import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  // Treat undefined/null/empty as missing
  const token =
    bearer && bearer !== "undefined" && bearer !== "null" ? bearer : null;

  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Missing or malformed token. Authorization:", authHeader);
    }
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set");
    return res
      .status(500)
      .json({ success: false, message: "Server misconfigured" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, ... }
    next();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Token verify failed:", err?.name || err?.message);
    }
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};
