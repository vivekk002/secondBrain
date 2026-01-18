import express from "express";
import { ContantModel, TagModel } from "../database";
import authMiddleware from "../middleware";
import { hashContent } from "../utils";

const router = express.Router();

//Add new content routes
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { link, contentType, title, tags } = req.body;

        // Validate required fields
        if (!link || !contentType || !title || !tags) {
            return res.status(400).json({
                error:
                    "Missing required fields: link, contentType, and title are required",
            });
        }

        // Create a new content entry
        const newContent = await ContantModel.create({
            link,
            contentType,
            title,
            //@ts-ignore
            userId: req.userId,
        });

        for (const tag of tags) {
            const normalizedName = String(tag).toLowerCase().trim();
            await TagModel.findOneAndUpdate(
                { name: normalizedName },
                { $addToSet: { contentId: newContent._id } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        res.status(201).json({
            data: newContent,
            message: "Content added successfully",
        });
    } catch (error: any) {
        console.error("Error adding content:", error.errorResponse.errmsg);
        res.status(500).json({
            error: error,
        });
    }
});

//Get all content routes
router.get("/", authMiddleware, async (req, res) => {
    //
    //@ts-ignore
    const contents = await ContantModel.find({ userId: req.userId }).populate(
        "userId",
        "username"
    );

    const tags = await TagModel.find();

    res.status(200).json({
        contents,
        tags,
        message: "Content fetched successfully",
    });
});

//Delete content by ID routes
router.delete("/:contentId", authMiddleware, async (req, res) => {
    const contentId = req.params.contentId;
    if (!contentId) {
        return res.status(400).json({ error: "Content ID is required" });
    }
    try {
        const content = await ContantModel.findOneAndDelete({
            _id: contentId,
            //@ts-ignore
            userId: req.userId,
        });
        await TagModel.updateMany(
            {
                contentId: content?._id,
            },
            { $pull: { contentId: contentId } }
        );

        if (!content) {
            return res.status(404).json({ error: "Content not found" });
        }

        res.status(200).json({
            message: "Content deleted successfully",
        });
        console.log("Content deleted:", contentId);
    } catch (error) {
        console.error("Error deleting content:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

//Share individual content route
router.post(
    "/:contentId/share",
    authMiddleware,
    async (req, res) => {
        const contentId = req.params.contentId;
        if (!contentId) {
            return res.status(400).json({ error: "Content ID is required" });
        }

        try {
            const content = await ContantModel.findOne({
                _id: contentId,
                //@ts-ignore
                userId: req.userId,
            });

            if (!content) {
                return res.status(404).json({ error: "Content not found" });
            }

            // Generate a unique share link for this content
            const shareHash = hashContent(8);
            const shareLink = `http://localhost:3000/api/v1/content/share/${shareHash}`;

            // Store the share link in the content
            await ContantModel.findByIdAndUpdate(contentId, {
                shareLink: shareLink,
                shareHash: shareHash,
            });

            res.status(200).json({
                shareLink: shareLink,
                message: "Content shared successfully",
            });
        } catch (error) {
            console.error("Error sharing content:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
);

//Get shared content by hash
router.get("/share/:hash", async (req, res) => {
    const { hash } = req.params;

    try {
        const content = await ContantModel.findOne({ shareHash: hash });

        if (!content) {
            return res.status(404).json({ error: "Shared content not found" });
        }

        res.status(200).json({
            content: content,
            message: "Shared content retrieved successfully",
        });
    } catch (error) {
        console.error("Error retrieving shared content:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
