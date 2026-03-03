import express from "express";
import wrapAsync from "utils/wrapAsync";
import { verifyToken } from "middleware/auth";
import controller from "controllers/portfolio";

const router = express.Router();

// Get all activities for the current user (student or teacher)
router.get("/activities", verifyToken, wrapAsync(controller.getUserActivities));

// Get activity details by ID
router.get(
  "/activities/:id",
  verifyToken,
  wrapAsync(controller.getActivityDetails),
);

// Get submission details for an activity
router.get(
  "/activities/:id/submission",
  verifyToken,
  wrapAsync(controller.getActivitySubmission),
);

export default router;
