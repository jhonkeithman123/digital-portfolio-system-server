import type { ResultSetHeader } from "mysql2/promise";
import type { NotificationType, DBParam } from "../types/db";
import db from "./db";

export interface CreateNotificationInput {
  recipientId: number;
  senderId: number | null;
  type: NotificationType;
  message: string;
  link: string | null;
}

export default async function createNotification({
  recipientId,
  senderId,
  type,
  message,
  link,
}: CreateNotificationInput): Promise<number> {
  const query = `
    INSERT INTO notifications (recipient_id, sender_id, type, message, link)
    VALUES (?, ?, ?, ?, ?)
  `;

  const params: DBParam[] = [recipientId, senderId, type, message, link];

  try {
    const [result] = await db.query<ResultSetHeader>(query, params);
    console.info("[DB] createNotification OK", {
      recipientId,
      type,
      insertId: result.insertId,
    });
    return result.insertId ?? 0;
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    console.error("Notification err:", msg);
    throw err;
  }
}
