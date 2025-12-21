import dotenv from "dotenv";
import type { Request, Response, CookieOptions } from "express";

dotenv.config();

export const AUTH_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "_HOST-token" : "token";
export const isProd = process.env.NODE_ENV === "production";

const baseSameSite: "none" | "lax" = isProd ? "none" : "lax";
const baseSecure: boolean = isProd;

interface BaseCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "none" | "lax";
  path: string;
}

const baseCookieOptions: BaseCookieOptions = {
  httpOnly: true,
  secure: baseSecure,
  sameSite: baseSameSite,
  path: "/",
};

function _isCrossSite(reqOrRes: Request | Response): boolean {
  // try to read Origin header from request (res.req exists in Express)
  const headers =
    (reqOrRes as Request).headers ||
    ((reqOrRes as Response).req && (reqOrRes as Response).req.headers) ||
    {};
  return !!headers.origin;
}

export function setAuthCookie(
  res: Response,
  token: string,
  maxAgeMs: number = 2 * 60 * 60 * 1000
): void {
  const cross = _isCrossSite(res);
  const opts: CookieOptions = {
    ...baseCookieOptions,
    maxAge: maxAgeMs,
    sameSite: cross ? "none" : baseCookieOptions.sameSite,
    secure: cross ? true : baseCookieOptions.secure,
  };

  if (!isProd) {
    console.info("[AUTH COOKIE] set", {
      name: AUTH_COOKIE_NAME,
      sameSite: opts.sameSite,
      secure: opts.secure,
    });
  }

  res.cookie(AUTH_COOKIE_NAME, token, opts);
}

export function clearAuthCookie(res: Response): void {
  const cross = _isCrossSite(res);
  const opts: CookieOptions = {
    ...baseCookieOptions,
    sameSite: cross ? "none" : baseCookieOptions.sameSite,
    secure: cross ? true : baseCookieOptions.secure,
  };

  if (!isProd) {
    console.info("[AUTH COOKIE] clear", {
      name: AUTH_COOKIE_NAME,
      sameSite: opts.sameSite,
      secure: opts.secure,
    });
  }

  res.clearCookie(AUTH_COOKIE_NAME, opts);
}

export function extractToken(req: Request): string | null {
  return req.cookies?.[AUTH_COOKIE_NAME] || null;
}
