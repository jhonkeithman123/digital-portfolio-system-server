import express, { type Response } from "express";
import dotenv from "dotenv";

import { verifyToken, type AuthRequest } from "middleware/auth";
import { queryAsync } from "config/helpers/dbHelper";
import generateCode from "config/code_generator";
import wrapAsync from "utils/wrapAsync";
import db from "config/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

dotenv.config();
const router = express.Router();

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
}

interface TeacherClassroomRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  section: string | null;
}

interface ClassroomRow extends RowDataPacket {
  id: number;
  name: string;
  code: string;
  teacher_id: number;
  section: string | null;
}

interface StudentRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role: string;
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

// ============================================================================
// ROUTE: GET /student - Check student's classroom enrollment
// ============================================================================
/**
 * Checks if a student is enrolled in a classroom.
 * Returns classroom details if enrolled, null if not.
 *
 * Process:
 * 1. Verify JWT token (student only)
 * 2. Query classroom_members with JOIN to classrooms
 * 3. Filter by student_id and status = 'accepted'
 * 4. Return enrollment status and classroom details
 *
 * Use case:
 * - Student dashboard: Show "Join Classroom" or "Your Classroom"
 * - Navigation: Redirect to classroom page if enrolled
 * - Authorization: Verify student has access to classroom features
 */
router.get(
  "/student",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

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
  }),
);

// ============================================================================
// ROUTE: GET /teacher - Check if teacher has created a classroom
// ============================================================================
/**
 * Checks if a teacher has already created their advisory classroom.
 * Teachers can only have ONE classroom (their advisory class).
 *
 * Process:
 * 1. Verify JWT token (teacher only)
 * 2. Query classrooms table for teacher_id match
 * 3. Return classroom details if exists
 *
 * Business rule:
 * - One teacher = One classroom (advisory class)
 * - Used to show "Create Classroom" or "Manage Classroom"
 * - Prevents duplicate classroom creation
 */
router.get(
  "/teacher",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

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
  }),
);

// ============================================================================
// ROUTE: POST /create - Teacher creates a new classroom
// ============================================================================
/**
 * Creates a new classroom for a teacher (advisory class).
 * Generates a unique 6-character code for students to join.
 *
 * Process:
 * 1. Verify JWT token (teacher only)
 * 2. Generate unique classroom code (ABC123 format)
 * 3. Insert classroom into database
 * 4. Return classroom ID and code
 *
 * Required fields:
 * - name: Classroom name (e.g., "Grade 10 - Section A")
 * - schoolYear: Academic year (e.g., "2024-2025")
 * - section: Optional section identifier (e.g., "A", "Einstein")
 *
 * Security:
 * - Only teachers can create classrooms
 * - One teacher can only have one classroom (enforced by unique teacher_id)
 * - Code is randomly generated and unique
 */
