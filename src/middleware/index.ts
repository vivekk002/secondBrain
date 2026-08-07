import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { BlacklistedTokenModel } from "../database";
import { AuthenticatedRequest } from "../utils/types";

const jwtsecret: string = (() => {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("Missing JWT_ACCESS_SECRET");
  }

  return process.env.JWT_ACCESS_SECRET;
})();

// Persisted in Mongo (with a TTL index) rather than an in-memory Set so
// logout survives server restarts and works across multiple instances.
export const addToBlacklist = async (token: string): Promise<void> => {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 30 * 60 * 1000);

  try {
    await BlacklistedTokenModel.updateOne(
      { token },
      { $setOnInsert: { token, expiresAt } },
      { upsert: true },
    );
  } catch (err) {
    console.error("Failed to persist blacklisted token:", err);
  }
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const found = await BlacklistedTokenModel.findOne({ token })
    .select("_id")
    .lean();
  return !!found;
};

const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const header = req.headers["authorization"];
  if (!header) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = header as string;

  try {
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ error: "Token has been invalidated" });
    }

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
