import dotenv from "dotenv";
import EventEmitter from "events";
import type {
  Pool,
  PoolOptions,
  RowDataPacket,
  ResultSetHeader,
  FieldPacket,
  SslOptions,
} from "mysql2/promise";
import type { DBParams } from "types/db";

dotenv.config();

const {
  DB_RETRY_BACKOFF_MS = 2000,
  SKIP_DB_ON_START = "false",
  DB_SSL = "false", // <-- new env flag: "true" or "false"
  DB_SSL_REJECT_UNAUTHORIZED = "false", // optional
} = process.env;

const eventBus = new EventEmitter();
let pool: Pool | null = null;
let connecting = false;
let attempts = 0;

// HOST switching helpers
const initialHost = process.env.DB_HOST || "127.0.0.1";
const LOCAL_FALLBACK_HOST = process.env.DB_HOST_LOCAL || "127.0.0.1";
let currentHost = initialHost;
let switchedToLocal = false;

function isDbAvailable(): boolean {
  return !!pool;
}

async function tryConnectOnce(): Promise<boolean> {
  try {
    const mysql = await import("mysql2/promise");

    // pick connection params depending on whether we've switched to the local fallback
    const usingLocal = currentHost === LOCAL_FALLBACK_HOST;
    const host = currentHost;
    const port = Number(
      usingLocal
        ? process.env.DB_PORT_LOCAL || process.env.DB_PORT || 3306
        : process.env.DB_PORT || 3306,
    );
    const user = usingLocal
      ? process.env.DB_USER_LOCAL || process.env.DB_USER
      : process.env.DB_USER;
    const password = usingLocal
      ? process.env.DB_PASS_LOCAL || process.env.DB_PASS
      : process.env.DB_PASS;
    const database = usingLocal
      ? process.env.DB_NAME_LOCAL || process.env.DB_NAME
      : process.env.DB_NAME;

    if (!database) {
      throw new Error(
        "Database name not configured (DB_NAME or DB_NAME_LOCAL missing)",
      );
    }

    const ssl: string | SslOptions | undefined =
      DB_SSL === "true" || DB_SSL === "1"
        ? { rejectUnauthorized: DB_SSL_REJECT_UNAUTHORIZED === "true" }
        : undefined;

    const poolOptions: PoolOptions = {
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
      ssl,
    };

    // create pool using the chosen host/credentials
    pool = mysql.createPool(poolOptions);

    // quick smoke test
    await pool.query("SELECT 1");

    attempts = 0;
    console.log(
      "DB connected:",
      `${host}:${port}`,
      `(localFallback=${usingLocal})`,
    );
    eventBus.emit("connected");
    return true;
  } catch (err) {
    attempts += 1;
    // ensure pool is cleared on failure
    try {
      pool && pool.end?.();
    } catch {}
    pool = null;
    const code = (err as Error)?.message || String(err);
    console.warn(
      `DB connect attempt ${attempts} to ${currentHost} failed:`,
      code,
    );
    return false;
  }
}

async function queryWithTimeout<
  T extends RowDataPacket[] | ResultSetHeader | ResultSetHeader[] =
    RowDataPacket[],
>(
  sql: string,
  params: DBParams = [],
  timeoutMs: number = 8000,
  maxRetries: number = 2,
): Promise<any> {
  const transientCodes = new Set([
    "ECONNRESET",
    "PROTOCOL_CONNECTION_LOST",
    "ETIMEDOUT",
    "EPIPE",
    "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  ]);

  const sleep = (ms: number): Promise<void> =>
    new Promise((r) => setTimeout(r, ms));

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const poolRef = await getPool();
      if (!poolRef)
        throw Object.assign(new Error("Database not available"), {
          code: "DB_NOT_AVAILABLE",
        });

      // use same call shape as previous code (execute/query returns [rows, fields])
      const p = poolRef.execute<T>(sql, params);
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(
          () => rej(new Error(`DB query timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      );
      const result = (await Promise.race([p, timeout])) as [T, FieldPacket[]];

      const dur = Date.now() - start;
      console.info(
        `[DB] query OK (${dur}ms) sql=${sql
          .split(/\s+/)
          .slice(0, 6)
          .join(" ")} paramsLen=${params.length}`,
      );

      // return the raw result ([rows, fields]) so callers expecting that shape keep working
      return result;
    } catch (err) {
      const dur = Date.now() - start;
      const errAny = err as any;
      const errMsg = errAny?.message || String(err);
      const errCode = errAny?.code || "";
      console.warn(
        `[DB] query ERR (${dur}ms) sql=${sql
          .split(/\s+/)
          .slice(0, 6)
          .join(" ")} err=${errMsg}`,
      );

      if (attempt < maxRetries && transientCodes.has(errCode)) {
        const backoff = 200 * Math.pow(2, attempt);
        console.info(
          `[DB] transient error ${errCode} - retrying attempt ${
            attempt + 1
          } after ${backoff}ms`,
        );
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
}

async function connectLoop() {
  if (connecting) return;
  connecting = true;
  console.log("Starting DB connect loop (initial host):", initialHost);

  while (!pool) {
    const ok = await tryConnectOnce();
    if (ok) break;

    // If we have not yet switched to local fallback and we've tried 3 times, switch.
    if (
      !switchedToLocal &&
      initialHost !== LOCAL_FALLBACK_HOST &&
      attempts >= 3
    ) {
      console.warn(
        `Failed to connect to remote DB at ${initialHost} after ${attempts} attempts. Switching to local DB host ${LOCAL_FALLBACK_HOST}`,
      );
      currentHost = LOCAL_FALLBACK_HOST;
      switchedToLocal = true;
      attempts = 0;
      // immediately try connecting to local in next loop iteration
      continue;
    }

    // If SKIP_DB_ON_START true and first attempts exhausted, stop trying immediately
    if (SKIP_DB_ON_START === "true" && attempts > 0) {
      console.warn(
        "SKIP_DB_ON_START=true — continuing without DB. Will still retry in background.",
      );
      break;
    }

    const backoff = Math.min(
      Number(DB_RETRY_BACKOFF_MS) * Math.max(1, attempts),
      60_000,
    );
    await new Promise((r) => setTimeout(r, backoff));
  }
  connecting = false;
  // If we are not connected, keep trying in background periodically
  if (!pool) {
    setInterval(
      async () => {
        if (!pool) await tryConnectOnce();
      },
      Math.max(5000, Number(DB_RETRY_BACKOFF_MS)),
    );
  }
}

// public helpers
async function getPool(): Promise<Pool | null> {
  if (pool) return pool;
  // attempt immediate connect once (non-blocking for callers)
  await tryConnectOnce();
  return pool;
}

// mysql2 returns [rows, fields] tuples
type QueryResult<
  T extends RowDataPacket[] | ResultSetHeader | ResultSetHeader[],
> = [T, FieldPacket[]];

async function query<
  T extends RowDataPacket[] | ResultSetHeader | ResultSetHeader[] =
    RowDataPacket[],
>(sql: string, params: DBParams = []): Promise<QueryResult<T>> {
  return queryWithTimeout<T>(sql, params);
}

// start background connection attempts immediately
connectLoop().catch((err) => {
  console.error("DB connect loop error:", err?.message || err);
});

export default {
  getPool,
  query,
  isDbAvailable,
  on: (ev: string, cb: (...args: unknown[]) => void) => eventBus.on(ev, cb),
};
