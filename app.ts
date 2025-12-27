import express from "express";
import ejs from "ejs";
import path from "path";
import dotenv from "dotenv";
import { Server } from "http";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import type { Express, Request, Response, NextFunction } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import auth from "./routes/auth";
import quizzes from "./routes/quizzes";
import mainRoute from "./routes/default";
import security from "./routes/security";
import classrooms from "./routes/classrooms";
import activities from "./routes/activities";
import showcase from "./routes/showcase";
import uploadStatic from "./routes/uploads";

import db from "./config/db";

dotenv.config();

const app: Express = express();
app.set("trust proxy", 1);

const clientUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5000",
    "http://localhost:4173",
    process.env.CLIENT_ORIGIN || "http://localhost:5173",
  ];

  // Log CORS attempt
  console.log(
    `[CORS] ${req.method} ${req.originalUrl} from origin: ${origin || "none"}`
  );

  // Set origin to the requesting origin if it's allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    console.log(`[CORS] ✅ Allowing origin: ${origin}`);
  } else if (!origin) {
    // Allow requests with no origin (same-site, curl, Postman)
    res.header("Access-Control-Allow-Origin", clientUrl);
    console.log(`[CORS] ✅ Allowing no-origin request, using: ${clientUrl}`);
  } else {
    console.log(`[CORS] ❌ Rejecting origin: ${origin}`);
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Request logging
app.use((req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const origin = req.headers.origin || "<none>";

  console.info(
    `[REQ START] ${new Date().toISOString()} ${req.ip} ${req.method} ${
      req.originalUrl
    } origin=${origin}`
  );

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.info(
      `[REQ END]   ${new Date().toISOString()} ${req.ip} ${req.method} ${
        req.originalUrl
      } status=${res.statusCode} dur=${duration}ms`
    );
  });

  next();
});

app.use(express.json());
app.use(cookieParser());

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log("[DEBUG] Cookies received:", req.cookies);
  console.log("[DEBUG] Auth header:", req.headers.authorization);
  next();
});

// Normalize token sources for authentication
app.use((req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || String(authHeader).trim() === "") {
      // Try cookie
      if (req.cookies?.token) {
        req.headers.authorization = `Bearer ${req.cookies.token}`;
      }
      // Try query parameter (for special clients)
      else if (req.query?.token) {
        req.headers.authorization = `Bearer ${String(req.query.token)}`;
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }
  next();
});

// Database availability middleware
type DBMiddleware = Request & {
  dbAvailable: boolean;
};

