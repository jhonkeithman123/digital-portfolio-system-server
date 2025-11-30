import express from "express";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { setAuthCookie, clearAuthCookie } from "../utils/authCookies.js";
import wrapAsync from "../utils/wrapAsync.js";

import { verifyToken } from "../middleware/auth.js";
import { sendVerificationEmail } from "../config/sendVerificationEmail.js";
import {
  findOneUserBy,
  insertRecord,
  updateRecord,
} from "../config/helpers/dbHelper.js";
import { generateToken } from "../config/helpers/generateToken.js";
import { createSession } from "../config/helpers/createSession.js";
import {
  generateVerificationCode,
  isVerificationCodeValid,
} from "../config/helpers/verification.js";
import { queryAsync } from "../config/helpers/dbHelper.js";

dotenv.config();

const router = express.Router();

router.get(
  "/session",
  verifyToken,
  wrapAsync(async (req, res) => {
    console.info(`[AUTH] GET /session entered ${new Date().toISOString()} ip=${req.ip}`);
    const userId = req.user.id;
    console("User id:", userId);

    try {
      const user = await findOneUserBy("ID", userId, [
        "ID",
        "username",
        "email",
        "role",
        "section",
      ]);

      if (!user) {
        console.info("[AUTH] GET /session user not found", { userId });
        return res.status(404).json({ error: "User not found." });
      }

      console.info("[AUTH] GET /session responding", { userId });
      res.json({ success: true, user });
    } catch (err) {
      console.error("[AUTH] GET /session error:", err?.stack || err);
      return res.status(500).json({ error: "Internal server error." });
    }
  })
);

