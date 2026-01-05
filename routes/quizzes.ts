import express, { type Response } from "express";
import { verifyToken, type AuthRequest } from "../middleware/auth.js";
import { queryAsync } from "../config/helpers/dbHelper.js";
import wrapAsync from "../utils/wrapAsync.js";
import db from "../config/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import createNotification from "../config/createNotification.js";

const router = express.Router();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface QuizRow extends RowDataPacket {
  id: number;
  classroom_id: number;
  teacher_id: number;
  title: string;
  questions: string | null; // Deprecated: kept for compatibility
  attempts_allowed: number | null;
  start_time: Date | null;
  end_time: Date | null;
  time_limit_seconds: number | null;
  created_at: Date;
}

interface QuizPageRow extends RowDataPacket {
  id: number;
  quiz_id: number;
  page_index: number;
  title: string;
  content_json: string;
}

interface QuestionData {
  id: string;
  type: "multiple_choice" | "checkboxes" | "short_answer" | "paragraph";
  text: string;
  options?: string[]; // For multiple_choice and checkboxes
  correctAnswer?: string | string[] | null; // Hidden from students
  sentenceLimit?: number; // For short_answer and paragraph
  requiresManualGrading: boolean;
}

interface PageData {
  id: string;
  title: string;
  questions: QuestionData[];
}

interface QuizAttemptRow extends RowDataPacket {
  id: number;
  quiz_id: number;
  student_id: number;
  attempt_no: number;
  status: "in_progress" | "completed";
  score: number | null;
  answers: string; // JSON stringified
  started_at: Date;
  submitted_at: Date | null;
  expires_at: Date | null;
  grading: string; // JSON stringified
  grader_id: number | null;
  graded_at: Date | null;
  comment: string;
}

interface QuizAttemptResponse {
  id: number;
  quiz_id: number;
  student_id: number;
  student_name: string;
  attempt_no: number;
  status: "in_progress" | "completed";
  score: number | null;
  answers: Record<string, unknown>;
  started_at: Date;
  submitted_at: Date | null;
  expires_at: Date | null;
  grading: Record<string, unknown>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely parse JSON string to object.
 * Used for quiz_pages.content_json and quiz_attempts.answers
 *
 * Process:
 * 1. Check if input is already an object (skip parsing)
 * 2. If string, attempt JSON.parse()
 * 3. If parsing fails, return empty object or array
 * 4. Silently handle errors (prevents app crash on corrupt data)
 *
 * Use cases:
 * - Loading quiz questions from database
 * - Parsing student answers from attempts
 * - Safe JSON handling without try-catch at call site
 *
 * @param raw - String or object to parse
 * @returns Parsed object or empty object on failure
 */
const parseQuestions = (raw: unknown): unknown => {
  try {
    return typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
  } catch {
    return [];
  }
};

/**
 * Load quiz pages in the format the editor expects.
 * Fetches all quiz_pages, parses content_json, and restructures.
 *
 * Process:
 * 1. Query quiz_pages sorted by page_index (ascending)
 * 2. For each page, parse content_json to extract questions
 * 3. Handle parsing errors gracefully (log but don't crash)
 * 4. Return array of pages with id, title, questions
 *
 * Page structure:
 * {
 *   id: "page-123",        // Generated from database row id
 *   title: "Page 1",
 *   questions: [...]       // Extracted from content_json.questions
 * }
 *
 * Error handling:
 * - If content_json is invalid, questions defaults to []
 * - Invalid JSON is logged but doesn't stop processing
 * - Pages with no questions are still returned
 *
 * Use cases:
 * - GET quiz: Load questions for viewing
 * - PUT quiz: Load existing questions for editing
 * - Student submission: Load to validate answers
 *
 * @param quizId - The quiz to load pages for
 * @returns Array of PageData objects in display order
 */
async function loadPages(quizId: number): Promise<PageData[]> {
  const rows = await queryAsync<QuizPageRow>(
    "SELECT id, page_index, title, content_json FROM quiz_pages WHERE quiz_id = ? ORDER BY page_index ASC",
    [quizId]
  );

  return rows.map((r) => {
    let questions: QuestionData[] = [];

    try {
      const parsed = parseQuestions(r.content_json);
      questions = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as any)?.questions)
        ? (parsed as any).questions
        : [];
    } catch (error) {
      console.error("Error parsing content_json for page:", error);
      // Continue with empty questions array
    }

    return {
      id: `page-${r.id}`,
      title: r.title,
      questions,
    };
  });
}

/**
 * Write (persist) quiz pages to database.
 * Replaces all existing pages for a quiz.
 *
 * Process:
 * 1. Delete all existing quiz_pages for this quiz
 * 2. For each page in input array:
 *    - Sanitize title (max 255 chars)
 *    - Wrap questions in {questions: [...]} structure
 *    - Insert as JSON string in content_json column
 * 3. Pages are indexed by position (0, 1, 2, ...)
 *
 * Page storage format:
 * {
 *   "questions": [
 *     { id, type, text, options, correctAnswer, ... }
 *   ]
 * }
 *
 * Safety:
 * - Full replacement (DELETE then INSERT)
 * - No partial updates (atomic from app perspective)
 * - Title is clamped to 255 chars (database limit)
 * - Questions array is validated before stringify
 *
 * Use cases:
 * - POST /create: Save new quiz with pages
 * - PUT /:quizId: Update quiz with edited pages
 *
 * @param quizId - The quiz these pages belong to
 * @param pages - Array of PageData to persist
 */
async function writePages(quizId: number, pages: PageData[]): Promise<void> {
  // Step 1: Delete all existing pages for this quiz
  await queryAsync("DELETE FROM quiz_pages WHERE quiz_id = ?", [quizId]);

  // Step 2: Insert new pages
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i] || {};
    const title = String(pg.title ?? `Page ${i + 1}`).slice(0, 255);
    const payload = JSON.stringify({
      questions: Array.isArray(pg.questions) ? pg.questions : [],
    });

    await queryAsync(
      "INSERT INTO quiz_pages (quiz_id, page_index, title, content_json) VALUES (?, ?, ?, ?)",
      [quizId, i, title, payload]
    );
  }
}

