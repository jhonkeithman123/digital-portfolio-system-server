import express, { type Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { verifyToken } from "../middleware/auth";

const router = express.Router();

router.get(
  "/showcase",
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      // TODO: Replace with your actual showcase logic
      // For now, return empty array
      return res.json({
        success: true,
        data: [],
      });
    } catch (error) {
      console.error("[SHOWCASE] Error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
);

export default router;
