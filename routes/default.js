import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { queryAsync } from "../config/helpers/dbHelper.js";

const router = express.Router();

router.get("/notifications", verifyToken, async (req, res) => {
  if (!req.dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }
  
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
  if (!req.dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }
  
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
  if (!req.dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }
  
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
  if (!req.dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }
  
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.filter(Number.isInteger)
    : [];
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

router.get("/users/sections", verifyToken, async (req, res) => {
  if (!req.dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }
  
  try {
    const rows = await queryAsync(
      "SELECT DISTINCT section FROM users WHERE role='student' AND section IS NOT NULL ORDER BY section"
    );
    res.json({ success: true, sections: rows.map((r) => r.section) });
  } catch (e) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Students list (optionally only those missing section)
router.get("/users/students", verifyToken, async (req, res) => {
  if (!req.dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }
  
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const { missing } = req.query;
    let sql =
      "SELECT id, username, email, COALESCE(NULLIF(section,''), NULL) AS section FROM users WHERE role='student'";
    const params = [];
    if (missing === "1" || missing === "true") {
      sql += " AND (section IS NULL OR section = '')";
    }
    sql += " ORDER BY username ASC";
    const rows = await queryAsync(sql, params);
    res.json({ success: true, students: rows });
  } catch (e) {
    console.error("GET /users/students error:", e.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update a single student's section
router.patch("/users/:id/section", verifyToken, async (req, res) => {
  if (!req.dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }
  
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const id = parseInt(req.params.id, 10);
    const section = (req.body?.section ?? "").toString().trim();
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    await queryAsync("UPDATE users SET section = ? WHERE id = ? AND role='student'", [
      section || null,
      id,
    ]);
    res.json({ success: true });
  } catch (e) {
    console.error("PATCH /users/:id/section error:", e.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
