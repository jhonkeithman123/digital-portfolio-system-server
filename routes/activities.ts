import express, { type Request, type Response } from "express";
import path from "path";
import multer, { type FileFilterCallback } from "multer";
import wrapAsync from "utils/wrapAsync";
import db from "config/db";
import { verifyToken, type AuthRequest } from "middleware/auth";
import { queryAsync } from "helpers/dbHelper";
import type {
  ActivityRow,
  CommentRow,
  CommentReplyRow,
  InstructionEntry,
  ActivitySubmission,
} from "types/db";
import createNotification from "config/createNotification";
import type { RowDataPacket } from "mysql2";
import fs from "fs/promises";

const router = express.Router();

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================
// Configure where uploaded activity files will be stored
const uploadDir = path.join(process.cwd(), "uploads", "activities");

// Set up storage strategy: where files go and how they're named
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const base = file.originalname.replace(/\s+/g, "_");
    cb(null, `${ts}__${base}`);
  },
});

// Configure multer middleaare with file validatation
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB per file
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ];
    // Only allow specific document and image types
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
// Database row types extended with additional fields from JOINs
interface ClassroomIdRow extends RowDataPacket {
  id: number;
}

interface ActivityWithClassroom extends ActivityRow {
  classroom_code: string; // Added from JOIN with classroom table
}

interface CommentWithUser extends CommentRow {
  username: string; // Added from JOIN users table
  role: string; // Added from JOIN with users table
  edited?: 0 | 1; // Optional flag if comment was edited
}

interface ReplyWithUser extends CommentReplyRow {
  username: string; // Added from JOIN with users table
  role: string; // Added from JOIN with users table
  edited?: 0 | 1; // Optional flag if comment was edited
}

interface CommentWithReplies extends CommentWithUser {
  replies: ReplyWithUser[]; // Nested replies for each comment
}

interface AuthResult {
  ok: boolean; // Whether authorization passed
  reason?: string; // Error message if authorization failed
  activity?: ActivityRow; // The authorized activity successful
}

interface InstructionWithTeacher extends InstructionEntry {
  username: string;
  teacher_role: string;
}

interface ReplyWithActivity extends RowDataPacket {
  id: number;
  comment_id: number;
  user_id: number;
}

