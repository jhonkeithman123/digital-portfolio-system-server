import jwt from "jsonwebtoken";
import { extractToken } from "../utils/authCookies.js";

export const verifyToken = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  if (!process.env.JWT_SECRET) {
    return res
      .status(500)
      .json({ success: false, message: "Server misconfigured" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};
