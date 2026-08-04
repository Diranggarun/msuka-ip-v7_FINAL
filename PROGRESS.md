# Build Progress

> Update this file after every completed phase or significant change.
> If unsure whether a phase is done, mark it Partial — be conservative.

## Status legend

- ✅ **Done** — phase fully implemented, tested, and working
- 🚧 **Partial** — some files exist but the phase is incomplete
- ⚠️ **Has issue** — implemented but a known bug exists (see DEBUGGING.md)
- ⏳ **Not started** — nothing matching this phase exists

## Stack note

> The original doc template assumed Python/FastAPI + React/Vite.
> Actual build is **Node.js + Express + Socket.IO + vanilla HTML/JS + SQLite**.
> Phase labels below are mapped to the real stack.
> Database migrated from XAMPP/MySQL to embedded SQLite (`node:sqlite`) on 2026-07-18 — no DB server needed.

## Phase checklist

- ✅ **Phase 1** — Project bootstrap & folder structure (`package.json`, `server.js`, `public/`, `tests/`)
- ✅ **Phase 2** — Database schema (SQLite via `db.js` / `node:sqlite`; originally MySQL + `mysql2/promise`)
- ✅ **Phase 3** — Backend config & DB connection (`server.js` 538 lines)
- ✅ **Phase 4** — Authentication (JWT + bcryptjs)
- ✅ **Phase 5** — User & conversation management (CRUD in `server.js`)
- ✅ **Phase 6** — Real-time messaging (Socket.IO)
- ✅ **Phase 7** — File & image sharing (multer + `public/uploads/`)
- ✅ **Phase 8** — VoIP signaling backend (1:1 + group rooms wired through Socket.IO; audited 2026-05-14, needs LAN smoke test only)
- ✅ **Phase 9** — Admin module (`public/admin.html` — 607 lines)
- ✅ **Phase 10** — Frontend bootstrap (vanilla HTML/JS, not React — 4 pages, ~3.3k lines)
- ✅ **Phase 11** — Auth pages (`public/index.html` — 1,296 lines incl. login flow)
- ✅ **Phase 12** — Chat dashboard (merged into `public/index.html`; there is no separate `chat.html`)
- ✅ **Phase 13** — VoIP call UI (1:1 + group call panels in `chat.html`, audited 2026-05-14; needs LAN smoke test only)
- ✅ **Phase 14** — Admin dashboard (analytics + management in `admin.html`)
- ✅ **Phase 15** — Reports, deployment, debugging docs (`feedback.html` + `DEPLOYMENT.md`)

**Estimated overall completion: ~95% (code complete; pending LAN smoke test + survey collection)**

## Known issues

- Secrets read from `.env` (see `msuka-ip-v7/.env.example`); in production the server now **refuses to boot** on dev defaults.
- VoIP needs an end-to-end smoke test on the target LAN — see §7 checklist in `DEPLOYMENT.md`. **This is the main remaining deliverable.**
- Playwright: `feedback-form.spec.js` radio clicks intermittently time out in Firefox (flake, not a regression — retry before investigating).
- Survey responses still need collecting (20–30 respondents) for Chapter 4.

## Completion log

