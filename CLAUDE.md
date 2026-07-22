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
- **Security invariants (RA 10173 hardening — do not regress):** login rate limiting (5 fails/15 min per IP+email); production boot refuses dev-default secrets; demo accounts seed only outside production; two-tier login (admins → `/admin.html` only, students/faculty → chat only); security-relevant actions write to `audit_logs`.
- **Offline-LAN rule:** no CDNs, no external fonts, no internet APIs, no STUN/TURN. Everything self-hosted.
- **Style:** match the existing compact single-file style; frontend reuses existing helpers (`appendMessage`, `showAuthMsg`, `fileSrc`, …) and the maroon/gold `:root` design tokens.

## After changes

- `npm run lint` and the Playwright suite must pass (known flake: feedback-form radio clicks in Firefox may timeout — retry once before calling it a regression).
- Update `PROGRESS.md` (completion log), `DECISIONS.md` (trade-offs), `DEBUGGING.md` (new known issues) when relevant.

## Docs map

`README.md` setup · `DEPLOYMENT.md` LAN deploy · `ERD.md` schema (7 tables) · `DECISIONS.md` why-choices · `DEBUGGING.md` known errors · `PROGRESS.md` phase checklist · `DEFENSE.md` oral-defense prep

## Subagents

Project agents live in `.claude/agents/`: `planner` (read-only architect), `backend-dev`, `frontend-dev`, `webrtc-specialist`, `code-reviewer` (read-only security review), `test-runner`, `debugger` (read-only investigation). Delegate matching work to them.

## Skills — routing for this project

Design skills are installed in `.agents/skills/` (gitignored; reinstall with `npx skills@latest add <repo>` from `skills-lock.json`). Skills auto-trigger from their own descriptions, but most of these were written for React/Tailwind marketing sites, so this table decides what applies **here**. Consult it before invoking a design skill.

**Use freely — stack-agnostic judgement, applied by hand:**

| Skill | Use for |
|---|---|
| `impeccable` | UI critique, hierarchy, a11y, spacing, states. Works on any stack. Ships hook scripts — leave them unregistered. |
| `redesign-existing-projects` | Audits before changing. Explicitly supports vanilla CSS. |
| `apple-design` | Interaction/motion principles, reduced-motion, gesture and sheet behaviour. |
| `emil-design-eng` | Small polish calls and "invisible details". |
| `find-animation-opportunities` · `improve-animations` · `review-animations` | Motion audits. Read-only; they plan, they don't implement. |
| `animation-vocabulary` | Naming a motion effect. |

**Do not apply without saying why first:**

- `full-output-enforcement` — mandates exhaustive unabridged output. Directly contradicts the capstone rule at the top of this file (small, explainable changes over large generated blocks). **Never enable it here.**
- `gpt-taste` — requires GSAP ScrollTrigger and AIDA landing-page structure. This is a chat app on an offline LAN with no bundler and no GSAP.
- `minimalist-ui` · `industrial-brutalist-ui` · `high-end-visual-design` — each prescribes its own palette and type. Would displace the maroon/gold `:root` tokens and the Cinzel/Nunito pairing, which are institutional MSU identity, not style choices.
- `design-taste-frontend` (+`-v1`) · `stitch-design-taste` — scoped to landing pages/portfolios and Google Stitch.
- `image-to-code` · `imagegen-frontend-web` · `imagegen-frontend-mobile` · `brandkit` — generate design imagery, then React/Tailwind. No image pipeline here, and generated markup can't drop into the inline-`<script>` pages.

Standing rule for every one of them: take the *reasoning*, never paste the code. Anything landing in `public/*.html` must match the existing compact style and be explainable line by line in oral defense.

## Demo accounts (dev only — seeding skipped in production)

`admin@cics.msu.edu`/`admin123` (admin portal only) · `student@cics.msu.edu`/`student123` (chat only)
