import express, { type Response } from "express";
import { verifyToken, type AuthRequest } from "middleware/auth";
import { queryAsync } from "config/helpers/dbHelper";
import wrapAsync from "utils/wrapAsync";
import db from "config/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import controller from "@/controllers/default";

const router = express.Router();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
// Database row types for notifications and users

interface NotificationRow extends RowDataPacket {
  id: number;
  recipient_id: number;
  sender_id: number;
  type: string; // 'invite', 'submission', 'feedback', etc.
  message: string;
  link: string | null;
  is_read: 0 | 1;
  created_at: Date;
  updated_at: Date;
}

interface StudentRow extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  section: string | null;
}

interface SectionRow extends RowDataPacket {
  section: string;
}

// ============================================================================
// ROUTE: GET /notifications - Fetch all notifications for current user
// ============================================================================
/**
 * Retrieves all notifications for the authenticated user.
 * Ordered by most recent first (DESC by created_at).
 *
 * Process:
 * 1. Verify JWT token
 * 2. Check database availability
 * 3. Query notifications for current user
 * 4. Return notifications list (newest first)
 *
 * Response structure:
 * {
 *   success: true,
 *   notifications: [
 *     {
 *       id: 1,
 *       type: 'invite',
 *       message: "You've been invited to...",
 *       link: "/classrooms/ABC123",
 *       is_read: 0,
 *       created_at: "2025-12-21T10:30:00Z"
 *     },
 *     ...
 *   ]
 * }
 *
 * Notification types:
 * - 'invite': Classroom invitation from teacher
 * - 'submission': Activity submission feedback
 * - 'feedback': Comments on student work
 * - 'grade': Grade posted for activity
 *
 * Use cases:
 * - App startup: Fetch notifications to display bell badge
 * - User clicks notification bell: Load full notification list
 * - Real-time: Update when new notifications arrive (via WebSocket)
 *
 * Security:
 * - User can only see their own notifications (recipient_id check)
 * - No pagination (assumes reasonable notification count)
 */
router.get(
  "/notifications",
  verifyToken,
  wrapAsync(controller.fetchAllNotifications),
);

// ============================================================================
// ROUTE: POST /notifications/:id/read - Mark single notification as read
// ============================================================================
/**
 * Marks a single notification as read.
 * Used when user clicks on a notification to view it.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Parse notification ID from URL params
 * 3. Update is_read = TRUE where id matches AND belongs to current user
 * 4. Return success (no error if not found - idempotent)
 *
 * Idempotent:
 * - Calling this multiple times is safe
 * - If already read, nothing changes
 * - Client can safely retry on error
 *
 * Security:
 * - User can only mark their own notifications (recipient_id WHERE clause)
 * - Prevents users from marking other users' notifications
 * - Returns success even if notification doesn't exist (safe)
 *
 * Use cases:
 * - User clicks notification → mark as read
 * - Navigation away from notification → mark as read
 * - Bulk read operation → calls this for each notification
 *
 * Performance:
 * - Indexed on (recipient_id, id) for fast lookups
 * - Single row update (very fast)
 * - Consider batch operations for many notifications
 */
router.post(
  "/notifications/:id/read",
  verifyToken,
  wrapAsync(controller.markNotificationAsRead),
);

// ============================================================================
// ROUTE: POST /notifications/mark-all-read - Mark ALL notifications as read
// ============================================================================
/**
 * Marks all unread notifications as read for the current user.
 * Used when user clicks "Mark all as read" button.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Check database availability
 * 3. Update all unread notifications (is_read = FALSE → TRUE)
 * 4. Return success
 *
 * Query logic:
 * - WHERE recipient_id = ? → Only user's notifications
 * - AND is_read = FALSE → Only unread ones (optimization)
 * - Avoids updating already-read notifications (unnecessary writes)
 *
 * Safety:
 * - No rows updated if all already read (safe)
 * - Idempotent: calling twice has same effect as calling once
 * - No notification IDs needed (bulk operation)
 *
 * Performance:
 * - Single UPDATE query (efficient)
 * - Index on (recipient_id, is_read) speeds up WHERE clause
 * - Better than individual POST calls for many notifications
 *
 * Use cases:
 * - User clicks "Mark all as read" button
 * - App initialization: Clear all old notifications
 * - Notification cleanup: Reduce clutter
 *
 * UI implications:
 * - Notification bell badge disappears (no unread count)
 * - All notification items show as "read" visually
 * - User can still view notification history
 */
