import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { queryAsync } from "../config/helpers/dbHelper.js";

const router = express.Router();

// helper to write pages into quiz_pages table
async function writePages(quizId, pages) {
  await queryAsync("DELETE FROM quiz_pages WHERE quiz_id = ?", [quizId]);

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

//helper to load pages as editor expects
async function loadPages(quizId) {
  const rows = await queryAsync(
    "SELECT id, page_index, title, content_json FROM quiz_pages WHERE quiz_id = ? ORDER BY page_index ASC",
    [quizId]
  );

  return rows.map((r) => {
    let questions = [];

    try {
      const parsed =
        typeof r.content_json == "string"
          ? JSON.parse(r.content_json)
          : r.content_json || {};
      questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    } catch (error) {
      console.error("Error parsing content_json:", error);
    }

    return { id: `page-${r.id}`, title: r.title, questions };
  });
}

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

// helper: parse questions JSON safely
const parseQuestions = (raw) => {
  try {
    return typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
  } catch {
    return [];
  }
};

router.get("/:code/quizzes/:quizId", verifyToken, async (req, res) => {
  const { code, quizId } = req.params;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    const rows = await queryAsync(
      `SELECT q.*, c.teacher_id
       FROM quizzes q
       JOIN classrooms c ON q.classroom_id = c.id
       WHERE c.code = ? AND q.id = ? LIMIT 1`,
      [code, quizId]
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });

    const qz = rows[0];
    const isOwner = role === "teacher" && qz.teacher_id === userId;

    // load normalized pages
    const pages = await loadPages(qz.id);
    const raw = { pages };
    const questions = isOwner ? raw : redactAnswersDeep(raw);

    // compute how many attempts this user has already used for this quiz
    const arows = await queryAsync(
      "SELECT COUNT(*) as cnt FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?",
      [qz.id, userId]
    );
    const attempts_used = arows[0]?.cnt || 0;
    const attempts_remaining =
      qz.attempts_allowed != null
        ? Math.max(0, qz.attempts_allowed - attempts_used)
        : null;

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
    console.error("Error fetching quiz:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

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
    const questionJson = JSON.stringify({ pages: sanitizedPages });

    const insertSql = `
      INSERT INTO quizzes (classroom_id, teacher_id, title, questions, attempts_allowed, start_time, end_time, time_limit_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    // keep quizzes.questions NULL (moved to quiz_pages), but remain compatible
    await queryAsync(insertSql, [
      classroomId,
      teacherId,
      (String(title || "").trim() || "Untitled Quiz").slice(0, 255),
      questionJson, // store nothing here; pages live in quiz_pages
      attempts,
      startTime || null,
      endTime || null,
      tls,
    ]);

    const idRow = await queryAsync("SELECT LAST_INSERT_ID() as id");
    const quizId = idRow[0]?.id || null;

    // persist pages
    await writePages(quizId, sanitizedPages);

    res.json({ success: true, message: "Quiz created", quizId });
  } catch (err) {
    console.error("Error creating quiz:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/:code/quizzes/:quizId", verifyToken, async (req, res) => {
  const teacherId = req.user.id;
  const { code, quizId } = req.params;
  const {
    title,
    questions,
    attemptsAllowed = 1,
    startTime = null,
    endTime = null,
    timeLimitSeconds = null,
  } = req.body;

  // helpers (same as in create)
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
    const sentenceLimit = Math.max(3, asInt(q?.sentenceLimit ?? 3, 3));
    const correctAnswer = String(q?.correctAnswer ?? "");
    return { ...base, sentenceLimit, correctAnswer };
  };
  const normalizeToPages = (qs) => {
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

  const attempts = clamp(asInt(attemptsAllowed, 1), 1, 100);
  const tls = (() => {
    const n = asInt(timeLimitSeconds, 0);
    return n > 0 ? n : null;
  })();

  try {
    // verify ownership and get classroom_id
    const rows = await queryAsync(
      `SELECT q.id, q.classroom_id, c.teacher_id
       FROM quizzes q
       JOIN classrooms c ON q.classroom_id = c.id
       WHERE q.id = ? AND c.code = ? LIMIT 1`,
      [quizId, code]
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    if (rows[0].teacher_id !== teacherId)
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    const sanitized = normalizeToPages(questions);
    const questionJson = JSON.stringify({ pages: sanitized });

    await queryAsync(
      `UPDATE quizzes
       SET title = ?, questions = ?, attempts_allowed = ?, start_time = ?, end_time = ?, time_limit_seconds = ?
       WHERE id = ? AND classroom_id = ? AND teacher_id = ?`,
      [
        (String(title || "").trim() || "Untitled Quiz").slice(0, 255),
        questionJson, // keep old column unused
        attempts,
        startTime || null,
        endTime || null,
        tls,
        quizId,
        rows[0].classroom_id,
        teacherId,
      ]
    );

    // replace pages with the new set
    await writePages(quizId, sanitized);

    res.json({ success: true, message: "Quiz updated", quizId });
  } catch (err) {
    console.error("Error updating quiz:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/:code/quizzes/:quizId", verifyToken, async (req, res) => {
  const teacherId = req.user.id;
  const { code, quizId } = req.params;

  try {
    const rows = await queryAsync(
      `SELECT q.id, q.classroom_id, c.teacher_id
       FROM quizzes q
       JOIN classrooms c ON q.classroom_id = c.id
       WHERE q.id = ? AND c.code = ? LIMIT 1`,
      [quizId, code]
    );

    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    if (rows[0].teacher_id !== teacherId)
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    await queryAsync("DELETE FROM quiz_attempts WHERE quiz_id = ?", [quizId]);
    await queryAsync("DELETE FROM quiz_pages WHERE quiz_id = ?", [quizId]);
    await queryAsync("DELETE FROM quizzes WHERE id = ? LIMIT 1", [quizId]);

    res.json({ success: true, message: "Quiz deleted" });
  } catch (err) {
    console.error("Error deleting quiz:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/:code/quizzes", verifyToken, async (req, res) => {
  const { code } = req.params;

  try {
    const rows = await queryAsync(
      `SELECT q.id, q.title, q.start_time, q.end_time, q.time_limit_seconds, q.attempts_allowed, q.created_at, u.username AS teacherName,
              (SELECT COUNT(*) FROM quiz_pages p WHERE p.quiz_id = q.id) AS pages_count,
              (SELECT COALESCE(SUM(JSON_LENGTH(JSON_EXTRACT(p.content_json, '$.questions'))),0) FROM quiz_pages p WHERE p.quiz_id = q.id) AS questions_count
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

router.post("/:code/quizzes/:quizId/attempt", verifyToken, async (req, res) => {
  const { code, quizId } = req.params;
  const studentId = req.user.id;

  try {
    const rows = await queryAsync(
      `SELECT q.*, c.id as classroom_id, c.teacher_id
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

    // check attempts used
    const arows = await queryAsync(
      "SELECT COUNT(*) as cnt FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?",
      [quizId, studentId]
    );
    const used = arows[0]?.cnt || 0;
    if (quiz.attempts_allowed != null && used >= quiz.attempts_allowed) {
      return res
        .status(400)
        .json({ success: false, message: "No attempts remaining" });
    }

    const nextAttemptNo = used + 1;
    const startedAt = new Date();
    let expiresAt = null;
    if (quiz.time_limit_seconds) {
      expiresAt = new Date(
        startedAt.getTime() + quiz.time_limit_seconds * 1000
      );
    }

    await queryAsync(
      `INSERT INTO quiz_attempts (quiz_id, student_id, attempt_no, answers, score, status, started_at, submitted_at, expires_at)
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

    const idRow = await queryAsync("SELECT LAST_INSERT_ID() as id");
    const attemptId = idRow[0]?.id || null;

    res.json({ success: true, attemptId, attemptNo: nextAttemptNo, expiresAt });
  } catch (err) {
    console.error("Error starting attempt:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/:code/quizzes/:quizId/submit", verifyToken, async (req, res) => {
  const { code, quizId } = req.params;
  const studentId = req.user.id;
  const { attemptId, answers } = req.body;

  try {
    // verify attempt belongs to student
    const art = await queryAsync(
      "SELECT * FROM quiz_attempts WHERE id = ? AND quiz_id = ? AND student_id = ? LIMIT 1",
      [attemptId, quizId, studentId]
    );
    if (!art.length)
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });

    const attempt = art[0];
    if (attempt.status === "completed")
      return res
        .status(400)
        .json({ success: false, message: "Attempt already submitted" });

    // load flattened questions to score (use existing loadPages)
    const pages = await loadPages(quizId);
    const qlist = pages.flatMap((p) => p.questions || []);

    let score = 0;
    let maxScore = 0;

    qlist.forEach((q) => {
      const correct = q.correctAnswer ?? q.answer ?? null;
      if (correct == null) return;
      maxScore += 1;
      const given = answers?.[q.id] ?? null;
      if (Array.isArray(correct)) {
        const givenArr = Array.isArray(given) ? given.map(String) : [];
        const equal =
          correct.length === givenArr.length &&
          correct.every((v) => givenArr.includes(String(v)));
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
    console.error("Error submitting attempt:", err);
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
