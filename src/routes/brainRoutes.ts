import express, { Response as ExpressResponse } from "express";
import { LinkModel, ContantModel, UserModel } from "../database";
import authMiddleware from "../middleware";
import { hashContent } from "../utils";
import { AuthenticatedRequest } from "../utils/types";

const router = express.Router();

router.post(
  "/share",
  authMiddleware,
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    const { share } = req.body;

    if (share) {
      const existingLink = await LinkModel.findOne({ userId: req.userId });
      if (existingLink) {
        return res.status(200).json({
          message: "Sharable link already exists",
          hash: existingLink.hash,
        });
      } else {
        const hash = hashContent(10);
        await LinkModel.create({
          hash,
          userId: req.userId,
        });

        return res.status(200).json({
          message: "Sharable link created successfully",
          hash,
        });
      }
    } else {
      await LinkModel.deleteOne({ userId: req.userId });

      return res.status(200).json({
        message: "Sharable link removed successfully",
        hash: null,
      });
    }
  },
);

// Must be registered before GET /:sharelink, otherwise Express would match
// this path as a sharelink lookup with sharelink="share" (this was a
// pre-existing bug: the frontend's share-status check always 404'd).
router.get(
  "/share",
  authMiddleware,
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    const existingLink = await LinkModel.findOne({ userId: req.userId });
    res.status(200).json({
      isShared: !!existingLink,
      hash: existingLink?.hash || null,
    });
  },
);

router.get(
  "/:sharelink",
  async (req: AuthenticatedRequest, res: ExpressResponse) => {
    const { sharelink } = req.params;

    if (!sharelink) {
      return res.status(400).json({ error: "Sharable link is required" });
    }
    const Link = await LinkModel.findOne({ hash: sharelink });
    if (!Link) {
      return res
        .status(404)
        .json({ error: "either the link not exit or it's incorrect" });
    }
    const contents = await ContantModel.find({ userId: Link.userId }).select(
      "title link contentType createdAt",
    );
    const user = await UserModel.findOne({ _id: Link.userId });
    res.status(200).json({
      name: user?.name,
      contents,
      message: "Sharable link contents fetched successfully",
    });
  },
);

export default router;
