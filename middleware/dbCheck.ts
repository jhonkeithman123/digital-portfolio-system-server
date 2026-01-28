import type { Request, Response, NextFunction } from "express";
import db from "config/db";

export interface DbRequest extends Request {
  dbAvailable: boolean;
}

export const checkDbAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await db.query("SELECT 1");
    (req as DbRequest).dbAvailable = true;
  } catch (err) {
    console.error("Database connection failed:", err);
    (req as DbRequest).dbAvailable = false;
  }

  next();
};

export const requireDb = (
  req: Request,
  res: Response,
  next: NextFunction,
): void | Response => {
  if (!(req as DbRequest).dbAvailable) {
    return res.status(503).json({
      success: false,
      error: "Database not available",
    });
  }
  next();
};