interface SubmissionWithUser extends ActivitySubmission {
  username: string;
  email: string;
  section: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetches a classroom by code, ensuring it belongs to the given teacher.
 * Used when teachers create activities - must verify classroom ownership.
 *
 * @param code - The classroom code (e.g., "ABC123")
 * @param teacherId - The teacher's user ID
 * @returns The classroom record or null if not found/unauthorized
 */
async function getClassroomForTeacher(
  code: string,
  teacherId: number,
): Promise<ClassroomIdRow | null> {
  const rows = await queryAsync<ClassroomIdRow>(
    "SELECT id FROM classrooms WHERE code = ? AND teacher_id = ? LIMIT 1",
    [code, teacherId],
  );
  return rows[0] || null;
}

/**
 * Authorizes access to an activity based on user role.
 *
 * Authorization rules:
 * - Teachers: Must own the activity (teacher_id matches)
 * - Students: Must be an accepted member of the activity's classroom
 *
 * @param activityId - The activity ID to check
 * @param userId - The requesting user's ID
 * @param role - The user's role ("teacher" or "student")
 * @returns Authorization result with activity data if successful
 */
async function authorizeActivity(
  activityId: string | number,
  userId: number,
  role: string,
): Promise<AuthResult> {
  // Step 1: Fetch the activity to get classroom and teacher info
  const rows = await queryAsync<ActivityRow>(
    `SELECT id, classroom_id, teacher_id, title, file_path, original_name, mime_type, created_at
     FROM activities
     WHERE id = ?
     LIMIT 1`,
    [activityId],
  );

  if (!rows.length) return { ok: false, reason: "Activity not found" };
  const activity = rows[0];

  // Step 2: Check authorization based on role
  if (role === "teacher") {
    // Teachers can only access activities they created
    if (activity.teacher_id !== userId)
      return { ok: false, reason: "Forbidden" };
  } else {
    // Students must be accepted members of the classroom
    const member = await queryAsync<RowDataPacket>(
      `SELECT 1
       FROM classroom_members
       WHERE classroom_id = ? AND student_id = ? AND status = 'accepted'
       LIMIT 1`,
      [activity.classroom_id, userId],
    );

    if (!member.length) return { ok: false, reason: "Forbidden" };
  }

  return { ok: true, activity };
}

// ============================================================================
// ROUTE: GET /:id - Fetch a single activity
// ============================================================================
/**
 * Retrieves detailed information about a specific activity.
 *
 * Process:
 * 1. Verify JWT token (verifyToken middleware)
 * 2. Check if database is available
 * 3. Authorize user access to the activity
 * 4. Fetch activity with classroom code
 * 5. Return activity data
 *
 * Authorization:
 * - Teachers: Must own the activity
 * - Students: Must be accepted member of the classroom
 */
router
  .route("/:id")
  .all(verifyToken) // Middleware: Decode JWT and attach user to req.user
  .get(
    wrapAsync(async (req: AuthRequest, res: Response) => {
      // Guard: Check if database is available
      if (!(req as any).dbAvailable) {
        return res
          .status(503)
          .json({ ok: false, error: "Database not available" });
      }

      const { id } = req.params;
      const userId = req.user!.userId; // ! = guaranteed by verifyToken middleware
      const role = req.user!.role;

      console.log("userId", userId, "Id", id);

      // Step 1: Check if user is authorized to view this activity
      const auth = await authorizeActivity(id, userId, role);
      if (!auth.ok) {
        const status = auth.reason === "Activity not found" ? 404 : 403;
        return res.status(status).json({ success: false, error: auth.reason });
      }

      // Step 2: Fetch activity details with classroom code
      const rows = await queryAsync<ActivityWithClassroom>(
        `SELECT a.id,
              a.classroom_id,
              a.teacher_id,
              a.title,
              a.file_path,
              a.original_name,
              a.mime_type,
              a.created_at,
              c.code as classroom_code
      FROM activities a
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE a.id = ?
      LIMIT 1`,
        [id],
      );

      if (!rows.length) {
        return res.status(404).json({ success: false, error: "Not found" });
      }

      const activity = rows[0];

      // Step 3: Double-check authorization (redundant but explicit)
      if (role === "teacher") {
        if (activity.teacher_id !== userId) {
          return res
            .status(403)
            .json({ success: false, error: "Forbidden for this activity" });
        }
      } else {
        // For students, verify classroom membership again
        const memberRows = await queryAsync<RowDataPacket>(
          `SELECT 1
         FROM classroom_members
         WHERE classroom_id = ? AND student_id = ? AND status = 'accepted'
         LIMIT 1`,
          [activity.classroom_id, userId],
        );

        if (!memberRows.length) {
          return res
            .status(403)
            .json({ success: false, error: "Forbidden for this activity" });
        }
      }

      const instructions = await queryAsync<InstructionWithTeacher>(
        `SELECT ai.id,
              ai.activity_id,
              ai.teacher_id,
              ai.instruction_text,
              ai.created_at,
              ai.updated_at,
              u.username,
              u.role as teacher_role
       FROM activity_instructions ai
       JOIN users u ON u.ID = ai.teacher_id
       WHERE ai.activity_id = ?
       ORDER BY ai.created_at ASC`,
        [id],
      );

      // Step 4: Return activity data
      return res.json({
        success: true,
        activity: { ...activity, instructions },
      });
    }),
  )
  .delete(
    wrapAsync(async (req: AuthRequest, res: Response) => {
      if (!(req as any).dbAvailable) {
        return res
          .status(503)
          .json({ success: false, error: "Database unavailable" });
      }

      const { id } = req.params;
      const userId = req.user!.userId;
      const role = req.user!.role;

      if (role !== "teacher") {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const rows = await queryAsync<ActivityRow>(
        `SELECT id, teacher_id FROM activities WHERE id = ? LIMIT 1`,
        [id],
      );
      if (!rows.length) {
        return res
          .status(404)
          .json({ success: false, error: "Activity not found" });
      }

      if (rows[0].teacher_id !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      await db.query(`DELETE FROM activities WHERE id = ?`, [id]);
      return res.json({ success: true, message: "Activity deleted" });
    }),
  );

// ============================================================================
// ROUTE: GET /:id/comments - Fetch all comments for an activity
// ============================================================================
/**
 * Retrieves all comments and their replies for an activity.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Authorize user access to the activity
 * 3. Fetch all top-level comments (ordered oldest first)
 * 4. Fetch all replies for those comments (using IN clause)
 * 5. Group replies by comment_id
 * 6. Return structured data with comments containing their replies
 *
 * Response structure:
 * {
 *   comments: [
 *     { id, comment, username, role, replies: [...] },
 *     ...
 *   ]
 * }
 */
router
  .route("/:id/comments")
  .all(verifyToken) // Apply token verification to all methods on this route
  .get(
    wrapAsync(async (req: AuthRequest, res: Response) => {
      if (!(req as any).dbAvailable) {
        return res
          .status(503)
          .json({ ok: false, error: "Database not available" });
      }

      const { id } = req.params;
      const userId = req.user!.userId;
      const role = req.user!.role;

      // Step 1: Authorize access to the activity
      const auth = await authorizeActivity(id, userId, role);
      if (!auth.ok) {
        const status = auth.reason === "Activity not found" ? 404 : 403;
        return res.status(status).json({ success: false, error: auth.reason });
      }

      // Step 2: Fetch all top-level comments (oldest first for chronological order)
      const comments = await queryAsync<CommentWithUser>(
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
        [id, auth.activity!.classroom_id],
      );

      // Step 3: Fetch all replies for these comments (if any)
      const repliesByComment: Record<number, ReplyWithUser[]> = {};
      if (comments.length > 0) {
        const ids = comments.map((c) => c.id); // Extract comment IDs

        // Use IN (?) to fetch all replies in one query
        const placeholder = ids.map(() => "?").join(",");
        const replies = await queryAsync<ReplyWithUser>(
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
           WHERE r.comment_id IN (${placeholder})
           ORDER BY r.created_at ASC`,
          ids, // DBParams allows arrays for IN clauses
        );

        // Step 4: Group replies by their parent comment ID
        replies.forEach((r) => {
          (repliesByComment[r.comment_id] ||= []).push(r);
        });
      }

      // Step 5: Construct final payload with nested replies
      const payload: CommentWithReplies[] = comments.map((c) => ({
        ...c,
        replies: repliesByComment[c.id] ?? [], // Empty array if no replies
      }));

      return res.json({ success: true, comments: payload });
    }),
  )
  // ============================================================================
  // ROUTE: POST /:id/comments - Add a new comment to an activity
  // ============================================================================
  /**
   * Creates a new top-level comment on an activity.
   *
   * Process:
   * 1. Verify JWT token
   * 2. Authorize user access to the activity
   * 3. Validate comment text (not empty, max 255 chars)
   * 4. Insert comment into database
   * 5. Fetch the newly created comment with user details
   * 6. Return the comment with empty replies array
   */
  .post(
    wrapAsync(async (req: AuthRequest, res: Response) => {
      if (!(req as any).dbAvailable) {
        return res
          .status(503)
          .json({ ok: false, error: "Database not available" });
      }

      const { id } = req.params;
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { comment } = req.body;

      // Step 1: Authorize access
      const auth = await authorizeActivity(id, userId, role);
      if (!auth.ok) {
        const status = auth.reason === "Activity not found" ? 404 : 403;
        return res.status(status).json({ success: false, error: auth.reason });
      }

      // Step 2: Validate comment text
      if (typeof comment !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Comment text are required" });
      }

      const trimmed = comment.trim();
      if (!trimmed.length) {
        return res
          .status(400)
          .json({ success: false, error: "Comments cannot be empty" });
      }

      // Enforce database column length (varchar(255))
      const safe = trimmed.slice(0, 255);

      // Step 3: Insert comment into database
      const [result] = await db.query<RowDataPacket[]>(
        `INSERT INTO comments
            (classroom_id, activity_id, user_id, comment, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [auth.activity!.classroom_id, id, userId, safe],
      );

      if (!result || typeof result !== "object" || !("insertId" in result)) {
        console.error("[ROUTE ERROR] Invalid result from INSERT:", result);
        return res
          .status(500)
          .json({ success: false, error: "Failed to insert comment" });
      }

      const commentId = (result as any).insertId;

      // Step 4: Fetch the newly created comment with user details
      const inserted = await queryAsync<CommentWithUser>(
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
        [commentId],
      );

      // Step 5: Return the comment with empty replies array
      return res.json({
        success: true,
        comments: { ...inserted[0], replies: [] },
        message: "Comment added",
      });
    }),
  );

router.delete(
  "/:id/comments/:commentId",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { id, commentId } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Authorize the activity access
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    // Define types for query results
    interface CommentIdUser extends RowDataPacket {
      id: number;
      user_id: number;
    }

    // Try to delete as a top-level comment
    const commentRows = await queryAsync<CommentIdUser>(
      `SELECT id, user_id FROM comments WHERE id = ? AND activity_id = ? LIMIT 1`,
      [commentId, id],
    );

    if (commentRows.length) {
      const existing = commentRows[0];

      // Verify user owns this comment
      if (existing.user_id !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      // Delete the comment (CASCADE will delete replies)
      await db.query<RowDataPacket[]>(`DELETE FROM comments WHERE id = ?`, [
        commentId,
      ]);

      return res.json({ success: true, message: "Comment deleted" });
    }

    const replyRows = await queryAsync<ReplyWithActivity>(
      `SELECT r.id, r.comment_id, r.user_id
       FROM comment_replies r
       JOIN comments c ON c.id = r.comment_id
       WHERE r.id = ? AND c.activity_id = ? LIMIT 1`,
      [commentId, id],
    );

    if (replyRows.length) {
      const existingReply = replyRows[0];

      // Check if the users owns this reply
      if (existingReply.user_id !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      // Delete the reply
      await db.query<RowDataPacket[]>(
        `DELETE FROM comment_replies WHERE id = ?`,
        [commentId],
      );

      return res.json({ success: true, message: "Reply deleted" });
    }

    // Return this if niether comment nor reply found
    return res
      .status(404)
      .json({ success: false, error: "Comment or reply not found" });
  }),
);

// ============================================================================
// ROUTE: POST /:id/comments/:commentId/replies - Add a reply to a comment
// ============================================================================
/**
 * Creates a reply to an existing comment.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Authorize user access to the activity
 * 3. Validate reply text
 * 4. Verify parent comment exists
 * 5. Insert reply into database
 * 6. Fetch newly created reply with user details
 * 7. Return the reply
 */
router.post(
  "/:id/comments/:commentId/replies",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { id, commentId } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { reply } = req.body;

    // Step 1: Authorize access to the activity
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    // Step 2: Validate reply text
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

    // Step 3: Verify parent comment exists and belongs to this activity
    const parent = await queryAsync<RowDataPacket>(
      `SELECT id FROM comments WHERE id = ? AND activity_id = ? LIMIT 1`,
      [commentId, id],
    );
    if (!parent.length) {
      return res
        .status(404)
        .json({ success: false, error: "Comment not found" });
    }

    // Enforce database column length (varchar(255))
    const safe = trimmed.slice(0, 255);

    // Step 4: Insert reply into database
    const [result] = await db.query<RowDataPacket[]>(
      `INSERT INTO comment_replies
        (comment_id, user_id, reply, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [commentId, userId, safe],
    );

    if (!result || typeof result !== "object" || !("insertId" in result)) {
      console.error(`[ROUTE ERROR] Invalid result from INSERT:`, result);
      return res
        .status(500)
        .json({ success: false, error: "Failed to insert reply" });
    }

    const replyId = (result as any).insertId;

    // Step 5: Fetch newly created reply with user details
    const inserted = await queryAsync<ReplyWithUser>(
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
       WHERE r.id = ?
       LIMIT 1`,
      [replyId],
    );

    if (!inserted.length) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch inserted reply" });
    }

    // Step 6: Return the reply
    return res.json({
      success: true,
      reply: inserted[0],
      message: "Reply added",
    });
  }),
);

router.delete(
  "/:id/comments/:commentId/replies/:replyId",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ success: false, error: "Database not found" });
    }

    const { id, commentId, replyId } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const replyRows = await queryAsync<ReplyWithActivity>(
      `SELECT r.id, r.comment_id, r.user_id
       FROM comment_replies r
       JOIN comments c ON c.id = r.comment_id
       WHERE r.id = ? AND r.comment_id = ? AND c.activity_id = ? AND c.id = ?
       LIMIT 1`,
      [replyId, commentId, id, commentId],
    );

    if (!replyRows.length) {
      return res.status(404).json({ success: false, error: "Reply not found" });
    }
    const existingReply = replyRows[0];

    if (existingReply.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    await db.query<RowDataPacket[]>(
      `DELETE FROM comment_replies WHERE id = ?`,
      [replyId],
    );

    return res.json({ success: true, message: "Reply deleted" });
  }),
);

