import db from "../db";
import type { ResultSetHeader } from "mysql2/promise";

/**
 * Inserts a new session into the database.
 *
 * @param userId - The user's ID
 * @param token - JWT token (typically 200-500 characters)
 * @param expiresAt - When the session expires
 * @throws Error if token is too long for database column
 */
export async function createSession(
  userId: number,
  token: string,
  expiresAt: Date
): Promise<void> {
  // Log token length for debugging
  console.info(`[DB] createSession token length: ${token.length} chars`);

  // Warn if token seems too long (typical JWT is 200-500 chars)
  if (token.length > 500) {
    console.warn(
      `[DB] createSession WARNING: Token is ${token.length} chars. ` +
        `Ensure database column 'token' is VARCHAR(1000) or TEXT.`
    );
  }

  const sql =
    "INSERT INTO session (user_id, token, expires_at) VALUES (?, ?, ?)";
  try {
    await db.query<ResultSetHeader>(sql, [userId, token, expiresAt]);
    console.info(`[DB] createSession OK userId=${userId}`);
    return;
  } catch (err) {
    const error = err as Error;

    // Provide more helpful error message for token length issues
    if (error.message.includes("Data too long for column 'token'")) {
      console.error(
        `[DB] createSession ERR: Token too long (${token.length} chars). ` +
          `Run: ALTER TABLE session MODIFY COLUMN token VARCHAR(1000);`
      );
    }

    console.error(
      `[DB] createSession ERR userId=${userId} err=${error?.message || err}`
    );
    throw err;
  }
}
