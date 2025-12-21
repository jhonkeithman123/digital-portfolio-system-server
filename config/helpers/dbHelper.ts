import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { DBParams, DBParam } from "../../types/db";
import db from "../db";

/**
 * Basic identifier validator to avoid SQL injection via field/table names.
 * Only allows letters, numbers and underscores.
 */
function validateIdentifier(name: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
}

/** Run a DB query but fail fast if it takes too long */
async function queryWithTimeout<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: DBParams = [],
  timeoutMs: number = 8000
): Promise<T[]> {
  const start = Date.now();
  const p = db.query<T[]>(sql, params);
  const timeout = new Promise<never>((_, rej) =>
    setTimeout(
      () => rej(new Error(`DB query timed out after ${timeoutMs}ms`)),
      timeoutMs
    )
  );
  try {
    const [rows] = await Promise.race([p, timeout]);
    const dur = Date.now() - start;
    console.info(
      `[DB] query OK (${dur}ms) sql=${sql
        .split(/\s+/)
        .slice(0, 6)
        .join(" ")} paramsLen=${params.length}`
    );
    return rows;
  } catch (err: unknown) {
    const dur = Date.now() - start;
    const msg = (err as Error)?.message || String(err);
    console.warn(
      `[DB] query ERR (${dur}ms) sql=${sql
        .split(/\s+/)
        .slice(0, 6)
        .join(" ")} err=${msg}`
    );
    throw err;
  }
}

/**
 * Retrieves a single row from users by field
 */
export async function findOneUserBy<T extends RowDataPacket = RowDataPacket>(
  field: string,
  value: DBParam,
  fields: string[] = ["*"]
): Promise<T | null> {
  validateIdentifier(field);
  const select = fields.join(", ");
  const sql = `SELECT ${select} FROM users WHERE ${field} = ? LIMIT 1`;
  const rows = await queryWithTimeout<T>(sql, [value]);
  return rows[0] ?? null;
}

/**
 * Retrieves multiple rows from users by field
 */
export async function findUsersBy<T extends RowDataPacket = RowDataPacket>(
  field: string,
  value: DBParam,
  fields: string[] = ["*"]
): Promise<T[]> {
  validateIdentifier(field);
  const select = fields.join(", ");
  const sql = `SELECT ${select} FROM users WHERE ${field} = ?`;
  return await queryWithTimeout<T>(sql, [value]);
}

/**
 * Inserts a record into a table. Returns insertId
 */
export async function insertRecord(
  table: string,
  data: Record<string, DBParam>
): Promise<number> {
  validateIdentifier(table);
  const fields = Object.keys(data);
  fields.forEach(validateIdentifier);
  const values = Object.values(data);
  const placeholders = fields.map(() => "?").join(", ");
  const sql = `INSERT INTO \`${table}\` (${fields.join(
    ", "
  )}) VALUES (${placeholders})`;
  // db.query returns [result, fields]
  const [result] = await db.query<ResultSetHeader>(sql, values);
  return result.insertId ?? 0;
}

/**
 * Updates records in a table based on conditions. Returns affectedRows.
 */
export async function updateRecord(
  table: string,
  updates: Record<string, DBParam>,
  conditions: Record<string, DBParam>
): Promise<number> {
  validateIdentifier(table);
  const updateFields = Object.keys(updates);
  updateFields.forEach(validateIdentifier);
  const whereFields = Object.keys(conditions);
  whereFields.forEach(validateIdentifier);

  const updateClause = updateFields.map((f) => `${f} = ?`).join(", ");
  const whereClause = whereFields.map((f) => `${f} = ?`).join(" AND ");

  const sql = `UPDATE \`${table}\` SET ${updateClause} WHERE ${whereClause}`;
  const params = [...Object.values(updates), ...Object.values(conditions)];

  const [result] = await db.query<ResultSetHeader>(sql, params);
  return result.affectedRows ?? 0;
}

/**
 * Promisified DB query helper for reuse across the project. Returns rows only.
 */
export async function queryAsync<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: DBParams = []
): Promise<T[]> {
  return queryWithTimeout<T>(sql, params);
}