// ============================================================================
// ROUTE: POST /create - Teacher creates a new activity
// ============================================================================
/**
 * Allows teachers to create a new activity with optional file attachment.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Check role is "teacher"
 * 3. Validate required fields (title, instructions, classroomCode)
 * 4. Verify teacher owns the classroom
 * 5. Handle file upload (if provided)
 * 6. Insert activity into database
 * 7. Return new activity ID
 */
router.post(
  "/create",
  verifyToken,
  upload.single("file"), // Multer middleware: handle single file upload
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    try {
      // Step 1: Check if user is a teacher
      if (req.user!.role !== "teacher")
        return res.status(403).json({ success: false, error: "Forbidden" });

      // Step 2: Validate required fields
      const { title, instructions, classroomCode, max_score } = req.body;
      if (!title || !instructions || !classroomCode) {
        return res
          .status(400)
          .json({ success: false, error: "Missing required fields" });
      }

      // Step 3: Verify teacher owns the classroom
      const classroom = await getClassroomForTeacher(
        classroomCode,
        req.user!.userId,
      );
      if (!classroom)
        return res
          .status(403)
          .json({ success: false, error: "Invalid classroom code" });

      // Step 4: Get uploaded file info (or null if no file)
      const file = req.file || null;

      // Step 5: Insert activity into database
      const maxScoreValue = parseInt(max_score, 10) || 100;

      const [result] = await db.query<RowDataPacket[]>(
        `INSERT INTO activities
          (classroom_id, teacher_id, title, file_path, original_name, mime_type, max_score)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          classroom.id,
          req.user!.userId,
          title.trim(),
          file ? file.filename : null, // Stored filename
          file ? file.originalname : null, // Original filename for display
          file ? file.mimetype : null, // MIME type for proper handling
          maxScoreValue,
        ],
      );

      const activityId = (result as any).insertId;

      const trimmedInstructions = instructions.trim();
      if (trimmedInstructions) {
        await db.query<RowDataPacket[]>(
          `INSERT INTO activity_instructions
            (activity_id, teacher_id, instruction_text, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [activityId, req.user!.userId, trimmedInstructions.slice(0, 2000)],
        );
      }

      // Step 6: Return success with new activity ID
      return res.json({
        success: true,
        id: activityId,
        message: "Activity created",
      });
    } catch (err) {
      console.error("Error creating activity:", err);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  }),
);

