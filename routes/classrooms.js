import express from "express";
import dotenv from "dotenv";

import { verifyToken } from "../middleware/auth.js";
import { queryAsync } from "../config/helpers/dbHelper.js";
import generateCode from "../config/code_generator.js";

dotenv.config();
const router = express.Router();

//* Checks if the student is already in the classroom
router.get("/student", verifyToken, async (req, res) => {
  const studentId = req.user.id;

  const query = `
    SELECT
      cm.classroom_id,
      cm.status,
      c.code,
      c.name
    FROM classroom_members cm
    JOIN classrooms c ON cm.classroom_id = c.id
    WHERE cm.student_id = ?
    AND cm.status = 'accepted'
  `;

  try {
    const results = await queryAsync(query, [studentId]);
    const classroom = results[0] || null;
    const isEnrolled = Boolean(classroom);

    console.log("Students enrollment check:", {
      studentId,
      isEnrolled,
      classroomDetails: isEnrolled
        ? {
            id: classroom.classroom_id,
            name: classroom.name,
            code: classroom.code,
          }
        : null,
    });

    res.json({
      success: true,
      enrolled: isEnrolled,
      classroomId: classroom?.classroom_id || null,
      code: classroom?.code || null,
      name: classroom?.name || null,
    });
  } catch (error) {
    console.error("Error checking students in the database:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//* Checks if the teacher already has a classroom
router.get("/teacher", verifyToken, async (req, res) => {
  const teacherId = req.user.id;

  try {
    const result = await queryAsync(
      "SELECT * FROM classrooms WHERE teacher_id = ?",
      [teacherId]
    );

    // avoid noisy terminal output in production — only log in development
    if (process.env.NODE_ENV === "development") {
      console.debug("Teacher has advisory class, going through");
      console.table(result);
    }

    res.json({
      success: true,
      created: result.length > 0,
      classroomId: result[0]?.id || null,
      code: result[0]?.code || null,
      name: result[0]?.name || null,
    });
  } catch (err) {
    console.error("Error checking teacher status:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/create", verifyToken, async (req, res) => {
  const { name, schoolYear, section } = req.body;
  const teacherId = req.user.id;
  const code = generateCode();

  const sql =
    "INSERT INTO classrooms (name, school_year, section, teacher_id, code) VALUES (?, ?, ?, ?, ?)";

  try {
    const result = await queryAsync(sql, [
      name,
      schoolYear,
      section || null,
      teacherId,
      code,
    ]);
    const classroomId = result.insertId || result.id || null;
    res.status(200).json({ success: true, classroomId, code });
  } catch (err) {
    console.error("Error creating classroom:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

//* Get students not already invited/accepted for a classroom
router.get("/:code/students", verifyToken, async (req, res) => {
  const { code } = req.params;
  const { section } = req.query;

  console.log("Fetching available students for classroom:", code);

  const sql = `
    SELECT u.id, u.username AS name, u.email, u.role
    FROM users u
    WHERE u.role = 'student'
      AND u.id NOT IN (
        SELECT cm.student_id
        FROM classroom_members cm
        JOIN classrooms c ON cm.classroom_id = c.id
        WHERE c.code = ?
          AND (cm.status = 'accepted' OR cm.status = 'pending')
      )
  `;

  const params = [code];
  if (section && section !== "all") {
    sql += " AND u.section = ?";
    params.push(section);
  }

  try {
    const results = await queryAsync(sql, params);
    console.log(`Found ${results.length} available students`);
    res.status(200).json({ success: true, students: results });
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/:code/invite", verifyToken, async (req, res) => {
  const { studentId } = req.body;
  const { code } = req.params;

  try {
    const classrooms = await queryAsync(
      "SELECT id, name FROM classrooms WHERE code = ? LIMIT 1",
      [code]
    );
    if (!classrooms.length) {
      return res
        .status(404)
        .json({ success: false, message: "Classroom not found." });
    }

    const { id: classroomId, name: classroomName } = classrooms[0];

    const existing = await queryAsync(
      "SELECT 1 FROM classroom_members WHERE classroom_id = ? AND student_id = ? LIMIT 1",
      [classroomId, studentId]
    );

    if (existing.length > 0) {
      console.log(
        `Detected existing student ${studentId} in classroom ${classroomId}`
      );
      return res
        .status(409)
        .json({ success: false, message: "Student already invited." });
    }

    await queryAsync(
      "INSERT INTO classroom_members (classroom_id, name, student_id, status, code) VALUES (?, ?, ?, 'pending', ?)",
      [classroomId, classroomName, studentId, code]
    );

    const message = `You've been invited to join classroom ${code}`;
    const link = `/classrooms/${code}`;

    // fire-and-forget notification
    queryAsync(
      `INSERT INTO notifications (recipient_id, sender_id, type, message, link)
       VALUES (?, ?, 'invite', ?, ?)`,
      [studentId, req.user.id, message, link]
    ).catch((e) => console.error("Failed to create notification:", e));

    res
      .status(200)
      .json({ success: true, message: "Successfully invited student" });
  } catch (err) {
    console.error("Error inviting student:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/invites", verifyToken, async (req, res) => {
  const studentId = req.user.id;

  const sql = `
    SELECT 
      cm.id,
      c.name as classroomName,
      c.code,
      u.username as teacherName,
      CASE WHEN hi.invite_id IS NULL THEN 0 ELSE 1 END AS hidden
    FROM classroom_members cm
    JOIN classrooms c ON cm.classroom_id = c.id
    JOIN users u ON c.teacher_id = u.id
    LEFT JOIN hidden_invites hi 
      ON hi.invite_id = cm.id AND hi.student_id = ?
    WHERE cm.student_id = ?
      AND cm.status = 'pending'
  `;

  try {
    const results = await queryAsync(sql, [studentId, studentId]);

    res.status(200).json({ success: true, invites: results });
  } catch (err) {
    console.error("Error fetching invites:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/invites/:inviteId/hide", verifyToken, async (req, res) => {
  const { inviteId } = req.params;
  const studentId = req.user.id;

  try {
    await queryAsync(
      "INSERT INTO hidden_invites (student_id, invite_id) VALUES (?, ?)",
      [studentId, inviteId]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error hiding invite:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

router.post("/invites/:inviteId/accept", verifyToken, async (req, res) => {
  const studentId = req.user.id;
  const { inviteId } = req.params;

  try {
    const result = await queryAsync(
      "UPDATE classroom_members SET status = 'accepted' WHERE id = ? AND student_id = ?",
      [inviteId, studentId]
    );

    const affected = result.affectedRows ?? result.affected ?? 0;
    if (!affected) {
      return res.status(404).json({
        success: false,
        message: "Invite not found or not authorized.",
      });
    }

    // cleanup hidden_invites (non-blocking)
    queryAsync(
      "DELETE FROM hidden_invites WHERE invite_id = ? AND student_id = ?",
      [inviteId, studentId]
    ).catch((e) => console.error("Error cleaning up hidden invites:", e));

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error accepting invite:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/join", verifyToken, async (req, res) => {
  const studentId = req.user.id;
  const { code } = req.body;

  try {
    await queryAsync("START TRANSACTION");

    const classroomRows = await queryAsync(
      "SELECT id, name FROM classrooms WHERE code = ? FOR UPDATE",
      [code]
    );
    if (!classroomRows.length) {
      await queryAsync("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, error: "Invalid classroom code" });
    }

    const { id: classroomId, name: classroomName } = classroomRows[0];

    const userRows = await queryAsync(
      "SELECT username FROM users WHERE id = ? LIMIT 1",
      [studentId]
    );
    const studentName = userRows[0]?.username || "";

    const memberRows = await queryAsync(
      "SELECT id, status FROM classroom_members WHERE classroom_id = ? AND student_id = ? FOR UPDATE",
      [classroomId, studentId]
    );

    if (memberRows.length && memberRows[0].status === "accepted") {
      await queryAsync("ROLLBACK");
      return res
        .status(400)
        .json({ success: false, error: "Already a member of this classroom" });
    }

    if (memberRows.length) {
      await queryAsync(
        "UPDATE classroom_members SET status = 'accepted' WHERE id = ? AND student_id = ?",
        [memberRows[0].id, studentId]
      );

      // cleanup hidden invites non-blocking
      queryAsync(
        "DELETE FROM hidden_invites WHERE student_id = ? AND invite_id = ?",
        [studentId, memberRows[0].id]
      ).catch((e) => console.error("Error cleaning hidden invites:", e));
    } else {
      await queryAsync(
        "INSERT INTO classroom_members (classroom_id, name, student_id, status, code) VALUES (?, ?, ?, 'accepted', ?)",
        [classroomId, studentName, studentId, code]
      );
    }

    await queryAsync("COMMIT");

    console.log(
      `Student ${studentId} joined classroom ${classroomName} (${code})`
    );
    res.status(200).json({
      success: true,
      message: "Successfully joined classroom",
      classroom: { id: classroomId, name: classroomName, code },
    });
  } catch (err) {
    console.error("Error joining classroom:", err);
    try {
      await queryAsync("ROLLBACK");
    } catch (rbErr) {
      console.error("Rollback failed:", rbErr);
    }
    res.status(500).json({ success: false, error: "Failed to join classroom" });
  }
});

export default router;
