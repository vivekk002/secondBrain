import express from "express";
import mongoose from "mongoose";
import cors from "cors";
require("dotenv").config();

import userRoutes from "./routes/userRoutes";
import contentRoutes from "./routes/contentRoutes";
import brainRoutes from "./routes/brainRoutes";

const app = express();

const PORT = process.env.PORT;
const mongourl = process.env.MONGOURL!;
mongoose
  .connect(mongourl)
  .then(() => console.log("Connected to MongoDB!"))
  .catch((err) => console.error(err));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import { errorHandler } from "./middleware/error";

import chatbotRoutes from "./routes/chatbot";
import searchRoutes from "./routes/searchRoutes";

app.use("/api/v1", userRoutes);
app.use("/api/v1/content", contentRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/brain", brainRoutes);
app.use("/api/v1/chat", chatbotRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
