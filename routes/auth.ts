import express, { type Response } from "express";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { setAuthCookie, clearAuthCookie } from "../utils/authCookies";
import wrapAsync from "../utils/wrapAsync";

import { AuthRequest, verifyToken } from "../middleware/auth";
import { sendVerificationEmail } from "../config/sendVerificationEmail";
import {
  findOneUserBy,
  insertRecord,
  updateRecord,
} from "../config/helpers/dbHelper";
import { generateToken } from "../config/helpers/generateToken";
import { createSession } from "../config/helpers/createSession";
import {
  generateVerificationCode,
  isVerificationCodeValid,
} from "../config/helpers/verification";
import { queryAsync } from "../config/helpers/dbHelper";
import { RowDataPacket } from "mysql2/promise";
import { UserRow } from "../types/db";

dotenv.config();

const router = express.Router();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
// Specialized row types for different user queries

interface UserProfileRow extends RowDataPacket {
  ID: number;
  username: string;
  email: string;
  role: string;
  section: string | null;
}

interface UserMeRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role: string;
  section: string | null;
}

// ============================================================================
// ROUTE: GET /session - Verify active session and return user data
// ============================================================================
/**
 * Checks if the user has a valid JWT token and returns their profile.
 * Used on app load to restore user session.
 *
 * Process:
 * 1. Verify JWT token (verifyToken middleware extracts user from token)
 * 2. Fetch user details from database
 * 3. Return user profile
 *
 * Security:
 * - Token must be valid (not expired, correct signature)
 * - User must exist in database (not deleted)
 */
router.get(
  "/session",
  verifyToken, // Middleware: Decode JWT and attach user to req.user
  wrapAsync(async (req: AuthRequest, res: Response) => {
    console.info(
      `[AUTH] GET /session entered ${new Date().toISOString()} ip=${req.ip}`
    );
    const userId = req.user!.userId; // Guaranteed by verifyToken middleware
    console.log("User id:", userId);

    try {
      // Fetch user details from database
      const user = await findOneUserBy<UserProfileRow>("ID", userId, [
        "ID",
        "username",
        "email",
        "role",
        "section",
      ]);

      // Check if user still exists (could have been deleted)
      if (!user) {
        console.info("[AUTH] GET /session user not found", { userId });
        return res.status(404).json({ error: "User not found." });
      }

      console.info("[AUTH] GET /session responding", { userId });
      return res.json({ success: true, user });
    } catch (err) {
      const error = err as Error;
      console.error("[AUTH] GET /session error:", error?.stack || error);
      return res.status(500).json({ error: "Internal server error." });
    }
  })
);

// ============================================================================
// ROUTE: GET /me - Get current user's profile
// ============================================================================
/**
 * Returns the authenticated user's profile information.
 * Similar to /session but with different field names (id instead of ID).
 *
 * Process:
 * 1. Verify JWT token
 * 2. Check database availability
 * 3. Fetch user from database
 * 4. Return user profile
 */
