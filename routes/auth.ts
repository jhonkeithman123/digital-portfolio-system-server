import express from "express";
import dotenv from "dotenv";
import wrapAsync from "utils/wrapAsync";

import { verifyToken } from "middleware/auth";
import controller from "controllers/auth";

dotenv.config();

const router = express.Router();

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
  wrapAsync(controller.checkSession),
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
router.get("/me", verifyToken, wrapAsync(controller.checkUserProfile));

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
  wrapAsync(controller.studentSetSection),
);

// ============================================================================
// ROUTE: GET /ping - Quick health check for authenticated requests
// ============================================================================
/**
 * Simple endpoint to verify token is valid without fetching user data.
 * Useful for quick auth checks.
 */
router.get("/ping", verifyToken, controller.ping);

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
router.post("/login", wrapAsync(controller.login));

// ============================================================================
// ROUTE: POST /logout - Clear session and cookie
// ============================================================================
/**
 * Logs out the user by clearing the authentication cookie.
 * Client should also clear any stored user data.
 *
 * Note: This doesn't invalidate the DB session record (could be added).
 */
router.post("/logout", controller.logout);

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
router.post("/signup", wrapAsync(controller.signup));

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
router.post("/request-verification", wrapAsync(controller.requestVerification));

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
router.post("/verify-code", wrapAsync(controller.verifyCode));

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
router.patch("/reset-password", wrapAsync(controller.resetPassword));

router.patch(
  "/change-username",
  verifyToken,
  wrapAsync(controller.changeUsername),
);

export default router;
