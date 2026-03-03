import type { Request, Response } from "express";
import { queryAsync } from "helpers/dbHelper";
import type { AuthRequest } from "middleware/auth";
import type { RowDataPacket } from "mysql2/promise";

interface ActivityRow extends RowDataPacket {
  id: number;
  classroom_id: number;
  teacher_id: number;
  title: string;
  file_path: string | null;
  original_name: string | null;
  mime_type: string | null;
  created_at: Date;
  due_date?: Date | null;
  max_score?: number;
}

interface SubmissionRow extends RowDataPacket {
  id: number;
  activity_id: number;
  student_id: number;
  score: number | null;
  created_at: Date | null;
  graded_at: Date | null;
}

interface ClassroomRow extends RowDataPacket {
  classroom_id: number;
}

// Get all activities for the current user
const getUserActivities = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const userId = req.user!.userId;
  const userRole = req.user!.role;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    let activities: any[] = [];

    if (userRole === "student") {
      // Get all activities with submission status for student
      // Note: activity_submissions uses 'created_at' not 'submitted_at'
      const rows = await queryAsync<any>(
        `
        SELECT 
          a.id,
          a.title,
          a.file_path as description,
          'activity' as type,
          a.created_at,
          a.due_date,
          c.name as className,
          c.section as classSection,
          s.id as submissionId,
          s.score,
          s.created_at as completedAt,
          s.graded_at,
          CASE 
            WHEN s.graded_at IS NOT NULL THEN 'graded'
            WHEN s.id IS NOT NULL THEN 'completed'
            WHEN a.due_date IS NOT NULL AND a.due_date < NOW() THEN 'overdue'
            ELSE 'pending'
          END as status
        FROM activities a
        INNER JOIN classrooms c ON a.classroom_id = c.id
        LEFT JOIN activity_submissions s ON a.id = s.activity_id AND s.student_id = ?
        WHERE c.id IN (
          SELECT classroom_id FROM classroom_members WHERE student_id = ? AND status = 'accepted'
        )
        ORDER BY 
          CASE 
            WHEN a.due_date IS NOT NULL AND a.due_date >= NOW() THEN 0
            ELSE 1
          END,
          a.due_date ASC,
          a.created_at DESC
        `,
        [userId, userId],
      );
      activities = rows;
    } else if (userRole === "teacher") {
      // Get all activities created by teacher with submission stats
      const rows = await queryAsync<any>(
        `
        SELECT 
          a.id,
          a.title,
          a.file_path as description,
          'activity' as type,
          a.created_at,
          a.due_date,
          c.name as className,
          c.section as classSection,
          COUNT(DISTINCT s.id) as totalSubmissions,
          COUNT(DISTINCT CASE WHEN s.graded_at IS NOT NULL THEN s.id END) as gradedCount,
          AVG(s.score) as averageScore,
          'created' as status
        FROM activities a
        INNER JOIN classrooms c ON a.classroom_id = c.id
        LEFT JOIN activity_submissions s ON a.id = s.activity_id
        WHERE a.teacher_id = ?
        GROUP BY a.id, a.title, a.file_path, a.created_at, a.due_date, c.name, c.section
        ORDER BY a.due_date DESC, a.created_at DESC
        `,
        [userId],
      );
      activities = rows;
    }

    return res.json({
      success: true,
      activities: activities.map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        type: a.type,
        score: a.score || null,
        completedAt: a.completedAt || a.graded_at || null,
        status: a.status,
        className: a.className,
        classSection: a.classSection,
        dueDate: a.due_date,
        createdAt: a.created_at,
        totalSubmissions: a.totalSubmissions || 0,
        gradedCount: a.gradedCount || 0,
        averageScore: a.averageScore
          ? parseFloat(a.averageScore).toFixed(1)
          : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching portfolio activities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load activities",
    });
  }
};

// Get activity details
const getActivityDetails = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const userRole = req.user!.role;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const rows = await queryAsync<ActivityRow>(
      `
      SELECT 
        a.*,
        c.name as classroomName,
        c.code as classroomCode,
        c.section as classSection,
        u.username as teacherName
      FROM activities a
      INNER JOIN classrooms c ON a.classroom_id = c.id
      LEFT JOIN users u ON a.teacher_id = u.ID
      WHERE a.id = ?
      `,
      [id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Activity not found" });
    }

    const activity = rows[0];

    // Check access permission
    if (userRole === "student") {
      const enrolled = await queryAsync<ClassroomRow>(
        `SELECT classroom_id FROM classroom_members 
         WHERE classroom_id = ? AND student_id = ? AND status = 'accepted'`,
        [activity.classroom_id, userId],
      );
      if (enrolled.length === 0) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }
    } else if (userRole === "teacher" && activity.teacher_id !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    return res.json({ success: true, activity });
  } catch (error) {
    console.error("Error fetching activity details:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get submission for an activity
const getActivitySubmission = async (
  req: AuthRequest,
  res: Response,
): Promise<Response> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const userRole = req.user!.role;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    if (userRole === "student") {
      const rows = await queryAsync<SubmissionRow>(
        `
        SELECT s.*, a.title as activityTitle
        FROM activity_submissions s
        INNER JOIN activities a ON s.activity_id = a.id
        WHERE s.activity_id = ? AND s.student_id = ?
        `,
        [id, userId],
      );

      return res.json({
        success: true,
        submission: rows.length > 0 ? rows[0] : null,
      });
    } else if (userRole === "teacher") {
      // Get all submissions for this activity
      const rows = await queryAsync<any>(
        `
        SELECT 
          s.*,
          u.username as studentName,
          u.email as studentEmail,
          u.section as studentSection
        FROM activity_submissions s
        INNER JOIN users u ON s.student_id = u.ID
        INNER JOIN activities a ON s.activity_id = a.id
        WHERE s.activity_id = ? AND a.teacher_id = ?
        ORDER BY s.created_at DESC
        `,
        [id, userId],
      );

      return res.json({
        success: true,
        submissions: rows,
      });
    }

    return res.status(403).json({ success: false, message: "Forbidden" });
  } catch (error) {
    console.error("Error fetching submission:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const controller = {
  getUserActivities,
  getActivityDetails,
  getActivitySubmission,
};

export default controller;
