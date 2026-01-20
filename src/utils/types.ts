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
