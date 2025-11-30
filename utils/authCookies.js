import dotenv from "dotenv";
dotenv.config();

export const AUTH_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "_HOST-token" : "token";
export const isProd = process.env.NODE_ENV === "production";

const sameSiteMode = isProd ? "none" : "lax";
const secureFlag = isProd;

const baseCookieOptions = {
  httpOnly: true,
  secure: secureFlag,
  sameSite: sameSiteMode,
  path: "/",
};

export function setAuthCookie(res, token, maxAgeMs = 2 * 60 * 60 * 1000) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...baseCookieOptions,
    maxAge: maxAgeMs,
  });
}

export function clearAuthCookie(res) {
  // keep same options used to set the cookie (esp. path/sameSite/secure)
  res.clearCookie(AUTH_COOKIE_NAME, { ...baseCookieOptions });
}

export function extractToken(req) {
  return req.cookies?.[AUTH_COOKIE_NAME] || null;
}
