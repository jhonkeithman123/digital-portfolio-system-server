import express from "express";
import path from "path";
import multer from "multer";
import wrapAsync from "../utils/wrapAsync.js";
import { verifyToken } from "../middleware/auth.js";
import { queryAsync } from "../config/helpers/dbHelper.js";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads", "activities");
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const base = file.originalname.replace(/\s+/g, "_");
    cb(null, `${ts}__${base}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

/* Helper: fetch classroom by code for this teacher */
async function getClassroomForTeacher(code, teacherId) {
  const rows = await queryAsync(
    "SELECT id FROM classrooms WHERE code = ? AND teacher_id = ? LIMIT 1",
    [code, teacherId]
  );
  return rows[0] || null;
}

async function authorizeActivity(activityId, userId, role) {
  const rows = await queryAsync(
    `SELECT a.id,
            a.classroom_id,
            a.teacher_id
     FROM activities a
     WHERE a.id = ?
     LIMIT 1`,
    [activityId]
  );

  if (!rows.length) return { ok: false, reason: "Activity not found" };
  const activity = rows[0];

  if (role === "teacher") {
    if (activity.teacher_id !== userId)
      return { ok: false, reason: "Forbidden" };
  } else {
    const member = await queryAsync(
      `SELECT 1
       FROM classroom_members
       WHERE classroom_id = ? AND student_id = ? AND status = 'accepted'
       LIMIT 1`,
      [activity.classroom_id, userId]
    );

    if (!member.length) return { ok: false, reason: "Forbidden" };
  }
  return { ok: true, activity };
}

//* Router to get activities
router.get(
  "/:id",
  verifyToken,
  wrapAsync(async (req, res) => {
    if (!req.dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    console.log("userId", userId, "Id", id);

    try {
      const auth = await authorizeActivity(id, userId, role);
      if (!auth.ok) {
        const status = auth.reason === "Activity not found" ? 404 : 403;
        return res.status(status).json({ success: false, error: auth.reason });
      }

      const rows = await queryAsync(
        `SELECT a.id,
              a.classroom_id,
              a.teacher_id,
              a.title,
              a.instructions,
              a.file_path,
              a.original_name,
              a.mime_type,
              a.created_at,
              c.code as classroom_code
      FROM activities a
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE a.id = ?
      LIMIT 1`,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({ success: false, error: "Not found" });
      }

      const activity = rows[0];

      //* Authorize Access:
      //* - Teacher must own the classroom
      //* - Student: must be accepted member of the classroom
      if (role === "teacher") {
        if (activity.teacher_id !== userId) {
          return res
            .status(403)
            .json({ success: false, error: "Forbidden for this activity" });
        }
      } else {
        const memberRows = await queryAsync(
          `SELECT 1
           FROM classroom_members
           WHERE classroom_id = ? AND student_id = ? AND status = 'accepted'
           LIMIT 1`,
          [activity.classroom_id, userId]
        );

        if (!memberRows.length) {
          return res
            .status(403)
            .json({ success: false, error: "Forbidden for this activity" });
        }
      }

      return res.json({ success: true, activity });
    } catch (e) {
      console.error("Error fetching activity:", e);
      res.status(500).json({ error: "Server error" });
    }
  })
);

router
  .route("/:id/comments")
  .all(verifyToken)
  //* Router to get comments
  .get(
    wrapAsync(async (req, res) => {
      if (!req.dbAvailable) {
        return res
          .status(503)
          .json({ ok: false, error: "Database not available" });
      }

      const { id } = req.params;
      const userId = req.user.id;
      const role = req.user.role;

      try {
        //* Auth
        const auth = await authorizeActivity(id, userId, role);
        if (!auth.ok) {
          const status = auth.reason === "Activity not found" ? 404 : 403;
          return res
            .status(status)
            .json({ success: false, error: auth.reason });
        }

        //* Fetch comments (oldest first)
        const comments = await queryAsync(
          `SELECT c.id,
                c.activity_id,
                c.classroom_id,
                c.user_id,
                c.comment,
                c.created_at,
                c.updated_at,
                u.username,
                u.role
         FROM comments c
         JOIN users u ON u.ID = c.user_id
         WHERE c.activity_id = ? AND c.classroom_id = ?
         ORDER BY c.created_at ASC`,
          [id, auth.activity.classroom_id]
        );

        let repliesByComment = {};
        if (comments.length) {
          const ids = comments.map((c) => c.id);
          const replies = await queryAsync(
            `SELECT r.id,
                  r.comment_id,
                  r.user_id,
                  r.reply,
                  r.created_at,
                  r.updated_at,
                  u.username,
                  u.role
           FROM comment_replies r
           JOIN users u ON u.ID = r.user_id
           WHERE r.comment_id IN (?)
           ORDER BY r.created_at ASC`,
            [ids]
          );
          replies.forEach((r) => {
            (repliesByComment[r.comment_id] ||= []).push(r);
          });
        }

        const payload = comments.map((c) => ({
          ...c,
          replies: repliesByComment[c.id] ?? [],
        }));

        return res.json({ success: true, comments: payload });
      } catch (e) {
        console.error("Error fetching comments:", e);
        return res.status(500).json({ error: "Error fetching comments" });
      }
    })
  )
  //* Router to modify the comments
  .post(
    wrapAsync(async (req, res) => {
      if (!req.dbAvailable) {
        return res
          .status(503)
          .json({ ok: false, error: "Database not available" });
      }

      const { id } = req.params;
      const userId = req.user.id;
      const role = req.user.role;
      const { comment } = req.body;

      try {
        const auth = await authorizeActivity(id, userId, role);
        if (!auth.ok) {
          const status = auth.reason === "Activity not found" ? 404 : 403;
          return res
            .status(status)
            .json({ success: false, error: auth.reason });
        }

        //* Validate comment
        if (typeof comment !== "string") {
          return res
            .status(400)
            .json({ success: false, error: "Comment text are required" });
        }

        //* Check if the comment is an empty string
        const trimmed = comment.trim();
        if (!trimmed.length) {
          return res
            .status(400)
            .json({ success: false, error: "Comments cannot be empty" });
        }
        const safe = trimmed.slice(0, 255); //* Enforce column length

        const result = await queryAsync(
          `INSERT INTO comments
              (classroom_id, activity_id, user_id, comment, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [auth.activity.classroom_id, id, userId, safe]
        );

        const inserted = await queryAsync(
          `SELECT c.id,
                c.activity_id,
                c.classroom_id,
                c.user_id,
                c.comment,
                c.created_at,
                c.updated_at,
                u.username,
                u.role
         FROM comments c
         JOIN users u ON u.ID = c.user_id
         WHERE c.id = ?
         LIMIT 1`,
          [result.insertId]
        );

        return res.json({
          success: true,
          comments: { ...inserted[0], replies: [] },
          message: "Comment added",
        });
      } catch (e) {
        console.error("Error fetching comments:", e);
        return res.status(500).json({ error: "Error saving comments" });
      }
    })
  );

