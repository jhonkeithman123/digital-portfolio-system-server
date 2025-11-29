import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import mainRoute from "./routes/default.js";
import auth from "./routes/auth.js";
import submission from "./routes/submissions.js";
import security from "./routes/security.js";
import classrooms from "./routes/classrooms.js";
import quizzes from "./routes/quizzes.js";
import activities from "./routes/activities.js";

import db from "./config/db.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const client_url = process.env.CLIENT_ORIGIN || "https://jhonkeithman123.github.io/digital-portfolio-system-client/";

const rawAllowed = process.env.ALLOWED_ORIGINS || client_url;
const allowedList = rawAllowed.split(",").map((s) => s.trim()).filter(Boolean);

const allowedHosts = allowedList.map((entry) => {
  try {
    return new URL(entry).hostname;
  } catch {
    return entry; // keep non-URL entries as-is
  }
});

app.use(
  cors({
    origin: (origin, callback) => {
      // allow non-browser requests (no origin header) like curl, server-to-server
      if (!origin) return callback(null, true);

      try {
        const originUrl = new URL(origin);
        // exact origin match (including protocol/port)
        if (allowedList.includes(origin)) return callback(null, true);
        // hostname match (allows both http and https)
        if (allowedHosts.includes(originUrl.hostname)) return callback(null, true);
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

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", client_url],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginEmbedderPolicy: false,
  })
);

// add a small middleware to expose DB availability in responses
app.use((req, res, next) => {
  try {
    const status = db?.isDbAvailable ? (db.isDbAvailable() ? "available" : "unavailable") : "unknown";
    res.setHeader("X-DB-Status", status);
    // expose to handlers if needed
    req.dbAvailable = status === "available";
  } catch (e) {
    req.dbAvailable = false;
  }
  next();
});

// human-friendly landing page for browser visits to "/"
// only responds when the client requests HTML; API clients will continue to work.
app.get("/", (req, res, next) => {
  const accept = req.headers.accept || "";
  if (!accept.includes("text/html")) return next();

  const clientUrl = client_url;
  const client_docs = "https://github.com/jhonkeithman123/digital-portfolio-system-client/blob/main/For_Client.md";
  const accent = process.env.ACCENT_COLOR || "#007bff";

  res.type("html").status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Backend API Service</title>
  <style>
    :root {
      --accent: ${accent};
      --bg: #0f1720;
      --card: #0b1220;
      --muted: #9aa4b2;
    }
    html,body{height:100%;margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial;color:#e6eef6;background:linear-gradient(180deg,var(--bg) 0%, #061221 100%);-webkit-font-smoothing:antialiased}
    .wrap{min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px}
    .card{max-width:880px;width:100%;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,0.04);border-radius:14px;padding:28px;box-shadow:0 8px 30px rgba(2,6,23,0.6);backdrop-filter: blur(6px);display:grid;grid-template-columns:120px 1fr;gap:20px;align-items:center}
    .logo{width:96px;height:96px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#6f42c1);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:28px;box-shadow:0 6px 18px rgba(0,0,0,0.45)}
    h1{margin:0;font-size:20px}
    p{margin:8px 0;color:var(--muted);line-height:1.4}
    .actions{margin-top:14px;display:flex;gap:12px}
    .btn{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:none;cursor:pointer;text-decoration:none;font-weight:600}
    .btn-primary{background:linear-gradient(90deg,var(--accent),#e55370);color:white;box-shadow:0 6px 18px rgba(0,0,0,0.35)}
    .btn-ghost{background:transparent;border:1px solid rgba(255,255,255,0.06);color:var(--muted)}
    .meta{font-size:13px;color:var(--muted);margin-top:8px}
    code{background:rgba(255,255,255,0.02);padding:4px 8px;border-radius:6px;color:#cfe7ff}
    @media (max-width:640px){.card{grid-template-columns:1fr; text-align:center}.logo{margin-inline:auto}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card" role="region" aria-labelledby="title">
      <div class="logo" aria-hidden="true">API</div>
      <div>
        <h1 id="title">Backend API — Not a user-facing site</h1>
        <p>This server hosts the API used by the frontend application. It's intended for programmatic access only. If you navigated here in a browser, open the client application instead.</p>
        <div class="actions">
          <a class="btn btn-primary" href="${clientUrl}" target="_blank" rel="noopener">Open Frontend</a>
          <a class="btn btn-ghost" href="${client_docs}/docs" target="_blank" rel="noopener">Client docs</a>
        </div>
        <div class="meta">
          For API access use endpoints like <code>/auth</code>, <code>/classrooms</code>, <code>/quizzes</code>. Requests should be made from the official client or an authorized service.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`);
});

app.use("/", mainRoute);
app.use("/auth", auth);
app.use("/api", submission);
app.use("/security", security);
app.use("/classrooms", classrooms);
app.use("/quizzes", quizzes);
app.use("/activity", activities);

const DEFAULT_PORT = parseInt(process.env.PORT ?? "5000", 10);
const MAX_ATTEMPTS = 10;

function tryListen(port, attemptsLeft) {
  const server = app.listen(port);
  server.on("listening", () => {
    console.log(`Server listening in port ${port}`);
  });

  server.on("error", (err) => {
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
        console.error(`No available ports after ${MAX_ATTEMPTS} attempts. Exiting`);
        process.exit(1);
      }
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });
}

tryListen(DEFAULT_PORT, MAX_ATTEMPTS);