// ============================================================================
// ROUTE: GET /classroom/:code - List all activities in a classroom
// ============================================================================
/**
 * Retrieves all activities for a specific classroom.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Validate classroom access based on role:
 *    - Teachers: Must own the classroom
 *    - Students: Must be accepted member
 * 3. Fetch all activities for the classroom
 * 4. Return activities (newest first)
 *
 * Authorization:
 * - Teachers: classroom.teacher_id matches user
 * - Students: classroom_members.status = 'accepted'
 */
router.get(
  "/classroom/:code",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { code } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Step 1: Validate classroom access based on role
    let classroomRow: ClassroomIdRow | undefined;
    if (role === "teacher") {
      // Teachers must own the classroom
      const rows = await queryAsync<ClassroomIdRow>(
        "SELECT id FROM classrooms WHERE code = ? AND teacher_id = ? LIMIT 1",
        [code, userId],
      );
      classroomRow = rows[0];
    } else {
      // Students must be accepted members
      const rows = await queryAsync<ClassroomIdRow>(
        `SELECT c.id
       FROM classrooms c
       JOIN classroom_members cm ON cm.classroom_id = c.id
       WHERE c.code = ? AND cm.student_id = ? AND cm.status = 'accepted'
       LIMIT 1`,
        [code, userId],
      );
      classroomRow = rows[0];
    }

    // Step 2: Check if user has access
    if (!classroomRow)
      return res
        .status(403)
        .json({ success: false, error: "Not authorized for this classroom" });

    // Step 3: Fetch all activities for this classroom (newest first)
    const activities = await queryAsync<ActivityRow>(
      `SELECT id, classroom_id, teacher_id, title, file_path, 
              original_name, mime_type, created_at
     FROM activities
     WHERE classroom_id = ?
     ORDER BY created_at DESC`,
      [classroomRow.id],
    );

    // Step 4: Return activities list
    return res.json({ success: true, activities });
  }),
);

