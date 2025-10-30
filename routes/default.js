import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { queryAsync } from "../config/helpers/dbHelper.js";

const router = express.Router();

router.get("/notifications", verifyToken, async (req, res) => {
  const query = `
        SELECT * FROM notifications
        WHERE recipient_id = ?
        ORDER BY created_at DESC
    `;
  try {
    const results = await queryAsync(query, [req.user.id]);

    res.json({ success: true, message: results });
  } catch (err) {
    console.error("Error retrieving notifications.", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

router.post("/notifications/:id/read", verifyToken, async (req, res) => {
  const teacherId = req.user.id;
  const query = `UPDATE notifications SET is_read = TRUE WHERE id = ? AND recipient_id = ?`;

  try {
    await queryAsync(query, [req.params.id, teacherId]);
  } catch (err) {
    console.error("Error creating notifications:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

export default router;
