import express, { Response as ExpressResponse } from "express";
import { ContantModel, TagModel } from "../database";
import authMiddleware from "../middleware";
import { extractContent } from "../utils/extraction";
import { generateEmbedding } from "../utils/ai";
import { hashContent } from "../utils/helpers";
import { imageUpload, deleteFromCloudinary } from "../utils/cloudinary";
import { AuthenticatedRequest } from "../utils/types";
import multer from "multer";
import os from "os";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { NextFunction } from "express";

const router = express.Router();

const ContentSchema = z
  .object({
    link: z.string().optional(),
    contentType: z.enum(["youtube", "pdf", "doc", "image", "article"]),
    title: z.string().min(1, "Title is required"),
    tags: z.union([z.string(), z.array(z.string())]).transform((val) => {
      return typeof val === "string" ? [val] : val;
    }),
  })
  .refine(
    (data) => {
      if (data.contentType === "youtube" || data.contentType === "article") {
        return !!data.link;
      }
      return true;
    },
    {
      message: "Link is required for youtube/article content",
      path: ["link"],
    },
  );

const allowedExtensionsByType: Record<string, string[]> = {
  pdf: [".pdf"],
  doc: [".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"],
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"],
};

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + "-" + file.originalname);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    // The "file" field is appended after "contentType" in the frontend's
    // FormData, so req.body.contentType is already parsed by the time this
    // runs. Extension-based (not MIME-based) because browsers send
    // unreliable/generic MIME types for Office documents.
    const contentType = req.body?.contentType as string | undefined;
    const allowed = contentType && allowedExtensionsByType[contentType];
    if (allowed) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        const error: any = new Error(
          `File extension "${ext}" is not allowed for content type "${contentType}". Allowed: ${allowed.join(", ")}`,
        );
        error.statusCode = 400;
        return cb(error);
      }
    }
    cb(null, true);
  },
});

router.post(
  "/",
  authMiddleware,
  upload.single("file"),
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse,
    next: NextFunction,
  ) => {
    try {
      const validatedData = ContentSchema.parse(req.body);
      const { link, contentType, title, tags } = validatedData;
      const file = req.file;

      if (contentType !== "youtube" && contentType !== "article" && !file) {
        res
          .status(400)
          .json({ error: "File is required for this content type" });
        return;
      }

      let text = "";
      let uploadResult = null;

      // Handle file upload first if file exists
      if (file) {
        try {
          uploadResult = await imageUpload(file, contentType);

          // Check if upload was successful
          if (!uploadResult || !uploadResult.secure_url) {
            return res.status(500).json({
              error:
                "Failed to upload file to Cloudinary. Please try again or use a smaller file.",
            });
          }
        } catch (uploadError: any) {
          console.error("Cloudinary upload error:", uploadError);
          return res.status(500).json({
            error:
              uploadError.message === "Request Timeout"
                ? "File upload timed out. Please try uploading a smaller file or try again later."
                : "Failed to upload file. Please try again.",
          });
        }

        // Extract text content from the file
        text = await extractContent(file, contentType);
      } else if (link) {
        // Extract text content from the link
        try {
          text = await extractContent(link, contentType);
        } catch (extractError: any) {
          return res.status(400).json({
            error:
              extractError.message ||
              "Failed to extract content from the provided link",
          });
        }
      }

      if (!text || text.trim().length === 0) {
        // YouTube (no captions / IP-blocked) and articles (paywalled,
        // bot-blocked, or JS-rendered pages we can't scrape) can
        // legitimately fail to yield text - save the link anyway rather
        // than blocking the user, just without AI search/chat support.
        if (contentType === "youtube" || contentType === "article") {
          console.warn(`Saving ${contentType} content without extracted text`);
          text = "";
        } else {
          return res.status(400).json({
            error:
              "Failed to extract text from content. The file might be empty, encrypted, or the format is not supported.",
          });
        }
      }

      let vectorDB: number[] = [];
      // Only generate embeddings if we have text content
      if (text && text.trim().length > 0) {
        try {
          vectorDB = await generateEmbedding(text);
        } catch (err) {
          console.error("Embedding generation failed:", err);
          return res.status(500).json({
            error: "Failed to generate AI embeddings for this content.",
          });
        }
      } else {
        console.warn("Skipping embedding generation for content without text");
      }

      const newContent = await ContantModel.create({
        link: link || uploadResult?.secure_url,
        contentType,
        title,
        vectorDB,
        transcription: text || "",
        userId: req.userId,
        filePublicId: uploadResult?.public_id,
      });

      for (const tag of tags) {
        const normalizedName = String(tag).toLowerCase().trim();
        await TagModel.findOneAndUpdate(
          { name: normalizedName, userId: req.userId },
          { $addToSet: { contentId: newContent._id } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      }

      res.status(201).json({
        data: newContent,
        message: "Content added successfully",
        warning:
          !text || text.trim().length === 0
            ? contentType === "youtube"
              ? "YouTube transcript unavailable. This may be due to: (1) Video has no captions, (2) IP blocking on cloud hosting (Render/AWS/etc). Video saved but won't be searchable via AI. For production deployments, consider using a proxy service to bypass IP restrictions. See README for details."
              : contentType === "article"
                ? "Couldn't extract readable text from this article (it may be paywalled, bot-protected, or require JavaScript). Link saved but won't be searchable via AI."
                : undefined
            : undefined,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.issues });
      } else {
        next(error);
      }
    } finally {
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting temp file:", err);
        });
      }
    }
  },
);

