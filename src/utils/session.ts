import { Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { RefreshTokenModel } from "../database";
import { generateAccessToken, generateRefreshToken } from "./generateToken";

const REFRESH_COOKIE_NAME = "refreshtoken";
const REFRESH_COOKIE_PATH = "/api/v1/";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Generates a new access+refresh pair, persists the refresh token's hash,
// and sets the refresh cookie on the response. Returns the access token
// to send back in the JSON body. Used by both /signin and /refresh so
// token issuance only happens in one place.
export async function issueTokenPair(res: Response, userId: string): Promise<string> {
  const refreshToken = generateRefreshToken(userId);
  const accessToken = generateAccessToken(userId);

  const decoded = jwt.decode(refreshToken) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000);

  await RefreshTokenModel.create({
    tokenHash: hashToken(refreshToken),
    expiresAt,
    userId,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: expiresAt.getTime() - Date.now(),
    path: REFRESH_COOKIE_PATH,
  });

  return accessToken;
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}
