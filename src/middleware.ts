import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = "vivek054054"; // Ideally, this should be stored in an environment variable

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Middleware logic can be added here
  const header = req.headers["authorization"];
  if (!header) {
    return res.status(401).json({ error: "Authorization header missing" });
  }
  // Assuming the format
  try {
    const validToken = jwt.verify(header as string, JWT_SECRET) as {
      id: string;
    };
    // Attach the user id to request object (make sure type declaration exists)
    (req as any).userId = validToken.id;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

export default authMiddleware;
