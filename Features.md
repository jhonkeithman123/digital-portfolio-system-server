# Server — Feature Summary & Operational Notes

This document describes notable server features, safety checks and operational guidance for the Digital Portfolio System backend.

## Quick overview

- Express-based API with focused routes:
  - /auth, /classrooms, /quizzes, /activity, /security, /api (submissions), plus a docs landing page (`/`).
- Hardened HTTP surface using helmet (CSP, referrer policy, frame-ancestors, controlled connect-src).
- CORS whitelist configurable via ALLOWED_ORIGINS / CLIENT_ORIGIN.
- DB-aware: server works safely when the DB is unavailable (returns 503 where appropriate).
- Defensive logging and error handling for easier debugging in production.
- Best-effort compatibility with MySQL variants (avoids server-only JSON functions and START TRANSACTION in prepared statements).

---

## Main features

### Security

- Helmet is configured with a strict Content Security Policy and referrer policy; crossOriginEmbedderPolicy is disabled for compatibility where required.
- CORS origin checking accepts an explicit origin list and hostname matches (supports non-browser requests with no Origin header).
- Routes use token verification middleware (`verifyToken`) for protected resources.

### DB resilience / graceful degradation

- `db.isDbAvailable()` is exposed via the X-DB-Status response header and `req.dbAvailable`.
- Handlers check `req.dbAvailable` and return 503 when the DB is not ready.
- Code avoids START TRANSACTION / FOR UPDATE when using mysql2 prepared statement protocol (prepared-statement limitations are handled).
- When JSON SQL functions are absent (e.g., JSON_LENGTH), the server falls back to parsing JSON in Node — see quizzes listing adjustments.

### Logging & debugging

- Request start / end logs include timestamp, client IP, method, URL and duration.
- Small previews of POST/PUT/PATCH request bodies are logged to aid debugging while keeping output bounded.
- Unhandled errors are caught and logged; the server responds with 500 unless headers already sent.

### Routes & useful endpoints (high level)

- GET / — browser-friendly landing page with client link and docs link.
- /auth — authentication endpoints.
- /classrooms
  - POST /classrooms/join — join by code (robust against duplicate inserts; no START TRANSACTION).
  - GET /classrooms/:code/is-member — verifies whether requesting user is member/teacher of a classroom.
  - GET /classrooms/:code/students, POST /:code/invite, invites management endpoints.
- /quizzes — listing adjusted to avoid SQL JSON functions; server computes question counts in JS when necessary.
- /activity — comments, replies, edits; PATCH added to allow comment/reply edits and set `edited` flag.

### Notifications & client integration

- Notifications are intended to be verified by the backend before the client navigates (e.g., classroom invites are checked via /classrooms/:code/is-member).
- Frontend Notification menu has been simplified to only navigate to /dash for invite-related notifications, after backend verification.

### Process resilience

- Handlers for `unhandledRejection` and `uncaughtException` log details. The server does not immediately exit on uncaught exceptions to favor diagnostics (adjust if required).

---

## Operational / deployment notes

Environment variables

- CLIENT_ORIGIN — default client origin used in helmet connect-src and doc links.
- ALLOWED_ORIGINS — comma-separated list (full origins or hostnames) allowed by CORS.
- PORT — server port.
- DATABASE\_\* — configured in `config/db.js` (mysql2 pool).
- ACCENT_COLOR — used on landing page.

DB compatibility

- If running MySQL on providers lacking JSON\_\* SQL functions, the server is already prepared: some queries avoid JSON functions and parse JSON in Node.
- The server avoids `START TRANSACTION` when using mysql2 prepared statement mode to prevent ER_UNSUPPORTED_PS; transactions may still be possible using alternate db client settings or non-prepared protocols if strict transactional behavior is required.

Recommended MySQL behavior

- MySQL 5.7+ or compatible MariaDB with JSON support is ideal. If JSON functions are missing, server-side parsing provides a fallback but be aware of performance tradeoffs.

Health checks

- Use a simple HTTP GET to any protected endpoint; check `X-DB-Status` header for DB availability.
- Example: curl -I https://your-server/classrooms — inspect X-DB-Status and HTTP status.

Logging

- Request lifecycle logging is enabled (start/end). For production, forward logs to your log aggregator and adjust verbosity.

Graceful upgrades & race conditions

- Join classroom flow handles duplicate inserts (ER_DUP_ENTRY) and upgrades pending invites to accepted when necessary.
- Hidden-invite cleanup is attempted after accept/update but is best-effort — failures are logged.

---

## Troubleshooting checklist

1. 500 from /quizzes shows JSON function error:
   - Either upgrade DB to support JSON_LENGTH or let the server compute counts in Node (already implemented).
2. 500 on /classrooms/join with ER_UNSUPPORTED_PS:
   - The server avoids START TRANSACTION; ensure code does not reintroduce transaction statements while using prepared statements.
3. Notifications opening invalid links:
   - Frontend now verifies invite/member state with `/classrooms/:code/is-member` before navigating to `/dash`.
4. Layout issues (client):
   - Header publishes CSS variables `--header-height` and `--vh` (ResizeObserver fallback). Ensure header is mounted and variables set.

---

## How to run (local dev)

- Install deps: npm ci
- Configure env (see above).
- Start: npm run dev (or node server/app.js)
- Monitor console for `X-DB-Status` and request logs.

---

## Recommended next improvements (short list)

- Add a small health endpoint (e.g. GET /health) returning { db: 'available' | 'unavailable', uptime, version }.
- Add a feature flag or admin toggle to enable stronger transactional semantics when a fully featured DB is guaranteed.
- Add automated integration tests for classroom join workflows and notification-to-invite verification.
- Rate-limit sensitive endpoints (e.g., join/invite) and add auditing for invite actions.
