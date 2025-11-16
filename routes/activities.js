import express from "express";
import path from "path";
import multer from "multer";
import { verifyToken } from "../middleware/auth.js";
import { queryAsync } from "../config/helpers/dbHelper.js";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads", "activities");
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const base = file.originalname.replace(/\s+/g, "_");
    cb(null, `${ts}__${base}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

/* Helper: fetch classroom by code for this teacher */
async function getClassroomForTeacher(code, teacherId) {
  const rows = await queryAsync(
    "SELECT id FROM classrooms WHERE code = ? AND teacher_id = ? LIMIT 1",
    [code, teacherId]
  );
  return rows[0] || null;
}

/* Teacher creates an activity */
router.post("/create", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (req.user.role !== "teacher")
      return res.status(403).json({ success: false, error: "Forbidden" });

    const { title, instructions, classroomCode } = req.body;
    if (!title || !instructions || !classroomCode) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    const classroom = await getClassroomForTeacher(classroomCode, req.user.id);
    if (!classroom)
      return res
        .status(403)
        .json({ success: false, error: "Invalid classroom code" });

    const file = req.file || null;

    const result = await queryAsync(
      `INSERT INTO activities
          (classroom_id, teacher_id, title, instructions, file_path, original_name, mime_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        classroom.id,
        req.user.id,
        title.trim(),
        instructions.trim(),
        file ? file.filename : null,
        file ? file.originalname : null,
        file ? file.mimetype : null,
      ]
    );

    return res.json({
      success: true,
      id: result.insertId,
      message: "Activity created",
    });
  } catch (err) {
    console.error("Error creating activity:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/* List activities for a classroom (student or teacher) */
router.get("/classroom/:code", verifyToken, async (req, res) => {
  const { code } = req.params;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    // Validate classroom access
    let classroomRow;
    if (role === "teacher") {
      const rows = await queryAsync(
        "SELECT id FROM classrooms WHERE code = ? AND teacher_id = ? LIMIT 1",
        [code, userId]
      );
      classroomRow = rows[0];
    } else {
      const rows = await queryAsync(
        `SELECT c.id
         FROM classrooms c
         JOIN classroom_members cm ON cm.classroom_id = c.id
         WHERE c.code = ? AND cm.student_id = ? AND cm.status = 'accepted'
         LIMIT 1`,
        [code, userId]
      );
      classroomRow = rows[0];
    }

    if (!classroomRow)
      return res
        .status(403)
        .json({ success: false, error: "Not authorized for this classroom" });

    const activities = await queryAsync(
      `SELECT id, title, instructions, file_path, original_name, mime_type, created_at
       FROM activities
       WHERE classroom_id = ?
       ORDER BY created_at DESC`,
      [classroomRow.id]
    );

    return res.json({ success: true, activities });
  } catch (err) {
    console.error("Error listing activities:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

export default router;