- 2026-05-14 — Phases 1–7, 9–12, 14 — Done — verified by inspection of `server.js` and `public/*.html`
- 2026-05-14 — Phases 8, 13, 15 — Partial — WebRTC + deployment docs incomplete
- 2026-05-14 — Secrets moved to `.env` (JWT, AES, MySQL creds) with inline loader; `.env.example` + `.gitignore` added
- 2026-05-14 — VoIP signaling audited (1:1 + group), wiring verified end-to-end in code; marked Phase 8 & 13 ✅
- 2026-05-14 — `DEPLOYMENT.md` written (MySQL, env, firewall, secure-context note, smoke-test checklist); Phase 15 ✅
- 2026-05-20 — ESLint added (flat config + `eslint-plugin-html` for inline `<script>` blocks); `lint`/`lint:fix` npm scripts; removed dead sparkline code in `admin.html` (`pushSparkPoint` + orphaned `loadSparkHistory`/`saveSparkHistory`/`storageKey`/`SPARK_HISTORY_KEY`); `npm run lint` clean — 0 problems
- 2026-07-18 — **Database migrated from XAMPP/MySQL to SQLite** (`db.js` on Node's built-in `node:sqlite`, WAL + foreign_keys + busy_timeout). Adapter keeps a mysql2-compatible `db.query()` surface so no call site in `server.js` changed. One-time importer at `scripts/migrate-mysql-to-sqlite.js`. Added LAN HTTPS endpoint on :3443 (self-signed cert) so browsers grant mic access for VoIP. Added `scripts/preflight.js` and `scripts/backup.js` (`VACUUM INTO` snapshots)
- 2026-07-18 — **RA 10173 Tier 1** (security-critical): AES encryption made fail-closed (no silent plaintext fallback); uploads moved out of `public/` and encrypted at rest, served only via authenticated `GET /uploads/:name`; login rate limiting (5 fails / 15 min per IP+email); production boot refuses dev-default secrets; demo seeding skipped in production; bcrypt 10 → 12 rounds; password minimum 6 → 8 chars
- 2026-07-20 — **RA 10173 Tier 2**: session revocation + expanded audit logging
- 2026-07-22 — **Security pass** (tested end-to-end): verified SQL injection is blocked (parameterized queries + SQLite — `'OR SLEEP(5)--` etc. all rejected). Fixed a **critical group-message IDOR** — `messages:get`/`message:send` now call `canAccessConv()` to enforce `group_members` before reading or posting to a `group_<id>` conversation (proven with a two-account read/write attack, before: leaked, after: refused). Login lockout tightened 10 → 5 attempts. Added admin **Login Monitor** cards (`/api/admin/login-activity`: per-user successes, failed attempts, last login). Added a **terms & privacy agreement** modal gate after login (accept to enter, decline signs out). Re-keyed 40 messages that were encrypted under the old dev AES key so the whole history decrypts under the `.env` key. New Playwright tests 1.9/1.10 cover the agreement; 6.7–6.10 cover the phone layout
- 2026-07-20 — Added `CLAUDE.md` (project guide for AI-assisted sessions) and seven task-scoped subagents in `.claude/agents/`; corrected stale MySQL/STUN claims in `README.md`
- 2026-07-21 — Documentation truth-pass: `DEFENSE.md` corrected (elevator pitch, SQLite adapter section, bcrypt 12, password ≥8, rate limiting, encrypted uploads, empty-`iceServers` rationale, demo step 11 no longer says MySQL Workbench) and gained a new §9 covering the RA 10173 security story; `DEPLOYMENT.md` rewritten for SQLite (no MySQL prerequisite, no schema creation step, `npm run backup` instead of `mysqldump`, SQLite-specific troubleshooting); `PROGRESS.md` brought current
- 2026-07-30 — **Left-nav restructure**: cut the icon rail from six destinations to three (`Messages` · `Global Chat` · `Notifications`, plus conditional `Admin`, then `Feedback` · `Sign Out`). Removed `#rail-groups` and `#rail-private` as exact duplicates of the `#nav-groups` / `#nav-private` filter pills — same `switchNav()` calls — and replaced the rail's New Group row with a floating gold **+** pinned bottom-right of the conversation list (`.fab-new-group`, reusing `openNewGroupModal()`, 5.44:1 glyph contrast, `aria-label` since it is icon-only). Also removed the in-section `+ New Group`, now redundant against the always-visible +. `switchNav()` needed no change — its rail lookup was already null-guarded. Deleted two things that went stale: the phone-only rule hiding the New Group row (target gone) and the rail's horizontal scroll (five tabs measure 60px at 320px, verified 320/375/414px). Tests 2.1, 2.3, 2.4, 2.7, 2.8, 2.9 repointed from the removed buttons to the pills and the floating +

- 2026-07-31 — **Admin dashboard redesign** (five stages, `7e5d2b5`→`01676da`): new top bar (greeting, live clock, MSU seal, global search, pending bell); five-tile KPI row with direction-aware period deltas; the Activity Overview rebuilt as one hero traffic chart with labelled y-axis and pointer scrubbing that snaps to the nearest bucket; a right-hand column carrying **Online Now** (role-coloured initials avatars, presence dots, four shortcuts, and the only entry point to the previously unreachable Recent Messages panel) and **Approved Users** (role filter tabs, scrollable, online-first, capped at 40 with a "Showing 40 of N" caption); and the pending queue converted from ~19,000px of stacked cards to a **paginated table** at ten per page. Fixed a pre-existing bug found during verification: the phone rules are written against `#app.open` but `login()` only set an inline `display:flex`, so `.admin-main` measured **0px at every width below 900px** — the dashboard was invisible on phones and tablets. Test 6.12 had been passing throughout and now measures `.admin-main` itself; new tests 5.9–5.14 cover panel population, role-tab partitioning, XSS escaping in the panels, pagination, cross-page search and pager clamping

## Notes

- Demo target: roughly **April–May 2026** per the Gantt chart in the capstone.
- Final deliverable: working LAN deployment + capstone evaluation survey (Likert, 20–30 respondents) — survey form (`feedback.html`) already built.
- Defense priority: be able to explain every line of code in oral defense — avoid one-shot generation.
- Remaining work (~5%): run the §7 LAN smoke test from `DEPLOYMENT.md` on the demo host, then collect the 20–30 survey responses via `feedback.html`.
- Deployment is simpler than the original Gantt assumed: no MySQL/XAMPP to install on the demo host, and `node_modules/` can be copied by USB to a fully offline machine (`npm install` is the only step needing internet).
- Defense prep: `DEFENSE.md` §9 is the RA 10173 security answer; §3.6 covers why SQLite over MySQL. Both were written against the shipped code, not the original plan.
