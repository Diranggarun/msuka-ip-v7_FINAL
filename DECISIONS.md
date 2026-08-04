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

## 2026-07-30 — Left rail cut from six destinations to three; New Group became a floating +

**Decision:** Removed `#rail-groups`, `#rail-private` and the rail's New Group button. Groups and Private are reached from the `#nav-groups` / `#nav-private` filter pills that were already in the list header; New Group is now a floating gold **+** pinned bottom-right of the conversation list. The in-section `+ New Group` inside `#section-groups` was removed too. The rail is now Messages · Global Chat · Notifications · [Admin] — spacer — Feedback · Sign Out.

**Context:** Three rail rows were exact duplicates of controls elsewhere in the same screen. `#rail-groups` fired `switchNav('groups', …)`, the identical call `#nav-groups` makes; `#rail-private` likewise; the rail's New Group called the same `openNewGroupModal()` as the button inside the Groups section. The phone CSS had already reached this conclusion for one of them — it hid the New Group row on narrow screens, with a comment reasoning that the Groups list has its own button so nothing becomes unreachable. This applies that same judgement at every screen size.

**Reasoning:** Two controls that call the same function are two things to explain in a defense and two places to keep in sync, for no gain. Keeping the *pills* rather than the rail rows is the right direction because the pills sit directly above the list they filter, whereas the rail mixes filters and destinations in one column. Global Chat and Notifications stayed because they are views, not filters — `switchNav()` deliberately hides the pill track for them, so they have no pill to fall back on. Feedback and Sign Out stayed because they have no other entry point anywhere in the UI.

**Trade-offs:** Group creation moved from a labelled row to an icon-only button, so it now depends on `aria-label` for its accessible name rather than visible text. Gold fill with a maroon glyph measures 5.44:1, past the 3:1 WCAG asks of non-text UI shapes. The lists needed 86px of bottom padding (52px button + 18px offset + breathing room) so the floating button never covers the last conversation row. `#compose-btn` in the list header was **kept** despite also calling `switchNav('private', …)`: a compose affordance is a different user intent from a filter, and the file already documents it that way.

Two things this let us delete rather than maintain: the phone-only rule hiding the New Group row (its target no longer exists) and the rail's horizontal scroll. That scroll existed because seven 44px tabs did not fit a 320px screen; five now measure 60px each there, verified at 320/375/414px.

---

## Admin dashboard rebuilt as an overview, not a stack of cards

**Decision:** Rebuilt `admin.html`'s landing view in five stages: a top bar with greeting, live clock and global search; a five-tile KPI row with period deltas; one hero traffic chart with a real y-axis and hover scrubbing; a right column carrying Online Now and Approved Users; and the pending queue as a paginated table.

**Context:** The page was five full-width stat cards stacked vertically — roughly 600px of near-identical rows before any content — followed by 157 pending requests rendered as individual cards, which alone made the page about 19,000px tall. Everything was equally loud, so nothing read first.

**Reasoning:** The shape of the data belongs at the top (one chart), the exact numbers one glance away (compact tiles), and the roster beside them rather than below. Filtering and paging happen client-side because `/api/admin/users` and `/api/admin/pending` already return the full set in one request; adding `?page=` parameters would mean new server routes, new SQL and new tests for a dataset that is a few hundred rows on a single-campus LAN. If the roster ever outgrows that, the endpoints are the place to change, not the panels.

**Trade-offs:**

- **Avatars are initials in a role-coloured circle.** There is no photo storage in this system and adding it was out of scope. Colour encodes role using the same hues as the role badges — the initials already distinguish people, so the colour is free to carry information instead of being decorative.
- **The Approved Users panel builds at most 40 rows.** `loadUsers()` re-runs every 5 seconds; mapping 200+ rows that often is wasted work for a panel showing six at a time. The full table is one click away, and the panel says "Showing 40 of N" rather than implying it is complete. Rows sort online-first: without that the cap hid whoever was actually online, since the server orders by join date and the one online account sat at index 77.
- **The role tabs are All / Students / Faculty / Admins.** The mockup asked for a "Staff" tab, but the `users.role` column only holds `student`, `faculty` and `admin`. A Staff tab would always have been empty.
- **The pending table's Status column is constant.** Every row reads `pending`, because `/api/admin/pending` filters on exactly that. It is kept because it was specified and it does confirm the queue's state at a glance, but it carries no information that distinguishes one row from another.
- **Pending search filters the data, not the DOM.** The previous implementation hid `.pending-card` elements. With pagination that would only ever search the page currently displayed, so the filter moved into the data and resets to page 1.

---

## Stack divergence from the original plan

The original capstone plan called for **FastAPI + React + Vite + Pydantic + Alembic migrations**. The actual build is **Node.js + Express + Socket.IO + vanilla HTML/JS + ad-hoc schema-init via `CREATE TABLE IF NOT EXISTS`**.

This was a delivery-time pragmatism call:
- Single language (JS everywhere) made debugging easier for the team.
- No build step on the frontend means deploy-by-copy on the demo host.
- `CREATE TABLE IF NOT EXISTS` + idempotent `ALTER TABLE` blocks substitute for a full migration runner and are sufficient at this scope.

The capstone document's Chapter 3 still cites the original FastAPI/React stack; defenders should be ready to explain the divergence as a delivery-time refinement, not a scope change. Functional requirements remained identical.
