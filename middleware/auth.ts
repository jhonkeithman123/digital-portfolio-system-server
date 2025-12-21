import jwt from "jsonwebtoken";
import { extractToken } from "../utils/authCookies";
import type { Request, Response, NextFunction } from "express";
import type { TokenPayload } from "../config/helpers/generateToken";

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const token = extractToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res
      .status(500)
      .json({ success: false, message: "Server misconfigured" });
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    (req as AuthRequest).user = decoded;
    next();
  } catch (err) {
    const msg = (err as Error)?.message || "Invalid token";
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      error: msg,
    });
  }
};
