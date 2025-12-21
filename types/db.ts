import type { RowDataPacket } from "mysql2/promise";

// Common param type for queries
export type DBParam = string | number | boolean | null | Date | Buffer;
export type DBParams = (DBParam | DBParam[])[];

// Generic insert helper: drop auto IDs and timestamp typically set by DB
export type InserTable<T, K extends keyof T = never> = Omit<T, "id" | K>;

// Tables
export interface ActivityRow extends RowDataPacket {
  id: number;
  classroom_id: number;
  teacher_id: number;
  title: string;
  file_path: string | null;
  original_name: string | null;
  mime_type: string | null;
  created_at: Date;
}

export interface InstructionEntry extends RowDataPacket {
  id: number;
  activity_id: number;
  teacher_id: number;
  instruction_text: string;
  created_at: string;
  updated_at: string;
}

export interface ClassroomRow extends RowDataPacket {
  id: number;
  name: string;
  section: string | null;
  code: string;
  teacher_id: number;
  created_at: Date;
  school_year: string;
  updated_at: Date | null;
}

export interface ClassroomMemberRow extends RowDataPacket {
  id: number;
  classroom_id: number;
  student_id: number;
  joined_at: Date;
  status: string;
  code: string;
  name: string;
}

export interface CommentRow extends RowDataPacket {
  id: number;
  classroom_id: number;
  activity_id: number;
  user_id: number;
  comment: string;
  created_at: Date;
  updated_at: Date;
}

export interface CommentReplyRow extends RowDataPacket {
  id: number;
  user_id: number;
  comment_id: number;
  reply: string;
  created_at: Date;
  updated_at: Date;
}

export interface HiddenInviteRow extends RowDataPacket {
  id: number;
  student_id: number;
  invite_id: number;
  created_at: Date;
}

export interface LogRow extends RowDataPacket {
  id: number;
  user_id: number;
  type: string;
  log: string;
  detected_at: Date;
  role: string;
}

export type NotificationType = "invite" | "quiz" | "feedback" | "system";

export interface NotificationRow extends RowDataPacket {
  id: number;
  recipient_id: number;
  sender_id: number;
  type: NotificationType | null;
  message: string;
  link: string | null;
  is_read: 0 | 1 | null;
  created_at: Date;
}

export interface QuizRow extends RowDataPacket {
  id: number;
  classroom_id: number;
  teacher_id: number;
  title: string;
  questions: string; // JSON string
  attempts: number;
  attempts_allowed: number;
  start_time: Date | null;
  end_time: Date | null;
  time_limit_seconds: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface QuizAttemptRow extends RowDataPacket {
  id: number;
  quiz_id: number;
  page_index: number;
  title: string;
  content_json: string; // JSON string
  created_at: Date;
}

export interface SessionRow extends RowDataPacket {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
}

export interface SubmissionRow extends RowDataPacket {
  id: number;
  student_id: number;
  classroom_id: number;
  file_url: string | null;
  submitted_at: Date | null;
  feedback: string | null;
}

export interface UserRow extends RowDataPacket {
  ID: number;
  email: string;
  username: string;
  section: string;
  password: string;
  role: string;
  verification_code: string | null;
  verification_expiry: Date | null;
  is_verified: 0 | 1 | null;
}