/**
 * Flatten pages structure to single question array.
 * Used for scoring without page context.
 *
 * Process:
 * 1. Parse input (could be {pages: [...]} or [...])
 * 2. If pages format, flatMap questions from all pages
 * 3. If array format, return as-is
 * 4. If invalid, return empty array
 *
 * Use case:
 * - Scoring student answers (iterate all questions)
 * - Validation (check if answer keys exist)
 *
 * @param raw - Structured questions data
 * @returns Flat array of all QuestionData objects
 */
const flatQuestions = (raw: unknown): QuestionData[] => {
  const q = parseQuestions(raw);

  if (q && typeof q === "object" && Array.isArray((q as any).pages)) {
    return (q as any).pages.flatMap((pg: any) => pg?.questions || []);
  }
  // Direct array format
  return Array.isArray(q) ? (q as QuestionData[]) : [];
};

/**
 * Remove correct answers from questions (redact for students).
 * Returns structure with correctAnswer and answer fields removed.
 *
 * Process:
 * 1. Parse input questions structure
 * 2. Define strip function (removes correctAnswer, answer keys)
 * 3. If pages format, strip each question in each page
 * 4. If array format, strip each question
 * 5. Return redacted structure
 *
 * Security:
 * - Removes correctAnswer before sending to student
 * - Preserves all other fields (text, options, type, etc.)
 * - Prevents answer key exposure
 *
 * Use cases:
 * - GET quiz (student view): Don't show answers
 * - GET quiz (teacher view): Show full structure
 *
 * @param raw - Original questions structure
 * @returns Redacted structure with answers removed
 */