// Current user's profile (includes section)
router.get(
  "/me",
  verifyToken,
  wrapAsync(async (req, res) => {
    console.info(`[AUTH] GET /me entered ${new Date().toISOString()} ip=${req.ip}`);
    if (!req.dbAvailable) {
      console.info("[AUTH] GET /me DB unavailable");
      return res.status(503).json({ ok: false, error: "Database not available" });
    }

    try {
      const [user] = await queryAsync(
        "SELECT id, username AS name, email, role, section FROM users WHERE id = ?",
        [req.user.id]
      );
      if (!user) {
        console.info("[AUTH] GET /me not found", { userId: req.user.id });
        return res.status(404).json({ success: false, message: "Not found" });
      }
      console.info("[AUTH] GET /me responding", { userId: req.user.id });
      res.json({ success: true, user });
    } catch (e) {
      console.error("[AUTH] GET /me error:", e?.stack || e);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  })
);

// Student can set their section ONLY if it is currently NULL/empty
router.patch(
  "/me/section",
  verifyToken,
  wrapAsync(async (req, res) => {
    console.info(`[AUTH] PATCH /me/section entered ${new Date().toISOString()} ip=${req.ip}`);
    if (!req.dbAvailable) {
      console.info("[AUTH] PATCH /me/section DB unavailable");
      return res.status(503).json({ ok: false, error: "Database not available" });
    }

    try {
      if (req.user.role !== "student") {
        console.info("[AUTH] PATCH /me/section forbidden - not student", { role: req.user.role });
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      const section = (req.body?.section ?? "").toString().trim();
      if (!section) {
        console.info("[AUTH] PATCH /me/section bad request - missing section");
        return res.status(400).json({ success: false, message: "Section is required" });
      }
      const result = await queryAsync(
        "UPDATE users SET section = ? WHERE id = ? AND role = 'student' AND (section IS NULL OR section = '')",
        [section, req.user.id]
      );
      if (!result?.affectedRows) {
        console.info("[AUTH] PATCH /me/section no-op - already set", { userId: req.user.id });
        return res.json({ success: false, message: "Section already set" });
      }
      console.info("[AUTH] PATCH /me/section updated", { userId: req.user.id, section });
      res.json({ success: true, section });
    } catch (e) {
      console.error("[AUTH] PATCH /me/section error:", e?.stack || e);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  })
);

router.get("/ping", verifyToken, (req, res) => {
  if (!req.dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }
  
  return res.json({ success: true, userId: req.user.id });
});

router.post("/login", wrapAsync(async (req, res) => {
  console.info(`[AUTH] login entered ${new Date().toISOString()} ip=${req.ip} bodyPreview=${JSON.stringify({ email: req.body?.email, role: req.body?.role }).slice(0,300)}`);
  if (!req.dbAvailable) {
    console.info("[AUTH] DB unavailable - aborting login");
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  const { email, password, role: intendedRole } = req.body;
  const normEmail = (email || "").toLowerCase();

  try {
    console.info("[AUTH] findOneUserBy start", normEmail);
    const user = await findOneUserBy("email", normEmail);
    console.info("[AUTH] findOneUserBy done", !!user);

    if (!user) {
      console.info("[AUTH] user not found");
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== intendedRole) {
      console.info("[AUTH] role mismatch", { dbRole: user.role, intendedRole });
      return res.status(403).json({ error: `Access denied for ${intendedRole} portal` });
    }

    console.info("[AUTH] bcrypt.compare start");
    const match = await bcrypt.compare(password, user.password);
    console.info("[AUTH] bcrypt.compare done", { match });

    if (!match) return res.status(401).json({ error: "Invalid password" });

    console.info("[AUTH] generateToken start");
    const { token, expiresAt } = generateToken(
      { id: user.ID ?? user.id, role: user.role },
      "2h"
    );
    console.info("[AUTH] generateToken done", { tokenExists: !!token });

    // helper to fail DB session creation if it hangs
    const promiseWithTimeout = (p, ms, label) =>
      Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
      ]);

    console.info("[AUTH] createSession start");
    // 8s timeout for createSession (adjust as needed)
    await promiseWithTimeout(createSession(user.ID ?? user.id, token, expiresAt), 8000, "createSession");
    console.info("[AUTH] createSession done");

    setAuthCookie(res, token);
    console.info(`[AUTH] login responding ${new Date().toISOString()} ip=${req.ip}`);

    return res.json({
      success: true,
      user: {
        id: user.ID ?? user.id,
        name: user.username,
        role: user.role,
        email: user.email,
        section: user.section || null,
      },
    });
  } catch (error) {
    console.error("[AUTH] Login error:", error?.stack || error?.message || error);
    return res.status(500).json({ error: "Internal server error" });
  }
}));

// Logout: clear cookie (and let client clear local storage if it uses it)
router.post("/logout", (req, res) => {
  if (!req.dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }
  
  clearAuthCookie(res);
  return res.json({ success: true });
});

router.post("/signup", wrapAsync(async (req, res) => {
  console.info(`[AUTH] signup entered ${new Date().toISOString()} ip=${req.ip} bodyPreview=${JSON.stringify({ email: req.body?.email, name: req.body?.name, role: req.body?.role }).slice(0,300)}`);
  if (!req.dbAvailable) {
    console.info("[AUTH] DB unavailable - aborting signup");
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  const { username, email, password, role, section } = req.body || {};
  if (!username || !email || !password || !role) {
    console.info("[AUTH] signup validation failed - missing fields");
    return res.status(400).json({ error: "name, email, password and role are required." });
  }

  const normedEmail = (email || "").toLowerCase();
  const sectionVal = section ? section.trim() : null;

  try {
    console.info("[AUTH] signup - checking existing email/username");
    const existingEmail = await findOneUserBy("email", normedEmail);
    if (existingEmail) return res.status(409).json({ error: "Email already registered." });

    const existingUsername = await findOneUserBy("username", username);
    if (existingUsername) return res.status(409).json({ error: "Username already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertId = await insertRecord("users", {
      username: username,
      email: normedEmail,
      password: hashedPassword,
      role,
      section: sectionVal,
    });

    console.info("[AUTH] signup created user", { insertId, email: normedEmail });
    return res.json({ success: true, message: "Successfully created user.", id: insertId });
  } catch (error) {
    console.error("[AUTH] Signup Error:", error?.stack || error);
    return res.status(500).json({ error: "Internal Server Error." });
  }
}));

router.post(
  "/request-verification",
  wrapAsync(async (req, res) => {
    console.info(`[AUTH] request-verification entered ${new Date().toISOString()} ip=${req.ip} bodyPreview=${JSON.stringify({ email: req.body?.email, role: req.body?.role }).slice(0,200)}`);
    if (!req.dbAvailable) {
      console.info("[AUTH] request-verification DB unavailable");
      return res.status(503).json({ ok: false, error: "Database not available" });
    }

    const { email, role } = req.body;
    if (!email || !role) {
      console.info("[AUTH] request-verification bad request - missing fields");
      return res.status(400).json({ error: "Email and role are required." });
    }

    const normEmail = email.toLowerCase();

    try {
      const user = await findOneUserBy("email", normEmail);
      if (!user || user.role !== role) {
        console.warn(`[AUTH] request-verification user not found ${normEmail} role=${role}`);
        return res.status(404).json({ error: "User not found." });
      }

      const { code, expiry, formatted, shouldUpdate } = generateVerificationCode(user);

      if (shouldUpdate) {
        await updateRecord(
          "users",
          {
            verification_code: code,
            verification_expiry: expiry,
          },
          {
            email: normEmail,
          }
        );
        await sendVerificationEmail(normEmail, code, formatted);
        console.info(`[AUTH] request-verification email sent to ${normEmail}`);
        return res.json({
          success: true,
          message: "Verification code sent to your email.",
        });
      } else {
        console.info(`[AUTH] request-verification code active for ${normEmail} until ${formatted}`);
        return res.json({
          success: true,
          message: `A verification is already active. Please check your email. It expires at ${formatted}.`,
        });
      }
    } catch (error) {
      console.error("[AUTH] request-verification error:", error?.stack || error);
      return res.status(500).json({ error: "Internal server error" });
    }
  })
);

router.post(
  "/verify-code",
  wrapAsync(async (req, res) => {
    console.info(`[AUTH] verify-code entered ${new Date().toISOString()} ip=${req.ip} bodyPreview=${JSON.stringify({ email: req.body?.email }).slice(0,200)}`);
    if (!req.dbAvailable) {
      console.info("[AUTH] verify-code DB unavailable");
      return res.status(503).json({ ok: false, error: "Database not available" });
    }

    const { email, code } = req.body;
    const normEmail = (email || "").toLowerCase();

    try {
      const user = await findOneUserBy("email", normEmail);
      if (!user) {
        console.info("[AUTH] verify-code user not found", { email: normEmail });
        return res.status(404).json({ error: "User not found." });
      }

      if (!isVerificationCodeValid(user, code)) {
        console.info("[AUTH] verify-code invalid/expired", { email: normEmail });
        return res.status(400).json({ error: "Invalid or expired code." });
      }

      await updateRecord(
        "users",
        {
          is_verified: 1,
          verification_code: null,
          verification_expiry: null,
        },
        {
          email: normEmail,
        }
      );

      console.info("[AUTH] verify-code success", { email: normEmail });
      res.json({ success: true, message: "Email is verified." });
    } catch (error) {
      console.error("[AUTH] verify-code error:", error?.stack || error);
      return res.status(500).json({ error: "Internal server error" });
    }
  })
);

router.patch(
  "/reset-password",
  wrapAsync(async (req, res) => {
    console.info(`[AUTH] reset-password entered ${new Date().toISOString()} ip=${req.ip} bodyPreview=${JSON.stringify({ email: req.body?.email }).slice(0,200)}`);
    if (!req.dbAvailable) {
      console.info("[AUTH] reset-password DB unavailable");
      return res.status(503).json({ ok: false, error: "Database not available" });
    }

    const { email, newPassword } = req.body;
    const normEmail = (email || "").toLowerCase();

    try {
      const user = await findOneUserBy("email", normEmail);
      if (!user || user.is_verified !== 1) {
        console.info("[AUTH] reset-password user not found or not verified", { email: normEmail });
        return res.status(404).json({ error: "User not found or not verified." });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await updateRecord(
        "users",
        {
          password: hashedPassword,
          is_verified: 0,
        },
        {
          email: normEmail,
        }
      );

      console.info("[AUTH] reset-password success", { email: normEmail });
      res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
      console.error("[AUTH] reset-password error:", err?.stack || err);
      return res.status(500).json({ error: "Internal server error." });
    }
  })
);

export default router;