// ============================================================================
// ROUTE: POST /:id/submit - Student submits answer for an activity
// ============================================================================
/**
 * Allows students to submit their work for an activity.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Check role is "student"
 * 3. Authorize student access to the activity (must be in classroom)
 * 4. Validate submission (text or file required)
 * 5. Handle file upload if provided
 * 6. Insert or update submission in database
 * 7. Return submission details
 *
 * Security:
 * - Only students can submit
 * - Must be accepted member of the classroom
 * - One submission per student per activity (upsert logic)
 */
router.post(
  "/:id/submit",
  verifyToken,
  upload.single("file"), // Handle optional file upload
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ success: false, error: "Database unavailable" });
    }

    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Step 1: Only students can submit
    if (role !== "student") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    // Step 2: Authorize student access to the activity
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    // Step 3: Validate submission (must have text or file)
    const trimmedText = (text || "").trim();
    const file = req.file || null;

    if (!trimmedText && !file) {
      return res.status(400).json({
        success: false,
        error: "Submission must include text or a file",
      });
    }

    // Step 4: Check if student already has a submission
    const existing = await queryAsync<ActivitySubmission>(
      `SELECT id FROM activity_submissions 
       WHERE activity_id = ? AND student_id = ? 
       LIMIT 1`,
      [id, userId],
    );

    let submissionId: number;

    if (existing.length) {
      // Update existing submission
      submissionId = existing[0].id;

      await db.query<RowDataPacket[]>(
        `UPDATE activity_submissions 
         SET file_path = ?, 
             original_name = ?, 
             mime_type = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          file ? file.filename : null,
          file ? file.originalname : null,
          file ? file.mimetype : null,
          submissionId,
        ],
      );
    } else {
      // Insert new submission
      const [result] = await db.query<RowDataPacket[]>(
        `INSERT INTO activity_submissions 
          (activity_id, student_id, file_path, original_name, mime_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id,
          userId,
          file ? file.filename : null,
          file ? file.originalname : null,
          file ? file.mimetype : null,
        ],
      );

      if (!result || !("insertId" in result)) {
        console.error("[ROUTE ERROR] Failed to insert submission:", result);
        return res
          .status(500)
          .json({ success: false, error: "Failed to save submission" });
      }

      submissionId = (result as any).insertId;
    }

    // Step 5: Fetch the submission details
    const submission = await queryAsync<
      ActivitySubmission & {
        username: string;
        email: string;
        section: string | null;
      }
    >(
      `SELECT s.id,
              s.activity_id,
              s.student_id,
              s.file_path,
              s.original_name,
              s.mime_type,
              s.score,
              s.graded_at,
              s.graded_by,
              s.created_at,
              s.updated_at,
              u.username,
              u.email,
              u.section
       FROM activity_submissions s
       JOIN users u ON u.ID = s.student_id
       WHERE s.id = ?
       LIMIT 1`,
      [submissionId],
    );

    // Step 6: Return success
    return res.json({
      success: true,
      message: existing.length ? "Submission updated" : "Submission created",
      submission: submission[0],
    });
  }),
);