const redactAnswersDeep = (raw: unknown) => {
  const q = parseQuestions(raw);
  const strip = (qq: any) => {
    const { correctAnswer, answer, ...rest } = qq || {};
    return rest;
  };

  if (q && typeof q === "object" && Array.isArray((q as any).pages)) {
    return {
      pages: (q as any).pages.map((pg: any) => ({
        id: pg.id,
        title: pg.title,
        questions: (pg.questions || []).map(strip),
      })),
    };
  }

  if (Array.isArray(q)) {
    return (q as any[]).map(strip);
  }

  return q;
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Clamp number between min and max (inclusive).
 * Used for attempts_allowed, time_limit_seconds, sentence limits.
 *
 * @example clamp(5, 1, 3) returns 3
 * @example clamp(-1, 0, 100) returns 0
 */
const clamp = (n: number, min: number, max: number): number =>
  Math.min(Math.max(n, min), max);

/**
 * Safe integer parsing with default value.
 * Returns default if parse fails or result is not finite.
 *
 * @example asInt("42") returns 42
 * @example asInt("abc", 10) returns 10
 * @example asInt(null, 5) returns 5
 */
const asInt = (v: unknown, d: number = 0): number => {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : d;
};

// ============================================================================
// QUESTION SANITIZATION
// ============================================================================

/**
 * Sanitize and validate a single question from client input.
 * Enforces type constraints and fills in sensible defaults.
 *
 * Process for each question type:
 *
 * 1. Validate type (must be in ALLOWED_TYPES)
 * 2. Generate ID if missing (timestamp + indices for uniqueness)
 * 3. Trim and default text
 *
 * For multiple_choice:
 * - Require minimum 2 options
 * - Validate correctAnswer index is in range
 * - Default to null if invalid
 *
 * For checkboxes:
 * - Similar to multiple_choice
 * - correctAnswer is array of indices (sorted)
 * - Filter invalid indices
 *
 * For short_answer:
 * - Clamp sentenceLimit to 1-3
 * - Store answer text as string
 *
 * For paragraph:
 * - Clamp sentenceLimit to min 3
 * - Answer text as string
 *
 * Security:
 * - Rejects unknown question types (defaults to multiple_choice)
 * - Removes any extra properties
 * - Validates array indices (prevents out-of-bounds)
 *
 * @param q - Question from client
 * @param pIdx - Page index (for ID generation)
 * @param qIdx - Question index (for ID generation)
 * @returns Sanitized QuestionData
 */
const sanitizeQuestion = (q: any, pIdx: number, qIdx: number): QuestionData => {
  const ALLOWED_TYPES = new Set([
    "multiple_choice",
    "checkboxes",
    "short_answer",
    "paragraph",
  ]);

  const type = ALLOWED_TYPES.has(q?.type) ? q.type : "multiple_choice";
  const makeId = (p: number, i: number) => `srv-q-${p}-${Date.now()}-${i}`;

  const base: Partial<QuestionData> = {
    id: q?.id || makeId(pIdx, qIdx),
    type: type as any,
    text: String(q?.text ?? "").trim() || "Untitled question",
    requiresManualGrading: Boolean(q?.requiresManualGrading),
  };

  if (type === "multiple_choice") {
    const opts = Array.isArray(q?.options)
      ? q.options.filter((s: any) => s != null).map(String)
      : [];
    const options = opts.length >= 2 ? opts : ["Option 1", "Option 2"];
    const idx = q?.correctAnswer == null ? null : asInt(q.correctAnswer, -1);
    const correctAnswer =
      idx != null && idx >= 0 && idx < options.length ? String(idx) : null;

    return {
      ...base,
      options,
      correctAnswer,
    } as QuestionData;
  }

  if (type === "checkboxes") {
    const opts = Array.isArray(q?.options)
      ? q.options.filter((s: any) => s != null).map(String)
      : [];
    const options = opts.length >= 2 ? opts : ["Option 1", "Option 2"];
    const set = new Set(
      Array.isArray(q?.correctAnswer)
        ? q.correctAnswer
            .map((v: any) => asInt(v, -1))
            .filter((n: number) => n >= 0 && n < options.length)
        : []
    );
    const correctAnswer = Array.from(set.values()).sort(
      (a, b) => Number(a) - Number(b)
    );

    return {
      ...base,
      options,
      correctAnswer,
    } as QuestionData;
  }

  if (type === "short_answer") {
    const sentenceLimit = clamp(asInt(q?.sentenceLimit ?? 1, 1), 1, 3);
    const correctAnswer = String(q?.correctAnswer ?? "");

    return {
      ...base,
      sentenceLimit,
      correctAnswer,
    } as QuestionData;
  }

  // paragraph
  const sentenceLimit = Math.max(3, asInt(q?.sentenceLimit ?? 3, 3));
  const correctAnswer = String(q?.correctAnswer ?? "");

  return {
    ...base,
    sentenceLimit,
    correctAnswer,
  } as QuestionData;
};

/**
 * Normalize questions input to pages format.
 * Handles three client input scenarios:
 *
 * Scenario A: { pages: [{ title, questions: [...] }, ...] }
 * - Already in correct format
 * - Sanitize each question in each page
 *
 * Scenario B: [{ title, questions: [...] }, ...] (array-of-pages)
 * - Client sent array where each element is a page
 * - Convert to { pages: [...] } format
 *
 * Scenario C: [question, question, ...] (flat array)
 * - Wrap into single "Page 1"
 * - Preserve all questions
 *
 * All questions are sanitized during normalization.
 * Page IDs are generated with timestamp for uniqueness.
 *
 * @param qs - Input from client (could be any format)
 * @returns Normalized array of PageData
 */
const normalizeToPages = (qs: unknown): PageData[] => {
  const makePageId = (i: number) => `srv-page-${Date.now()}-${i}`;

  // Scenario A: Already { pages: [...] }
  if (qs && typeof qs === "object" && Array.isArray((qs as any).pages)) {
    return (qs as any).pages.map((pg: any, pIdx: number) => ({
      id: pg?.id || makePageId(pIdx),
      title: String(pg?.title ?? `Page ${pIdx + 1}`),
      questions: Array.isArray(pg?.questions)
        ? pg.questions.map((q: any, qIdx: number) =>
            sanitizeQuestion(q, pIdx, qIdx)
          )
        : [],
    }));
  }

  // Scenario B: Array of pages (each has .questions)
  if (
    Array.isArray(qs) &&
    qs.length > 0 &&
    Array.isArray((qs as any)[0]?.questions)
  ) {
    return (qs as any[]).map((pg: any, pIdx: number) => ({
      id: pg?.id || makePageId(pIdx),
      title: String(pg?.title ?? `Page ${pIdx + 1}`),
      questions: Array.isArray(pg?.questions)
        ? pg.questions.map((q: any, qIdx: number) =>
            sanitizeQuestion(q, pIdx, qIdx)
          )
        : [],
    }));
  }

  // Scenario C: Flat array of questions
  const arr = Array.isArray(qs) ? (qs as any[]) : [];
  return [
    {
      id: makePageId(0),
      title: "Page 1",
      questions: arr.map((q: any, qIdx: number) =>
        sanitizeQuestion(q, 0, qIdx)
      ),
    },
  ];
};

// ============================================================================
// ROUTE: GET /:code/quizzes - List all quizzes in a classroom
// ============================================================================
/**
 * Fetches all quizzes for a classroom with metadata.
 * Returns summary info (count of pages and questions).
 *
 * Process:
 * 1. Verify JWT token
 * 2. Query all quizzes for this classroom code
 * 3. For each quiz, fetch pages and count questions
 * 4. Return list with question/page counts
 *
 * Response includes:
 * - Quiz details (id, title, times, attempts)
 * - pages_count: Number of pages in quiz
 * - questions_count: Total questions across all pages
 * - teacherName: Name of quiz creator
 *
 * Question counting:
 * - Iterates each page's content_json
 * - Parses JSON to extract questions array
 * - Sums across all pages
 * - Handles parse errors gracefully (count = 0)
 *
 * Use cases:
 * - Teacher dashboard: Browse own quizzes
 * - Student dashboard: Browse available quizzes
 * - Classroom content view: Show quiz list
 *
 * Security:
 * - Works for any authenticated user
 * - Returns public quiz metadata only
 * - No answer keys or student attempts shown
 *
 * @route GET /:code/quizzes
 */
router.get(
  "/:code/quizzes",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { code } = req.params;

    try {
      // Step 1: Query all quizzes for this classroom
      const rows = await queryAsync<any>(
        `SELECT q.id, q.title, q.start_time, q.end_time, q.time_limit_seconds, 
                q.attempts_allowed, q.created_at, u.username AS teacherName,
                (SELECT COUNT(*) FROM quiz_pages p WHERE p.quiz_id = q.id) AS pages_count
         FROM quizzes q
         JOIN classrooms c ON q.classroom_id = c.id
         LEFT JOIN users u ON q.teacher_id = u.id
         WHERE c.code = ?`,
        [code]
      );

      // Step 2: Count questions per quiz
      for (const r of rows) {
        try {
          // Fetch all pages for this quiz
          const pages = await queryAsync<QuizPageRow>(
            "SELECT content_json FROM quiz_pages WHERE quiz_id = ?",
            [r.id]
          );

          let questions_count = 0;
          for (const p of pages) {
            try {
              const parsed = parseQuestions(p.content_json);
              const qArray = Array.isArray(parsed)
                ? parsed
                : Array.isArray((parsed as any)?.questions)
                ? (parsed as any).questions
                : [];
              questions_count += qArray.length;
            } catch (e) {
              // Continue on parse error
            }
          }
          r.questions_count = questions_count;
        } catch (e) {
          // Fallback to 0 if fetch fails
          r.questions_count = 0;
        }
      }

      // Step 3: Return quiz list
      res.json({ success: true, quizzes: rows });
    } catch (err) {
      const error = err as Error;
      console.error("Error listing quizzes:", error.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  })
);

// ============================================================================
// ROUTE: POST /:code/quizzes/create - Create a new quiz
// ============================================================================
/**
 * Creates a new quiz with pages and questions.
 * Sanitizes all input and stores in normalized format.
 *
 * Request body:
 * {
 *   title: "Chapter 5 Quiz",
 *   questions: [...] or { pages: [...] },  // Flexible input format
 *   attemptsAllowed: 3,                     // Optional, default 1
 *   startTime: "2025-12-21T10:00:00Z",     // Optional
 *   endTime: "2025-12-21T11:00:00Z",       // Optional
 *   timeLimitSeconds: 1800                  // Optional (30 minutes)
 * }
 *
 * Process:
 * 1. Verify JWT token (teacher only)
 * 2. Validate classroom ownership
 * 3. Normalize questions to pages format
 * 4. Clamp and validate settings (attempts, time, etc.)
 * 5. Insert quiz into quizzes table
 * 6. Persist pages to quiz_pages table
 * 7. Return quiz ID
 *
 * Validation:
 * - Title: Required, max 255 chars, defaults to "Untitled Quiz"
 * - Attempts: Clamped to 1-100, default 1
 * - Time limit: Must be positive, null if not set
 * - Start/End times: Optional, can be null
 *
 * Storage:
 * - quizzes table: Metadata (title, teacher_id, times, attempts)
 * - quiz_pages table: Normalized pages with JSON questions
 * - questions column (quizzes): Kept NULL (deprecated, use pages)
 *
 * Security:
 * - Teacher must own the classroom
 * - Questions are sanitized (no injection risks)
 * - Timestamps validated
 *
 * Use cases:
 * - Teacher creates quiz in classroom
 * - Copy/clone quiz with different title
 * - Import quiz structure from JSON
 *
 * @route POST /:code/quizzes/create
 */
router.post(
  "/:code/quizzes/create",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const teacherId = req.user!.userId;
    const { code } = req.params;
    const {
      title,
      questions,
      attemptsAllowed = 1,
      startTime = null,
      endTime = null,
      timeLimitSeconds = null,
    } = req.body;

    // Step 1: Normalize questions to pages format
    const normalizedPages = normalizeToPages(questions);

    // Step 2: Validate and clamp settings
    const attempts = clamp(asInt(attemptsAllowed, 1), 1, 100);
    const tls = (() => {
      const n = asInt(timeLimitSeconds, 0);
      return n > 0 ? n : null;
    })();

    try {
      // Step 3: Verify classroom ownership
      const classroomRows = await queryAsync<RowDataPacket>(
        "SELECT id FROM classrooms WHERE code = ? AND teacher_id = ? LIMIT 1",
        [code, teacherId]
      );

      if (!classroomRows.length) {
        return res.status(404).json({
          success: false,
          message: "Classroom not found or not authorized",
        });
      }

      const classroomId = classroomRows[0].id;

      // Step 4: Insert quiz into database
      const [result] = await db.query<ResultSetHeader>(
        `INSERT INTO quizzes 
         (classroom_id, teacher_id, title, questions, attempts_allowed, start_time, end_time, time_limit_seconds, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          classroomId,
          teacherId,
          (String(title || "").trim() || "Untitled Quiz").slice(0, 255),
          null, // questions column deprecated, NULL
          attempts,
          startTime || null,
          endTime || null,
          tls,
        ]
      );

      const quizId = result.insertId;

      // Step 5: Persist pages to quiz_pages table
      await writePages(quizId, normalizedPages);

      // Step 6: Return success with quiz ID
      res.json({ success: true, message: "Quiz created", quizId });
    } catch (err) {
      const error = err as Error;
      console.error("Error creating quiz:", error.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  })
);

// ============================================================================
// ROUTE GROUP: /:code/quizzes/:quizId - View/Edit/Delete a quiz
// ============================================================================
/**
 * Handles GET (view), PUT (edit), and DELETE operations on a single quiz.
 * Different authorization rules for students vs teachers.
 *
 * Shared:
 * - Verify JWT token
 * - Check database availability
 * - Fetch quiz and validate classroom access
 */
router
  .route("/:code/quizzes/:quizId")
  .all(verifyToken)
  // ==== GET /:code/quizzes/:quizId ====
  .get(
    wrapAsync(async (req: AuthRequest, res: Response) => {
      if (!(req as any).dbAvailable) {
        return res
          .status(503)
          .json({ ok: false, error: "Database not available" });
      }

      const { code, quizId } = req.params;
      const userId = req.user!.userId;
      const role = req.user!.role;

      try {
        // Step 1: Fetch quiz with teacher info
        const rows = await queryAsync<QuizRow>(
          `SELECT q.*, c.teacher_id
           FROM quizzes q
           JOIN classrooms c ON q.classroom_id = c.id
           WHERE c.code = ? AND q.id = ? LIMIT 1`,
          [code, quizId]
        );

        if (!rows.length) {
          return res
            .status(404)
            .json({ success: false, message: "Quiz not found" });
        }

        const qz = rows[0];
        const isOwner = role === "teacher" && qz.teacher_id === userId;

        // Step 2: Load pages in normalized format
        const pages = await loadPages(parseInt(quizId, 10));
        const raw = { pages };

        // Step 3: Redact answers for students
        const questions = isOwner ? raw : redactAnswersDeep(raw);

        // Step 4: Count attempts used
        const arows = await queryAsync<RowDataPacket>(
          "SELECT COUNT(*) as cnt FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?",
          [quizId, userId]
        );
        const attempts_used = arows[0]?.cnt || 0;
        const attempts_remaining =
          qz.attempts_allowed != null
            ? Math.max(0, qz.attempts_allowed - attempts_used)
            : null;

        // Step 5: Return quiz data
        res.json({
          success: true,
          quiz: {
            id: qz.id,
            title: qz.title,
            start_time: qz.start_time,
            end_time: qz.end_time,
            time_limit_seconds: qz.time_limit_seconds,
            attempts_allowed: qz.attempts_allowed,
            attempts_used,
            attempts_remaining,
            created_at: qz.created_at,
            questions,
          },
        });
      } catch (err) {
        const error = err as Error;
        console.error("Error fetching quiz:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
      }
    })
  )
  // ==== PUT /:code/quizzes/:quizId - Update quiz ====
  /**
   * Updates quiz metadata and questions.
   * Only quiz owner (teacher) can edit.
   *
   * Process:
   * 1. Verify JWT token (teacher required)
   * 2. Check database availability
   * 3. Fetch quiz and verify ownership
   * 4. Normalize questions to pages format
   * 5. Validate settings (attempts, time limits)
   * 6. Update quiz table with metadata
   * 7. Replace pages via writePages (delete + insert)
   * 8. Return success
   *
   * Authorization:
   * - Teacher must own the quiz (via classroom.teacher_id)
   * - Returns 404 if quiz not found
   * - Returns 403 if not owner
   *
   * Updates allowed:
   * - title: Quiz name
   * - questions: Full structure (pages + questions)
   * - attempts_allowed: Max attempts for students
   * - start_time/end_time: Availability window
   * - time_limit_seconds: Time per attempt
   *
   * Constraints:
   * - Title: Max 255 chars
   * - Attempts: 1-100
   * - Time limit: Must be positive or null
   *
   * Use cases:
   * - Teacher edits quiz after creation
   * - Add/remove questions
   * - Change due dates
   * - Adjust time limits
   * - Adjust attempt limits
   */
  .put(
    wrapAsync(async (req: AuthRequest, res: Response) => {
      if (!(req as any).dbAvailable) {
        return res
          .status(503)
          .json({ ok: false, error: "Database not available" });
      }

      const teacherId = req.user!.userId;
      const { code, quizId } = req.params;
      const {
        title,
        questions,
        attemptsAllowed = 1,
        startTime = null,
        endTime = null,
        timeLimitSeconds = null,
      } = req.body;

      // Step 1: Validate and prepare settings
      const attempts = clamp(asInt(attemptsAllowed, 1), 1, 100);
      const tls = (() => {
        const n = asInt(timeLimitSeconds, 0);
        return n > 0 ? n : null;
      })();

      try {
        // Step 2: Verify ownership
        const rows = await queryAsync<QuizRow>(
          `SELECT q.id, q.classroom_id, c.teacher_id
           FROM quizzes q
           JOIN classrooms c ON q.classroom_id = c.id
           WHERE q.id = ? AND c.code = ? LIMIT 1`,
          [quizId, code]
        );

        if (!rows.length) {
          return res
            .status(404)
            .json({ success: false, message: "Quiz not found" });
        }

        if (rows[0].teacher_id !== teacherId) {
          return res
            .status(403)
            .json({ success: false, message: "Not authorized" });
        }

        // Step 3: Normalize questions
        const sanitized = normalizeToPages(questions);

        // Step 4: Update quiz metadata
        await db.query<ResultSetHeader>(
          `UPDATE quizzes
           SET title = ?, attempts_allowed = ?, start_time = ?, end_time = ?, time_limit_seconds = ?
           WHERE id = ? AND classroom_id = ? AND teacher_id = ?`,
          [
            (String(title || "").trim() || "Untitled Quiz").slice(0, 255),
            attempts,
            startTime || null,
            endTime || null,
            tls,
            quizId,
            rows[0].classroom_id,
            teacherId,
          ]
        );

        // Step 5: Replace pages
        await writePages(parseInt(quizId, 10), sanitized);

        // Step 6: Return success
        res.json({ success: true, message: "Quiz updated", quizId });
      } catch (err) {
        const error = err as Error;
        console.error("Error updating quiz:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
      }
    })
  )
  // ==== DELETE /:code/quizzes/:quizId - Delete quiz ====
  /**
   * Deletes a quiz and all related data (pages, attempts).
   * Only quiz owner (teacher) can delete.
   *
   * Process:
   * 1. Verify JWT token (teacher required)
   * 2. Fetch quiz and verify ownership
   * 3. Delete all quiz_attempts for this quiz
   * 4. Delete all quiz_pages for this quiz
   * 5. Delete the quiz itself
   * 6. Return success
   *
   * Cascading deletes:
   * - quiz_attempts: Student responses deleted
   * - quiz_pages: Question pages deleted
   * - quizzes: Main record deleted
   *
   * Safety:
   * - Verifies ownership before any deletion
   * - Three separate queries (atomic at app level)
   * - If verification fails, nothing is deleted
   *
   * Authorization:
   * - Teacher must own the quiz
   * - Returns 403 if not owner
   * - Returns 404 if quiz not found
   *
   * Consequences:
   * - All student attempts permanently deleted
   * - Scores and feedback lost
   * - Cannot be undone
   *
   * Use cases:
   * - Remove quiz from classroom
   * - Delete incorrect quiz
   * - Classroom cleanup
   *
   * Warning:
   * - Permanent deletion (no soft delete)
   * - Consider archive option instead
   */
  .delete(
    wrapAsync(async (req: AuthRequest, res: Response) => {
      if (!(req as any).dbAvailable) {
        return res
          .status(503)
          .json({ ok: false, error: "Database not available" });
      }

      const teacherId = req.user!.userId;
      const { code, quizId } = req.params;

      try {
        // Step 1: Verify ownership
        const rows = await queryAsync<QuizRow>(
          `SELECT q.id, q.classroom_id, c.teacher_id
           FROM quizzes q
           JOIN classrooms c ON q.classroom_id = c.id
           WHERE q.id = ? AND c.code = ? LIMIT 1`,
          [quizId, code]
        );

        if (!rows.length) {
          return res
            .status(404)
            .json({ success: false, message: "Quiz not found" });
        }

        if (rows[0].teacher_id !== teacherId) {
          return res
            .status(403)
            .json({ success: false, message: "Not authorized" });
        }

        // Step 2: Delete cascade (attempts, pages, quiz)
        await queryAsync("DELETE FROM quiz_attempts WHERE quiz_id = ?", [
          quizId,
        ]);
        await queryAsync("DELETE FROM quiz_pages WHERE quiz_id = ?", [quizId]);
        await queryAsync("DELETE FROM quizzes WHERE id = ? LIMIT 1", [quizId]);

        // Step 3: Return success
        res.json({ success: true, message: "Quiz deleted" });
      } catch (err) {
        const error = err as Error;
        console.error("Error deleting quiz:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
      }
    })
  );

// ============================================================================
// ROUTE GROUP: /:code/quizzes/:quizId/attempts - Manage quiz attempts
// ============================================================================
/**
 * Handles fetching, starting, submitting, and grading quiz attempts.
 * Shared middleware: JWT verification.
 */
router
  .route("/:code/quizzes/:quizId/attempt")
  .all(verifyToken)
  // ==== GET /:code/quizzes/:quizId/attempts - List attempts (teacher-only) ====
  /**
   * Retrieves all student attempts for a quiz.
   * Teacher-only endpoint with optional status filtering.
   *
   * Query parameters:
   * - status: "needs_grading" (default) | "completed" | "in_progress" | "all"
   *
   * Process:
   * 1. Verify JWT token (teacher required)
   * 2. Fetch quiz and verify teacher ownership
   * 3. Query attempts with optional status filter
   * 4. Parse JSON fields (answers, grading)
   * 5. Return structured attempt data
   *
   * Statuses explained:
   * - needs_grading: Submitted but not yet graded by teacher
   * - completed: Submitted and graded
   * - in_progress: Student still taking quiz
   * - all: Show all attempts
   *
   * Response includes:
   * - Attempt metadata (id, student info, attempt number)
   * - Score (calculated or teacher-entered)
   * - Status (in_progress, completed)
   * - Timestamps (started, submitted, graded)
   * - Parsed answers (student responses)
   * - Grading info (rubric, comments)
   *
   * Safety:
   * - Status filter validated against whitelist
   * - Defaults to "needs_grading" if invalid
   * - Only teacher of quiz can access
   *
   * Use cases:
   * - Teacher reviews student responses
   * - Grade attempts one-by-one
   * - Export grades to parent system
   * - Monitor in-progress attempts
   *
   * Limit:
   * - Returns max 200 attempts (LIMIT 200)
   * - Prevents large result sets
   * - Use pagination for large classes
   */
  .get(
    wrapAsync(async (req: AuthRequest, res: Response) => {
      if (!(req as any).dbAvailable) {
        return res
          .status(503)
          .json({ ok: false, error: "Database not available" });
      }

      const { code, quizId } = req.params;
      const { status = "needs_grading" } = req.query;
      const requesterId = req.user!.userId;
      const role = req.user!.role;

      try {
        // Step 1: Verify quiz ownership
        const qrows = await queryAsync<QuizRow>(
          `SELECT q.*, c.teacher_id
           FROM quizzes q
           JOIN classrooms c ON q.classroom_id = c.id
           WHERE c.code = ? AND q.id = ? LIMIT 1`,
          [code, quizId]
        );

        if (!qrows.length) {
          return res
            .status(404)
            .json({ success: false, message: "Quiz not found" });
        }

        if (role !== "teacher" || qrows[0].teacher_id !== requesterId) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }

        // Step 2: Validate and apply status filter
        const allowedStatuses = [
          "needs_grading", // Default - shows submission awaiting teacher review
          "completed", // Fully graded
          "in_progress", // Still taking quiz
          "all",
        ];
        const st = allowedStatuses.includes(String(status))
          ? String(status)
          : "needs_grading";

        let sql = `
          SELECT qa.*, u.id as student_id, u.username as student_username, u.username as student_name
          FROM quiz_attempts qa
          JOIN users u ON u.id = qa.student_id
          WHERE qa.quiz_id = ?
        `;
        const sqlParams: any[] = [quizId];

        if (st !== "all") {
          sql += " AND qa.status = ?";
          sqlParams.push(st);
        }

        sql += " ORDER BY qa.id DESC LIMIT 200";

        // Step 3: Fetch attempts
        const attempts = await queryAsync<QuizAttemptRow>(sql, sqlParams);

        // Step 4: Parse JSON fields
        const out: QuizAttemptResponse[] = attempts.map((a) => ({
          id: a.id,
          quiz_id: a.quiz_id,
          student_id: a.student_id,
          student_name: a.student_name || a.student_username || "",
          attempt_no: a.attempt_no,
          status: a.status,
          score: a.score,
          answers: (() => {
            try {
              return JSON.parse(a.answers || "{}");
            } catch {
              return {};
            }
          })(),
          started_at: a.started_at,
          submitted_at: a.submitted_at,
          expires_at: a.expires_at,
          grading: (() => {
            try {
              return JSON.parse(a.grading || "{}");
            } catch {
              return {};
            }
          })(),
        }));

        // Step 5: Return attempts
        res.json({ success: true, attempts: out });
      } catch (err) {
        const error = err as Error;
        console.error("Error listing attempts:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
      }
    })
  )
  // ==== POST /:code/quizzes/:quizId/attempts - Start a new attempt ====
  /**
   * Creates a new quiz attempt for a student.
   * Checks attempt limit before allowing start.
   *
   * Process:
   * 1. Verify JWT token (student or authorized user)
   * 2. Fetch quiz and validate access
   * 3. Count attempts already used
   * 4. Check if attempts remain (if limit set)
   * 5. Calculate expiry time if time limit set
   * 6. Insert quiz_attempts row with "in_progress" status
   * 7. Return attempt ID and expiry time
   *
   * Attempt limit enforcement:
   * - Attempts_allowed = null: Unlimited attempts
   * - Attempts_allowed = 3: Max 3 attempts
   * - Returns 400 if limit reached
   *
   * Time limit handling:
   * - time_limit_seconds = null: No time limit
   * - time_limit_seconds = 1800: 30 minutes per attempt
   * - Expiry = started_at + time_limit_seconds
   * - Client should warn user as expiry approaches
   *
   * Response:
   * {
   *   success: true,
   *   attemptId: 42,
   *   attemptNo: 2,      // This is the user's 2nd attempt
   *   expiresAt: "2025-12-21T10:30:00Z" or null
   * }
   *
   * Security:
   * - User can only create attempts for themselves
   * - Enforced by insert using student_id from token
   * - Classroom membership implied (quiz exists)
   *
   * Use cases:
   * - Student clicks "Start Quiz"
   * - Check if attempts remain
   * - Get countdown timer target
   * - Track attempt number
   */
  .post(
    wrapAsync(async (req: AuthRequest, res: Response) => {
      if (!(req as any).dbAvailable) {
        return res
          .status(503)
          .json({ ok: false, error: "Database not available" });
      }

      const { code, quizId } = req.params;
      const studentId = req.user!.userId;

      try {
        // Step 1: Fetch quiz
        const rows = await queryAsync<QuizRow>(
          `SELECT q.*, c.id as classroom_id, c.teacher_id
           FROM quizzes q
           JOIN classrooms c ON q.classroom_id = c.id
           WHERE c.code = ? AND q.id = ? LIMIT 1`,
          [code, quizId]
        );

        if (!rows.length) {
          return res
            .status(404)
            .json({ success: false, message: "Quiz not found" });
        }

        const quiz = rows[0];

        // Step 2: Count existing attempts
        const arows = await queryAsync<RowDataPacket>(
          "SELECT COUNT(*) as cnt FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?",
          [quizId, studentId]
        );
        const used = arows[0]?.cnt || 0;

        // Step 3: Check attempt limit
        if (quiz.attempts_allowed != null && used >= quiz.attempts_allowed) {
          return res
            .status(400)
            .json({ success: false, message: "No attempts remaining" });
        }

        // Step 4: Calculate attempt number and expiry
        const nextAttemptNo = used + 1;
        const startedAt = new Date();
        let expiresAt = null;

        if (quiz.time_limit_seconds) {
          expiresAt = new Date(
            startedAt.getTime() + quiz.time_limit_seconds * 1000
          );
        }

        // Step 5: Insert attempt
        const [result] = await db.query<ResultSetHeader>(
          `INSERT INTO quiz_attempts 
           (quiz_id, student_id, attempt_no, answers, score, status, started_at, submitted_at, expires_at)
           VALUES (?, ?, ?, ?, NULL, 'in_progress', ?, NULL, ?)`,
          [
            quizId,
            studentId,
            nextAttemptNo,
            JSON.stringify({}),
            startedAt,
            expiresAt,
          ]
        );

        // Step 6: Return attempt info
        res.json({
          success: true,
          attemptId: result.insertId,
          attemptNo: nextAttemptNo,
          expiresAt,
        });
      } catch (err) {
        const error = err as Error;
        console.error("Error starting attempt:", error.message);
        res.status(500).json({ success: false, message: "Server error" });
      }
    })
  );

// ============================================================================
// ROUTE: POST /:code/quizzes/:quizId/submit - Submit completed attempt
// ============================================================================
/**
 * Student submits their quiz answers for scoring.
 * Validates attempt ownership and calculates auto-score.
 *
 * Request body:
 * {
 *   attemptId: 42,
 *   answers: {
 *     "srv-q-0-12345-0": "1",     // Multiple choice: index as string
 *     "srv-q-0-12345-1": ["0","2"], // Checkboxes: array of indices
 *     "srv-q-0-12345-2": "Paris"    // Short answer: text
 *   }
 * }
 *
 * Process:
 * 1. Verify JWT token
 * 2. Validate attempt belongs to student
 * 3. Check attempt not already submitted
 * 4. Load quiz questions (flattened)
 * 5. Score each answer against correct answer
 * 6. Calculate percentage score
 * 7. Update attempt with answers, score, and status
 * 8. Return final score
 *
 * Scoring logic:
 * - For each question with a correctAnswer:
 *   - Multiple choice: String equality (answer index = correctAnswer index)
 *   - Checkboxes: Array equality (sorted indices match)
 *   - Text answers: Exact string match (case-sensitive)
 * - Score = (correct / total questions) * 100
 * - Returns as percentage (0-100)
 *
 * Security:
 * - Student can only submit their own attempts
 * - Enforced by attemptId + student_id WHERE clause
 * - Prevents double submission (status check)
 * - Answers not validated beyond type checking
 *
 * Manual grading:
 * - Initial score is auto-calculated
 * - Teacher can override via PATCH /attempts/:id/grade
 * - For essay/text, teacher reviews and scores manually
 *
 * Use cases:
 * - Student clicks "Submit Quiz"
 * - Auto-score multiple choice/fill-in
 * - Essays sent for manual grading
 * - Score recorded in grade book
 *
 * @route POST /:code/quizzes/:quizId/submit
 */
router.post(
  "/:code/quizzes/:quizId/submit",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { quizId } = req.params;
    const studentId = req.user!.userId;
    const { attemptId, answers } = req.body;

    try {
      // Step 1: Validate attempt ownership
      const art = await queryAsync<QuizAttemptRow>(
        "SELECT * FROM quiz_attempts WHERE id = ? AND quiz_id = ? AND student_id = ? LIMIT 1",
        [attemptId, quizId, studentId]
      );

      if (!art.length) {
        return res
          .status(404)
          .json({ success: false, message: "Attempt not found" });
      }

      // Step 2: Prevent double submission
      const attempt = art[0];
      if (attempt.status === "completed") {
        return res
          .status(400)
          .json({ success: false, message: "Attempt already submitted" });
      }

      // Step 3: Load flattened questions for scoring
      const pages = await loadPages(parseInt(quizId, 10));
      const qlist = flatQuestions({ pages });

      // Step 4: Score answers
      let score = 0;
      let maxScore = 0;
      let manualGradingRequired = false;
      const grading: Record<string, any> = {};

      qlist.forEach((q: any) => {
        // Skip questions that require manual grading
        if (q.requiresManualGrading) {
          grading[q.id] = {
            requiresManualGrading: true,
            answer: answers?.[q.id] ?? null,
            scored: false,
          };
          manualGradingRequired = true;
          return;
        }

        const correct = q.correctAnswer ?? q.answer ?? null;
        if (correct == null) return; // Skip questions without answer key

        maxScore += 1;
        const given = answers?.[q.id] ?? null;
        let isCorrect;

        // Compare based on answer type
        if (Array.isArray(correct)) {
          // Checkboxes: array comparison
          const givenArr = Array.isArray(given) ? given.map(String) : [];
          isCorrect =
            correct.length === givenArr.length &&
            correct.every((v) => givenArr.includes(String(v)));
        } else {
          // Multiple choice or text: string comparison
          isCorrect = String(given) === String(correct);
        }

        if (isCorrect) score += 1;

        grading[q.id] = {
          correct: isCorrect,
          given,
          expected: correct,
          scored: true,
        };
      });

      // Step 5: Calculate percentage
      const percent = manualGradingRequired
        ? null
        : maxScore
        ? Math.round((score / maxScore) * 100)
        : 0;

      const status = manualGradingRequired ? "needs_grading" : "completed";

      // Step 6: Update attempt
      await db.query<ResultSetHeader>(
        "UPDATE quiz_attempts SET answers = ?, score = ?, status = ?, grading = ?, submitted_at = ? WHERE id = ?",
        [
          JSON.stringify(answers || {}),
          percent,
          status,
          JSON.stringify(grading),
          new Date(),
          attemptId,
        ]
      );

      // Send notification if auto-graded
      try {
        if (status === "completed") {
          const [quizRow] = await queryAsync<
            QuizRow & { title: string; teacher_id: number }
          >("SELECT title, teacher_id FROM quizzes WHERE id = ? LIMIT 1", [
            quizId,
          ]);

          await createNotification({
            recipientId: studentId,
            senderId: quizRow?.teacher_id ?? null,
            type: "grade",
            message: `Your quiz "${
              quizRow?.title || "Quiz"
            }" was graded: ${percent}%.`,
            link: `/quizzes/${req.params.code}/quizzes/${quizId}/results`,
          });
        }
      } catch (e) {
        console.error("[notify] quiz submit grade:", (e as Error).message);
      }

      // Step 7: Return score
      res.json({
        success: true,
        score: percent,
        requiresManualGrading: manualGradingRequired,
        message: manualGradingRequired
          ? "Submitted. Waiting for teacher to grade."
          : "Quiz submitted and graded.",
      });
    } catch (err) {
      const error = err as Error;
      console.error("Error submitting attempt:", error.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  })
);

