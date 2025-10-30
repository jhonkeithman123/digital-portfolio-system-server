import db from "../db.js";

/**
 * Inserts a new session into the database.
 * @param {number} userId - The user's ID.
 * @param {string} token - The JWT token.
 * @param {Date} expiresAt - Expiration timestamp.
 * @returns {Promise<void>}
 */
export function createSession(userId, token, expiresAt) {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO session (user_id, token, expires_at) VALUES (?, ?, ?)";
    db.query(sql, [userId, token, expiresAt], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
