import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { z } from "zod";
import jwt from "jsonwebtoken";
import cors from "cors";
require("dotenv").config();

import { UserModel, TagModel, ContantModel, LinkModel } from "./database";
import authMiddleware, { addToBlacklist } from "./middleware";
import { hashContent } from "./utils";
const app = express();

const PORT = process.env.PORT;
const jwtsecret: string = (() => {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET");
  }

  return process.env.JWT_SECRET;
})();

const tokenBlacklist = new Set<string>();
const mongourl = process.env.MONGOURL!;
mongoose
  .connect(mongourl)
  .then(() => console.log("Connected to MongoDB!"))
  .catch((err) => console.error(err));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

//password hashing function
const saltRounds = 16; // Increasing this improves security but slows hashing
const password = "user_password";

async function hashPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, saltRounds);

  return hash;
}

//zod validation schema
const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});
const signInSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password is wrong"),
});

//generate JWT token
function generateToken(userId: string): string {
  const payload = { id: userId };

  // Generate a token valid for 1 hour (3600 seconds)
  const token = jwt.sign(payload, jwtsecret, { expiresIn: "30min" });
  return token;
}

//SignUp routes
app.post("/api/v1/signup", async (req, res) => {
  const { name, username, password } = req.body;

  const validation = signUpSchema.safeParse({ name, username, password });
  if (!validation.success) {
    return res.status(400).json({
      error: validation.error.message,
      issues: validation.error.issues,
    });
  }
  // Check if user already exists
  const existingUser = await UserModel.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ error: "Username already exists" });
  }

  // Hash the password before saving
  const hashedPassword = await hashPassword(password);

  // Create a new user
  await UserModel.create({
    name: name,
    username: username,
    password: hashedPassword,
  });
  // Logic to handle user signup

  res.status(201).json({
    message: "User signed up successfully",
  });
});

//SignIn routes
app.post("/api/v1/signin", async (req, res) => {
  const { username, password } = req.body;
  console.log(req.body);

  const validation = signInSchema.safeParse({ username, password });
  if (!validation.success) {
    return res.status(400).json({
      error: validation.error.message,
      issues: validation.error.issues,
    });
  }
  // Find the user by username
  const user = await UserModel.find({ username });
  if (!user || user.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  // Compare the provided password with the stored hashed password
  const isPasswordValid = await bcrypt.compare(password, user[0].password);

  if (!isPasswordValid) {
    return res.status(401).json({ error: "Invalid password" });
  } else {
    const token = generateToken(user[0]._id.toString());

    res.status(200).json({
      name: user[0].name,
      username: user[0].username,
      token: token,
      message: "User signed in successfully",
    });
  }

  // Logic to handle user sign-in
});

//logout route
app.post("/api/v1/logout", authMiddleware, async (req, res) => {
  const token = req.headers.authorization;
  if (token) {
    addToBlacklist(token);
    console.log("Token blacklisted:", token);
  }
  res.status(200).json({ message: "Logged out successfully" });
});

//Add new content routes
app.post("/api/v1/content", authMiddleware, async (req, res) => {
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
app.get("/api/v1/content", authMiddleware, async (req, res) => {
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
app.delete("/api/v1/content/:contentId", authMiddleware, async (req, res) => {
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
app.post(
  "/api/v1/content/:contentId/share",
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
app.get("/api/v1/content/share/:hash", async (req, res) => {
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

//Get a sharable link by ID routes
app.post("/api/v1/brain/share", authMiddleware, async (req, res) => {
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
app.get("/api/v1/brain/:sharelink", async (req, res) => {
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

export default app;
