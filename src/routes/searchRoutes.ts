import express, { Response } from "express";
import { ContantModel } from "../database";
import authMiddleware from "../middleware";
import { generateEmbedding } from "../utils/ai";
import { AuthenticatedRequest } from "../utils/types";

const router = express.Router();

// Cosine similarity function
function cosineSimilarity(vecA: number[], vecB: number[]) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

router.post(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== "string" || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      // 1. Generate Embedding for the query
      let queryEmbedding: number[] = [];
      try {
        queryEmbedding = await generateEmbedding(query);
      } catch (e) {
        console.error("Failed to generate query embedding", e);
        // Fallback: Proceed with just text search if embedding fails
      }

      // 2. Fetch all user content
      // Note: optimization would be to use a real vector DB or aggregation pipeline
      // For small-medium scale (personal second brain), in-memory comparison is acceptable
      const allContent = await ContantModel.find({
        userId: req.userId,
      });

      // 3. Score Content
      const results = allContent
        .map((content) => {
          let score = 0;
          let matchType = "none";

          // Vector Similarity
          if (
            queryEmbedding.length > 0 &&
            content.vectorDB &&
            content.vectorDB.length > 0
          ) {
            const similarity = cosineSimilarity(
              queryEmbedding,
              content.vectorDB,
            );
            score += similarity * 0.7;
            if (similarity > 0.45) matchType = "semantic";
          }

          // Keyword Match
          const lowerQuery = query.toLowerCase();
          const lowerTitle = content.title.toLowerCase();

          if (lowerTitle.includes(lowerQuery)) {
            score += 0.3;
            if (score < 0.3) matchType = "keyword";
            if (lowerTitle === lowerQuery) score += 0.2;
          }

          return {
            ...content.toObject(),
            score,
            matchType,
          };
        })
        .filter((item) => item.score > 0.25)
        .sort((a, b) => b.score - a.score);

      res.status(200).json({
        results,
        count: results.length,
        message: "Search completed successfully",
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Internal server error during search" });
    }
  },
);

export default router;