// ============================================================================
// ROUTE: PATCH /:id/instructions - Update activity instructions (teacher only)
// ============================================================================
/**
 * Allows teachers to edit the instructions of an activity they own.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Check role is "teacher"
 * 3. Verify activity exists and teacher owns it
 * 4. Validate new instructions
 * 5. Update instructions in database
 * 6. Return updated activity
 *
 * Security:
 * - Only teachers can update
 * - Must own the activity (teacher_id matches)
 * - Max 10,000 characters to prevent huge payloads
 */
router.patch(
  "/:id/instructions",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      console.error("DB unavailable");
      return res
        .status(500)
        .json({ success: false, error: "Database not available" });
    }

    const { id } = req.params;
    const { instructions } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Step 1: Check if user is a teacher
    if (role !== "teacher") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    // Step 2: Ensure activity exists and fetch ownership info
    const actRows = await queryAsync<ActivityRow>(
      `SELECT id, classroom_id, teacher_id, title, 
              file_path, original_name, mime_type, created_at
     FROM activities
     WHERE id = ?
     LIMIT 1`,
      [id],
    );

    if (!actRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Activity not found" });
    }

    // Step 3: Verify teacher owns this activity
    const activity = actRows[0];
    if (activity.teacher_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    // Step 4: Validate new instructions
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

    // Enforce max length (2,000 chars per instruction)
    const safe = trimmed.slice(0, 2000);

    // Step 5: Insert new instruction entry (append mode)
    const [result] = await db.query<RowDataPacket[]>(
      `INSERT INTO activity_instructions
        (activity_id, teacher_id, instruction_text, created_at)
       VALUES (?, ?, ?, NOW())`,
      [id, userId, safe],
    );

    if (!result || !("insertId" in result)) {
      console.error("[ROUTE ERROR] Failed to insert instruction:", result);
      return res
        .status(500)
        .json({ success: false, error: "Failed to save instruction" });
    }

    // Step 6: Fetch all instructions for this activity (oldest first)
    const allInstructions = await queryAsync<InstructionWithTeacher>(
      `SELECT ai.id,
              ai.activity_id,
              ai.teacher_id,
              ai.instruction_text,
              ai.created_at,
              ai.updated_at,
              u.username,
              u.role as teacher_role
       FROM activity_instructions ai
       JOIN users u ON u.ID = ai.teacher_id
       WHERE ai.activity_id = ?
       ORDER BY ai.created_at ASC`,
      [id],
    );

    // Step 7: Return all instructions with attribution
    return res.json({
      success: true,
      message: "Instruction added",
      instructions: allInstructions,
    });
  }),
);

router.put(
  "/:id/instructions/:instructionId",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ success: false, error: "Database not available" });
    }

    const { id, instructionId } = req.params;
    const { instruction_text } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Only teachers can access this
    if (role !== "teacher") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    // Check if the instruction text is a string
    if (typeof instruction_text !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Invalid instruction text" });
    }

    const trimmed = instruction_text.trim();
    if (!trimmed) {
      return res
        .status(400)
        .json({ success: false, error: "Instruction cannot be empty" });
    }
    const safe = trimmed.slice(0, 2000);

    // Verify activity ownership
    const actRows = await queryAsync<ActivityRow>(
      `SELECT id, teacher_id FROM activities WHERE id = ? LIMIT 1`,
      [id],
    );
    if (!actRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Activity not found" });
    }
    if (actRows[0].teacher_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    // Verify instruction belongs to this activity
    const instrRows = await queryAsync<InstructionEntry>(
      `SELECT id FROM activity_instructions WHERE id = ? AND activity_id = ? LIMIT 1`,
      [instructionId, id],
    );
    if (!instrRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Instruction not found" });
    }

    // Update instruction
    await db.query<RowDataPacket[]>(
      `UPDATE activity_instructions SET instruction_text = ?, updated_at = NOW() WHERE id = ?`,
      [safe, instructionId],
    );

    // Return full instruction list (oldest first)
    const allInstructions = await queryAsync<InstructionWithTeacher>(
      `SELECT ai.id,
              ai.activity_id,
              ai.teacher_id,
              ai.instruction_text,
              ai.created_at,
              ai.updated_at,
              u.username,
              u.role as teacher_role
       FROM activity_instructions ai
       JOIN users u ON u.ID = ai.teacher_id
       WHERE ai.activity_id = ?
       ORDER BY ai.created_at ASC`,
      [id],
    );

    return res.json({
      success: true,
      message: "Instruction updated",
      instructions: allInstructions,
    });
  }),
);

// ============================================================================
// ROUTE: PATCH /:id/comments/:commentId - Edit a comment or reply
// ============================================================================
/**
 * Allows users to edit their own comments or replies.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Validate new comment text
 * 3. Authorize access to the activity
 * 4. Try to update as a top-level comment first
 * 5. If not found, try to update as a reply
 * 6. Return updated comment/reply with edited flag
 *
 * Security:
 * - Users can only edit their own comments/replies (user_id matches)
 * - Must have access to the activity
 * - Sets edited = 1 flag to indicate modification
 */
