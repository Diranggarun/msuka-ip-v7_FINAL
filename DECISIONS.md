# Project Decisions Log

> Newest entries first. Add an entry whenever a non-trivial choice is made.
> Format: `## YYYY-MM-DD — Short title`

---

## Template (copy this when adding a new entry)

```
## YYYY-MM-DD — Short title

**Decision:** What was decided.

**Context:** Why this came up.

**Alternatives considered:** What else we looked at.

**Reasoning:** Why we picked this one.

**Trade-offs:** What we give up by choosing this.
```

---

## Foundational decisions (from the capstone document)

These are decisions baked into the project specification. Don't revisit without updating the capstone paper too.

### Backend framework: FastAPI (not Django, not Flask)
- **Reasoning:** Async support is critical for Socket.IO + WebRTC signaling at 50–100 concurrent users. FastAPI's Pydantic integration also matches the project's typed-schema discipline.
- **Trade-off:** Smaller ecosystem than Django; no built-in admin UI (we build our own in Phase 14).

### ~~Database: MySQL 8 (not PostgreSQL)~~ — SUPERSEDED 2026-07-18
- **Reasoning (at the time):** Most CICS lab machines have MySQL pre-installed. Easier to demo without environment setup.
- **Trade-off:** Loses some PostgreSQL-only features (JSONB indexing, etc.); minor for this scope.
- **Superseded by:** *Database: embedded SQLite* below.

### Database: embedded SQLite via `node:sqlite` (replaces MySQL 8) — 2026-07-18
- **Reasoning:** The "MySQL is pre-installed" assumption did not survive contact with real deployment. Every demo host needed XAMPP installed, MySQL started, a schema created, and a root password wired into `.env` — four failure points before the app could even boot, on machines we don't control. SQLite removes all four: the database is a single file the server creates itself, and the driver is built into Node 22.5+, so there is nothing to install and no native module to compile.
- **Migration cost was near zero:** `db.js` wraps `node:sqlite` in a `mysql2/promise`-compatible surface, so every `const [rows] = await db.query(sql, params)` call site in `server.js` was left untouched. A one-time importer (`scripts/migrate-mysql-to-sqlite.js`) moved existing rows across.
- **Concurrency:** opened with `journal_mode=WAL` so readers don't block the writer, `foreign_keys=ON` (off by default in SQLite), and `busy_timeout=5000`. Writes serialize on Node's event loop, so `SQLITE_BUSY` can only come from a second process (e.g. `db-audit.js`), which the timeout absorbs.
- **Trade-off:** Single-host only — SQLite can't be shared across multiple app servers. Irrelevant here (one LAN server by design), and the mysql2-compatible adapter means going back is a `db.js` change rather than a codebase change. Also forfeits MySQL-specific tooling like Workbench and `mysqldump`; replaced by `npm run backup` (`VACUUM INTO` snapshots) and `node db-audit.js`.

### Real-time chat: Socket.IO (not raw WebSockets)
- **Reasoning:** Automatic reconnection, room management, and event-based API match the use case. Capstone Chapter 3.2.5 specifies Socket.IO.
- **Trade-off:** Slight overhead vs. native WebSocket. Acceptable on LAN.

### Voice calls: WebRTC peer-to-peer (not server-relayed audio)
- **Reasoning:** Backend never carries audio — only signals. Scales naturally to 50–100 users since the server isn't a bottleneck.
- **Trade-off:** Requires HTTPS or localhost for `getUserMedia`. Documented workaround in Phase 13 (Chrome flag) and Phase 15.2 (self-signed cert).

### Authentication: JWT + Bcrypt (not session cookies)
- **Reasoning:** Works seamlessly across REST and Socket.IO. Stateless, scales horizontally.
- **Trade-off:** Token revocation isn't instant (we track in `sessions` table for forced logout).

### Email gate: institutional emails only (@msumain.edu.ph)
- **Reasoning:** Capstone Chapter 2.1.3.3 cites the National Cybersecurity Plan requirement for trusted institutional identities.

### File upload limit: 5MB
- **Reasoning:** Capstone Scope & Limitations explicitly caps at 5MB to prevent local server congestion.

### Deployment target: Windows server in CICS LAN
- **Reasoning:** Matches existing CICS infrastructure; researchers will manage the server.
- **Trade-off:** Some deployment scripts will be Windows-specific (.bat, .ps1). Documented in Phase 15.2.

---

## Build decisions (added during development)

_Newest entries first._

---

## 2026-05-14 — Move secrets to `.env` with inline loader

**Decision:** `JWT_SECRET`, `AES_SECRET`, `AES_SALT`, and optionally `SQLITE_PATH` read from `process.env`. A tiny inline loader parses `.env` so no `dotenv` package is added. (The original `MYSQL_*` credentials disappeared with the SQLite migration — an embedded file database has no credentials to leak.)

