import express, { type Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { queryAsync } from "../config/helpers/dbHelper";
import wrapAsync from "../utils/wrapAsync";

const router = express.Router();

router.post(
  "/csp-report",
  express.json({ type: "application/csp-report" }),
  (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    console.error("CSP Violation", req.body);
    res.status(204).end();
  }
);

router.post(
  "/tamper-log",
  express.json(),
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }
    const { type, detectedAt, role, userId } = req.body;
    const logMessage = `Tampering detected at ${new Date(
      detectedAt
    ).toLocaleString()} - type: ${type}, role: ${role}, User ID: ${
      userId ?? "unknown"
    }`;
    const query = `INSERT INTO logging (type, detected_at, role, user_id, log) VALUES (?, ?, ?, ?, ?)`;
    const values = [type, detectedAt, role, userId || null, logMessage];
    try {
      await queryAsync(query, values);
      res.status(201).json({ success: "Successfully logged the tampering" });
    } catch (err) {
      console.error("Failed to log tampering:", err);
      return res.status(500).json({ error: "Failed to log tampering" });
    }
  })
);

export default router;