router.patch(
  "/:id/comments/:commentId",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ success: false, error: "Database not available" });
    }

    const { id, commentId } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { comment } = req.body;

    // Step 1: Validate new comment text
    if (typeof comment !== "string") {
      return res.status(400).json({ success: false, error: "Invalid comment" });
    }
    const trimmed = comment.trim();
    if (!trimmed) {
      return res
        .status(400)
        .json({ success: false, error: "Comment cannot be empty" });
    }
    const safe = trimmed.slice(0, 255);

    // Step 2: Authorize activity access
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    // Define types for different query results
    interface CommentIdUser extends RowDataPacket {
      id: number;
      user_id: number;
    }

    interface ReplyWithActivity extends RowDataPacket {
      id: number;
      comment_id: number;
      user_id: number;
      reply: string;
      created_at: Date;
      updated_at: Date;
      edited?: 0 | 1;
      activity_id: number;
      classroom_id: number;
    }

    // Step 3: Try to update as a top-level comment
    const commentRows = await queryAsync<CommentIdUser>(
      `SELECT id, user_id FROM comments WHERE id = ? AND activity_id = ? LIMIT 1`,
      [commentId, id],
    );

    if (commentRows.length) {
      const existing = commentRows[0];

      // Verify user owns this comment
      if (existing.user_id !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      // Update comment and set edited flag
      await db.query<RowDataPacket[]>(
        `UPDATE comments SET comment = ?, updated_at = NOW(), edited = 1 WHERE id = ?`,
        [safe, commentId],
      );

      // Fetch updated comment with user details
      const updated = await queryAsync<CommentWithUser>(
        `SELECT c.id, c.activity_id, c.classroom_id, c.user_id, c.comment, 
                c.created_at, c.updated_at, c.edited, u.username, u.role
        FROM comments c
        JOIN users u ON u.ID = c.user_id
        WHERE c.id = ? LIMIT 1`,
        [commentId],
      );

      return res.json({
        success: true,
        type: "comment",
        comment: updated[0],
        message: "Comment updated",
      });
    }

    // Step 4: Not a top-level comment - try as a reply
    const replyRows = await queryAsync<ReplyWithActivity>(
      `SELECT r.id, r.comment_id, r.user_id, r.reply, r.created_at, r.updated_at, 
              r.edited, c.activity_id, c.classroom_id
       FROM comment_replies r
       JOIN comments c ON c.id = r.comment_id
       WHERE r.id = ? AND c.activity_id = ? LIMIT 1`,
      [commentId, id],
    );

    if (replyRows.length) {
      const existingReply = replyRows[0];

      // Verify user owns this reply
      if (existingReply.user_id !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      // Update reply and set edited flag
      await db.query<RowDataPacket[]>(
        `UPDATE comment_replies SET reply = ?, updated_at = NOW(), edited = 1 WHERE id = ?`,
        [safe, commentId],
      );

      // Fetch updated reply with user details
      const updatedReply = await queryAsync<ReplyWithUser>(
        `SELECT r.id, r.comment_id, r.user_id, r.reply, r.created_at, r.updated_at, 
                r.edited, u.username, u.role
         FROM comment_replies r
         JOIN users u ON u.ID = r.user_id
         WHERE r.id = ? LIMIT 1`,
        [commentId],
      );

      return res.json({
        success: true,
        type: "reply",
        reply: updatedReply[0],
        message: "Reply updated",
      });
    }

    // Step 5: Neither comment nor reply found
    return res
      .status(404)
      .json({ success: false, error: "Comment or reply not found" });
  }),
);

// ============================================================================
// ROUTE: GET /:id/my-submission - Get current user's submission
// ============================================================================
/**
 * Allows students to view their own submission for an activity.
 */
router.get(
  "/:id/my-submission",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ success: false, error: "Database unavailable" });
    }

    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "student") {
      console.log("[DEBUG] Not a student, forbidden");
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const submission = await queryAsync<ActivitySubmission>(
      `SELECT id, activity_id, student_id, file_path, original_name, 
              mime_type, score, graded_at, graded_by, created_at, updated_at
       FROM activity_submissions 
       WHERE activity_id = ? AND student_id = ? 
       LIMIT 1`,
      [id, userId],
    );

    console.log("Submission found:", submission.length > 0);

    if (!submission.length) {
      return res.json({ success: true, submission: null });
    }

    return res.json({ success: true, submission: submission[0] });
  }),
);

