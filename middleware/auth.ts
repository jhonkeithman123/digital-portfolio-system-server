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

  console.log("[AUTH] verifyToken called", {
    path: req.path,
    cookies: req.cookies,
    authHeader: req.headers.authorization,
    tokenFound: !!token,
    tokenLength: token?.length,
  });

  if (!token) {
    console.warn(
      `[AUTH] verifyToken FAIL: No token ${new Date().toString()} ${
        req.method
      } ${req.originalUrl}`
    );
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[AUTH] verifyToken FAIL: JWT_SECRET not configured");
    return res
      .status(500)
      .json({ success: false, message: "Server misconfigured" });
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    (req as AuthRequest).user = decoded;
    console.info(
      `[AUTH] verifyToken OK: userId=${decoded.userId} ${req.method} ${req.originalUrl}`
    );

    next();
  } catch (err) {
    const msg = (err as Error)?.message || "Invalid token";
    console.warn(
      `[AUTH] verifyToken FAIL: ${msg} ${req.method} ${req.originalUrl}`,
      { tokenPreview: token?.substring(0, 20) }
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      error: msg,
    });
  }
};
