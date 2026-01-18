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

  // Generate a token valid for 1 hour (3600 seconds)
  const token = jwt.sign(payload, jwtsecret, { expiresIn: "30min" });
  return token;
}

//SignUp routes
router.post("/signup", async (req, res) => {
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