// ============================================================================
// ROUTE: GET /:id/submissions - List submissions for this activity (teacher only)
// ============================================================================
router.get(
  "/:id/submissions",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ success: false, error: "Database not available" });
    }

    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Only teachers
    if (role !== "teacher") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    const submissions = await queryAsync<
      SubmissionWithUser & {
        score: number | null;
        graded_at: string | null;
        graded_by: number | null;
      }
    >(
      `SELECT s.id,
              s.activity_id,
              s.student_id,
              s.file_path,
              s.original_name,
              s.mime_type,
              s.score,
              s.graded_at,
              s.graded_by,
              s.created_at,
              s.updated_at,
              u.username,
              u.email,
              u.section
       FROM activity_submissions s
       JOIN users u ON u.ID = s.student_id
       WHERE s.activity_id = ?
       ORDER BY s.created_at DESC`,
      [id],
    );

    // Get activity max_score
    const activityRows = await queryAsync<ActivityRow>(
      `SELECT max_score FROM activities WHERE id = ? LIMIT 1`,
      [id],
    );

    const maxScore = activityRows[0]?.max_score || 100;

    return res.json({ success: true, submissions, maxScore });
  }),
);

// ============================================================================
// ROUTE: DELETE /:id/submission/:submissionId - Unsubmit (student only)
// ============================================================================
/**
 * Allows students to delete/unsubmit their own submission.
 */
router.delete(
  "/:id/submission/:submissionId",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ success: false, error: "Database unavailable" });
    }

    const { id, submissionId } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== "student") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    // Verify submission belongs to this student
    const existing = await queryAsync<ActivitySubmission>(
      `SELECT id, student_id, file_path 
       FROM activity_submissions 
       WHERE id = ? AND activity_id = ? 
       LIMIT 1`,
      [submissionId, id],
    );

    if (!existing.length) {
      return res
        .status(404)
        .json({ success: false, error: "Submission not found" });
    }

    if (existing[0].student_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    // Delete file if exists
    if (existing[0].file_path) {
      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        "activities",
        existing[0].file_path,
      );
      try {
        await fs.unlink(filePath);
      } catch (e) {
        console.error("Failed to delete file:", e);
      }
    }

    // Delete submission
    await db.query<RowDataPacket[]>(
      `DELETE FROM activity_submissions WHERE id = ?`,
      [submissionId],
    );

    return res.json({ success: true, message: "Submission removed" });
  }),
);

// ============================================================================
// ROUTE: PATCH /:id/submissions/:submissionId/score - Grade a submission
// ============================================================================
/**
 * Allows teachers to assign a score to a student's submission.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Check role is "teacher"
 * 3. Authorize activity ownership
 * 4. Validate score (0 to activity.max_score)
 * 5. Update submission with score and timestamp
 * 6. Return updated submission
 */
router.patch(
  "/:id/submissions/:submissionId/score",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ success: false, error: "Database unavailable" });
    }

    const { id, submissionId } = req.params;
    const { score } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Only teachers can grade
    if (role !== "teacher") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    // Authorize activity ownership
    const auth = await authorizeActivity(id, userId, role);
    if (!auth.ok) {
      const status = auth.reason === "Activity not found" ? 404 : 403;
      return res.status(status).json({ success: false, error: auth.reason });
    }

    // Get activity max_score
    const activityRows = await queryAsync<ActivityRow & { max_score: number }>(
      `SELECT id, max_score FROM activities WHERE id = ? LIMIT 1`,
      [id],
    );

    if (!activityRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Activity not found" });
    }

    const maxScore = activityRows[0].max_score || 100;

    // Validate score
    const parsedScore = parseFloat(score);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > maxScore) {
      return res.status(400).json({
        success: false,
        error: `Score must be between 0 and ${maxScore}`,
      });
    }

    // Verify submission exists and belongs to this activity
    const subRows = await queryAsync<SubmissionWithUser>(
      `SELECT s.id, s.activity_id
       FROM activity_submissions s
       WHERE s.id = ? AND s.activity_id = ?
       LIMIT 1`,
      [submissionId, id],
    );

    if (!subRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Submission not found" });
    }

    // Update score
    await db.query<RowDataPacket[]>(
      `UPDATE activity_submissions 
       SET score = ?, graded_at = NOW(), graded_by = ?
       WHERE id = ?`,
      [parsedScore, userId, submissionId],
    );

    // Fetch updated submission
    const updated = await queryAsync<
      SubmissionWithUser & {
        score: number | null;
        graded_at: string | null;
        graded_by: number | null;
      }
    >(
      `SELECT s.id,
              s.activity_id,
              s.student_id,
              s.file_path,
              s.original_name,
              s.mime_type,
              s.score,
              s.graded_at,
              s.graded_by,
              s.created_at,
              s.updated_at,
              u.username,
              u.email,
              u.section
       FROM activity_submissions s
       JOIN users u ON u.ID = s.student_id
       WHERE s.id = ?
       LIMIT 1`,
      [submissionId],
    );

    try {
      console.log("Creating notification");
      const activityTitle = activityRows[0]?.title || "Activity";
      await createNotification({
        recipientId: updated[0].student_id,
        senderId: userId,
        type: "grade",
        message: `Your activity "${activityTitle}" was graded ${parsedScore}/${maxScore}.`,
        link: `/activity/${id}/view`,
      });
    } catch (e) {
      console.error("[notify] activity grade:", (e as Error).message);
    }

    return res.json({
      success: true,
      message: "Score updated",
      submission: updated[0],
      maxScore,
    });
  }),
);
export default router;