router.get(
  "/me",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    console.info(
      `[AUTH] GET /me entered ${new Date().toISOString()} ip=${req.ip}`
    );

    // Guard: Check if database is available
    if (!(req as any).dbAvailable) {
      console.info("[AUTH] GET /me DB unavailable");
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    try {
      // Query with field aliasing (username AS name)
      const users = await queryAsync<UserMeRow>(
        "SELECT ID as id, username AS name, email, role, section FROM users WHERE ID = ?",
        [req.user!.userId]
      );
      const user = users[0];

      if (!user) {
        console.info("[AUTH] GET /me not found", { userId: req.user!.userId });
        return res.status(404).json({ success: false, message: "Not found" });
      }

      console.info("[AUTH] GET /me responding", { userId: req.user!.userId });
      return res.json({ success: true, user });
    } catch (e) {
      const error = e as Error;
      console.error("[AUTH] GET /me error:", error?.stack || error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  })
);

// ============================================================================
// ROUTE: PATCH /me/section - Student sets their section (one-time only)
// ============================================================================
/**
 * Allows students to set their section if it's currently empty.
 * Once set, section cannot be changed via this endpoint.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Check role is "student"
 * 3. Validate section is provided
 * 4. Update section only if currently NULL or empty
 * 5. Return success or "already set" message
 *
 * Security:
 * - Only students can use this endpoint
 * - Can only be set once (prevents accidental changes)
 * - Teachers manage student sections via other endpoints
 */
router.patch(
  "/me/section",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    console.info(
      `[AUTH] PATCH /me/section entered ${new Date().toISOString()} ip=${
        req.ip
      }`
    );

    if (!(req as any).dbAvailable) {
      console.info("[AUTH] PATCH /me/section DB unavailable");
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    try {
      // Step 1: Check if user is a student
      if (req.user!.role !== "student") {
        console.info("[AUTH] PATCH /me/section forbidden - not student", {
          role: req.user!.role,
        });
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // Step 2: Validate section is provided
      const section = (req.body?.section ?? "").toString().trim();
      if (!section) {
        console.info("[AUTH] PATCH /me/section bad request - missing section");
        return res
          .status(400)
          .json({ success: false, message: "Section is required" });
      }

      // Step 3: Update section only if currently NULL or empty
      const result = await queryAsync<RowDataPacket>(
        "UPDATE users SET section = ? WHERE ID = ? AND role = 'student' AND (section IS NULL OR section = '')",
        [section, req.user!.userId]
      );

      // Step 4: Check if update actually happened
      if (!result[0].affectedRows) {
        console.info("[AUTH] PATCH /me/section no-op - already set", {
          userId: req.user!.userId,
        });
        return res.json({ success: false, message: "Section already set" });
      }

      console.info("[AUTH] PATCH /me/section updated", {
        userId: req.user!.userId,
        section,
      });
      return res.json({ success: true, section });
    } catch (e) {
      const error = e as Error;
      console.error("[AUTH] PATCH /me/section error:", error?.stack || error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  })
);

// ============================================================================
// ROUTE: GET /ping - Quick health check for authenticated requests
// ============================================================================
/**
 * Simple endpoint to verify token is valid without fetching user data.
 * Useful for quick auth checks.
 */
router.get("/ping", verifyToken, (req: AuthRequest, res: Response) => {
  if (!(req as any).dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  return res.json({ success: true, userId: req.user!.userId });
});

// ============================================================================
// ROUTE: POST /login - Authenticate user and create session
// ============================================================================
/**
 * Authenticates a user with email/password and returns a JWT token.
 *
 * Process:
 * 1. Validate email and role from request
 * 2. Find user by email
 * 3. Verify user exists and role matches intended portal
 * 4. Compare password with bcrypt hash
 * 5. Generate JWT token with user claims
 * 6. Store session in database
 * 7. Set httpOnly cookie with token
 * 8. Return user data
 *
 * Security:
 * - Passwords are hashed with bcrypt (never stored plain)
 * - Role must match to prevent portal confusion (student vs teacher)
 * - JWT expires in 2 hours
 * - Session tracked in database for invalidation
 * - Token stored in httpOnly cookie (not accessible to JS)
 */
router.post(
  "/login",
  wrapAsync(async (req: AuthRequest, res: Response) => {
    console.info(
      `[AUTH] login entered ${new Date().toISOString()} ip=${
        req.ip
      } bodyPreview=${JSON.stringify({
        email: req.body?.email,
        role: req.body?.role,
      }).slice(0, 300)}`
    );

    if (!(req as any).dbAvailable) {
      console.info("[AUTH] DB unavailable - aborting login");
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { email, password, role: intendedRole } = req.body;
    const normEmail = (email || "").toLowerCase(); // Normalize email to lowercase

    try {
      // Step 1: Find user by email
      console.info("[AUTH] findOneUserBy start", normEmail);
      const user = await findOneUserBy<UserRow>("email", normEmail);
      console.info("[AUTH] findOneUserBy done", !!user);

      if (!user) {
        console.info("[AUTH] user not found");
        return res.status(404).json({ error: "User not found" });
      }

      // Step 2: Verify role matches the intended portal (student vs teacher)
      if (user.role !== intendedRole) {
        console.info("[AUTH] role mismatch", {
          dbRole: user.role,
          intendedRole,
        });
        return res
          .status(403)
          .json({ error: `Access denied for ${intendedRole} portal` });
      }

      // Step 3: Compare password with stored bcrypt hash
      console.info("[AUTH] bcrypt.compare start");
      const match = await bcrypt.compare(password, user.password);
      console.info("[AUTH] bcrypt.compare done", { match });

      if (!match) return res.status(401).json({ error: "Invalid password" });

      // Step 4: Generate JWT token with user claims
      console.info("[AUTH] generateToken start");
      const { token, expiresAt } = generateToken(
        {
          userId: user.ID,
          email: user.email,
          role: user.role,
          username: user.username,
          section: user.section,
        },
        "24h" // Token valid for 8 hours
      );
      console.info("[AUTH] generateToken done", { tokenExists: !!token });

      // Helper: Wrap promise with timeout to prevent hanging
      const promiseWithTimeout = <T>(
        p: Promise<T>,
        ms: number,
        label: string
      ): Promise<T> =>
        Promise.race([
          p,
          new Promise<never>((_, rej) =>
            setTimeout(
              () => rej(new Error(`${label} timed out after ${ms}ms`)),
              ms
            )
          ),
        ]);

      // Step 5: Store session in database (with timeout protection)
      console.info("[AUTH] createSession start");
      await promiseWithTimeout(
        createSession(user.ID, token, expiresAt),
        8000,
        "createSession"
      );
      console.info("[AUTH] createSession done");

      // Step 6: Set httpOnly cookie with token
      setAuthCookie(res, token);
      console.info(
        `[AUTH] login responding ${new Date().toISOString()} ip=${req.ip}`
      );

      // Step 7: Return user data (no password!)
      return res.json({
        success: true,
        user: {
          id: user.ID,
          name: user.username,
          role: user.role,
          email: user.email,
          section: user.section || null,
        },
      });
    } catch (error) {
      const err = error as Error;
      console.error("[AUTH] Login error:", err?.stack || err?.message || error);
      return res.status(500).json({ error: "Internal server error" });
    }
  })
);

// ============================================================================
// ROUTE: POST /logout - Clear session and cookie
// ============================================================================
/**
 * Logs out the user by clearing the authentication cookie.
 * Client should also clear any stored user data.
 *
 * Note: This doesn't invalidate the DB session record (could be added).
 */
router.post("/logout", (req: AuthRequest, res: Response) => {
  if (!(req as any).dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  // Clear the authentication cookie
  clearAuthCookie(res);
  return res.json({ success: true });
});

// ============================================================================
// ROUTE: POST /signup - Register a new user
// ============================================================================
/**
 * Creates a new user account.
 *
 * Process:
 * 1. Validate required fields (username, email, password, role)
 * 2. Check if email already exists
 * 3. Check if username already exists
 * 4. Hash password with bcrypt
 * 5. Insert user into database
 * 6. Return success with user ID
 *
 * Security:
 * - Email must be unique
 * - Username must be unique
 * - Password is hashed with bcrypt (salt rounds: 10)
 * - Email is normalized to lowercase
 * - New accounts are unverified (is_verified = 0)
 */
router.post(
  "/signup",
  wrapAsync(async (req: AuthRequest, res: Response) => {
    console.info(
      `[AUTH] signup entered ${new Date().toISOString()} ip=${
        req.ip
      } bodyPreview=${JSON.stringify({
        email: req.body?.email,
        name: req.body?.name,
        role: req.body?.role,
      }).slice(0, 300)}`
    );

    if (!(req as any).dbAvailable) {
      console.info("[AUTH] DB unavailable - aborting signup");
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { username, email, password, role, section } = req.body || {};

    // Step 1: Validate required fields
    if (!username || !email || !password || !role) {
      console.info("[AUTH] signup validation failed - missing fields");
      return res
        .status(400)
        .json({ error: "name, email, password and role are required." });
    }

    const normedEmail = (email || "").toLowerCase();
    let sectionVal = section ? section.trim() : null;

    if (role === "student" && section && section.trim()) {
      const trimmedSection = section.trim().toUpperCase();

      // Validate format: STRAND-SECTION (e.g., STEM-1, ABM-2A)
      const sectionPattern = /^[A-Z0-9]+-[A-Z0-9]+$/;

      if (!sectionPattern.test(trimmedSection)) {
        console.warn(
          "[AUTH] signup validation failed - invalid section format"
        );
        return res.status(400).json({
          success: false,
          error:
            "Section must follow format: STRAND-SECTION (e.g., STEM-1, ABM-2A, ICT-12)",
        });
      }

      sectionVal = trimmedSection;
    }

    try {
      // Step 2: Check if email already exists
      console.info("[AUTH] signup - checking existing email/username");
      const existingEmail = await findOneUserBy<UserRow>("email", normedEmail);
      if (existingEmail)
        return res.status(409).json({ error: "Email already registered." });

      // Step 3: Check if username already exists
      const existingUsername = await findOneUserBy<UserRow>(
        "username",
        username
      );
      if (existingUsername)
        return res.status(409).json({ error: "Username already exists." });

      // Step 4: Hash password (10 salt rounds)
      const hashedPassword = await bcrypt.hash(password, 10);

      // Step 5: Insert new user into database
      const insertId = await insertRecord("users", {
        username: username,
        email: normedEmail,
        password: hashedPassword,
        role,
        section: sectionVal,
      });

      console.info("[AUTH] signup created user", {
        insertId,
        email: normedEmail,
        section: sectionVal,
      });

      // Step 6: Return success (user should verify email next)
      return res.json({
        success: true,
        message: "Successfully created user.",
        id: insertId,
      });
    } catch (error) {
      const err = error as Error;
      console.error("[AUTH] Signup Error:", err?.stack || error);
      return res.status(500).json({ error: "Internal Server Error." });
    }
  })
);

// ============================================================================
// ROUTE: POST /request-verification - Send verification code via email
// ============================================================================
/**
 * Generates and sends a 6-digit verification code to user's email.
 * Used for email verification and password reset flows.
 *
 * Process:
 * 1. Validate email and role
 * 2. Find user by email and verify role matches
 * 3. Generate 6-digit code with expiry (10 minutes)
 * 4. If no active code, update database and send email
 * 5. If code still active, inform user to check email
 *
 * Code Generation:
 * - 6-digit random number (100000-999999)
 * - Valid for 10 minutes by default
 * - Reuses existing code if still valid (prevents spam)
 *
 * Security:
 * - Code expires after 10 minutes
 * - Only one active code per user at a time
 * - Role must match to prevent cross-portal attacks
 */
router.post(
  "/request-verification",
  wrapAsync(async (req: AuthRequest, res: Response) => {
    console.info(
      `[AUTH] request-verification entered ${new Date().toISOString()} ip=${
        req.ip
      } bodyPreview=${JSON.stringify({
        email: req.body?.email,
        role: req.body?.role,
      }).slice(0, 200)}`
    );

    if (!(req as any).dbAvailable) {
      console.info("[AUTH] request-verification DB unavailable");
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { email, role } = req.body;

    // Step 1: Validate required fields
    if (!email || !role) {
      console.info("[AUTH] request-verification bad request - missing fields");
      return res.status(400).json({ error: "Email and role are required." });
    }

    const normEmail = email.toLowerCase();

    try {
      // Step 2: Find user and verify role matches
      const user = await findOneUserBy<UserRow>("email", normEmail);
      if (!user || user.role !== role) {
        console.warn(
          `[AUTH] request-verification user not found ${normEmail} role=${role}`
        );
        return res.status(404).json({ error: "User not found." });
      }

      // Step 3: Generate verification code (or reuse if still valid)
      const { code, expiry, formatted, shouldUpdate } =
        generateVerificationCode(user);

      if (shouldUpdate) {
        // Step 4a: Code expired or doesn't exist - create new one
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

        // Send email with code
        await sendVerificationEmail(normEmail, code, formatted);
        console.info(`[AUTH] request-verification email sent to ${normEmail}`);

        return res.json({
          success: true,
          message: "Verification code sent to your email.",
        });
      } else {
        // Step 4b: Code still active - don't send duplicate
        console.info(
          `[AUTH] request-verification code active for ${normEmail} until ${formatted}`
        );
        return res.json({
          success: true,
          message: `A verification is already active. Please check your email. It expires at ${formatted}.`,
        });
      }
    } catch (error) {
      const err = error as Error;
      console.error("[AUTH] request-verification error:", err?.stack || error);
      return res.status(500).json({ error: "Internal server error" });
    }
  })
);

// ============================================================================
// ROUTE: POST /verify-code - Verify the 6-digit code
// ============================================================================
/**
 * Validates a verification code and marks the user's email as verified.
 *
 * Process:
 * 1. Find user by email
 * 2. Check if code matches and hasn't expired
 * 3. Mark user as verified (is_verified = 1)
 * 4. Clear verification code and expiry
 * 5. Return success
 *
 * Security:
 * - Code must match exactly
 * - Code must not be expired
 * - After verification, code is cleared (single-use)
 * - User can now use password reset or login
 */
router.post(
  "/verify-code",
  wrapAsync(async (req: AuthRequest, res: Response) => {
    console.info(
      `[AUTH] verify-code entered ${new Date().toISOString()} ip=${
        req.ip
      } bodyPreview=${JSON.stringify({ email: req.body?.email }).slice(0, 200)}`
    );

    if (!(req as any).dbAvailable) {
      console.info("[AUTH] verify-code DB unavailable");
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { email, code } = req.body;
    const normEmail = (email || "").toLowerCase();

    try {
      // Step 1: Find user
      const user = await findOneUserBy<UserRow>("email", normEmail);
      if (!user) {
        console.info("[AUTH] verify-code user not found", { email: normEmail });
        return res.status(404).json({ error: "User not found." });
      }

      // Step 2: Validate code (checks expiry and match)
      if (!isVerificationCodeValid(user, code)) {
        console.info("[AUTH] verify-code invalid/expired", {
          email: normEmail,
        });
        return res.status(400).json({ error: "Invalid or expired code." });
      }

      // Step 3: Mark user as verified and clear code
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
      return res.json({ success: true, message: "Email is verified." });
    } catch (error) {
      const err = error as Error;
      console.error("[AUTH] verify-code error:", err?.stack || error);
      return res.status(500).json({ error: "Internal server error" });
    }
  })
);

// ============================================================================
// ROUTE: PATCH /reset-password - Reset password after verification
// ============================================================================
/**
 * Allows verified users to reset their password.
 *
 * Process:
 * 1. Verify user exists and is verified (is_verified = 1)
 * 2. Hash new password with bcrypt
 * 3. Update password in database
 * 4. Reset verification status (user must verify again for future resets)
 * 5. Return success
 *
 * Security Flow:
 * 1. User requests verification code (/request-verification)
 * 2. User verifies code (/verify-code) - sets is_verified = 1
 * 3. User resets password (/reset-password) - sets is_verified = 0
 * 4. User must re-verify for next password reset
 *
 * This ensures the user verified their email before changing password.
 */
router.patch(
  "/reset-password",
  wrapAsync(async (req: AuthRequest, res: Response) => {
    console.info(
      `[AUTH] reset-password entered ${new Date().toISOString()} ip=${
        req.ip
      } bodyPreview=${JSON.stringify({ email: req.body?.email }).slice(0, 200)}`
    );

    if (!(req as any).dbAvailable) {
      console.info("[AUTH] reset-password DB unavailable");
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { email, newPassword } = req.body;
    const normEmail = (email || "").toLowerCase();

    try {
      // Step 1: Find user and verify they completed verification
      const user = await findOneUserBy<UserRow>("email", normEmail);
      if (!user || user.is_verified !== 1) {
        console.info("[AUTH] reset-password user not found or not verified", {
          email: normEmail,
        });
        return res
          .status(404)
          .json({ error: "User not found or not verified." });
      }

      // Step 2: Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Step 3: Update password and reset verification status
      await updateRecord(
        "users",
        {
          password: hashedPassword,
          is_verified: 0, // Reset so user must verify again next time
        },
        {
          email: normEmail,
        }
      );

      console.info("[AUTH] reset-password success", { email: normEmail });
      return res.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (err) {
      const error = err as Error;
      console.error("[AUTH] reset-password error:", error?.stack || error);
      return res.status(500).json({ error: "Internal server error." });
    }
  })
);

export default router;
