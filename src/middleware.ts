import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = "vivek054054"; // Ideally, this should be stored in an environment variable

// Token blacklist (in a real app, this should be in Redis or database)
let tokenBlacklist: Set<string> = new Set();

// Function to add token to blacklist
export const addToBlacklist = (token: string) => {
  tokenBlacklist.add(token);
};

// Function to check if token is blacklisted
export const isTokenBlacklisted = (token: string): boolean => {
  return tokenBlacklist.has(token);
};

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers["authorization"];
  if (!header) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = header as string;

  // Check if token is blacklisted
  if (isTokenBlacklisted(token)) {
    return res.status(401).json({ error: "Token has been invalidated" });
  }

  try {
    const validToken = jwt.verify(token, JWT_SECRET) as {
      id: string;
    };
    // Attach the user id to request object
    (req as any).userId = validToken.id;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

export default authMiddleware;
