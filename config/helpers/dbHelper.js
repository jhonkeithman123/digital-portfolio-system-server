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

/**
 * Retrieves a single row from a table based on a specific field and value.
 * @param {string} field - Column name to filter by (e.g., "email", "id").
 * @param {any} value - Value to match against the specified field.
 * @param {string[]} [fields=["*"]] - Columns to select
 * @returns {Promise<Object|null>}
 */
export function findOneUserBy(field, value, fields = ["*"]) {
  return new Promise((resolve, reject) => {
    try {
      validateIdentifier(field);
      const select = fields.join(", ");
      const sql = `SELECT ${select} FROM users WHERE ${field} = ? LIMIT 1`;
      db.query(sql, [value], (err, results) => {
        if (err) return reject(err);
        resolve(results[0] || null);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves multiple rows from users table filtered by a field.
 * @param {string} field
 * @param {any} value
 * @param {string[]} [fields=["*"]]
 * @returns {Promise<Object[]>}
 */
export function findUsersBy(field, value, fields = ["*"]) {
  return new Promise((resolve, reject) => {
    try {
      validateIdentifier(field);
      const select = fields.join(", ");
      const sql = `SELECT ${select} FROM users WHERE ${field} = ?`;
      db.query(sql, [value], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Inserts a record into a table.
 * @param {string} table
 * @param {Object} data
 * @returns {Promise<number>} - resolves with insertId
 */
export function insertRecord(table, data) {
  return new Promise((resolve, reject) => {
    try {
      validateIdentifier(table);
      const fields = Object.keys(data);
      fields.forEach(validateIdentifier);
      const values = Object.values(data);
      const placeholders = fields.map(() => "?").join(", ");
      const sql = `INSERT INTO \`${table}\` (${fields.join(
        ", "
      )}) VALUES (${placeholders})`;
      db.query(sql, values, (err, result) => {
        if (err) return reject(err);
        resolve(result.insertId);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Updates records in a table based on conditions.
 * @param {string} table
 * @param {Object} updates
 * @param {Object} conditions
 * @returns {Promise<number>} - resolves with affectedRows
 */
export function updateRecord(table, updates, conditions) {
  return new Promise((resolve, reject) => {
    try {
      validateIdentifier(table);
      const updateFields = Object.keys(updates);
      updateFields.forEach(validateIdentifier);
      const whereFields = Object.keys(conditions);
      whereFields.forEach(validateIdentifier);

      const updateClause = updateFields.map((f) => `${f} = ?`).join(", ");
      const whereClause = whereFields.map((f) => `${f} = ?`).join(" AND ");

      const sql = `UPDATE \`${table}\` SET ${updateClause} WHERE ${whereClause}`;
      const params = [...Object.values(updates), ...Object.values(conditions)];

      db.query(sql, params, (err, result) => {
        if (err) return reject(err);
        resolve(result.affectedRows);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Promisified DB query helper for reuse across the project.
 * @param {string} sql - The sql command.
 * @param {Array} params  - The parameters to be passed in an array
 * @returns {Promise<any>} - Returns a Promise
 */
export function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}
