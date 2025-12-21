import express from "express";
import ejs from "ejs";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import helmet from "helmet";
import { Server } from "http";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import type { Express, Request, Response, NextFunction } from "express";

import auth from "./routes/auth";
import quizzes from "./routes/quizzes";
import mainRoute from "./routes/default";
import security from "./routes/security";
import classrooms from "./routes/classrooms";
import activities from "./routes/activities";
import submission from "./routes/submissions";

import db from "./config/db";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
app.set("trust proxy", 1);

const client_url: string =
  process.env.CLIENT_ORIGIN ||
  "http://digital-portfolio-system-client.vercel.app";

const rawAllowed: string = process.env.ALLOWED_ORIGINS || client_url;
const allowedList: string[] = rawAllowed
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedHosts: string[] = allowedList.map((entry) => {
  try {
    return new URL(entry).hostname;
  } catch {
    return entry; // keep non-URL entries as-is
  }
});

// Static files in public folder
app.use(express.static(path.join(__dirname, "public")));

app.use((req: Request, res: Response, next: NextFunction): void => {
  const start: number = Date.now();
  const origin: string = req.headers.origin || "<none>";
  console.info(
    `[REQ START] ${new Date().toISOString()} ${req.ip} ${req.method} ${
      req.originalUrl
    } origin=${origin}`
  );

  res.on("finish", () => {
    const dur = Date.now() - start;
    console.info(
      `[REQ END]   ${new Date().toISOString()} ${req.ip} ${req.method} ${
        req.originalUrl
      } status=${res.statusCode} dur=${dur}ms`
    );
  });

  next();
});

app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // allow non-browser requests (no origin header) like curl, server-to-server
      if (!origin) return callback(null, true);

      try {
        const originUrl = new URL(origin);
        // exact origin match (including protocol/port)
        if (allowedList.includes(origin)) return callback(null, true);
        // hostname match (allows both http and https)
        if (allowedHosts.includes(originUrl.hostname))
          return callback(null, true);
      } catch {
        // fallthrough to deny
      }

      return callback(new Error("CORS: origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(cookieParser());

// Normalize token sources so verifyToken can read Authorization consistently
app.use((req: Request, res: Response, next: NextFunction) => {
  try {
    // if Authorization header already present, keep it
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || String(authHeader).trim() === "") {
      // try cookie named 'token'
      if (req.cookies && req.cookies.token) {
        req.headers.authorization = `Bearer ${req.cookies.token}`;
      } else if (req.query && req.query.token) {
        // allow ?token=... for special clients
        req.headers.authorization = `Bearer ${String(req.query.token)}`;
      }
    }
  } catch (e) {
    // ignore
  }
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          client_url,
          "https://digital-portfolio-system-server.onrender.com",
        ],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginEmbedderPolicy: false,
  })
);

type DBMiddleware = Request & {
  dbAvailable: boolean;
};

// add a small middleware to expose DB availability in responses
app.use((req: Request, res: Response, next: NextFunction) => {
  try {
    const status: string = db.isDbAvailable
      ? db.isDbAvailable()
        ? "available"
        : "unavailable"
      : "unknown";
    res.setHeader("X-DB-Status", status);
    // expose to handlers if needed
    (req as DBMiddleware).dbAvailable = status === "available";
  } catch (e) {
    (req as DBMiddleware).dbAvailable = false;
  }
  next();
});

// human-friendly landing page for browser visits to "/"
// only responds when the client requests HTML; API clients will continue to work.
app.get("/", (req: Request, res: Response, next: NextFunction): void => {
  const accept: string = req.headers.accept || "";
  if (!accept.includes("text/html")) return next();

  const clientUrl: string = client_url;
  const docsUrl: string =
    "https://github.com/jhonkeithman123/digital-portfolio-system-client/blob/main/For_Client.md";
  const accent: string = process.env.ACCENT_COLOR || "#007bff";

  ejs.renderFile(
    path.join(__dirname, "public/index.html"),
    { clientUrl, docsUrl, accent },
    (err: Error | null, html: string) => {
      if (err) {
        console.error("EJS render error:", err);
        return res.status(500).json({ error: "Template render failed" });
      }
      res.type("html").send(html);
    }
  );
});

app.use("/", mainRoute);
app.use("/auth", auth);
app.use("/api", submission);
app.use("/security", security);
app.use("/classrooms", classrooms);
app.use("/quizzes", quizzes);
app.use("/activity", activities);

app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error(
    `[UNHANDLED ERROR] ${new Date().toISOString()} ${req.method} ${
      req.originalUrl
    } err=${err?.stack || err}`
  );
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error" });
  } else {
    next(err);
  }
});

// catch process-level failures
process.on("unhandledRejection", (reason: unknown) => {
  console.error("unhandledRejection:", reason);
});
process.on("uncaughtException", (err: Error) => {
  console.error("uncaughtException:", err);
  // process.exit(1) // after logging
});

const DEFAULT_PORT = parseInt(process.env.PORT ?? "5000", 10);
const MAX_ATTEMPTS = 10;

function tryListen(port: number, attemptsLeft: number) {
  const server: Server = app.listen(port);
  server.on("listening", () => {
    console.log(`Server listening in port ${port}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err && err.code === "EADDRINUSE") {
      console.warn(`PORT ${port} in use.`);

      try {
        server.close();
      } catch (e) {
        //* Ignore
      }

      if (attemptsLeft > 0) {
        const next = port + 1;
        console.log(`Trying port ${next} (${attemptsLeft - 1} attempts left)`);
        tryListen(next, attemptsLeft - 1);
      } else {
        console.error(
          `No available ports after ${MAX_ATTEMPTS} attempts. Exiting`
        );
        process.exit(1);
      }
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });
}

tryListen(DEFAULT_PORT, MAX_ATTEMPTS);
