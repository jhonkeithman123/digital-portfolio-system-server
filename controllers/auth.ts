import bcrypt from "bcrypt";
import { UserRow } from "types/db";
import { Response } from "express";
import { RowDataPacket } from "mysql2";
import { AuthRequest } from "middleware/auth";
import { findOneUserBy, updateRecord } from "config/helpers/dbHelper";
import { queryAsync } from "config/helpers/dbHelper";
import { createSession } from "config/helpers/createSession";
import { generateToken } from "config/helpers/generateToken";
import { sendVerificationEmail } from "config/sendVerificationEmail";
import {
  generateVerificationCode,
  isVerificationCodeValid,
} from "config/helpers/verification";
import { setAuthCookie, clearAuthCookie } from "utils/authCookies";
import db from "config/db";

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

const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "mail.com",
  "yandex.com",
  "msn.com",
  "gmx.com",
  "tutanota.com",
];

function validateEmailDomain(email: string): {
  valid: boolean;
  error?: string;
} {
  const trimmedEmail = email.trim().toLowerCase();

  // Basic email format validation
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmedEmail)) {
    return {
      valid: false,
      error: "Invalid email format",
    };
  }

  // Extract domain from email
  const domain = trimmedEmail.split("@")[1];

  // Check if domain is in allowed list
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return {
      valid: false,
      error: `Email domain '${domain}' is not supported. Please use Gmail, Yahoo, Outlook, Hotmail, or iCloud.`,
    };
  }

  return { valid: true };
}

