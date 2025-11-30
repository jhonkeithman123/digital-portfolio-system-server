import db from "./db.js";

async function test_db() {
  try {
    const result = await db.query("SELECT 1 + 1 AS result");
    const rows = Array.isArray(result) ? result[0] : result;
    console.log("Database test success:", rows?.[0]?.result);
  } catch (err) {
    console.error("Database test failed:", err?.message || err);
  }
}

test_db();