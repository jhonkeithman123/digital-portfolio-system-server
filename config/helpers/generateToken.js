import jwt from "jsonwebtoken";

/**
 * Generates a JWT token and expiration timestamp.
 * @param {Object} payload - Data to encode in the token (e.g., user ID and role).
 * @param {string} [expiresIn="2h"] - Token expiration duration (e.g., "2h", "1d").
 * @returns {{ token: string, expiresAt: Date }}
 */
export function generateToken(payload, expiresIn = "2h") {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set in environment");
  }
  const expiresAt = new Date(Date.now() + parseDurationToMs(expiresIn));
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  return { token, expiresAt };
}

// * helper to convert "2h" or "1d" to milliseconds
function parseDurationToMs(duration) {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error("Invalid duration format");
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}
