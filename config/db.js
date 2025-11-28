import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const {
  DB_HOST = "sql100.infinityfree.com",
  DB_PORT = 3306,
  DB_USER = "if0_40541559",
  DB_PASS = "Justine0917",
  DB_NAME = "if0_40541559_digital_portfolio",
  DB_RETRY_ATTEMPTS = 5,
  DB_RETRY_BACKOFF_MS = 1000,
  SKIP_DB_ON_START = "false", // set to "true" to continue without DB (useful for dev)
} = process.env;

console.log("Attempting to connect to DB:", DB_HOST);

let pool = null;

async function createPoolWithRetry() {
  let attempt = 0;
  while (attempt < Number(DB_RETRY_ATTEMPTS)) {
    try {
      const p = mysql.createPool({
        host: DB_HOST,
        port: Number(DB_PORT),
        user: DB_USER,
        password: DB_PASS,
        database: DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // quick smoke test
      await p.query("SELECT 1");
      console.log("Connected to MySQL:", `${DB_HOST}:${DB_PORT}`);
      return p;
    } catch (err) {
      attempt += 1;
      console.error(`DB connection attempt ${attempt} failed:`, err?.code || err?.message || err);
      if (attempt >= Number(DB_RETRY_ATTEMPTS)) {
        console.error("Exceeded DB connection attempts.");
        if (SKIP_DB_ON_START === "true") {
          console.warn("Continuing without DB (SKIP_DB_ON_START=true). Some routes will fail.");
          return null;
        }
        // exit so the platform shows a failing deploy (optional)
        process.exit(1);
      }
      const wait = Number(DB_RETRY_BACKOFF_MS) * attempt;
      console.log(`Retrying DB connection in ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return null;
}

export async function getPool() {
  if (pool) return pool;
  pool = await createPoolWithRetry();
  return pool;
}

export async function query(sql, params = []) {
  const p = await getPool();
  if (!p) throw new Error("Database not available");
  return p.execute(sql, params);
}

// eager init (optional)
getPool().catch((err) => {
  console.error("DB initialization error:", err?.message || err);
});

export default {
  getPool,
  query,
};