app.use((req: Request, res: Response, next: NextFunction) => {
  try {
    const isAvailable = db.isDbAvailable ? db.isDbAvailable() : false;
    const status = isAvailable ? "available" : "unavailable";

    res.setHeader("X-DB-Status", status);
    (req as DBMiddleware).dbAvailable = isAvailable;
  } catch (e) {
    (req as DBMiddleware).dbAvailable = false;
    res.setHeader("X-DB-Status", "unknown");
  }
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

// Landing page for browser visits
app.get("/", (req: Request, res: Response, next: NextFunction): void => {
  const accept = req.headers.accept || "";
  if (!accept.includes("text/html")) return next();

  const docsUrl =
    "https://github.com/jhonkeithman123/digital-portfolio-system-client/blob/main/For_Client.md";
  const accentColor = process.env.ACCENT_COLOR || "#007bff";

  ejs.renderFile(
    path.join(__dirname, "public/index.ejs"),
    { clientUrl, docsUrl, accent: accentColor },
    (err: Error | null, html: string) => {
      if (err) {
        console.error("EJS render error:", err);
        return res.status(500).json({ error: "Template render failed" });
      }
      res.type("html").send(html);
    }
  );
});

app.use("/uploads", uploadStatic);

// API routes
app.use("/", mainRoute);
app.use("/auth", auth);
app.use("/security", security);
app.use("/classrooms", classrooms);
app.use("/quizzes", quizzes);
app.use("/activity", activities);
app.use("/showcase", showcase);

// ============================================================================
// BROWSER REDIRECT MIDDLEWARE (must be AFTER API routes)
// ============================================================================

/**
 * Redirect all browser HTML requests back to root
 * This prevents users from accessing API endpoints via browser URL bar
 */
app.use((req: Request, res: Response, next: NextFunction): void => {
  const accept = req.headers.accept || "";
  const userAgent = req.headers["user-agent"] || "";

  // Check if request is from a browser asking for HTML
  const isBrowser =
    accept.includes("text/html") &&
    (userAgent.includes("Mozilla") ||
      userAgent.includes("Chrome") ||
      userAgent.includes("Safari") ||
      userAgent.includes("Edge") ||
      userAgent.includes("Firefox"));

  // Allow /redirect endpoint to pass through
  if (req.path === "/redirect") {
    return next();
  }

  // If it's a browser trying to access any route other than "/" or "/redirect"
  if (isBrowser && req.path !== "/") {
    console.log(
      `[SECURITY] Browser detected accessing ${req.path}, redirecting to /`
    );
    return res.redirect(302, "/");
  }

  next();
});

// ============================================================================
// EXTERNAL REDIRECT HANDLER
// ============================================================================

/**
 * Safe redirect endpoint for external links from the landing page
 * Usage: <a href="/redirect?url=https://github.com/...">
 */
app.get("/redirect", (req: Request, res: Response): void => {
  const targetUrl = req.query.url as string;

  if (!targetUrl) {
    return res.redirect(302, "/");
  }

  // Whitelist of allowed domains
  const allowedDomains = [
    "github.com",
    "docs.google.com",
    new URL(clientUrl).hostname,
  ];

  try {
    const url = new URL(targetUrl);
    const isAllowed = allowedDomains.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );

    if (isAllowed) {
      console.log(`[REDIRECT] Allowing external redirect to: ${targetUrl}`);
      return res.redirect(302, targetUrl);
    } else {
      console.log(
        `[SECURITY] Blocked redirect to unauthorized domain: ${url.hostname}`
      );
      return res.redirect(302, "/");
    }
  } catch (e) {
    console.error(`[REDIRECT] Invalid URL: ${targetUrl}`);
    return res.redirect(302, "/");
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error(
    `[UNHANDLED ERROR] ${new Date().toISOString()} ${req.method} ${
      req.originalUrl
    }`,
    err?.stack || err
  );

  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error" });
  } else {
    next(err);
  }
});

// Process-level error handlers
process.on("unhandledRejection", (reason: unknown) => {
  console.error("[UNHANDLED REJECTION]", reason);
});

process.on("uncaughtException", (err: Error) => {
  console.error("[UNCAUGHT EXCEPTION]", err);
  process.exit(1);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const DEFAULT_PORT = parseInt(process.env.PORT ?? "5000", 10);
const MAX_ATTEMPTS = 10;

function tryListen(port: number, attemptsLeft: number) {
  const server: Server = app.listen(port);

  server.on("listening", () => {
    console.log(`✅ Server listening on port ${port}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 Client URL: ${clientUrl}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err?.code === "EADDRINUSE") {
      console.warn(`⚠️  Port ${port} is already in use.`);

      try {
        server.close();
      } catch (e) {
        // Ignore close errors
      }

      if (attemptsLeft > 0) {
        const nextPort = port + 1;
        console.log(
          `🔄 Trying port ${nextPort} (${attemptsLeft - 1} attempts remaining)`
        );
        tryListen(nextPort, attemptsLeft - 1);
      } else {
        console.error(
          `❌ No available ports after ${MAX_ATTEMPTS} attempts. Exiting.`
        );
        process.exit(1);
      }
    } else {
      console.error("❌ Server error:", err);
      process.exit(1);
    }
  });
}

tryListen(DEFAULT_PORT, MAX_ATTEMPTS);
