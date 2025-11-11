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

    // return using "notifications" key to match client
    res.json({ success: true, notifications: results });
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
    return res.json({ success: true });
  } catch (err) {
    console.error("Error creating notifications:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

// Mark ALL current user's notifications as read
router.post("/notifications/mark-all-read", verifyToken, async (req, res) => {
  try {
    await queryAsync(
      "UPDATE notifications SET is_read = TRUE WHERE recipient_id = ? AND is_read = FALSE",
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("mark-all-read error", err.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Batch mark selected IDs (owned by user) as read
router.post("/notifications/read-batch", verifyToken, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Number.isInteger) : [];
  if (!ids.length) return res.json({ success: true, updated: 0 });
  const placeholders = ids.map(() => "?").join(",");
  try {
    const sql = `UPDATE notifications SET is_read = TRUE 
                 WHERE recipient_id = ? AND id IN (${placeholders})`;
    const result = await queryAsync(sql, [req.user.id, ...ids]);
    res.json({ success: true, updated: result?.affectedRows || 0 });
  } catch (err) {
    console.error("read-batch error", err.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
