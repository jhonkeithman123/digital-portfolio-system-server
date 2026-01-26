import type { Request, Response } from "express";
import path from "path";
import type { AuthRequest } from "middleware/auth";
import db from "config/db";
import { queryAsync } from "helpers/dbHelper";
import type {
  ActivityRow,
  CommentRow,
  CommentReplyRow,
  InstructionEntry,
  ActivitySubmission,
} from "types/db";
import createNotification from "config/createNotification";
import type { RowDataPacket } from "mysql2/promise";
import fs from "fs/promises";
import multer, { type FileFilterCallback } from "multer";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
interface ClassroomIdRow extends RowDataPacket {
  id: number;
}

interface ActivityWithClassroom extends ActivityRow {
  classroom_code: string;
}

interface CommentWithUser extends CommentRow {
  username: string;
  role: string;
  edited?: 0 | 1;
}

interface ReplyWithUser extends CommentReplyRow {
  username: string;
  role: string;
  edited?: 0 | 1;
}

interface CommentWithReplies extends CommentWithUser {
  replies: ReplyWithUser[];
}

interface AuthResult {
  ok: boolean;
  reason?: string;
  activity?: ActivityRow;
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

// Configure multer middleware with file validatation
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

async function authorizeActivity(
  activityId: string | number,
  userId: number,
  role: string,
): Promise<AuthResult> {
  const rows = await queryAsync<ActivityRow>(
    `SELECT id, classroom_id, teacher_id, title, file_path, original_name, mime_type, created_at
     FROM activities
     WHERE id = ?
     LIMIT 1`,
    [activityId],
  );

  if (!rows.length) return { ok: false, reason: "Activity not found" };
  const activity = rows[0];

  if (role === "teacher") {
    if (activity.teacher_id !== userId)
      return { ok: false, reason: "Forbidden" };
  } else {
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
// CONTROLLERS
// ============================================================================

const getActivityById = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  console.log("userId", userId, "Id", id);

  const auth = await authorizeActivity(id, userId, role);
  if (!auth.ok) {
    const status = auth.reason === "Activity not found" ? 404 : 403;
    return res.status(status).json({ success: false, error: auth.reason });
  }

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

  if (role === "teacher") {
    if (activity.teacher_id !== userId) {
      return res
        .status(403)
        .json({ success: false, error: "Forbidden for this activity" });
    }
  } else {
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

  return res.json({
    success: true,
    activity: { ...activity, instructions },
  });
};

const deleteActivity = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
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
};

const getActivityComments = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  const auth = await authorizeActivity(id, userId, role);
  if (!auth.ok) {
    const status = auth.reason === "Activity not found" ? 404 : 403;
    return res.status(status).json({ success: false, error: auth.reason });
  }

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

  const repliesByComment: Record<number, ReplyWithUser[]> = {};
  if (comments.length > 0) {
    const ids = comments.map((c) => c.id);
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
      ids,
    );

    replies.forEach((r) => {
      (repliesByComment[r.comment_id] ||= []).push(r);
    });
  }

  const payload: CommentWithReplies[] = comments.map((c) => ({
    ...c,
    replies: repliesByComment[c.id] ?? [],
  }));

  return res.json({ success: true, comments: payload });
};

const createComment = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { comment } = req.body;

  const auth = await authorizeActivity(id, userId, role);
  if (!auth.ok) {
    const status = auth.reason === "Activity not found" ? 404 : 403;
    return res.status(status).json({ success: false, error: auth.reason });
  }

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

  const safe = trimmed.slice(0, 255);

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

  return res.json({
    success: true,
    comments: { ...inserted[0], replies: [] },
    message: "Comment added",
  });
};