const checkSession = async (req: AuthRequest, res: Response) => {
  console.info(
    `[AUTH] GET /session entered ${new Date().toISOString()} ip=${req.ip}`,
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
};

const checkUserProfile = async (req: AuthRequest, res: Response) => {
  console.info(
    `[AUTH] GET /me entered ${new Date().toISOString()} ip=${req.ip}`,
  );

  try {
    // Query with field aliasing (username AS name)
    const users = await queryAsync<UserMeRow>(
      "SELECT ID as id, username AS name, email, role, section FROM users WHERE ID = ?",
      [req.user!.userId],
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
};

const studentSetSection = async (req: AuthRequest, res: Response) => {
  console.info(
    `[AUTH] PATCH /me/section entered ${new Date().toISOString()} ip=${req.ip}`,
  );

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
      [section, req.user!.userId],
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
};

const ping = (req: AuthRequest, res: Response) => {
  return res.json({ success: true, userId: req.user!.userId });
};

const login = async (req: AuthRequest, res: Response) => {
  console.info(
    `[AUTH] login entered ${new Date().toISOString()} ip=${
      req.ip
    } bodyPreview=${JSON.stringify({
      email: req.body?.email,
      role: req.body?.role,
    }).slice(0, 300)}`,
  );

  const { emailOrUsername, password, role: intendedRole } = req.body;

  if (!emailOrUsername || !password || !intendedRole) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Determine if input is email (contains @) or username
    const isEmail = emailOrUsername.includes("@");
    const normalizedInput = isEmail
      ? emailOrUsername.toLowerCase().trim()
      : emailOrUsername.trim();

    console.info("[AUTH] findOneUserBy start", {
      type: isEmail ? "email" : "username",
      normalized: normalizedInput,
    });

    // Single database query
    const user = await findOneUserBy<UserRow>(
      isEmail ? "email" : "username",
      normalizedInput,
    );

    console.info("[AUTH] findOneUserBy done", { found: !!user });

    // Generic error message to prevent user enumeration
    if (!user) {
      console.info("[AUTH] user not found");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify role matches the intended portal
    if (user.role !== intendedRole) {
      console.info("[AUTH] role mismatch", {
        dbRole: user.role,
        intendedRole,
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare password with stored bcrypt hash
    console.info("[AUTH] bcrypt.compare start");
    const match = await bcrypt.compare(password, user.password);
    console.info("[AUTH] bcrypt.compare done", { match });

    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    console.info("[AUTH] generateToken start");
    const { token, expiresAt } = generateToken(
      {
        userId: user.ID,
        email: user.email,
        role: user.role,
        username: user.username,
        section: user.section,
      },
      "24h",
    );
    console.info("[AUTH] generateToken done");

    // Store session with timeout protection
    const promiseWithTimeout = <T>(
      p: Promise<T>,
      ms: number,
      label: string,
    ): Promise<T> =>
      Promise.race([
        p,
        new Promise<never>((_, rej) =>
          setTimeout(
            () => rej(new Error(`${label} timed out after ${ms}ms`)),
            ms,
          ),
        ),
      ]);

    console.info("[AUTH] createSession start");
    await promiseWithTimeout(
      createSession(user.ID, token, expiresAt),
      8000,
      "createSession",
    );
    console.info("[AUTH] createSession done");

    // Set httpOnly cookie
    setAuthCookie(res, token);
    console.info(`[AUTH] login responding ${new Date().toISOString()}`);

    // Return user data
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
    console.error("[AUTH] Login error:", err?.stack || err?.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const logout = (req: AuthRequest, res: Response) => {
  // Clear the authentication cookie
  clearAuthCookie(res);
  return res.json({ success: true });
};

const signup = async (req: AuthRequest, res: Response) => {
  if (!(req as any).dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  const { username, email, password, role, section } = req.body;

  console.log("[AUTH] Signup attempt", { username, email, role });

  // Validate required fields
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Validate email domain
  const emailValidation = validateEmailDomain(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if email already exists
    const existingUserByEmail = await findOneUserBy<UserRow>(
      "email",
      normalizedEmail,
    );

    if (existingUserByEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Check if username already exists
    const existingUserByUsername = await findOneUserBy<UserRow>(
      "username",
      username,
    );

    if (existingUserByUsername) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await db.query<RowDataPacket[]>(
      `INSERT INTO users (username, email, password, role, section, is_verified) 
       VALUES (?, ?, ?, ?, ?, 0)`,
      [username, normalizedEmail, hashedPassword, role, section || null],
    );

    const userId = (result as any).insertId;

    console.log("[AUTH] User created", {
      userId,
      username,
      email: normalizedEmail,
    });

    return res.json({
      success: true,
      message: "User created. Please verify your email.",
      userId,
    });
  } catch (err) {
    console.error("[AUTH] Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const requestVerification = async (req: AuthRequest, res: Response) => {
  if (!(req as any).dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ error: "Email and role are required" });
  }

  // Validate email domain
  const emailValidation = validateEmailDomain(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const user = await findOneUserBy<UserRow>("email", normalizedEmail);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== role) {
      return res
        .status(400)
        .json({ error: "Role mismatch. Please check your account type." });
    }

    // Check if there's an active verification code
    if (user.verification_code && user.verification_expires_at) {
      const expiryDate = new Date(user.verification_expires_at);
      const now = new Date();

      if (expiryDate > now) {
        return res.json({
          success: true,
          message:
            "A verification code is already active. Please check your email.",
        });
      }
    }

    // Generate new 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with verification code
    await db.query<RowDataPacket[]>(
      `UPDATE users 
       SET verification_code = ?, verification_expiry = ? 
       WHERE email = ?`,
      [code, expiresAt, normalizedEmail],
    );

    // Send verification email
    const emailSent = await sendVerificationEmail(
      normalizedEmail,
      code,
      expiresAt,
    );

    if (!emailSent) {
      return res
        .status(500)
        .json({ error: "Failed to send verification email" });
    }

    console.log("[AUTH] Verification code sent", { email: normalizedEmail });

    return res.json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (err) {
    console.error("[AUTH] Request verification error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const verifyCode = async (req: AuthRequest, res: Response) => {
  console.info(
    `[AUTH] verify-code entered ${new Date().toISOString()} ip=${
      req.ip
    } bodyPreview=${JSON.stringify({ email: req.body?.email }).slice(0, 200)}`,
  );

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
      },
    );

    console.info("[AUTH] verify-code success", { email: normEmail });
    return res.json({ success: true, message: "Email is verified." });
  } catch (error) {
    const err = error as Error;
    console.error("[AUTH] verify-code error:", err?.stack || error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const resetPassword = async (req: AuthRequest, res: Response) => {
  console.info(
    `[AUTH] reset-password entered ${new Date().toISOString()} ip=${
      req.ip
    } bodyPreview=${JSON.stringify({ email: req.body?.email }).slice(0, 200)}`,
  );

  const { email, newPassword } = req.body;
  const normEmail = (email || "").toLowerCase();

  try {
    // Step 1: Find user and verify they completed verification
    const user = await findOneUserBy<UserRow>("email", normEmail);
    if (!user || user.is_verified !== 1) {
      console.info("[AUTH] reset-password user not found or not verified", {
        email: normEmail,
      });
      return res.status(404).json({ error: "User not found or not verified." });
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
      },
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
};

const controller = {
  checkSession,
  checkUserProfile,
  studentSetSection,
  ping,
  login,
  logout,
  signup,
  requestVerification,
  verifyCode,
  resetPassword,
};

export default controller;