router.post(
  "/notifications/mark-all-read",
  verifyToken,
  wrapAsync(controller.markAllNotificationsAsRead),
);

// ============================================================================
// ROUTE: POST /notifications/read-batch - Mark multiple notifications as read
// ============================================================================
/**
 * Marks a batch of selected notifications as read in one query.
 * More efficient than individual POST calls for many notifications.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Validate notification IDs from request body
 * 3. Build dynamic IN (?, ?, ...) clause
 * 4. Update all matching notifications
 * 5. Return count of updated rows
 *
 * Request body format:
 * {
 *   ids: [1, 2, 3, 5, 8]  // Array of notification IDs
 * }
 *
 * Query safety:
 * - IDs are validated with Number.isInteger() (prevent injection)
 * - Placeholders (?) are used for all values
 * - WHERE recipient_id = ? ensures user can only update own notifications
 * - IN (?, ?, ...) prevents SQL injection
 *
 * Validation:
 * - ids must be an array: if not, returns empty success
 * - Each id must be an integer: non-integers filtered out
 * - Empty array: returns success with updated: 0 (no-op)
 * - Non-integer values: silently filtered (not an error)
 *
 * Response:
 * {
 *   success: true,
 *   updated: 3  // Number of rows actually updated
 * }
 *
 * Edge cases:
 * - IDs that don't exist: Silently ignored
 * - IDs belonging to other users: Blocked by WHERE recipient_id
 * - Already read notifications: Silently updated (no change)
 * - Empty ids array: Returns updated: 0
 *
 * Performance:
 * - Single query regardless of notification count
 * - Much faster than 5+ individual queries
 * - Reduces database round trips
 *
 * Use cases:
 * - Notification list: User selects multiple → clicks "Mark as read"
 * - Bulk cleanup: Clear old notifications
 * - Import: Mark imported notifications as read
 */
router.post(
  "/notifications/read-batch",
  verifyToken,
  wrapAsync(controller.markMultipleNotificationsAsRead),
);

// Delete batch notifications
router.delete(
  "/notifications/delete-batch",
  verifyToken,
  wrapAsync(controller.deleteSelectedNotifications),
);

// Delete all notifications
router.delete(
  "/notifications/delete-all",
  verifyToken,
  wrapAsync(controller.deleteAllNotifications),
);

// ============================================================================
// ROUTE: GET /users/sections - Get all distinct student sections
// ============================================================================
/**
 * Returns a list of all unique section values from the students table.
 * Used for filtering students by section in UI dropdowns.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Query all distinct sections where students exist
 * 3. Filter out NULL and empty sections
 * 4. Sort alphabetically
 * 5. Return as array of strings
 *
 * Query logic:
 * - DISTINCT: Get unique values only
 * - WHERE role='student': Only student sections (not teachers)
 * - AND section IS NOT NULL: Exclude NULL sections
 * - ORDER BY section: Alphabetical order (A, B, C, ...)
 *
 * Response:
 * {
 *   success: true,
 *   sections: ["A", "B", "Einstein", "Newton", "Section 1"]
 * }
 *
 * Data transformation:
 * - Database returns: [{section: "A"}, {section: "B"}, ...]
 * - Mapped to: ["A", "B", ...]
 * - Client uses for dropdown options
 *
 * Use cases:
 * - Teacher dashboard: Filter students by section
 * - Classroom creation: Set classroom section
 * - Student list: View students in specific section
 * - Analytics: Group by section
 *
 * Performance:
 * - DISTINCT is efficient with index on (role, section)
 * - Returns only section names (very small result set)
 * - Suitable for frequent calls
 *
 * Security:
 * - Returns section names only (no sensitive data)
 * - Token required (basic auth)
 * - No role check (all authenticated users can see sections)
 */
