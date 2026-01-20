import express from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { UserModel } from "../database";
import authMiddleware, { addToBlacklist } from "../middleware";

const router = express.Router();

const jwtsecret: string = (() => {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET");
  }

  return process.env.JWT_SECRET;
})();

const saltRounds = 16;

async function hashPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, saltRounds);

  return hash;
}

const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});
const signInSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password is wrong"),
});

function generateToken(userId: string): string {
  const payload = { id: userId };

  const token = jwt.sign(payload, jwtsecret, { expiresIn: "30min" });
  return token;
}

router.post("/signup", async (req, res) => {
  const { name, username, password } = req.body;

  const validation = signUpSchema.safeParse({ name, username, password });
  if (!validation.success) {
    return res.status(400).json({
      error: validation.error.message,
      issues: validation.error.issues,
    });
  }
  const existingUser = await UserModel.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ error: "Username already exists" });
  }

  const hashedPassword = await hashPassword(password);

  await UserModel.create({
    name: name,
    username: username,
    password: hashedPassword,
  });

  res.status(201).json({
    message: "User signed up successfully",
  });
});

router.post("/signin", async (req, res) => {
  const { username, password } = req.body;
  console.log(req.body);

  const validation = signInSchema.safeParse({ username, password });
  if (!validation.success) {
    return res.status(400).json({
      error: validation.error.message,
      issues: validation.error.issues,
    });
  }
  const user = await UserModel.find({ username });
  if (!user || user.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }
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
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  bio: z.string().optional(),
  profilePicture: z.string().url().optional(),
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const user = await UserModel.findById(userId).select("-password -__v");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ user });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

import multer from "multer";
import os from "os";
import fs from "fs";
import { imageUpload } from "../utils/cloudinary";

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + "-" + file.originalname);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.put(
  "/update",
  authMiddleware,
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { username, email, bio } = req.body;
      let { profilePicture } = req.body;

      const file = req.file;
      if (file) {
        try {
          const uploadResult = await imageUpload(file, "image");
          if (uploadResult && uploadResult.secure_url) {
            profilePicture = uploadResult.secure_url;
          }
        } catch (uploadError) {
          console.error("Cloudinary upload failed:", uploadError);
          return res.status(500).json({ error: "Failed to upload image" });
        } finally {
          if (file.path) {
            fs.unlink(file.path, (err) => {
              if (err) console.error("Error deleting temp file:", err);
            });
          }
        }
      }

      const validation = updateProfileSchema.safeParse({
        username,
        email,
        bio,
        profilePicture,
      });

      if (!validation.success) {
        return res.status(400).json({
          error: validation.error.message,
          issues: validation.error.issues,
        });
      }

      if (email) {
        const existingUser = await UserModel.findOne({
          email,
          _id: { $ne: userId },
        });
        if (existingUser) {
          return res.status(400).json({ error: "Email already in use" });
        }
      }

      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { $set: { username, email, bio, profilePicture } },
        { new: true, runValidators: true },
      ).select("-password -_id -__v");

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json({
        message: "Profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post("/logout", authMiddleware, async (req, res) => {
  const token = req.headers.authorization;
  if (token) {
    addToBlacklist(token);
    console.log("Token blacklisted:", token);
  }
  res.status(200).json({ message: "Logged out successfully" });
});

router.post("/reset-password", async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({ error: "fill the required fields" });
    }
    const user = await UserModel.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await UserModel.updateOne({ _id: user._id }, { password: hashedPassword });
    return res.status(200).json({ message: "Password updated" });
  } catch (error) {
    console.log("error during password reset", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