**Context:** Hardcoded dev secrets in `server.js` are a defense red flag and a real risk on LAN deployment.

**Reasoning:** Inline loader avoids a 6 kB dependency for one tiny parser. Falls back to the old dev defaults so existing dev workflows aren't broken; logs a `⚠️` warning when defaults are in use.

**Trade-offs:** No quoting/escaping rules beyond simple `KEY=VALUE` lines. If complex multiline values are ever needed, swap to `dotenv`.

---

## 2026-05-14 — Persist anonymous survey responses (`survey_responses` table + public POST)

**Decision:** New `survey_responses` table. `POST /api/survey` is the only unauthenticated mutation in the app.

**Context:** Capstone needs 20–30 Likert responses for Chapter 4 evaluation. `questionnaire.html` (now `feedback.html`) was only logging to console, so respondents were unrecoverable.

**Reasoning:** Anonymous-friendly because requiring a CICS account just to give feedback would skew the sample. Per-section means + the full `scores_json` are stored so we can compute aggregates AND drill into per-question stats during defense.

**Trade-offs:** Public endpoint is vulnerable to spam. Mitigated by required `type` + `device` fields and the fact that the form lives on the LAN-only deployment.

---

## 2026-05-14 — Transactional `group:create`

**Decision:** Group creation now wraps INSERTs in `BEGIN/COMMIT/ROLLBACK` via a borrowed connection from the pool, and uses `INSERT IGNORE` for member rows.

**Context:** Previous code did a sequence of single-statement INSERTs. If the second member-INSERT failed mid-loop, an orphaned group sat in `groups_table` with no members.

**Reasoning:** Atomicity matters here because the system has no admin UI to clean up orphaned groups.

**Trade-offs:** Slight code complexity (manual connection borrow/release). Acceptable for the integrity gain.

---

## 2026-05-14 — Add `UNIQUE(group_id, user_id)` on `group_members`

**Decision:** Added a unique composite index.

**Context:** Audit showed no current duplicates, but the application-layer protection (an existence check before INSERT) is racy under fast clicks.

**Reasoning:** Database is the right layer to enforce "a user is in a group exactly once."

**Trade-offs:** None — duplicates here were never desirable.

---

## 2026-05-14 — Self-host Google Fonts for offline LAN

**Decision:** Downloaded Cinzel + Nunito woff2 files into `public/fonts/`, rewrote `/fonts/google-fonts.css` to use local paths, replaced every CDN `<link>` in the four HTML pages.

**Context:** The capstone's premise is "works on a LAN even when internet is down." External CDN dependencies break that.

**Reasoning:** ~177 KB total disk cost for total CDN independence. Same paths work whether online or offline.

**Trade-offs:** Fonts are pinned to a single moment in time — won't auto-update if Google ships fixes.

---

## 2026-05-14 — Performance indexes on hot query columns

**Decision:** Added `idx_messages_conv_created`, `idx_messages_created`, `idx_users_account_status`, `idx_users_status`, `idx_survey_created`, `idx_audit_created`.

**Context:** Every chat fetch filters on `messages.conv_key` + orders by `created_at`. Admin filters users by `account_status`. Online count queries on `users.status`. All were full-table scans before.

**Reasoning:** Even at 200 messages the scan is unnoticeable, but at 10k+ it becomes a Socket.IO handler timeout risk that drops messages.

**Trade-offs:** Tiny extra disk + maintenance cost on inserts. Negligible at this scale.

---

## 2026-05-14 — Notifications persisted per user in `localStorage`

**Decision:** Notifications array is saved under `msukaip-notif-<email>` on every mutation and reloaded on login. The list is cleared from memory at logout (so the next user doesn't see them) but not from storage.

**Context:** Original behavior wiped notifications on logout — users lost any unseen activity from previous sessions.

**Reasoning:** Per-user namespacing means multiple respondents can demo on the same laptop without seeing each other's notifications.

**Trade-offs:** Sensitive content lives in plaintext in `localStorage`. Acceptable in the LAN deployment context since the chat itself is also accessible on that machine after login.

---

## Stack divergence from the original plan

The original capstone plan called for **FastAPI + React + Vite + Pydantic + Alembic migrations**. The actual build is **Node.js + Express + Socket.IO + vanilla HTML/JS + ad-hoc schema-init via `CREATE TABLE IF NOT EXISTS`**.

This was a delivery-time pragmatism call:
- Single language (JS everywhere) made debugging easier for the team.
- No build step on the frontend means deploy-by-copy on the demo host.
- `CREATE TABLE IF NOT EXISTS` + idempotent `ALTER TABLE` blocks substitute for a full migration runner and are sufficient at this scope.

The capstone document's Chapter 3 still cites the original FastAPI/React stack; defenders should be ready to explain the divergence as a delivery-time refinement, not a scope change. Functional requirements remained identical.