const deleteComment = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const { id, commentId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  const auth = await authorizeActivity(id, userId, role);
  if (!auth.ok) {
    const status = auth.reason === "Activity not found" ? 404 : 403;
    return res.status(status).json({ success: false, error: auth.reason });
  }

  interface CommentIdUser extends RowDataPacket {
    id: number;
    user_id: number;
  }

  const commentRows = await queryAsync<CommentIdUser>(
    `SELECT id, user_id FROM comments WHERE id = ? AND activity_id = ? LIMIT 1`,
    [commentId, id],
  );

  if (commentRows.length) {
    const existing = commentRows[0];

    if (existing.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

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

    if (existingReply.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    await db.query<RowDataPacket[]>(
      `DELETE FROM comment_replies WHERE id = ?`,
      [commentId],
    );

    return res.json({ success: true, message: "Reply deleted" });
  }

  return res
    .status(404)
    .json({ success: false, error: "Comment or reply not found" });
};

const createReply = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const { id, commentId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { reply } = req.body;

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

  const parent = await queryAsync<RowDataPacket>(
    `SELECT id FROM comments WHERE id = ? AND activity_id = ? LIMIT 1`,
    [commentId, id],
  );
  if (!parent.length) {
    return res.status(404).json({ success: false, error: "Comment not found" });
  }

  const safe = trimmed.slice(0, 255);

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

  return res.json({
    success: true,
    reply: inserted[0],
    message: "Reply added",
  });
};

const deleteReply = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
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

  await db.query<RowDataPacket[]>(`DELETE FROM comment_replies WHERE id = ?`, [
    replyId,
  ]);

  return res.json({ success: true, message: "Reply deleted" });
};

const createActivity = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  try {
    if (req.user!.role !== "teacher")
      return res.status(403).json({ success: false, error: "Forbidden" });

    const { title, instructions, classroomCode, max_score } = req.body;
    if (!title || !instructions || !classroomCode) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    const classroom = await getClassroomForTeacher(
      classroomCode,
      req.user!.userId,
    );
    if (!classroom)
      return res
        .status(403)
        .json({ success: false, error: "Invalid classroom code" });

    const file = req.file || null;
    const maxScoreValue = parseInt(max_score, 10) || 100;

    const [result] = await db.query<RowDataPacket[]>(
      `INSERT INTO activities
        (classroom_id, teacher_id, title, file_path, original_name, mime_type, max_score)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        classroom.id,
        req.user!.userId,
        title.trim(),
        file ? file.filename : null,
        file ? file.originalname : null,
        file ? file.mimetype : null,
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
};

const getClassroomActivities = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const { code } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  let classroomRow: ClassroomIdRow | undefined;
  if (role === "teacher") {
    const rows = await queryAsync<ClassroomIdRow>(
      "SELECT id FROM classrooms WHERE code = ? AND teacher_id = ? LIMIT 1",
      [code, userId],
    );
    classroomRow = rows[0];
  } else {
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

  if (!classroomRow)
    return res
      .status(403)
      .json({ success: false, error: "Not authorized for this classroom" });

  const activities = await queryAsync<ActivityRow>(
    `SELECT id, classroom_id, teacher_id, title, file_path, 
            original_name, mime_type, created_at
   FROM activities
   WHERE classroom_id = ?
   ORDER BY created_at DESC`,
    [classroomRow.id],
  );

  return res.json({ success: true, activities });
};

const submitActivity = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  if (!(req as any).dbAvailable) {
    return res
      .status(503)
      .json({ success: false, error: "Database unavailable" });
  }

  const { id } = req.params;
  const { text } = req.body;
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

  const trimmedText = (text || "").trim();
  const file = req.file || null;

  if (!trimmedText && !file) {
    return res.status(400).json({
      success: false,
      error: "Submission must include text or a file",
    });
  }

  const existing = await queryAsync<ActivitySubmission>(
    `SELECT id FROM activity_submissions 
     WHERE activity_id = ? AND student_id = ? 
     LIMIT 1`,
    [id, userId],
  );

  let submissionId: number;

  if (existing.length) {
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

  return res.json({
    success: true,
    message: existing.length ? "Submission updated" : "Submission created",
    submission: submission[0],
  });
};

const updateInstructions = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
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

  if (role !== "teacher") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

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

  const activity = actRows[0];
  if (activity.teacher_id !== userId) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

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

  const safe = trimmed.slice(0, 2000);

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
    message: "Instruction added",
    instructions: allInstructions,
  });
};

const editInstruction = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  if (!(req as any).dbAvailable) {
    return res
      .status(503)
      .json({ success: false, error: "Database not available" });
  }

  const { id, instructionId } = req.params;
  const { instruction_text } = req.body;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role !== "teacher") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

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

  const instrRows = await queryAsync<InstructionEntry>(
    `SELECT id FROM activity_instructions WHERE id = ? AND activity_id = ? LIMIT 1`,
    [instructionId, id],
  );
  if (!instrRows.length) {
    return res
      .status(404)
      .json({ success: false, error: "Instruction not found" });
  }

  await db.query<RowDataPacket[]>(
    `UPDATE activity_instructions SET instruction_text = ?, updated_at = NOW() WHERE id = ?`,
    [safe, instructionId],
  );

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
};

const editComment = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  if (!(req as any).dbAvailable) {
    return res
      .status(503)
      .json({ success: false, error: "Database not available" });
  }

  const { id, commentId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { comment } = req.body;

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

  const auth = await authorizeActivity(id, userId, role);
  if (!auth.ok) {
    const status = auth.reason === "Activity not found" ? 404 : 403;
    return res.status(status).json({ success: false, error: auth.reason });
  }

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

  const commentRows = await queryAsync<CommentIdUser>(
    `SELECT id, user_id FROM comments WHERE id = ? AND activity_id = ? LIMIT 1`,
    [commentId, id],
  );

  if (commentRows.length) {
    const existing = commentRows[0];

    if (existing.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    await db.query<RowDataPacket[]>(
      `UPDATE comments SET comment = ?, updated_at = NOW(), edited = 1 WHERE id = ?`,
      [safe, commentId],
    );

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

    if (existingReply.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    await db.query<RowDataPacket[]>(
      `UPDATE comment_replies SET reply = ?, updated_at = NOW(), edited = 1 WHERE id = ?`,
      [safe, commentId],
    );

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

  return res
    .status(404)
    .json({ success: false, error: "Comment or reply not found" });
};

const getMySubmission = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
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
};

const getActivitySubmissions = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  if (!(req as any).dbAvailable) {
    return res
      .status(503)
      .json({ success: false, error: "Database not available" });
  }

  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

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

  const activityRows = await queryAsync<ActivityRow>(
    `SELECT max_score FROM activities WHERE id = ? LIMIT 1`,
    [id],
  );

  const maxScore = activityRows[0]?.max_score || 100;

  return res.json({ success: true, submissions, maxScore });
};

const deleteSubmission = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
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

  await db.query<RowDataPacket[]>(
    `DELETE FROM activity_submissions WHERE id = ?`,
    [submissionId],
  );

  return res.json({ success: true, message: "Submission removed" });
};

const gradeSubmission = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  if (!(req as any).dbAvailable) {
    return res
      .status(503)
      .json({ success: false, error: "Database unavailable" });
  }

  const { id, submissionId } = req.params;
  const { score } = req.body;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role !== "teacher") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  const auth = await authorizeActivity(id, userId, role);
  if (!auth.ok) {
    const status = auth.reason === "Activity not found" ? 404 : 403;
    return res.status(status).json({ success: false, error: auth.reason });
  }

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

  const parsedScore = parseFloat(score);
  if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > maxScore) {
    return res.status(400).json({
      success: false,
      error: `Score must be between 0 and ${maxScore}`,
    });
  }

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

  await db.query<RowDataPacket[]>(
    `UPDATE activity_submissions 
     SET score = ?, graded_at = NOW(), graded_by = ?
     WHERE id = ?`,
    [parsedScore, userId, submissionId],
  );

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
};

export { upload };

const controller = {
  getActivityById,
  getActivityComments,
  getActivitySubmissions,
  getClassroomActivities,
  getMySubmission,
  deleteActivity,
  deleteComment,
  deleteReply,
  deleteSubmission,
  editComment,
  editInstruction,
  createActivity,
  createComment,
  createReply,
  createNotification,
  gradeSubmission,
  submitActivity,
  updateInstructions,
};

export default controller;
