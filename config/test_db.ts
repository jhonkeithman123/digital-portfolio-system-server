import db from "./db";
import type { RowDataPacket } from "mysql2/promise";

interface TestRow extends RowDataPacket {
  result: number;
}

async function test_db(): Promise<void> {
  try {
    const [rows] = await db.query<TestRow[]>("SELECT 1 + 1 AS result");
    console.log("Database test success:", rows?.[0]?.result);
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    console.error("Database test failed:", msg);
  }
  process.exit(0);
}

test_db();