router.post(
  "/create",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { name, schoolYear, section } = req.body;
    const teacherId = req.user!.userId;

    // Step 1: Generate unique 6-character code (e.g., "ABC123")
    const code = generateCode();

    // Step 2: Insert classroom into database
    const sql = `
      INSERT INTO classrooms (name, school_year, section, teacher_id, code)
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await db.query<ResultSetHeader>(sql, [
        name,
        schoolYear,
        section || null, // Allow empty section
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
  }),
);

// ============================================================================
// ROUTE: PATCH /teacher/section - Update classroom section
// ============================================================================
/**
 * Allows teachers to update or clear the section field of their classroom.
 *
 * Process:
 * 1. Verify JWT token (teacher only)
 * 2. Validate classroom code and teacher ownership
 * 3. Sanitize section value (trim or set to null)
 * 4. Update classroom section
 * 5. Return success message
 *
 * Section handling:
 * - Empty string "" → converted to null (cleared)
 * - Whitespace-only → trimmed and set to null
 * - Valid string → trimmed and saved
 * - null → explicitly cleared
 *
 * Security:
 * - Teacher must own the classroom (teacher_id check)
 * - Code must match to prevent unauthorized updates
 */
router.patch(
  "/teacher/section",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

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
  }),
);

// ============================================================================
// ROUTE: GET /:code/students - Get available students for invitation
// ============================================================================
/**
 * Fetches students who are NOT already invited or members of the classroom.
 * Optionally filters by section for targeted invitations.
 *
 * Process:
 * 1. Verify JWT token (teacher only)
 * 2. Query students with role = 'student'
 * 3. Exclude students already invited/accepted (via NOT IN subquery)
 * 4. Optionally filter by section
 * 5. Return list of available students
 *
 * Query logic:
 * - Main query: SELECT students
 * - Subquery: Find student_ids already in classroom_members
 * - Status filter: Exclude 'accepted' OR 'pending' (both are unavailable)
 * - Section filter: Optional WHERE clause
 *
 * Use case:
 * - Teacher invites page: Show list of students to invite
 * - Section dropdown: Filter students by their registered section
 * - Prevents duplicate invitations
 */
router.get(
  "/:code/students",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

    const { code } = req.params;
    const { section } = req.query;

    console.log("Fetching available students for classroom:", code);

    // Step 1: Build query to exclude already-invited students
    let sql = `
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

    const params: (string | number)[] = [code];

    // Step 2: Optionally filter by section
    if (section && section !== "all") {
      sql += " AND u.section = ?";
      params.push(section as string);
    }

    try {
      // Step 3: Execute query and return results
      const results = await queryAsync<StudentRow>(sql, params);
      console.log(`Found ${results.length} available students`);

      res.status(200).json({ success: true, students: results });
    } catch (err) {
      console.error("Error fetching students:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }),
);

// ============================================================================
// ROUTE: POST /:code/invite - Teacher invites a student to classroom
// ============================================================================
/**
 * Sends a classroom invitation to a student.
 * Creates a pending membership and sends a notification.
 *
 * Process:
 * 1. Verify JWT token (teacher only)
 * 2. Find classroom by code
 * 3. Check if student is already invited/member
 * 4. Insert pending membership into classroom_members
 * 5. Create notification for student
 * 6. Return success
 *
 * Membership states:
 * - pending: Invitation sent, waiting for student response
 * - accepted: Student joined the classroom
 * - rejected: Student declined (not implemented yet)
 *
 * Notification:
 * - Type: 'invite'
 * - Message: "You've been invited to join classroom {code}"
 * - Link: /classrooms/{code} (student can view and accept)
 * - Fire-and-forget: Notification failure doesn't block invite
 *
 * Security:
 * - Prevents duplicate invitations (409 conflict)
 * - Validates classroom exists
 * - Only teachers can invite
 */
router.post(
  "/:code/invite",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

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
  }),
);

// ============================================================================
// ROUTE: GET /invites - Get student's pending invitations
// ============================================================================
/**
 * Fetches all pending classroom invitations for the logged-in student.
 * Includes a "hidden" flag for invites the student has dismissed.
 *
 * Process:
 * 1. Verify JWT token (student only)
 * 2. Query classroom_members for pending invitations
 * 3. JOIN with classrooms to get classroom details
 * 4. JOIN with users to get teacher name
 * 5. LEFT JOIN with hidden_invites to check if dismissed
 * 6. Return list of invitations
 *
 * Query structure:
 * - classroom_members: Source of invitations (status = 'pending')
 * - classrooms: Get classroom name and code
 * - users: Get teacher name for display
 * - hidden_invites: Check if student dismissed this invite
 *
 * Hidden invites:
 * - Students can dismiss invites without rejecting
 * - Hidden invites are filtered out in UI
 * - Can be un-hidden by clearing hidden_invites table
 * - Accepting an invite auto-removes from hidden_invites
 *
 * Use case:
 * - Student notifications page: Show pending invites
 * - Invite cards: Display classroom name, teacher, and actions
 * - UI filtering: Hide dismissed invites from notification count
 */
