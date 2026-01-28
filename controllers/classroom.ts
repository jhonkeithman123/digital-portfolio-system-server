import { Response } from "express";
import { AuthRequest } from "middleware/auth";
import { RowDataPacket } from "mysql2/promise";
import { queryAsync } from "config/helpers/dbHelper";
import { ResultSetHeader } from "mysql2/promise";
import generateCode from "config/code_generator";
import db from "config/db";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
// Database row types for different query results
interface StudentClassroomRow extends RowDataPacket {
  classroom_id: number;
  status: "pending" | "accepted" | "rejected";
  code: string;
  name: string;
  section: string | null;
  grade: string | null;
}

interface TeacherClassroomRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  section: string | null;
  grade: string | null;
}

interface ClassroomRow extends RowDataPacket {
  id: number;
  name: string;
  code: string;
  teacher_id: number;
  section: string | null;
  grade: string | null;
}

interface StudentRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role: string;
  section: string | null;
  grade: string | null;
}

interface InviteRow extends RowDataPacket {
  id: number;
  classroomName: string;
  code: string;
  teacherName: string;
  hidden: 0 | 1;
}

interface ClassroomMemberRow extends RowDataPacket {
  id: number;
  status: "pending" | "accepted" | "rejected";
  student_id: number;
}

interface UserRow extends RowDataPacket {
  username: string;
}

