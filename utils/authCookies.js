import dotenv from "dotenv";
dotenv.config();

export const AUTH_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "_HOST-token" : "token";
export const isProd = process.env.NODE_ENV === "production";

const baseSameSite = isProd ? "none" : "lax";
const baseSecure = isProd;

const baseCookieOptions = {
  httpOnly: true,
  secure: baseSecure,
  sameSite: baseSameSite,
  path: "/",
};

function _isCrossSite(reqOrRes) {
  // try to read Origin header from request (res.req exists in Express)
  const headers = (reqOrRes && reqOrRes.headers) || (reqOrRes && reqOrRes.req && reqOrRes.req.headers) || {};
  return !!(headers && headers.origin);
}

export function setAuthCookie(res, token, maxAgeMs = 2 * 60 * 60 * 1000) {
  const cross = _isCrossSite(res);
  const opts = {
    ...baseCookieOptions,
    maxAge: maxAgeMs,
    sameSite: cross ? "none" : baseCookieOptions.sameSite,
    secure: cross ? true : baseCookieOptions.secure,
  };

  if (!isProd) {
    console.info("[AUTH COOKIE] set", { name: AUTH_COOKIE_NAME, sameSite: opts.sameSite, secure: opts.secure });
  }

  res.cookie(AUTH_COOKIE_NAME, token, opts);
}

export function clearAuthCookie(res) {
  const cross = _isCrossSite(res);
  const opts = {
    ...baseCookieOptions,
    sameSite: cross ? "none" : baseCookieOptions.sameSite,
    secure: cross ? true : baseCookieOptions.secure,
  };

  if (!isProd) {
    console.info("[AUTH COOKIE] clear", { name: AUTH_COOKIE_NAME, sameSite: opts.sameSite, secure: opts.secure });
  }

  res.clearCookie(AUTH_COOKIE_NAME, opts);
}

export function extractToken(req) {
  return req.cookies?.[AUTH_COOKIE_NAME] || null;
}