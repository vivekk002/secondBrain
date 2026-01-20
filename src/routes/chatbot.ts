import express, { Response } from "express";
import { z } from "zod";
import authMiddleware from "../middleware";
import { AuthenticatedRequest } from "../utils/types";
import { ContantModel } from "../database";
import { chatWithAI } from "../utils/ai";

const router = express.Router();

const ChatSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
  question: z.string().min(1, "Question is required"),
});

router.post(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { contentId, question } = ChatSchema.parse(req.body);

      const content = await ContantModel.findOne({
        _id: contentId,
        userId: req.userId,
      });

      if (!content) {
        return res
          .status(404)
          .json({ error: "Content not found or unauthorized" });
      }

      if (!content.transcription) {
        return res.status(400).json({
          error:
            "This content has no text to analyze. Please try another file.",
        });
      }

      const history = content.aiChat || [];

      const answer = await chatWithAI(
        content.transcription,
        history as any[],
        question,
      );

      await ContantModel.findByIdAndUpdate(contentId, {
        $push: {
          aiChat: {
            role: "user",
            content: question,
            timestamp: new Date(),
          },
        },
      });

      await ContantModel.findByIdAndUpdate(contentId, {
        $push: {
          aiChat: {
            role: "model",
            content: answer,
            timestamp: new Date(),
          },
        },
      });

      res.status(200).json({
        answer,
        message: "Response generated successfully",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues });
      }
      console.error("Chat Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
