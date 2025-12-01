# Server — Feature Summary & Operational Notes

This file describes key server features and simple how-to notes for the Digital Portfolio backend.

## Quick overview

- Express API with routes like /auth, /classrooms, /quizzes, /activity, /security, /api, and a docs landing page (`/`).
- Basic hardening via helmet (CSP, referrer policy). Some browser policies are relaxed when needed.
- CORS list can be set with ALLOWED_ORIGINS or CLIENT_ORIGIN.
- Server handles missing DB safely (returns 503 where needed).
- Clear logs and error handling to help debugging.

---

## Main features

### Security

- Helmet provides basic headers (CSP and referrer rules). Some policies are turned off where they break functionality.
- CORS lets you whitelist specific origins or hostnames.
- Protected routes use token middleware (`verifyToken`) to check requests.

### Client-side per-tab session guard (prevent forward-nav reuse)

- Problem: a user can go back to the login page and then press forward. The browser may restore a protected page from its cache so the user can see it even though they are no longer logged in.
- What we do:
  - On login we set a per-tab flag in sessionStorage: `tabAuth`.
  - When an unauthenticated page (login, signup, role-select, forgot-password) is shown, the app clears `tabAuth` and runs a small guard. The guard can also ask the server to clear the cookie and reload the page.
  - All protected pages use a single central guard (in TokenGuard). On popstate/pageshow/focus:
    - If `tabAuth` is missing, we immediately treat the tab as logged out and redirect to /login.
    - If `tabAuth` is present, we call the backend `/auth/session` to confirm the cookie is still valid.
- Files:
  - src/utils/tabAuth.ts — set/remove the tab flag, install the login guard, and the restore guard.
  - src/components/auth/tokenGuard.tsx — installs the restore guard for all protected pages.
  - Unauthenticated pages mount installLoginPageGuard() on mount (Login, Signup, RoleSelect, ForgotPassword).
- Why this helps:
  - sessionStorage is local to each tab and is fast to check. This lets us immediately block forward navigation when the user visited an unauthenticated page.
  - pageshow/focus listeners handle browser cache cases where React might not re-run mount effects.
- Limitations:
  - This is a client-side safety net. It does not replace server-side session invalidation. For full logout across tabs or devices, invalidate sessions on the server.
  - In development, if API is on another port, make sure requests include credentials or use the Vite proxy so cookies are handled correctly.

### DB resilience / graceful degradation

- Server exposes DB status via X-DB-Status and req.dbAvailable.
- Handlers return 503 if the DB is not ready.
- Some queries avoid advanced JSON SQL functions and compute results in Node if needed.

### Logging & debugging

- Requests log start and end time, client IP, method and URL.
- POST/PUT/PATCH bodies are logged in short form to help debugging.
- Uncaught errors are logged and return 500 unless headers already sent.

---

## Main functions (what the system does)

This section lists the main features the app provides and short notes on current status or improvements needed.

### Classroom

- Create and manage classrooms (teacher creates a class with a code).
- Invite students (invite link or code). Invite flow verifies the link with the server before join.
- Join classroom by code. Server checks duplicates and handles race cases.
- Manage classroom members (list students, remove, change sections).
- Needs improvements: pagination for large classes, bulk invite UI, stronger permission checks for certain actions.

### Quizzes

- Create quizzes (teacher), list quizzes (student/teacher), take quizzes (student).
- Support for multiple question types and storing attempts and scores.
- Teacher can view results and export basic reports.
- Needs improvements: richer analytics, timed auto-submit, retry rules, and improved UX for large question banks.

### Activities (posts / comments / replies)

- Activity feed for classroom (posts, comments, replies).
- Students and teachers can post text and simple attachments.
- Notifications for comments and replies.
- Needs improvements: moderation tools, richer attachments (images/pdf), and better real-time updates.

### User / Account

- Signup, login, password reset, and account verification flows.
- Role handling (teacher vs student) and simple profile data.
- Session management via httpOnly cookie and /auth/session endpoint.
- Needs improvements: email rate limits, 2FA option, account recovery flows.

### Notifications

- Server-side verification then client navigation for notification links.
- Unread counts are tracked and shown in the UI.
- Needs improvements: push notifications and batched notification endpoints.

### Invitations & Links

- Short-lived invite links and codes for classrooms.
- Server verifies invite before allowing join.
- Needs improvements: link expiry management UI and revoke option.

### File uploads

- Basic support for attachments in posts and student submissions.
- Files stored on disk or external storage depending on deploy.
- Needs improvements: virus scan, storage limits, and direct upload to object storage.

### Search & Filtering

- Search for quizzes, classrooms, and activity posts.
- Basic filters (by classroom, by date, by section).
- Needs improvements: full-text search, relevance ranking, and better filter UI.

### Reporting & Exports

- Basic exports (CSV) for quiz results and member lists.
- Needs improvements: scheduled exports, richer report templates.

### Real-time & State

- Some realtime features via polling; server supports websocket if enabled.
- Needs improvements: full websocket flow for live quizzes and live updates.

---

## Operational / deployment notes

Environment variables

- CLIENT_ORIGIN — client origin used in docs and headers.
- ALLOWED_ORIGINS — allowed CORS origins (comma separated).
- PORT — server port.
- DATABASE\_\* — DB config.
- ACCENT_COLOR — used on landing page.

DB compatibility

- Server supports DBs without JSON functions by doing some work in Node. This may be slower but keeps function.

Health checks

- Use a GET to a protected endpoint and check the X-DB-Status header.

Logging

- Request lifecycle logging is on. For production, forward logs to your log system and tune verbosity.

Graceful upgrades & race conditions

- Join classroom flow tolerates duplicate inserts and handles common race cases.
- Some cleanup tasks are best-effort and will be logged on failure.

---

## Troubleshooting checklist (short)

1. 404/500 from API endpoints — check env values (API base, ports) and CORS.
2. Cookies not sent in dev — use Vite proxy or enable credentials with CORS.
3. Forward-nav to protected page after visiting login — ensure `tabAuth` is cleared on unauth pages and TokenGuard is installed on protected pages.
4. DB errors about JSON functions — run fallback logic in server or upgrade DB.

---

## Next small improvements

- Add a simple GET /health endpoint returning DB status and uptime.
- Add a server-side session revoke feature for stronger logout across devices.
- Add basic rate limits to sensitive endpoints (login, join, invite).
- Improve classroom, quizzes, and activities features per notes above.