router.get(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(String(req.query.limit ?? "100"), 10) || 100),
    );
    const skip = (page - 1) * limit;

    const [contents, total] = await Promise.all([
      ContantModel.find({ userId: req.userId })
        .populate("userId", "username")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ContantModel.countDocuments({ userId: req.userId }),
    ]);

    const tags = await TagModel.find({ userId: req.userId });

    res.status(200).json({
      contents,
      tags,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + contents.length < total,
      },
      message: "Content fetched successfully",
    });
  },
);

router.get(
  "/:contentId",
  authMiddleware,
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    const contentId = req.params.contentId;
    if (!contentId) {
      return res.status(400).json({ error: "Content ID is required" });
    }
    try {
      const content = await ContantModel.findOne({
        _id: contentId,
        userId: req.userId,
      });
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }
      res.status(200).json({
        content,
        message: "Content fetched successfully",
      });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.delete(
  "/:contentId",
  authMiddleware,
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    const contentId = req.params.contentId;
    if (!contentId) {
      return res.status(400).json({ error: "Content ID is required" });
    }
    try {
      const content = await ContantModel.findOne({
        _id: contentId,
        userId: req.userId,
      });

      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }

      if (content.filePublicId) {
        await deleteFromCloudinary(content.filePublicId);
      }

      await ContantModel.findOneAndDelete({
        _id: contentId,
        userId: req.userId,
      });

      await TagModel.updateMany(
        {
          contentId: content._id,
        },
        { $pull: { contentId: contentId } },
      );

      res.status(200).json({
        message: "Content deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post(
  "/:contentId/share",
  authMiddleware,
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    const contentId = req.params.contentId;
    if (!contentId) {
      return res.status(400).json({ error: "Content ID is required" });
    }

    try {
      const content = await ContantModel.findOne({
        _id: contentId,
        userId: req.userId,
      });

      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }

      const shareHash = hashContent(8);

      await ContantModel.findByIdAndUpdate(contentId, {
        shareHash: shareHash,
      });

      res.status(200).json({
        hash: shareHash,
        message: "Content shared successfully",
      });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.get("/share/:hash", async (req, res) => {
  const { hash } = req.params;

  try {
    const content = await ContantModel.findOne({ shareHash: hash }).select(
      "title link contentType createdAt",
    );

    if (!content) {
      return res.status(404).json({ error: "Shared content not found" });
    }

    res.status(200).json({
      content: content,
      message: "Shared content retrieved successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
