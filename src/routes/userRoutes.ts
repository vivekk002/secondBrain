import express from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { RefreshTokenModel, UserModel } from "../database";
import authMiddleware, { addToBlacklist } from "../middleware";
import { AuthenticatedRequest } from "../utils/types";
import fs from "fs";
import { imageUpload } from "../utils/cloudinary";
import { verifyRefreshToken } from "../utils/generateToken";
import { issueTokenPair, hashToken, clearRefreshCookie } from "../utils/session";
import { changePasswordSchema, signInSchema, signUpSchema, updateProfileSchema } from "../utils/zodSchema";
import { uploadToMulter } from "../utils/multer";


const router = express.Router();

// Throttle credential-guessing endpoints. Keyed by IP; each failed or
// successful attempt still counts, so this also caps brute-force speed.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});



const saltRounds = 12;

async function hashPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, saltRounds);

  return hash;
}







router.post("/signup", authLimiter, async (req, res) => {
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

router.post("/signin", authLimiter, async (req, res) => {
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
    const accessToken = await issueTokenPair(res, user[0]._id.toString());

    res.status(200).json({
      name: user[0].name,
      username: user[0].username,
      token: accessToken,
      message: "User signed in successfully",
    });
  }
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refreshtoken;
  if (!token) {
    return res.status(401).json({ error: "Refresh token missing" });
  }

  let decoded: { sub: string };
  try {
    decoded = verifyRefreshToken(token);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  const storedToken = await RefreshTokenModel.findOne({ tokenHash: hashToken(token) });

  if (!storedToken || storedToken.revoked) {
    // Either this token was never issued, or it's already been rotated
    // away and is being reused - treat both as theft and kill every
    // session for this user rather than trusting the token further.
    await RefreshTokenModel.updateMany({ userId: decoded.sub }, { revoked: true });
    return res.status(401).json({ error: "Refresh token reuse detected" });
  }

  storedToken.revoked = true;
  await storedToken.save();

  const accessToken = await issueTokenPair(res, decoded.sub);

  res.status(200).json({ token: accessToken });
});



router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
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





router.put(
  "/update",
  authMiddleware,
  uploadToMulter.single("profilePicture"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.userId;
      const { name, email, bio } = req.body;
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
        name,
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
        { $set: { name, email, bio, profilePicture } },
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
    await addToBlacklist(token);
  }

  const refreshToken = req.cookies?.refreshtoken;
  if (refreshToken) {
    await RefreshTokenModel.updateOne(
      { tokenHash: hashToken(refreshToken) },
      { revoked: true },
    );
  }
  clearRefreshCookie(res);

  res.status(200).json({ message: "Logged out successfully" });
});


// Requires an authenticated session and proof of the current password.
// A true pre-auth "forgot password" flow needs email/SMS verification
// infrastructure this project doesn't have yet; exposing an unauthenticated
// reset keyed only on username would let anyone take over any account.
router.post(
  "/change-password",
  authLimiter,
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const validation = changePasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: validation.error.message,
          issues: validation.error.issues,
        });
      }
      const { currentPassword, newPassword } = validation.data;

      const user = await UserModel.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const hashedPassword = await hashPassword(newPassword);
      await UserModel.updateOne(
        { _id: user._id },
        { password: hashedPassword },
      );
      return res.status(200).json({ message: "Password updated" });
    } catch (error) {
      console.log("error during password change", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
