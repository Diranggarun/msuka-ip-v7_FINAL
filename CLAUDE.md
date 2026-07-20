# CLAUDE.md — MSUkaIP

LAN-based messaging + VoIP capstone app for CICS, Mindanao State University — Main Campus.
Capstone constraint: **the student must be able to explain every line in oral defense** — prefer small, explainable changes over clever rewrites or large generated blocks.

## Actual stack (do not assume otherwise)

- **Backend:** Node.js + Express + Socket.IO — all server logic in `msuka-ip-v7/server.js`
- **Database:** SQLite via `msuka-ip-v7/db.js` (Node built-in `node:sqlite`, Node 22.5+, no native deps). Exposes a mysql2-compatible surface: `const [rows] = await db.query(sql, params)`. Migrated from XAMPP/MySQL — ignore any doc that still says MySQL.
- **Frontend:** Vanilla HTML/JS, **no build step, no React, no bundler** — three self-contained pages in `msuka-ip-v7/public/`: `index.html` (login + chat SPA), `admin.html`, `feedback.html`. Inline `<style>`/`<script>` per page.
- **Voice:** WebRTC peer-to-peer audio; server only relays signaling. `iceServers` is intentionally **empty** (offline LAN, host candidates, same /24). Mic requires the HTTPS origin `https://<ip>:3443` (self-signed cert auto-generated into `certs/`).
- **Auth:** JWT (`jsonwebtoken`) + bcryptjs (12 rounds, 8-char minimum). **Encryption:** AES-256-GCM for message text and uploaded files at rest, fail-closed (never fall back to plaintext).
- **Tests:** Playwright only (`msuka-ip-v7/tests/`) — API via request context, UI in Chromium + Firefox. No pytest, no RTL, no unit framework.

## Commands (run from `msuka-ip-v7/`)

```
node server.js          # start (SQLite — no XAMPP/MySQL/Redis needed)
npm run lint            # eslint incl. inline <script> blocks (must stay clean)
npx playwright test     # server must already be running
npm run preflight       # env/DB/network readiness check
node db-audit.js        # schema + integrity audit
```

## Conventions

- **Socket.IO events:** `namespace:action` — e.g. `message:send`/`message:new`, `call:initiate`/`call:incoming`, `webrtc:offer`, `room:join`, `typing:update`. New events follow this pattern and validate payloads server-side.
- **Rooms:** general chat is `group_general`; private rooms are `private_<sortedEmailA>__<sortedEmailB>`.
- **SQL:** always parameterized `?` placeholders through `db.query()`. Timestamps are localtime `YYYY-MM-DD HH:MM:SS` strings.
- **Uploads:** stored in `msuka-ip-v7/uploads/` (outside `public/`), encrypted at rest, served only via authenticated `GET /uploads/:name`. Client media URLs must use `fileSrc(u)` which appends `?token=` (media tags can't send Authorization headers).
- **Security invariants (RA 10173 hardening — do not regress):** login rate limiting (10 fails/15 min per IP+email); production boot refuses dev-default secrets; demo accounts seed only outside production; two-tier login (admins → `/admin.html` only, students/faculty → chat only); security-relevant actions write to `audit_logs`.
- **Offline-LAN rule:** no CDNs, no external fonts, no internet APIs, no STUN/TURN. Everything self-hosted.
- **Style:** match the existing compact single-file style; frontend reuses existing helpers (`appendMessage`, `showAuthMsg`, `fileSrc`, …) and the maroon/gold `:root` design tokens.

## After changes

- `npm run lint` and the Playwright suite must pass (known flake: feedback-form radio clicks in Firefox may timeout — retry once before calling it a regression).
- Update `PROGRESS.md` (completion log), `DECISIONS.md` (trade-offs), `DEBUGGING.md` (new known issues) when relevant.

## Docs map

`README.md` setup · `DEPLOYMENT.md` LAN deploy · `ERD.md` schema (7 tables) · `DECISIONS.md` why-choices · `DEBUGGING.md` known errors · `PROGRESS.md` phase checklist · `DEFENSE.md` oral-defense prep

## Subagents

Project agents live in `.claude/agents/`: `planner` (read-only architect), `backend-dev`, `frontend-dev`, `webrtc-specialist`, `code-reviewer` (read-only security review), `test-runner`, `debugger` (read-only investigation). Delegate matching work to them.

## Demo accounts (dev only — seeding skipped in production)

`admin@cics.msu.edu`/`admin123` (admin portal only) · `student@cics.msu.edu`/`student123` (chat only)
