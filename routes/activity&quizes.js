import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { queryAsync } from "../config/helpers/dbHelper.js";

const router = express.Router();

router.post("/:code/quizzes/create", verifyToken, async (req, res) => {
  const teacherId = req.user.id;
  const { code } = req.params;
  const {
    title,
    questions,
    attemptsAllowed = 2,
    startTime = null,
    endTime = null,
    timeLimitSeconds = null,
  } = req.body;

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

    const insertSql = `
      INSERT INTO quizzes (classroom_id, teacher_id, title, questions, attempts_allowed, start_time, end_time, time_limit_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const qJson = JSON.stringify(questions || []);

    await queryAsync(insertSql, [
      classroomId,
      teacherId,
      title || "Untitled Quiz",
      qJson,
      attemptsAllowed,
      startTime,
      endTime,
      timeLimitSeconds,
    ]);

    res.json({ success: true, message: "Quiz created" });
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
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });

    const quiz = rows[0];
    const quizObj = {
      id: quiz.id,
      title: quiz.title,
      start_time: quiz.start_time,
      end_time: quiz.end_time,
      time_limit_seconds: quiz.time_limit_seconds,
      attempts_allowed: quiz.attempts_allowed,
      created_at: quiz.created_at,
      questions: JSON.parse(quiz.questions || "[]"),
    };

    if (userRole !== "teacher" || userId !== quiz.teacher_id) {
      // hide answers for students
      quizObj.questions = quizObj.questions.map((q) => {
        const { answer, correctAnswer, ...rest } = q;
        const copy = { ...rest };
        if (q.options) copy.options = q.options;
        return copy;
      });
    }

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
