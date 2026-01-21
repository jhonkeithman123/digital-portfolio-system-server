import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// STATIC FILE SERVING - Activity uploads
// ============================================================================
router.use(
  "/activities",
  express.static(path.join(__dirname, "..", "uploads", "activities"), {
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".pdf")) {
        res.setHeader("Content-Type", "application/pdf");
      } else if (filePath.endsWith(".doc")) {
        res.setHeader("Content-Type", "application/msword");
      } else if (filePath.endsWith(".docx")) {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
      }

      if (filePath.endsWith(".pdf")) {
        res.setHeader("Content-Disposition", "inline");
      }
    },
  }),
);

export default router;
