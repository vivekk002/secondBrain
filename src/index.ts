import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { z } from "zod";
import jwt from "jsonwebtoken";

require("dotenv").config();
import { UserModel, TagModel, ContantModel, LinkModel } from "./database";
import middleware from "./middleware";
const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = "vivek054054"; // Ideally, this should be stored in an environment variable

mongoose
  .connect(
    "mongodb+srv://vivek054:vivek054054@cluster0.hyhgqop.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(() => console.log("Connected to MongoDB!"))
  .catch((err) => console.error(err));

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
const userSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

//generate JWT token
function generateToken(userId: string): string {
  // You can include other claims in the payload as needed
  const payload = { id: userId };

  // Generate a token valid for 1 hour (3600 seconds)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
  return token;
}

//SignUp routes
app.post("/api/v1/signup", async (req, res) => {
  const { username, password } = req.body;

  const validation = userSchema.safeParse({ username, password });
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
  const hashedPassword = await hashPassword(password); // Ideally, you should hash the password before saving

  // Create a new user
  await UserModel.create({ username: username, password: hashedPassword });
  // Logic to handle user signup

  res.status(201).json({
    data: { username, password: hashedPassword },
    message: "User signed up successfully",
  });

  console.log("User signed up:", username);
  console.log("Hashed password:", hashedPassword);
});

//SignIn routes
app.post("/api/v1/signin", async (req, res) => {
  const { username, password } = req.body;
  const validation = userSchema.safeParse({ username, password });
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
    console.log("Generated JWT Token:", token);
  }

  // Logic to handle user sign-in
  res.status(200).json({
    data: { username: user[0].username },
    message: "User signed in successfully",
  });
  console.log("User signed in:", user[0].username);
});

//Add new content routes
app.post("/api/v1/content", middleware, async (req, res) => {
  const { link, type, title } = req.body;

  // Create a new content entry
  const newContent = await ContantModel.create({
    link,
    type,
    title,
    //@ts-ignore
    userId: req.userId,
    tags: [], // Assuming req.userId is set by middleware
    // Assuming req.userId is set by middleware
  });

  console.log("New content added:", newContent);
  res.status(201).json({
    data: newContent,
    message: "Content added successfully",
  });
});

//Get all content routes
app.get("/api/v1/content", middleware, async (req, res) => {
  // Logic to handle fetching all content
  //@ts-ignore
  const contents = await ContantModel.find({ userId: req.userId }).populate(
    "userId",
    "username"
  );
  res.status(200).json({
    data: contents,
    message: "Content fetched successfully",
  });
});

//Delete content by ID routes
app.delete("/api/v1/content/:contentId", middleware, async (req, res) => {
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
  } catch (error) {
    console.error("Error deleting content:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
  res.status(200).json({
    message: "Content deleted successfully",
  });
  console.log("Content deleted:", contentId);
});

//Get a sharable link by ID routes
app.get("/api/v1/brain/share", async (req, res) => {});

//Get sharable links routes
app.get("/api/v1/brain/:sharelink", async (req, res) => {});

export default app;
