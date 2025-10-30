import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { queryAsync } from "../config/helpers/dbHelper.js";

const router = express.Router();

router.post("/:code/quizzes/create", verifyToken, async (req, res) => {
  const teacherId = req.user.id;
  if (!teacherId)
    return res.status(401).json({ success: false, message: "Unauthorized" });

  const { code } = req.params;
  const {
    title,
    questions,
    attemptsAllowed = 1,
    startTime = null,
    endTime = null,
    timeLimitSeconds = null,
  } = req.body;

  // helpers
  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  const asInt = (v, d = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
  };
  const ALLOWED_TYPES = new Set([
    "multiple_choice",
    "checkboxes",
    "short_answer",
    "paragraph",
  ]);
  const makeId = (p, i) => `srv-q-${p}-${Date.now()}-${i}`;
  const makePageId = (i) => `srv-page-${Date.now()}-${i}`;

  const sanitizeQuestion = (q, pIdx, qIdx) => {
    const type = ALLOWED_TYPES.has(q?.type) ? q.type : "multiple_choice";
    const base = {
      id: q?.id || makeId(pIdx, qIdx),
      type,
      text: String(q?.text ?? "").trim() || "Untitled question",
    };

    if (type === "multiple_choice") {
      const opts = Array.isArray(q?.options)
        ? q.options.filter((s) => s != null).map(String)
        : [];
      const options = opts.length >= 2 ? opts : ["Option 1", "Option 2"];
      const idx =
        q?.correctAnswer == null ? null : asInt(q.correctAnswer, null);
      const correctAnswer =
        idx != null && idx >= 0 && idx < options.length ? String(idx) : null;
      return { ...base, options, correctAnswer };
    }

    if (type === "checkboxes") {
      const opts = Array.isArray(q?.options)
        ? q.options.filter((s) => s != null).map(String)
        : [];
      const options = opts.length >= 2 ? opts : ["Option 1", "Option 2"];
      const set = new Set(
        Array.isArray(q?.correctAnswer)
          ? q.correctAnswer
              .map((v) => asInt(v, -1))
              .filter((n) => n >= 0 && n < options.length)
          : []
      );
      const correctAnswer = Array.from(set.values()).sort((a, b) => a - b);
      return { ...base, options, correctAnswer };
    }

    if (type === "short_answer") {
      const sentenceLimit = clamp(asInt(q?.sentenceLimit ?? 1, 1), 1, 3);
      const correctAnswer = String(q?.correctAnswer ?? "");
      return { ...base, sentenceLimit, correctAnswer };
    }

    // paragraph
    const sentenceLimit = Math.max(3, asInt(q?.sentenceLimit ?? 3, 3));
    const correctAnswer = String(q?.correctAnswer ?? "");
    return { ...base, sentenceLimit, correctAnswer };
  };

  const normalizeToPages = (qs) => {
    // If already { pages }, sanitize each page; otherwise wrap array into a single page
    if (qs && Array.isArray(qs.pages)) {
      return qs.pages.map((pg, pIdx) => ({
        id: pg?.id || makePageId(pIdx),
        title: String(pg?.title ?? `Page ${pIdx + 1}`),
        questions: Array.isArray(pg?.questions)
          ? pg.questions.map((q, qIdx) => sanitizeQuestion(q, pIdx, qIdx))
          : [],
      }));
    }
    const arr = Array.isArray(qs) ? qs : [];
    return [
      {
        id: makePageId(0),
        title: "Page 1",
        questions: arr.map((q, qIdx) => sanitizeQuestion(q, 0, qIdx)),
      },
    ];
  };

  // normalized settings
  const attempts = clamp(asInt(attemptsAllowed, 1), 1, 100);
  const tls = (() => {
    const n = asInt(timeLimitSeconds, 0);
    return n > 0 ? n : null;
  })();

  try {
    const classroomRows = await queryAsync(
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

    const sanitizedPages = normalizeToPages(questions);
    const payloadQuestions = { pages: sanitizedPages };

    const insertSql = `
      INSERT INTO quizzes (classroom_id, teacher_id, title, questions, attempts_allowed, start_time, end_time, time_limit_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await queryAsync(insertSql, [
      classroomId,
      teacherId,
      (String(title || "").trim() || "Untitled Quiz").slice(0, 255),
      JSON.stringify(payloadQuestions),
      attempts,
      startTime || null,
      endTime || null,
      tls,
    ]);

    const idRow = await queryAsync("SELECT LAST_INSERT_ID() as id");
    const quizId = idRow[0]?.id || null;

    res.json({ success: true, message: "Quiz created", quizId });
  } catch (err) {
    console.error("Error creating quiz:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/:code/quizzes", verifyToken, async (req, res) => {
  const { code } = req.params;

  try {
    const rows = await queryAsync(
      `SELECT q.id, q.title, q.start_time, q.end_time, q.time_limit_seconds, q.attempts_allowed, q.created_at, u.username AS teacherName
       FROM quizzes q
       JOIN classrooms c ON q.classroom_id = c.id
       LEFT JOIN users u ON q.teacher_id = u.id
       WHERE c.code = ?`,
      [code]
    );

    res.json({ success: true, quizzes: rows });
  } catch (err) {
    console.error("Error listing quizzes:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// helper: parse questions JSON safely
const parseQuestions = (raw) => {
  try {
    return typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
  } catch {
    return [];
  }
};

// helper: flatten for scoring only
const flatQuestions = (raw) => {
  const q = parseQuestions(raw);
  if (q && Array.isArray(q.pages)) {
    return q.pages.flatMap((pg) => pg?.questions || []);
  }
  return Array.isArray(q) ? q : [];
};

// helper: redact answers but keep structure
const redactAnswersDeep = (raw) => {
  const q = parseQuestions(raw);
  const strip = (qq) => {
    const { correctAnswer, answer, ...rest } = qq || {};
    // keep options/type/text/etc
    return rest;
  };
  if (q && Array.isArray(q.pages)) {
    return {
      pages: q.pages.map((pg) => ({
        id: pg.id,
        title: pg.title,
        questions: (pg.questions || []).map(strip),
      })),
    };
  }
  if (Array.isArray(q)) return q.map(strip);
  return q;
};

router.get("/:code/quizzes/:quizId", verifyToken, async (req, res) => {
  const { code, quizId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const rows = await queryAsync(
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

    const quiz = rows[0];
    const rawQuestions = parseQuestions(quiz.questions);

    const isOwnerTeacher = userRole === "teacher" && userId === quiz.teacher_id;

    const quizObj = {
      id: quiz.id,
      title: quiz.title,
      start_time: quiz.start_time,
      end_time: quiz.end_time,
      time_limit_seconds: quiz.time_limit_seconds,
      attempts_allowed: quiz.attempts_allowed,
      created_at: quiz.created_at,
      questions: isOwnerTeacher
        ? rawQuestions
        : redactAnswersDeep(rawQuestions),
    };

    res.json({ success: true, quiz: quizObj });
  } catch (err) {
    console.error("Error fetching quiz details:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/:code/quizzes/:quizId/attempt", verifyToken, async (req, res) => {
  const { code, quizId } = req.params;
  const studentId = req.user.id;

  try {
    const rows = await queryAsync(
      `SELECT q.*, c.id as classroom_id
       FROM quizzes q
       JOIN classrooms c ON q.classroom_id = c.id
       WHERE c.code = ? AND q.id = ? LIMIT 1`,
      [code, quizId]
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });

    const quiz = rows[0];
    const now = new Date();

    if (quiz.start_time && new Date(quiz.start_time) > now) {
      return res
        .status(400)
        .json({ success: false, message: "Quiz has not started yet" });
    }
    if (quiz.end_time && new Date(quiz.end_time) < now) {
      return res
        .status(400)
        .json({ success: false, message: "Quiz has already ended" });
    }

    const attempts = await queryAsync(
      "SELECT COUNT(*) as cnt FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?",
      [quizId, studentId]
    );
    const used = attempts[0]?.cnt || 0;
    const nextAttemptNo = used + 1;

    if (quiz.attempts_allowed != null && used >= quiz.attempts_allowed) {
      return res
        .status(400)
        .json({ success: false, message: "No attempts remaining" });
    }

    const startedAt = new Date();
    let expiresAt = null;
    if (quiz.time_limit_seconds) {
      expiresAt = new Date(
        startedAt.getTime() + quiz.time_limit_seconds * 1000
      );
    }

    const insertSql = `
      INSERT INTO quiz_attempts (quiz_id, student_id, attempt_no, answers, score, status, started_at, submitted_at, expires_at)
      VALUES (?, ?, ?, ?, NULL, 'in_progress', ?, NULL, ?)
    `;
    await queryAsync(insertSql, [
      quizId,
      studentId,
      nextAttemptNo, // <- tracked attempt number
      JSON.stringify({}),
      startedAt,
      expiresAt,
    ]);

    const idRow = await queryAsync("SELECT LAST_INSERT_ID() as id");
    const attemptId = idRow[0]?.id || null;

    res.json({ success: true, attemptId, attemptNo: nextAttemptNo, expiresAt });
  } catch (err) {
    console.error("Error starting quiz attempt:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/:code/quizzes/:quizId/submit", verifyToken, async (req, res) => {
  const { code, quizId } = req.params;
  const studentId = req.user.id;
  const { attemptId, answers } = req.body; // answers: { questionId: selectedOption, ... }

  try {
    const quizRows = await queryAsync(
      `SELECT q.*, c.id as classroom_id
       FROM quizzes q
       JOIN classrooms c ON q.classroom_id = c.id
       WHERE c.code = ? AND q.id = ? LIMIT 1`,
      [code, quizId]
    );
    if (!quizRows.length)
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });

    const quiz = quizRows[0];

    const attemptRows = await queryAsync(
      "SELECT * FROM quiz_attempts WHERE id = ? AND quiz_id = ? AND student_id = ? LIMIT 1",
      [attemptId, quizId, studentId]
    );
    if (!attemptRows.length)
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });

    const attempt = attemptRows[0];
    if (attempt.status === "completed") {
      return res
        .status(400)
        .json({ success: false, message: "Attempt already submitted" });
    }
    if (attempt.expires_at && new Date(attempt.expires_at) < new Date()) {
      await queryAsync(
        "UPDATE quiz_attempts SET status = 'expired' WHERE id = ?",
        [attemptId]
      );
      return res
        .status(400)
        .json({ success: false, message: "Attempt expired" });
    }

    const qlist = JSON.parse(quiz.questions || "[]");
    let score = 0;
    let maxScore = 0;

    qlist.forEach((q) => {
      const correct = q.correctAnswer ?? q.answer ?? null;
      if (correct == null) return;
      maxScore += 1;
      const given = answers?.[q.id] ?? null;
      if (Array.isArray(correct)) {
        const givenArr = Array.isArray(given) ? given : [];
        const equal =
          correct.length === givenArr.length &&
          correct.every((v) => givenArr.includes(v));
        if (equal) score += 1;
      } else {
        if (String(given) === String(correct)) score += 1;
      }
    });

    const percent = maxScore ? Math.round((score / maxScore) * 100) : 0;

    await queryAsync(
      "UPDATE quiz_attempts SET answers = ?, score = ?, status = 'completed', submitted_at = ? WHERE id = ?",
      [JSON.stringify(answers || {}), percent, new Date(), attemptId]
    );

    res.json({ success: true, score: percent });
  } catch (err) {
    console.error("Error submitting quiz attempt:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/:code/quizzes/:quizId/attempts", verifyToken, async (req, res) => {
  const { code, quizId } = req.params;
  const userId = req.user.id;

  try {
    const quizRows = await queryAsync(
      `SELECT q.*, c.id as classroom_id
       FROM quizzes q
       JOIN classrooms c ON q.classroom_id = c.id
       WHERE c.code = ? AND q.id = ? LIMIT 1`,
      [code, quizId]
    );
    if (!quizRows.length)
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });

    const quiz = quizRows[0];
    if (quiz.teacher_id !== userId) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const attempts = await queryAsync(
      `SELECT a.id, a.student_id, u.username as studentName, a.attempt_no as attemptNo,
              a.score, a.status, a.started_at, a.submitted_at, a.expires_at
       FROM quiz_attempts a
       LEFT JOIN users u ON a.student_id = u.id
       WHERE a.quiz_id = ?
       ORDER BY a.student_id, a.attempt_no`,
      [quizId]
    );

    res.json({ success: true, attempts });
  } catch (err) {
    console.error("Error fetching quiz attempts:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ----------------- end new routes -----------------

export default router;
