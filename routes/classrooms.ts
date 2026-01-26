import express from "express";
import dotenv from "dotenv";

import { verifyToken } from "middleware/auth";
import wrapAsync from "utils/wrapAsync";
import controller from "controllers/classroom";

dotenv.config();
const router = express.Router();

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
  wrapAsync(controller.checkIfStudentIsEnrolled),
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
  wrapAsync(controller.checkIfTeacherHasClassroom),
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
router.post("/create", verifyToken, wrapAsync(controller.createClassroom));

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
  wrapAsync(controller.modifySectionTeacher),
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
  wrapAsync(controller.fetchUnenrolledStudents),
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
  wrapAsync(controller.sendClassroomInviteForStudent),
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
  wrapAsync(controller.fetchClassroomInvites),
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
  wrapAsync(controller.dismissInvite),
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
  wrapAsync(controller.acceptInvite),
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
router.post("/join", verifyToken, wrapAsync(controller.enterByClassroomByCode));

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
  wrapAsync(controller.checkIfStudentIsClassroomMember),
);

export default router;
