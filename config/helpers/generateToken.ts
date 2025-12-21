import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  username?: string;
  section?: string | null;
  iat?: number;
  exp?: number;
}

export interface GeneratedToken {
  token: string;
  expiresAt: Date;
}

// * helper to convert "2h" / "30m" / "1d" into milliseconds
function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error("Invalid duration format");
  const value = parseInt(match[1], 10);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const multipliers: Record<typeof unit, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}

/**
 * Generates a JWT token and expiration timestamp.
 */
export function generateToken(
  payload: TokenPayload,
  expiresIn: SignOptions["expiresIn"] = "2h"
): GeneratedToken {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set in environment");

  const options: SignOptions = { expiresIn };
  const expiresAt = new Date(Date.now() + parseDurationToMs(String(expiresIn)));

  const token = jwt.sign(payload, secret as Secret, options);
  return { token, expiresAt };
}
