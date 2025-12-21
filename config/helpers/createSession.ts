import db from "../db";
import type { ResultSetHeader } from "mysql2/promise";

/**
 * Inserts a new session into the database.
 */
export async function createSession(
  userId: string,
  token: string,
  expiresAt: string
): Promise<void> {
  const sql =
    "INSERT INTO session (user_id, token, expires_at) VALUES (?, ?, ?)";
  try {
    await db.query<ResultSetHeader>(sql, [userId, token, expiresAt] as any[]);
    // result may be [rows, fields] depending on mysql2; no need to return anything
    console.info(`[DB] createSession OK userId=${userId}`);
    return;
  } catch (err) {
    const error = err as Error;
    console.error(
      `[DB] createSession ERR userId=${userId} err=${error?.message || err}`
    );
    throw err;
  }
}
