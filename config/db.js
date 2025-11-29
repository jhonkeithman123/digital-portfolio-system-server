import mysql from "mysql2/promise";
import dotenv from "dotenv";
import EventEmitter from "events";

dotenv.config();

const {
  DB_RETRY_ATTEMPTS = 0, // 0 = retry forever
  DB_RETRY_BACKOFF_MS = 2000,
  SKIP_DB_ON_START = "false",
} = process.env;

const eventBus = new EventEmitter();
let pool = null;
let connecting = false;
let attempts = 0;

function isDbAvailable() {
  return !!pool;
}

async function tryConnectOnce() {
  try {
    const p = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    await p.query("SELECT 1");
    pool = p;
    attempts = 0;
    console.log("DB connected:", `${process.env.DB_HOST}:${process.env.DB_PORT}`);
    eventBus.emit("connected");
    return true;
  } catch (err) {
    attempts += 1;
    const code = err?.code || err?.message || err;
    console.warn(`DB connect attempt ${attempts} failed:`, code);
    return false;
  }
}

async function connectLoop() {
  if (connecting) return;
  connecting = true;
  console.log("Starting DB connect loop to", process.env.DB_HOST);
  while (!pool) {
    const ok = await tryConnectOnce();
    if (ok) break;
    // If SKIP_DB_ON_START true and first attempts exhausted, stop trying immediately
    if (SKIP_DB_ON_START === "true" && attempts > 0) {
      console.warn("SKIP_DB_ON_START=true — continuing without DB. Will still retry in background.");
      break;
    }
    const backoff = Math.min(Number(DB_RETRY_BACKOFF_MS) * Math.max(1, attempts), 60_000);
    await new Promise((r) => setTimeout(r, backoff));
  }
  connecting = false;
  // If we are not connected, keep trying in background periodically
  if (!pool) {
    setInterval(async () => {
      if (!pool) await tryConnectOnce();
    }, Math.max(5000, Number(DB_RETRY_BACKOFF_MS)));
  }
}

// public helpers
async function getPool() {
  if (pool) return pool;
  // attempt immediate connect once (non-blocking for callers)
  await tryConnectOnce();
  return pool;
}

async function query(sql, params = []) {
  const p = await getPool();
  if (!p) {
    const err = new Error("Database not available");
    err.code = "DB_NOT_AVAILABLE";
    throw err;
  }
  return p.execute(sql, params);
}

// start background connection attempts immediately
connectLoop().catch((err) => {
  console.error("DB connect loop error:", err?.message || err);
});

export default {
  getPool,
  query,
  isDbAvailable,
  on: (ev, cb) => eventBus.on(ev, cb),
};