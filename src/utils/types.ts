import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export interface TranscriptItem {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

export interface AIChatMessage {
  role: "user" | "model";
  content: string;
  timestamp: Date;
}
