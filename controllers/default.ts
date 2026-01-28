import { AuthRequest } from "middleware/auth";
import type { Response } from "express";
import { RowDataPacket } from "mysql2/promise";
import { queryAsync } from "config/helpers/dbHelper";
import db from "config/db";
import { ResultSetHeader } from "mysql2/promise";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
// Database row types for notifications and users

interface NotificationRow extends RowDataPacket {
  id: number;
  recipient_id: number;
  sender_id: number;
  type: string; // 'invite', 'submission', 'feedback', etc.
  message: string;
  link: string | null;
  is_read: 0 | 1;
  created_at: Date;
  updated_at: Date;
}

interface StudentRow extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  section: string | null;
}

interface SectionRow extends RowDataPacket {
  section: string;
}

const fetchAllNotifications = async (req: AuthRequest, res: Response) => {
  // Guard: Check database availability
  if (!(req as any).dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  const userId = req.user!.userId;

  // Step 1: Query notifications ordered by newest first
  const query = `
      SELECT 
        id,
        recipient_id,
        sender_id,
        type,
        message,
        link,
        is_read,
        created_at,
        updated_at
      FROM notifications
      WHERE recipient_id = ?
      ORDER BY created_at DESC
    `;

  try {
    // Step 2: Execute query and fetch results
    const results = await queryAsync<NotificationRow>(query, [userId]);

    // Step 3: Return notifications using "notifications" key for client compatibility
    res.json({ success: true, notifications: results });
  } catch (err) {
    const error = err as Error;
    console.error("Error retrieving notifications:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  // Guard: Check database availability
  if (!(req as any).dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  const userId = req.user!.userId;
  const notificationId = req.params.id;

  // Step 1: Update notification is_read flag
  const query = `
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE id = ? AND recipient_id = ?
    `;

  try {
    // Step 2: Execute update (no error if not found)
    await db.query<ResultSetHeader>(query, [notificationId, userId]);

    // Step 3: Return success (idempotent - always returns success)
    return res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    console.error("Error marking notification as read:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const markAllNotificationsAsRead = async (req: AuthRequest, res: Response) => {
  // Guard: Check database availability
  if (!(req as any).dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  const userId = req.user!.userId;

  try {
    // Step 1: Update all unread notifications for this user
    await db.query<ResultSetHeader>(
      `UPDATE notifications 
         SET is_read = TRUE 
         WHERE recipient_id = ? AND is_read = FALSE`,
      [userId],
    );

    // Step 2: Return success
    res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    console.error("Error marking all notifications as read:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const markMultipleNotificationsAsRead = async (
  req: AuthRequest,
  res: Response,
) => {
  // Guard: Check database availability
  if (!(req as any).dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  const userId = req.user!.userId;

  // Step 1: Extract and validate notification IDs from request
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.filter(Number.isInteger) // Only keep integers
    : [];

  // Step 2: Return early if no valid IDs (no-op, still success)
  if (!ids.length) {
    return res.json({ success: true, updated: 0 });
  }

  // Step 3: Build dynamic IN clause: "id IN (?, ?, ?)"
  const placeholders = ids.map(() => "?").join(",");

  try {
    // Step 4: Update notifications using batch query
    // Passes recipient_id first, then all IDs
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE notifications 
         SET is_read = TRUE 
         WHERE recipient_id = ? AND id IN (${placeholders})`,
      [userId, ...ids], // userId first, then all IDs
    );

    // Step 5: Return success with count of updated rows
    res.json({ success: true, updated: result.affectedRows ?? 0 });
  } catch (err) {
    const error = err as Error;
    console.error("Error in batch read operation:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteNotification = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No notification IDs provided" });
  }

  try {
    const placeholders = ids.map(() => "?").join(",");
    await queryAsync(
      `DELETE FROM notifications WHERE id IN (${placeholders}) AND recipient_id = ?`,
      [...ids, userId],
    );

    res.json({ success: true, message: "Notifications deleted" });
  } catch (err) {
    console.error("Error deleting notifications:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteAllNotifications = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    await queryAsync(`DELETE FROM notifications WHERE recipient_id = ?`, [
      userId,
    ]);

    res.json({ success: true, message: "All notifications deleted" });
  } catch (err) {
    console.error("Error deleting all notifications:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteSelectedNotifications = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No notification IDs provided" });
  }

  try {
    const placeholders = ids.map(() => "?").join(",");
    await queryAsync(
      `DELETE FROM notifications WHERE id IN (${placeholders}) AND recipient_id = ?`,
      [...ids, userId],
    );

    res.json({ success: true, message: "Notifications deleted" });
  } catch (err) {
    console.error("Error deleting notifications:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const fetchSections = async (req: AuthRequest, res: Response) => {
  // Guard: Check database availability
  if (!(req as any).dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  try {
    // Step 1: Query distinct sections (excludes NULL, sorted)
    const rows = await queryAsync<SectionRow>(
      "SELECT DISTINCT section FROM users WHERE role='student' AND section IS NOT NULL ORDER BY section ASC",
      [],
    );

    // Step 2: Extract section values and return
    const sections = rows.map((r) => r.section);
    res.json({ success: true, sections });
  } catch (err) {
    const error = err as Error;
    console.error("Error fetching sections:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const editStudentSection = async (req: AuthRequest, res: Response) => {
  // Guard: Check database availability
  if (!(req as any).dbAvailable) {
    return res.status(503).json({ ok: false, error: "Database not available" });
  }

  try {
    // Step 1: Check authorization (teachers only)
    if (req.user!.role !== "teacher") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Step 2: Parse query parameter for filtering
    const { missing } = req.query;
    const shouldFilterMissing = missing === "1" || missing === "true";

    // Step 3: Build dynamic SQL
    let sql =
      "SELECT id, username, email, COALESCE(NULLIF(section,''), NULL) AS section FROM users WHERE role='student'";
    const params: any[] = [];

    if (shouldFilterMissing) {
      // Add filter for students without section
      sql += " AND (section IS NULL OR section = '')";
    }

    // Step 4: Sort by username (consistent ordering)
    sql += " ORDER BY username ASC";

    // Step 5: Execute query
    const rows = await queryAsync<StudentRow>(sql, params);

    // Step 6: Return students list
    res.json({ success: true, students: rows });
  } catch (err) {
    const error = err as Error;
    console.error("Error fetching students:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const controller = {
  editStudentSection,
  fetchAllNotifications,
  fetchSections,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  markMultipleNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  deleteSelectedNotifications,
};

export default controller;
