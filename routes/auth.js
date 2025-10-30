import express from "express";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

import { verifyToken } from "../middleware/auth.js";
import { sendVerificationEmail } from "../config/sendVerificationEmail.js";
import {
  findOneUserBy,
  findUsersBy,
  insertRecord,
  updateRecord,
} from "../config/helpers/dbHelper.js";
import { generateToken } from "../config/helpers/generateToken.js";
import { createSession } from "../config/helpers/createSession.js";
import {
  generateVerificationCode,
  isVerificationCodeValid,
} from "../config/helpers/verification.js";

dotenv.config();

const router = express.Router();

router.get("/session", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await findOneUserBy("id", userId, [
      "id",
      "username",
      "email",
      "role",
    ]);

    if (!user) {
      console.error("User not found");
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password, role: intendedRole } = req.body;

  const normEmail = email.toLowerCase();

  try {
    const user = await findOneUserBy("email", normEmail);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role !== intendedRole) {
      console.log("Unauthorized Access Blocked.");
      return res
        .status(403)
        .json({ error: `Access denied for ${intendedRole} portal` });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid password" });

    const { token, expiresAt } = generateToken(
      { id: user.ID, role: user.role },
      "2h"
    );

    await createSession(user.ID, token, expiresAt);

    res.json({
      success: true,
      token,
      user: {
        id: user.ID,
        name: user.username,
        role: user.role,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/signup", async (req, res) => {
  const { name, email, password, role } = req.body;

  const normedEmail = email.toLowerCase();

  try {
    const user = await findOneUserBy("email", normedEmail);
    if (!user) return res.status(404).json({ error: "User not found." });

    const username = await findOneUserBy("username", name);
    if (username > 0)
      return res.status(405).json({ error: "Username already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);

    await insertRecord("users", {
      username: name,
      email,
      password: hashedPassword,
      role,
    });

    res.json({ success: true, message: "Successfully created user." });
  } catch (error) {
    console.error("Signup Error:", error.message);
    return res.status(500).json({ error: "Internal Server Error." });
  }
});

router.post("/request-verification", async (req, res) => {
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ error: "Email and role are required." });
  }

  const normEmail = email.toLowerCase();

  try {
    const user = await findOneUserBy("email", normEmail);
    if (!user || user.role !== role) {
      console.warn(
        `[NOT FOUND] no user found for ${normEmail} with role ${role}`
      );
      return res.status(404).json({ error: "User not found." });
    }

    const { code, expiry, formatted, shouldUpdate } =
      generateVerificationCode(user);

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
      console.log(
        `[EMAIL SENT] Code sent to ${normEmail} (expires at ${formatted})`
      );
      return res.json({
        success: true,
        message: "Verification code sent to your email.",
      });
    } else {
      console.log(
        `[CODE ACTIVE] Code for ${normEmail} still valid untill ${formatted}`
      );
      return res.json({
        success: true,
        message: `A verification is already active. Please check your email. It expires at ${formatted}.`,
      });
    }
  } catch (error) {
    console.error("[ERROR] Verifiaction request failed:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/verify-code", async (req, res) => {
  const { email, code } = req.body;
  const normEmail = email.toLowerCase();

  try {
    const user = await findOneUserBy("email", normEmail);
    if (!user) {
      console.log("User not found.");
      return res.status(404).json({ error: "User not found." });
    }

    if (!isVerificationCodeValid(user, code))
      return res.status(400).json({ error: "Invalid or expired code." });

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

    res.json({ success: true, message: "Email is verified." });
  } catch (error) {
    console.error("Verification error:", error.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.patch("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  const normEmail = email.toLowerCase();

  try {
    const user = await findOneUserBy("email", normEmail);
    if (!user || user.is_verified !== 1) {
      console.log("User not found or not verified.");
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

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("[reset-password] Error:", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