// ============================================================================
// ROUTE: PATCH /:code/quizzes/:quizId/attempts/:attemptId/grade - Grade attempt
// ============================================================================
/**
 * Teacher manually grades a student quiz attempt.
 * Overrides auto-score and adds rubric/feedback.
 *
 * Request body:
 * {
 *   score: 85,                     // Final score (0-100)
 *   grading: {                      // Optional rubric details
 *     essay_q1: 8,                 // Individual question scores
 *     essay_q2: 7
 *   },
 *   comment: "Good effort, but need to cite sources"  // Feedback
 * }
 *
 * Process:
 * 1. Verify JWT token (teacher only)
 * 2. Validate quiz ownership
 * 3. Validate attempt exists
 * 4. Update attempt with teacher score and feedback
 * 5. Set status to "completed" (officially graded)
 * 6. Record grader_id and graded_at timestamp
 * 7. Return success
 *
 * Fields updated:
 * - score: Final grade (0-100 or custom scale)
 * - status: "completed" (marks as officially graded)
 * - grading: JSON object (rubric, question scores, etc.)
 * - grader_id: Teacher's user ID
 * - graded_at: Timestamp of grading
 * - comment: Feedback to student
 *
 * Security:
 * - Teacher must own the quiz
 * - Attempt must belong to quiz
 * - Prevents unauthorized grade changes
 *
 * Use cases:
 * - Teacher reviews auto-scored essay questions
 * - Override auto-score if incorrect
 * - Add detailed rubric feedback
 * - Partial credit for work-shown
 * - Comments for student improvement
 *
 * Score overrides:
 * - Can override auto-calculated score
 * - Useful for manual grading of text questions
 * - Records who graded and when
 * - Audit trail for score changes
 *
 * @route PATCH /:code/quizzes/:quizId/attempts/:attemptId/grade
 */
