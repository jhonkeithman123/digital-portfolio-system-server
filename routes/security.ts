import express from "express";
import wrapAsync from "utils/wrapAsync";
import controller from "controllers/security";

const router = express.Router();

router.post(
  "/csp-report",
  express.json({ type: "application/csp-report" }),
  controller.cspReport,
);

router.post("/tamper-log", express.json(), wrapAsync(controller.tamperLog));

export default router;