const checkIfStudentIsEnrolled = async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.userId;

  // Step 1: Query for accepted classroom membership
  // JOIN ensures we get classroom details in one query
  const query = `
      SELECT
        cm.classroom_id,
        cm.status,
        c.code,
        c.name,
        c.section
      FROM classroom_members cm
      JOIN classrooms c ON cm.classroom_id = c.id
      WHERE cm.student_id = ?
        AND cm.status = 'accepted'
    `;

  try {
    const results = await queryAsync<StudentClassroomRow>(query, [studentId]);
    const classroom = results[0] || null;
    const isEnrolled = Boolean(classroom);

    // Log enrollment status for debugging
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

    // Step 2: Return structured response
    res.json({
      success: true,
      enrolled: isEnrolled,
      classroomId: classroom?.classroom_id || null,
      code: classroom?.code || null,
      name: classroom?.name || null,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Error checking students in the database:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const checkIfTeacherHasClassroom = async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.userId;

  try {
    // Step 1: Find teacher's classroom (should be 0 or 1 row)
    const result = await queryAsync<TeacherClassroomRow>(
      "SELECT id, code, name, section FROM classrooms WHERE teacher_id = ?",
      [teacherId],
    );

    // Step 2: Log for debugging (only in development to reduce noise)
    if (process.env.NODE_ENV === "development") {
      console.debug("Teacher has advisory class, going through");
      console.table(result);
    }

    // Step 3: Return classroom status
    res.json({
      success: true,
      created: result.length > 0,
      classroomId: result[0]?.id || null,
      code: result[0]?.code || null,
      name: result[0]?.name || null,
      section: result[0]?.section ?? null,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Error checking teacher status:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const createClassroom = async (req: AuthRequest, res: Response) => {
  const { name, schoolYear, section, grade } = req.body;
  const teacherId = req.user!.userId;

  // Step 1: Generate unique 6-character code (e.g., "ABC123")
  const code = generateCode();

  // Step 2: Insert classroom into database
  const sql = `
      INSERT INTO classrooms (name, school_year, section, grade, teacher_id, code)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

  try {
    const [result] = await db.query<ResultSetHeader>(sql, [
      name,
      schoolYear,
      section || null, // Allow empty section
      grade || null,
      teacherId,
      code,
    ]);

    const classroomId = result.insertId;

    // Step 3: Return success with classroom details
    res.status(200).json({ success: true, classroomId, code });
  } catch (err) {
    console.error("Error creating classroom:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
};

const modifySectionTeacher = async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.userId;
  let { section, code } = req.body;

  console.log("section from save classroom section: ", section);

  // Step 1: Validate required fields
  if (!code) {
    return res
      .status(400)
      .json({ success: false, error: "Missing classroom code" });
  }

  try {
    // Step 2: Verify teacher owns this classroom
    const rows = await queryAsync<RowDataPacket>(
      "SELECT id FROM classrooms WHERE code = ? AND teacher_id = ? LIMIT 1",
      [code, teacherId],
    );

    if (!rows.length) {
      return res
        .status(403)
        .json({ success: false, error: "Not authorized for this classroom" });
    }

    // Step 3: Sanitize section value
    if (typeof section === "string") {
      section = section.trim();
      if (section === "") section = null; // Empty string becomes null
    }

    // Step 4: Validate section type (must be string or null)
    if (section !== null && typeof section !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Invalid section type" });
    }

    // Step 5: Update classroom section
    await db.query<ResultSetHeader>(
      "UPDATE classrooms SET section = ? WHERE code = ? AND teacher_id = ?",
      [section, code, teacherId],
    );

    // Step 6: Return success message
    return res.json({
      success: true,
      message: section
        ? "Classroom section updated"
        : "Classroom section cleared",
      section,
    });
  } catch (err) {
    console.error("Error saving to database:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};

const fetchUnenrolledStudents = async (req: AuthRequest, res: Response) => {
  const { code } = req.params;
  const { section } = req.query;

  console.log("Fetching available students for classroom:", code);

  try {
    // Step 1: Get classroom details including grade
    const classroomRows = await queryAsync<ClassroomRow>(
      "SELECT id, grade, section FROM classrooms WHERE code = ? LIMIT 1",
      [code],
    );

    if (!classroomRows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Classroom not found" });
    }

    const classroom = classroomRows[0];
    const classroomGrade = classroom.grade; // e.g., "12"

    // Step 2: Build query to exclude currently-enrolled students
    // FIXED: Only check current classroom_members, not hidden_invites
    let sql = `
      SELECT u.id, u.username AS name, u.email, u.role, u.section, u.grade
      FROM users u
      WHERE u.role = 'student'
        AND u.id NOT IN (
          SELECT cm.student_id
          FROM classroom_members cm
          WHERE cm.classroom_id = ?
            AND (cm.status = 'accepted' OR cm.status = 'pending')
        )
    `;

    const params: (string | number)[] = [classroom.id]; // Use classroom.id instead of code

    if (classroomGrade) {
      sql += " AND u.grade = ?";
      params.push(classroomGrade);
    }

    if (section && section !== "all") {
      const strand = (section as string).split("-")[0];
      sql += " AND u.section LIKE ?";
      params.push(`${strand}%`);
    }

    // Step 5: Sort by section, then username
    sql += " ORDER BY u.section ASC, u.username ASC";

    // Step 6: Execute query and return results
    const results = await queryAsync<StudentRow>(sql, params);
    console.log(
      `Found ${results.length} available students for grade ${classroomGrade}`,
    );

    res.status(200).json({ success: true, students: results });
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const sendClassroomInviteForStudent = async (
  req: AuthRequest,
  res: Response,
) => {
  const { studentId } = req.body;
  const { code } = req.params;

  try {
    // Step 1: Find classroom by code
    const classrooms = await queryAsync<ClassroomRow>(
      "SELECT id, name FROM classrooms WHERE code = ? LIMIT 1",
      [code],
    );

    if (!classrooms.length) {
      return res
        .status(404)
        .json({ success: false, message: "Classroom not found." });
    }

    const { id: classroomId, name: classroomName } = classrooms[0];

    // Step 2: Check if student is already invited or member
    const existing = await queryAsync<RowDataPacket>(
      "SELECT 1 FROM classroom_members WHERE classroom_id = ? AND student_id = ? LIMIT 1",
      [classroomId, studentId],
    );

    if (existing.length > 0) {
      console.log(
        `Detected existing student ${studentId} in classroom ${classroomId}`,
      );
      return res
        .status(409)
        .json({ success: false, message: "Student already invited." });
    }

    // Step 3: Insert pending membership
    await db.query<ResultSetHeader>(
      "INSERT INTO classroom_members (classroom_id, name, student_id, status, code) VALUES (?, ?, ?, 'pending', ?)",
      [classroomId, classroomName, studentId, code],
    );

    // Step 4: Create notification (fire-and-forget)
    const message = `You've been invited to join classroom ${code}`;
    const link = `/classrooms/${code}`;

    queryAsync(
      `INSERT INTO notifications (recipient_id, sender_id, type, message, link)
         VALUES (?, ?, 'invite', ?, ?)`,
      [studentId, req.user!.userId, message, link],
    ).catch((e) => console.error("Failed to create notification:", e));

    // Step 5: Return success
    res
      .status(200)
      .json({ success: true, message: "Successfully invited student" });
  } catch (err) {
    console.error("Error inviting student:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const fetchClassroomInvites = async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.userId;

  // Step 1: Query pending invites with hidden flag
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
      ORDER BY cm.id DESC
    `;

  try {
    // Step 2: Execute query (studentId appears twice for LEFT JOIN)
    const results = await queryAsync<InviteRow>(sql, [studentId, studentId]);

    console.log(
      `[fetchClassroomInvites] Found ${results.length} invites for student ${studentId}:`,
      results,
    );

    // Step 3: Return invitations
    res.status(200).json({ success: true, invites: results });
  } catch (err) {
    console.error("Error fetching invites:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const dismissInvite = async (req: AuthRequest, res: Response) => {
  const { inviteId } = req.params;
  const studentId = req.user!.userId;

  try {
    // Step 1: Verify the invite exists and belongs to the student
    const inviteRows = await queryAsync<ClassroomMemberRow>(
      "SELECT id, classroom_id FROM classroom_members WHERE id = ? AND student_id = ? LIMIT 1",
      [inviteId, studentId],
    );

    if (!inviteRows.length) {
      return res.status(404).json({
        success: false,
        error: "Invite not found or not authorized",
      });
    }

    // Step 2: Insert hide record (use INSERT IGNORE to handle duplicates)
    await db.query<ResultSetHeader>(
      "INSERT IGNORE INTO hidden_invites (student_id, invite_id) VALUES (?, ?)",
      [studentId, inviteId],
    );

    // Step 3: Return success
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error hiding invite:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const undismissInvite = async (req: AuthRequest, res: Response) => {
  const { inviteId } = req.params;
  const studentId = req.user!.userId;

  try {
    // Step 1: Verify the invite exists and belongs to the student
    const inviteRows = await queryAsync<ClassroomMemberRow>(
      "SELECT id FROM classroom_members WHERE id = ? AND student_id = ? LIMIT 1",
      [inviteId, studentId],
    );

    if (!inviteRows.length) {
      return res.status(404).json({
        success: false,
        error: "Invite not found or not authorized",
      });
    }

    // Step 2: Delete hide record
    await db.query<ResultSetHeader>(
      "DELETE FROM hidden_invites WHERE student_id = ? AND invite_id = ?",
      [studentId, inviteId],
    );

    // Step 3: Return success
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error unhiding invite:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const acceptInvite = async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.userId;
  const { inviteId } = req.params;

  try {
    // Step 1: Update membership status to 'accepted'
    const [result] = await db.query<ResultSetHeader>(
      "UPDATE classroom_members SET status = 'accepted' WHERE id = ? AND student_id = ?",
      [inviteId, studentId],
    );

    // Step 2: Check if update succeeded (invite exists and belongs to student)
    const affected = result.affectedRows ?? 0;
    if (!affected) {
      return res.status(404).json({
        success: false,
        message: "Invite not found or not authorized.",
      });
    }

    // Step 3: Clean up hidden_invites (non-blocking, fire-and-forget)
    queryAsync(
      "DELETE FROM hidden_invites WHERE invite_id = ? AND student_id = ?",
      [inviteId, studentId],
    ).catch((e) => console.error("Error cleaning up hidden invites:", e));

    // Step 4: Return success
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error accepting invite:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const enterByClassroomByCode = async (req: AuthRequest, res: Response) => {
  const studentId = req.user!.userId;
  const { code } = req.body;

  try {
    // Step 1: Find classroom by code
    const classroomRows = await queryAsync<ClassroomRow>(
      "SELECT id, name FROM classrooms WHERE code = ? LIMIT 1",
      [code],
    );

    if (!classroomRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Invalid classroom code" });
    }

    const { id: classroomId, name: classroomName } = classroomRows[0];

    // Step 2: Get student's username for classroom_members.name
    const userRows = await queryAsync<UserRow>(
      "SELECT username FROM users WHERE id = ? LIMIT 1",
      [studentId],
    );
    const studentName = userRows[0]?.username || "";

    // Step 3: Check if student already has a membership row
    const memberRows = await queryAsync<ClassroomMemberRow>(
      "SELECT id, status FROM classroom_members WHERE classroom_id = ? AND student_id = ? LIMIT 1",
      [classroomId, studentId],
    );

    // Scenario A: Already accepted member
    if (memberRows.length && memberRows[0].status === "accepted") {
      return res.status(400).json({
        success: false,
        error: "Already a member of this classroom",
      });
    }

    // Scenario B: Pending invite exists - accept it
    if (memberRows.length) {
      await db.query<ResultSetHeader>(
        "UPDATE classroom_members SET status = 'accepted' WHERE id = ? AND student_id = ?",
        [memberRows[0].id, studentId],
      );

      // Clean up hidden_invites (non-blocking)
      queryAsync(
        "DELETE FROM hidden_invites WHERE invite_id = ? AND student_id = ?",
        [memberRows[0].id, studentId],
      ).catch((e) => console.error("Error cleaning hidden invites:", e));
    } else {
      // Scenario C: New member - insert accepted membership
      try {
        await db.query<ResultSetHeader>(
          "INSERT INTO classroom_members (classroom_id, name, student_id, status, code) VALUES (?, ?, ?, 'accepted', ?)",
          [classroomId, studentName, studentId, code],
        );

        // Clean up any stale hidden_invites (edge case)
        const existing = await queryAsync<RowDataPacket>(
          "SELECT id FROM classroom_members WHERE classroom_id = ? AND student_id = ?",
          [classroomId, studentId],
        );

        if (existing.length) {
          const inviteId = existing[0].id;
          queryAsync(
            "DELETE FROM hidden_invites WHERE invite_id = ? AND student_id = ?",
            [inviteId, studentId],
          ).catch((e) =>
            console.error("Error cleaning hidden invites after insert:", e),
          );
        }
      } catch (err) {
        const error = err as any;

        // Handle race condition: another request inserted concurrently
        if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
          console.warn("Race condition detected, handling gracefully");

          // Find the existing row and mark as accepted
          try {
            const other = await queryAsync<RowDataPacket>(
              "SELECT id FROM classroom_members WHERE classroom_id = ? AND student_id = ? LIMIT 1",
              [classroomId, studentId],
            );

            if (other.length) {
              await db.query<ResultSetHeader>(
                "UPDATE classroom_members SET status = 'accepted' WHERE id = ? AND student_id = ?",
                [other[0].id, studentId],
              );

              // Clean up hidden_invites
              queryAsync(
                "DELETE FROM hidden_invites WHERE invite_id = ? AND student_id = ?",
                [other[0].id, studentId],
              ).catch(() => {});
            }
          } catch (innerErr) {
            console.error("Race handling failed:", innerErr);
          }
        } else {
          // Not a duplicate error - re-throw
          throw err;
        }
      }
    }

    // Step 4: Return success with classroom details
    console.log(
      `Student ${studentId} joined classroom ${classroomName} (${code})`,
    );

    res.status(200).json({
      success: true,
      message: "Successfully joined classroom",
      classroom: { id: classroomId, name: classroomName, code },
    });
  } catch (err) {
    console.error("Error joining classroom:", err);
    res.status(500).json({ success: false, error: "Failed to join classroom" });
  }
};

const checkIfStudentIsClassroomMember = async (
  req: AuthRequest,
  res: Response,
) => {
  if (!(req as any).dbAvailable) {
    return res
      .status(503)
      .json({ success: false, error: "Database not available" });
  }

  const { code } = req.params;
  const userId = req.user!.userId;

  try {
    // Step 1: Find classroom by code
    const classroomRows = await queryAsync<ClassroomRow>(
      "SELECT id, name, code, teacher_id FROM classrooms WHERE code = ? LIMIT 1",
      [code],
    );

    if (!classroomRows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Classroom not found" });
    }

    const classroom = classroomRows[0];

    // Step 2: Check if user is a student member
    const memberRows = await queryAsync<ClassroomMemberRow>(
      `SELECT cm.id, cm.status, cm.student_id
         FROM classroom_members cm
         WHERE cm.classroom_id = ? AND cm.student_id = ? LIMIT 1`,
      [classroom.id, userId],
    );

    // Step 3: Determine membership status
    const isMember = !!(
      memberRows.length && memberRows[0].status === "accepted"
    );
    const membershipStatus = memberRows.length ? memberRows[0].status : null;

    // Step 4: Check if user is the teacher
    const isTeacher = Number(classroom.teacher_id) === Number(userId);

    // Final membership: teacher OR accepted student
    const finalIsMember = isMember || isTeacher;

    // Step 5: Return detailed membership info
    res.json({
      success: true,
      isMember: finalIsMember,
      membershipStatus,
      classroom: {
        id: classroom.id,
        name: classroom.name,
        code: classroom.code,
      },
      isTeacher,
    });
  } catch (e) {
    console.error("Error checking membership:", e);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const controller = {
  acceptInvite,
  checkIfStudentIsEnrolled,
  checkIfStudentIsClassroomMember,
  checkIfTeacherHasClassroom,
  createClassroom,
  dismissInvite,
  enterByClassroomByCode,
  fetchClassroomInvites,
  fetchUnenrolledStudents,
  modifySectionTeacher,
  sendClassroomInviteForStudent,
  undismissInvite,
};

export default controller;