router.get(
  "/invites",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

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
    `;

    try {
      // Step 2: Execute query (studentId appears twice for LEFT JOIN)
      const results = await queryAsync<InviteRow>(sql, [studentId, studentId]);

      // Step 3: Return invitations
      res.status(200).json({ success: true, invites: results });
    } catch (err) {
      console.error("Error fetching invites:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }),
);

// ============================================================================
// ROUTE: POST /invites/:inviteId/hide - Hide an invitation (soft dismiss)
// ============================================================================
/**
 * Allows students to hide (dismiss) an invitation without rejecting it.
 * The invite remains in database but is filtered out in UI.
 *
 * Process:
 * 1. Verify JWT token (student only)
 * 2. Insert record into hidden_invites table
 * 3. Return success
 *
 * Hidden vs Rejected:
 * - Hidden: Student dismissed notification, but can still accept later
 * - Rejected: Student declined invitation (not implemented)
 * - Hidden invites are removed when student accepts
 *
 * Use case:
 * - Student wants to clear notification badge
 * - Student isn't ready to join but doesn't want to reject
 * - Teacher can still see student as "invited" (status = pending)
 *
 * Security:
 * - Student can only hide their own invites (student_id check)
 * - Duplicate hides are safe (INSERT doesn't check)
 */
router.post(
  "/invites/:inviteId/hide",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    const { inviteId } = req.params;
    const studentId = req.user!.userId;

    try {
      // Step 1: Insert hide record (duplicate-safe)
      await db.query<ResultSetHeader>(
        "INSERT INTO hidden_invites (student_id, invite_id) VALUES (?, ?)",
        [studentId, inviteId],
      );

      // Step 2: Return success
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error hiding invite:", err);
      res.status(500).json({ success: false, error: "Server error" });
    }
  }),
);

// ============================================================================
// ROUTE: POST /invites/:inviteId/accept - Accept a classroom invitation
// ============================================================================
/**
 * Student accepts a pending classroom invitation.
 * Updates membership status from 'pending' to 'accepted'.
 *
 * Process:
 * 1. Verify JWT token (student only)
 * 2. Update classroom_members status to 'accepted'
 * 3. Verify student owns this invite (student_id check)
 * 4. Clean up hidden_invites (if student had hidden it)
 * 5. Return success
 *
 * State transition:
 * - Before: status = 'pending' (invited but not joined)
 * - After: status = 'accepted' (active member)
 *
 * Side effects:
 * - Student can now access classroom activities
 * - Student appears in teacher's member list
 * - Invite is removed from student's notifications
 * - Hidden invite record is deleted (if exists)
 *
 * Security:
 * - Student can only accept their own invites (student_id WHERE clause)
 * - Returns 404 if invite doesn't exist or doesn't belong to student
 */
router.post(
  "/invites/:inviteId/accept",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

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
  }),
);

// ============================================================================
// ROUTE: POST /join - Student joins classroom via code (self-enroll)
// ============================================================================
/**
 * Allows students to join a classroom by entering the classroom code.
 * Handles both new joins and accepting existing pending invitations.
 *
 * Process:
 * 1. Verify JWT token (student only)
 * 2. Find classroom by code
 * 3. Check if student is already a member
 * 4. If pending invite exists, accept it
 * 5. If no invite exists, create accepted membership
 * 6. Clean up hidden_invites (if any)
 * 7. Return success with classroom details
 *
 * Three scenarios:
 *
 * A) Student already accepted:
 *    - Return error: "Already a member"
 *
 * B) Student has pending invite:
 *    - Update status from 'pending' to 'accepted'
 *    - Clean up hidden_invites
 *    - Return success
 *
 * C) Student is new (no invite):
 *    - Insert new classroom_members row with status = 'accepted'
 *    - Handle rare race condition (duplicate key)
 *    - Return success
 *
 * Race condition handling:
 * - If two processes try to join simultaneously, one gets duplicate key error
 * - Catch ER_DUP_ENTRY (errno 1062) and treat as success
 * - Update existing row to 'accepted' as fallback
 *
 * Security:
 * - Classroom code must be valid (6-character code)
 * - Student can only join once per classroom
 * - No teacher approval needed (self-enroll model)
 *
 * Use case:
 * - Student enters code: "ABC123"
 * - Student clicks "Join" on invite card (same endpoint)
 * - Handles both invited and non-invited students
 */
router.post(
  "/join",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
    if (!(req as any).dbAvailable) {
      return res
        .status(503)
        .json({ ok: false, error: "Database not available" });
    }

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
          if (
            error &&
            (error.code === "ER_DUP_ENTRY" || error.errno === 1062)
          ) {
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
      res
        .status(500)
        .json({ success: false, error: "Failed to join classroom" });
    }
  }),
);

// ============================================================================
// ROUTE: GET /:code/is-member - Check if user is a member of classroom
// ============================================================================
/**
 * Verifies if the logged-in user has access to a specific classroom.
 * Works for both teachers and students with different authorization logic.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Find classroom by code
 * 3. Check if user is the teacher (teacher_id match)
 * 4. Check if user is an accepted student member
 * 5. Return membership status and classroom details
 *
 * Authorization logic:
 * - Teachers: teacher_id must match classroom.teacher_id
 * - Students: Must have accepted membership in classroom_members
 *
 * Response includes:
 * - isMember: true if user has access (teacher OR accepted student)
 * - membershipStatus: 'pending', 'accepted', or null
 * - isTeacher: true if user is the classroom teacher
 * - classroom: Basic classroom info (id, name, code)
 *
 * Use cases:
 * - Route guards: Prevent unauthorized access to classroom pages
 * - UI rendering: Show different views for teachers vs students
 * - Activity access: Verify user can view/submit activities
 * - Navigation: Redirect non-members to join page
 *
 * Security:
 * - Returns 404 if classroom doesn't exist (prevents code enumeration)
 * - Clearly distinguishes between teacher and student access
 * - Students must have status = 'accepted' (pending is not enough)
 */
router.get(
  "/:code/is-member",
  verifyToken,
  wrapAsync(async (req: AuthRequest, res: Response) => {
    // Guard: Check database availability
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
  }),
);

export default router;