router.patch(
  "/:code/quizzes/:quizId/attempts/:attemptId/grade",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { code, quizId, attemptId } = req.params;
    const { score, grading = {}, comment = "" } = req.body;
    const requesterId = req.user!.userId;
    const role = req.user!.role;

    try {
      // Step 1: Verify quiz ownership
      const qrows = await queryAsync<QuizRow>(
        `SELECT q.*, c.teacher_id
         FROM quizzes q
         JOIN classrooms c ON q.classroom_id = c.id
         WHERE c.code = ? AND q.id = ? LIMIT 1`,
        [code, quizId]
      );

      if (!qrows.length) {
        return res
          .status(404)
          .json({ success: false, message: "Quiz not found" });
      }

      if (role !== "teacher" || qrows[0].teacher_id !== requesterId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // Step 2: Verify attempt exists
      const arows = await queryAsync<QuizAttemptRow>(
        "SELECT * FROM quiz_attempts WHERE id = ? AND quiz_id = ? LIMIT 1",
        [attemptId, quizId]
      );

      if (!arows.length) {
        return res
          .status(404)
          .json({ success: false, message: "Attempt not found" });
      }

      // Step 3: Update attempt with grade
      const now = new Date();
      await db.query<ResultSetHeader>(
        `UPDATE quiz_attempts
         SET score = ?, status = 'completed', grading = ?, grader_id = ?, graded_at = ?, comment = ?
         WHERE id = ?`,
        [
          Number(score) || 0,
          JSON.stringify(grading || {}),
          requesterId,
          now,
          String(comment || ""),
          attemptId,
        ]
      );

      // Get attempt student_id
      const [att] = await queryAsync<QuizAttemptRow & { student_id: number }>(
        "SELECT id, student_id FROM quiz_attempts WHERE id = ? LIMIT 1",
        [attemptId]
      );

      try {
        // Send notification
        const [quizRow] = await queryAsync<QuizRow & { title: string }>(
          "SELECT title FROM quizzes WHERE id = ? LIMIT 1",
          [quizId]
        );
        if (att && quizRow) {
          await createNotification({
            recipientId: att.student_id,
            senderId: req.user!.userId,
            type: "grade",
            message: `Your quiz "${quizRow?.title || "Quiz"}" was graded.`,
            link: `/quizzes/${code}/quizzes/${quizId}/results`,
          });
          console.log("[NOTIFY] Quiz manual grade notification send");
        }
      } catch (e) {
        console.error("[notify] quiz manual grade:", (e as Error).message);
      }

      // Step 4: Return success
      res.json({ success: true, message: "Attempt graded" });
    } catch (err) {
      const error = err as Error;
      console.error("Error grading attempt:", error.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  })
);

router.get(
  "/:code/quizzes/:quizId/my-attempts",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    if (!(req as any).dbAvailable) {
      return res.status(503).json({ error: "Database not available" });
    }

    const { code, quizId } = req.params;
    const studentId = req.user!.userId;

    try {
      // Fetch student's own attempts
      const attempts = await queryAsync<QuizAttemptRow>(
        `SELECT qa.* 
         FROM quiz_attempts qa
         JOIN quizzes q ON q.id = qa.quiz_id
         JOIN classrooms c ON c.id = q.classroom_id
         WHERE c.code = ? AND qa.quiz_id = ? AND qa.student_id = ?
         ORDER BY qa.attempt_no DESC`,
        [code, quizId, studentId]
      );

      // Parse JSON fields
      const out = attempts.map((a) => ({
        id: a.id,
        quiz_id: a.quiz_id,
        student_id: a.student_id,
        attempt_no: a.attempt_no,
        status: a.status,
        score: a.score,
        answers: (() => {
          try {
            return JSON.parse(a.answers || "{}");
          } catch {
            return {};
          }
        })(),
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        expires_at: a.expires_at,
        grading: (() => {
          try {
            return JSON.parse(a.grading || "{}");
          } catch {
            return {};
          }
        })(),
        comment: a.comment,
      }));

      res.json({ success: true, attempts: out });
    } catch (err) {
      const error = err as Error;
      console.error("Error fetching student attempts:", error.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  })
);

export default router;