router.get("/users/sections", verifyToken, wrapAsync(controller.fetchSections));

// ============================================================================
// ROUTE: GET /users/students - List all students (optionally filter by section)
// ============================================================================
/**
 * Returns all students in the system with their details.
 * Teachers can filter to show only students missing a section assignment.
 *
 * Process:
 * 1. Verify JWT token
 * 2. Check role is "teacher" (authorization)
 * 3. Parse optional "missing" query parameter
 * 4. Build dynamic SQL based on missing filter
 * 5. Execute query and return students list
 *
 * Query parameters:
 * - missing=1 or missing=true: Show only students WITHOUT section
 * - Omitted or missing=0: Show ALL students
 *
 * Filter logic (when missing=1):
 * - WHERE section IS NULL OR section = ''
 * - Includes both NULL (never set) and empty string (cleared)
 * - Useful for teachers to assign sections
 *
 * Response:
 * {
 *   success: true,
 *   students: [
 *     {
 *       id: 1,
 *       username: "john_doe",
 *       email: "john@example.com",
 *       section: "A"  // or null if not set
 *     },
 *     ...
 *   ]
 * }
 *
 * Authorization:
 * - Only teachers can use this endpoint
 * - Students get 403 Forbidden
 *
 * Use cases:
 * - Teacher dashboard: Browse all students
 * - Section assignment: Show students needing section
 * - Bulk operations: Select students for classroom creation
 * - Student management: Export student list
 *
 * Performance:
 * - Index on (role, section) speeds up filter
 * - Sorted by username (consistent order)
 * - Considers all students in system (no pagination)
 *
 * Data transformation:
 * - COALESCE(NULLIF(section,''), NULL):
 *   - Converts empty string to NULL
 *   - Ensures consistent NULL representation
 *   - Prevents "" vs NULL confusion in client
 *
 * Security:
 * - Only teachers can access (req.user.role check)
 * - No sensitive password/email filtering
 * - Returns email (needed for teacher reference)
 */
router.get("/users/students", verifyToken, wrapAsync(controller.fetchSections));

// ============================================================================
// ROUTE: PATCH /users/:id/section - Update a student's section
// ============================================================================
/**
 * Allows teachers to assign or update a student's section.
 * Single student edit (for bulk edit, use batch endpoint).
 *
 * Process:
 * 1. Verify JWT token
 * 2. Check authorization (teacher only)
 * 3. Parse and validate student ID from URL
 * 4. Extract and sanitize section from request body
 * 5. Update student section in database
 * 6. Return success
 *
 * Request format:
 * PATCH /users/123/section
 * {
 *   section: "A"  // or "" to clear, or null to clear
 * }
 *
 * Section handling:
 * - "A" → saved as "A"
 * - "" (empty string) → converted to null (cleared)
 * - null → saved as null
 * - "  " (whitespace) → trimmed to "", then null
 * - Undefined/missing → treated as empty, becomes null
 *
 * ID validation:
 * - Must be a valid integer
 * - Parsed with parseInt(..., 10) for safety
 * - Non-integer returns 400 Bad Request
 * - Prevents SQL injection
 *
 * Query safety:
 * - WHERE role='student': Only updates students
 * - Prevents accidental updates to teachers/admins
 * - Safe even if ID doesn't exist (no error, just no update)
 *
 * Authorization:
 * - Only teachers can update
 * - Students cannot modify themselves or others
 * - Returns 403 Forbidden if not teacher
 *
 * Use cases:
 * - Teacher dashboard: Click student → edit section
 * - Classroom creation: Assign sections before creation
 * - Student management: Bulk import then update
 * - Section reorganization: Move students between sections
 *
 * Response:
 * {
 *   success: true
 * }
 *
 * No data returned:
 * - Status 200 means operation succeeded
 * - Client refreshes list to see new section
 * - More efficient than returning student data
 *
 * Performance:
 * - Single row update (very fast)
 * - Index on (role, id) speeds lookup
 * - For bulk updates, use batch endpoint instead
 */
router.patch(
  "/users/:id/section",
  verifyToken,
  wrapAsync(controller.editStudentSection),
);

export default router;
