import db from "../db.js";

/**
 * Basic identifier validator to avoid SQL injection via field/table names.
 * Only allows letters, numbers and underscores.
 * @param {string} name
 */
function validateIdentifier(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
}

/** Run a DB query but fail fast if it takes too long */
async function queryWithTimeout(sql, params = [], timeoutMs = 8000) {
  const start = Date.now();
  const p = db.query(sql, params);
  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error(`DB query timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  try {
    const result = await Promise.race([p, timeout]);
    const dur = Date.now() - start;
    // mysql2/promise returns [rows, fields] for execute()
    const rows = Array.isArray(result) ? result[0] : result;
    console.info(`[DB] query OK (${dur}ms) sql=${sql.split(/\s+/).slice(0,6).join(" ")} paramsLen=${params.length}`);
    return rows;
  } catch (err) {
    const dur = Date.now() - start;
    console.warn(`[DB] query ERR (${dur}ms) sql=${sql.split(/\s+/).slice(0,6).join(" ")} err=${err?.message || err}`);
    throw err;
  }
}

/**
 * Retrieves a single row from a table based on a specific field and value.
 * @param {string} field - Column name to filter by (e.g., "email", "id").
 * @param {any} value - Value to match against the specified field.
 * @param {string[]} [fields=["*"]] - Columns to select
 * @returns {Promise<Object|null>}
 */
export async function findOneUserBy(field, value, fields = ["*"]) {
  validateIdentifier(field);
  const select = fields.join(", ");
  const sql = `SELECT ${select} FROM users WHERE ${field} = ? LIMIT 1`;
  const rows = await queryWithTimeout(sql, [value]);
  return (rows && rows[0]) || null;
}

/**
 * Retrieves multiple rows from users table filtered by a field.
 * @param {string} field
 * @param {any} value
 * @param {string[]} [fields=["*"]]
 * @returns {Promise<Object[]>}
 */
export async function findUsersBy(field, value, fields = ["*"]) {
  validateIdentifier(field);
  const select = fields.join(", ");
  const sql = `SELECT ${select} FROM users WHERE ${field} = ?`;
  const rows = await queryWithTimeout(sql, [value]);
  return rows || [];
}

/**
 * Inserts a record into a table.
 * @param {string} table
 * @param {Object} data
 * @returns {Promise<number>} - resolves with insertId
 */
export async function insertRecord(table, data) {
  validateIdentifier(table);
  const fields = Object.keys(data);
  fields.forEach(validateIdentifier);
  const values = Object.values(data);
  const placeholders = fields.map(() => "?").join(", ");
  const sql = `INSERT INTO \`${table}\` (${fields.join(", ")}) VALUES (${placeholders})`;
  // db.query returns [result, fields]
  const result = await db.query(sql, values);
  const insertResult = Array.isArray(result) ? result[0] : result;
  return insertResult.insertId;
}

/**
 * Updates records in a table based on conditions.
 * @param {string} table
 * @param {Object} updates
 * @param {Object} conditions
 * @returns {Promise<number>} - resolves with affectedRows
 */
export async function updateRecord(table, updates, conditions) {
  validateIdentifier(table);
  const updateFields = Object.keys(updates);
  updateFields.forEach(validateIdentifier);
  const whereFields = Object.keys(conditions);
  whereFields.forEach(validateIdentifier);

  const updateClause = updateFields.map((f) => `${f} = ?`).join(", ");
  const whereClause = whereFields.map((f) => `${f} = ?`).join(" AND ");

  const sql = `UPDATE \`${table}\` SET ${updateClause} WHERE ${whereClause}`;
  const params = [...Object.values(updates), ...Object.values(conditions)];

  const result = await db.query(sql, params);
  const updateResult = Array.isArray(result) ? result[0] : result;
  return updateResult.affectedRows;
}

/**
 * Promisified DB query helper for reuse across the project.
 * @param {string} sql - The sql command.
 * @param {Array} params  - The parameters to be passed in an array
 * @returns {Promise<any>} - Returns a Promise
 */
export async function queryAsync(sql, params = []) {
  const rows = await queryWithTimeout(sql, params);
  return rows;
}