//* Router for the replies of the comments
router.post(
  "/:id/comments/:commentId/replies",
  verifyToken,
  wrapAsync(async (req, res) => {
    if (!req.dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { id, commentId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { reply } = req.body;

    try {
      const auth = await authorizeActivity(id, userId, role);
      if (!auth.ok) {
        const status = auth.reason === "Activity not found" ? 404 : 403;
        return res.status(status).json({ success: false, error: auth.reason });
      }

      if (typeof reply !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Reply must be a string" });
      }

      const trimmed = reply.trim();
      if (!trimmed) {
        return res
          .status(400)
          .json({ success: false, error: "Reply cannot be empty" });
      }

      const parent = await queryAsync(
        `SELECT id FROM comments WHERE id = ? AND activity_id = ? LIMIT 1`,
        [commentId, id]
      );
      if (!parent.length) {
        return res
          .status(404)
          .json({ success: false, error: "Comment not found" });
      }

      const safe = trimmed.slice(0, 255);
      const result = await queryAsync(
        `INSERT INTO comment_replies
        (comment_id, user_id, reply, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
        [commentId, userId, safe]
      );

      const inserted = await queryAsync(
        `SELECT r.id,
              r.comment_id,
              r.user_id,
              r.reply,
              r.created_at,
              r.updated_at,
              u.username,
              u.role
       FROM comment_replies r
       JOIN users u ON u.id = r.user_id
       WHERE r.id = ?
       LIMIT 1`,
        [result.insertId]
      );

      return res.json({
        success: true,
        reply: inserted[0],
        message: "Reply added",
      });
    } catch (e) {
      console.error("Error adding reply:", e);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  })
);

//* Teacher creates an activity
router.post(
  "/create",
  verifyToken,
  upload.single("file"),
  wrapAsync(async (req, res) => {
    if (!req.dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    try {
      if (req.user.role !== "teacher")
        return res.status(403).json({ success: false, error: "Forbidden" });

      const { title, instructions, classroomCode } = req.body;
      if (!title || !instructions || !classroomCode) {
        return res
          .status(400)
          .json({ success: false, error: "Missing required fields" });
      }

      const classroom = await getClassroomForTeacher(
        classroomCode,
        req.user.id
      );
      if (!classroom)
        return res
          .status(403)
          .json({ success: false, error: "Invalid classroom code" });

      const file = req.file || null;

      const result = await queryAsync(
        `INSERT INTO activities
          (classroom_id, teacher_id, title, instructions, file_path, original_name, mime_type, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          classroom.id,
          req.user.id,
          title.trim(),
          instructions.trim(),
          file ? file.filename : null,
          file ? file.originalname : null,
          file ? file.mimetype : null,
        ]
      );

      return res.json({
        success: true,
        id: result.insertId,
        message: "Activity created",
      });
    } catch (err) {
      console.error("Error creating activity:", err);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  })
);

//* List activities for a classroom (student or teacher)
router.get(
  "/classroom/:code",
  verifyToken,
  wrapAsync(async (req, res) => {
    if (!req.dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { code } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    try {
      // Validate classroom access
      let classroomRow;
      if (role === "teacher") {
        const rows = await queryAsync(
          "SELECT id FROM classrooms WHERE code = ? AND teacher_id = ? LIMIT 1",
          [code, userId]
        );
        classroomRow = rows[0];
      } else {
        const rows = await queryAsync(
          `SELECT c.id
         FROM classrooms c
         JOIN classroom_members cm ON cm.classroom_id = c.id
         WHERE c.code = ? AND cm.student_id = ? AND cm.status = 'accepted'
         LIMIT 1`,
          [code, userId]
        );
        classroomRow = rows[0];
      }

      if (!classroomRow)
        return res
          .status(403)
          .json({ success: false, error: "Not authorized for this classroom" });

      const activities = await queryAsync(
        `SELECT id, title, instructions, file_path, original_name, mime_type, created_at
       FROM activities
       WHERE classroom_id = ?
       ORDER BY created_at DESC`,
        [classroomRow.id]
      );

      return res.json({ success: true, activities });
    } catch (err) {
      console.error("Error listing activities:", err);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  })
);

router.patch(
  "/:id/instructions",
  verifyToken,
  wrapAsync(async (req, res) => {
    if (!req.dbAvailable) {
      console.error("DB unavailable");
      return res
        .status(500)
        .json({ success: false, error: "Database not available" });
    }

    const { id } = req.params;
    const { instructions } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    try {
      if (role !== "teacher") {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      //* Ensure activity exists and teacher owns it
      const actRows = await queryAsync(
        `SELECT id, teacher_id, classroom_id
       FROM activities
       WHERE id = ?
       LIMIT 1`,
        [id]
      );

      if (!actRows.length) {
        return res
          .status(404)
          .json({ success: false, error: "Activity not found" });
      }

      const activity = actRows[0];
      if (activity.teacher_id !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      //* validate input
      if (typeof instructions !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Invalid instructions" });
      }

      const trimmed = instructions.trim();
      if (trimmed.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Instructions cannot be empty" });
      }

      //* Enforcing a 10000 characters max length to avoid huge payloads
      const safe = trimmed.slice(0, 10000);

      //* persist update
      await queryAsync(
        `UPDATE activities
       SET instructions = ?, updated_at = NOW()
       WHERE id = ?`,
        [safe, id]
      );

      const updated = await queryAsync(
        `SELECT id, title, instructions, file_path, original_name, mime_type, updated_at
       FROM activities
       WHERE id = ?
       LIMIT 1`,
        [id]
      );

      return res.json({
        success: true,
        message: "Instructions updated",
        activity: updated[0] || { id, instructions: safe },
      });
    } catch (e) {
      console.error("Error updatid instructions:", e);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  })
);

router.patch(
  "/:id/comments/:commentId",
  verifyToken,
  wrapAsync(async (req, res) => {
    if (!req.dbAvailable) {
      return res
        .status(503)
        .json({ success: false, error: "Database not available" });
    }

    const { id, commentId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { comment } = req.body;

    try {
      // basic validation
      if (typeof comment !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Invalid comment" });
      }
      const trimmed = comment.trim();
      if (!trimmed) {
        return res
          .status(400)
          .json({ success: false, error: "Comment cannot be empty" });
      }
      const safe = trimmed.slice(0, 255);

      // authorize activity access
      const auth = await authorizeActivity(id, userId, role);
      if (!auth.ok) {
        const status = auth.reason === "Activity not found" ? 404 : 403;
        return res.status(status).json({ success: false, error: auth.reason });
      }

      // Try update as top-level comment first
      const commentRows = await queryAsync(
        `SELECT id, user_id FROM comments WHERE id = ? AND activity_id = ? LIMIT 1`,
        [commentId, id]
      );

      if (commentRows.length) {
        const existing = commentRows[0];
        if (existing.user_id !== userId) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }

        // update
        await queryAsync(
          `UPDATE comments SET comment = ?, updated_at = NOW(), edited = 1 WHERE id = ?`,
          [safe, commentId]
        );

        const updated = await queryAsync(
          `SELECT c.id, c.activity_id, c.classroom_id, c.user_id, c.comment, c.created_at, c.updated_at c.edited, u.username, u.role
          FROM comments c
          JOIN users u ON u.id = c.user_id
          WHERE c.id = ? LIMIT 1`,
          [commentId]
        );

        return res.json({
          success: true,
          type: "comment",
          comment: updated[0],
          message: "Comment updated",
        });
      }

      //* Not a top-level comment - try as a reply
      const replyRows = await queryAsync(
        `SELECT r.id, r.comment_id, r.user_id, r.reply, r.created_at, r.updated_at, r.edited, c.activity_id, c.classroom_id
         FROM comment_replies r
         JOIN comments c ON c.id = r.comment_id
         WHERE r.id = ? AND c.activity_id = ? LIMIT 1`,
        [commentId, id]
      );

      if (replyRows.length) {
        const existingReply = replyRows[0];
        if (existingReply.user_id !== userId) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }

        await queryAsync(
          `UPDATE comment_replies SET reply = ?, updated_at = NOW(), edited = 1 WHERE id = ?`,
          [safe, commentId]
        );

        const updatedReply = await queryAsync(
          `SELECT r.id, r.comment_id, c.activity_id, c.classroom_id, r.user_id, r.reply, r.created_at, r.updated_at, r.edited, u.username, u.role
           FROM comment_replies r
           JOIN comments c ON c.id = r.comment_id
           JOIN users u ON u.id = r.user_id
           WHERE r.id = ? LIMIT 1`,
          [commentId]
        );

        return res.json({
          success: true,
          type: "reply",
          reply: updatedReply[0],
          message: "Reply updated",
        });
      }
    } catch (e) {
      console.error("Error updating comment:", e);
      return res.status(500).json({ success: false, error: "Server error" });
    }
  })
);

export default router;
// Todo: Make the instructions increment but the added instructions be the teacher not replay by it 