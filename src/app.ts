import express from "express";
import cors from "cors";

import userRoutes from "./routes/userRoutes";
import contentRoutes from "./routes/contentRoutes";
import brainRoutes from "./routes/brainRoutes";
import chatbotRoutes from "./routes/chatbot";
import searchRoutes from "./routes/searchRoutes";
import { errorHandler } from "./middleware/error";
import cookieParser from "cookie-parser";

// Express app wiring, separated from index.ts's process bootstrap (DB
// connection + listen()) so tests can import this directly with supertest
// without binding a real port or requiring a live Mongo connection string.
const app = express();

// Restrict which origins can call the API with credentials. Defaults to the
// Vite dev server so local development keeps working out of the box; set
// FRONTEND_URL (comma-separated for multiple origins) in production.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser())

app.use("/api/v1", userRoutes);
app.use("/api/v1/content", contentRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/brain", brainRoutes);
app.use("/api/v1/chat", chatbotRoutes);

app.use(errorHandler);

export default app;
