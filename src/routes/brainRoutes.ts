import express from "express";
import { LinkModel, ContantModel, UserModel } from "../database";
import authMiddleware from "../middleware";
import { hashContent } from "../utils";

const router = express.Router();

//Get a sharable link by ID routes
router.post("/share", authMiddleware, async (req, res) => {
    const { share } = req.body;

    if (share) {
        //@ts-ignore
        const existingLink = await LinkModel.findOne({ userId: req.userId });
        if (existingLink) {
            const hash = existingLink.hash;
            return res.status(200).json({
                message: "Sharable link already exists",
                shareLink: `http://localhost:3000/api/v1/brain/${hash}`,
            });
        } else {
            const hash = hashContent(10);
            const newLink = await LinkModel.create({
                hash,
                //@ts-ignore
                userId: req.userId,
            });

            return res.status(200).json({
                message: "Sharable link created successfully",
                shareLink: `http://localhost:3000/api/v1/brain/${hash}`,
            });
        }
    } else {
        //@ts-ignore
        await LinkModel.deleteOne({ userId: req.userId });

        return res.status(200).json({
            message: "Sharable link removed successfully",
            shareLink: null,
        });
    }
});

//Get sharable links routes
router.get("/:sharelink", async (req, res) => {
    const { sharelink } = req.params;
    console.log("Received sharelink:", sharelink);

    if (!sharelink) {
        return res.status(400).json({ error: "Sharable link is required" });
    }
    const Link = await LinkModel.findOne({ hash: sharelink });
    if (!Link) {
        return res
            .status(404)
            .json({ error: "either the link not exit or it's incorrect" });
    }
    const contents = await ContantModel.find({ userId: Link.userId });
    const user = await UserModel.findOne({ _id: Link.userId });
    res.status(200).json({
        name: user?.name,
        contents,
        message: "Sharable link contents fetched successfully",
    });
});

export default router;
