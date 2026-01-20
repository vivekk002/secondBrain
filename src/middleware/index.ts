import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";

const jwtsecret: string = (() => {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET");
  }

  return process.env.JWT_SECRET;
})();

let tokenBlacklist: Set<string> = new Set();

export const addToBlacklist = (token: string) => {
  tokenBlacklist.add(token);
};

export const isTokenBlacklisted = (token: string): boolean => {
  return tokenBlacklist.has(token);
};

import { AuthenticatedRequest } from "../utils/types";

const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const header = req.headers["authorization"];
  if (!header) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = header as string;

  if (isTokenBlacklisted(token)) {
    return res.status(401).json({ error: "Token has been invalidated" });
  }

  try {
    const validToken = jwt.verify(token, jwtsecret) as {
      id: string;
    };
    req.userId = validToken.id;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

export default authMiddleware;
