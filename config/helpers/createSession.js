import db from "../db.js";

/**
 * Inserts a new session into the database.
 * @param {number} userId - The user's ID.
 * @param {string} token - The JWT token.
 * @param {Date} expiresAt - Expiration timestamp.
 * @returns {Promise<void>}
 */
export async function createSession(userId, token, expiresAt) {
  const sql = "INSERT INTO session (user_id, token, expires_at) VALUES (?, ?, ?)";
  try {
    const result = await db.query(sql, [userId, token, expiresAt]);
    // result may be [rows, fields] depending on mysql2; no need to return anything
    console.info(`[DB] createSession OK userId=${userId}`);
    return;
  } catch (err) {
    console.error(`[DB] createSession ERR userId=${userId} err=${err?.message || err}`);
    throw err;
  }
}
