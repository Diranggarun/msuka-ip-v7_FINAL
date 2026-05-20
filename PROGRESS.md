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
> Actual build is **Node.js + Express + Socket.IO + vanilla HTML/JS + MySQL**.
> Phase labels below are mapped to the real stack.

## Phase checklist

- ✅ **Phase 1** — Project bootstrap & folder structure (`package.json`, `server.js`, `public/`, `tests/`)
- ✅ **Phase 2** — Database schema (MySQL via `mysql2/promise`)
- ✅ **Phase 3** — Backend config & DB connection (`server.js` 538 lines)
- ✅ **Phase 4** — Authentication (JWT + bcryptjs)
- ✅ **Phase 5** — User & conversation management (CRUD in `server.js`)
- ✅ **Phase 6** — Real-time messaging (Socket.IO)
- ✅ **Phase 7** — File & image sharing (multer + `public/uploads/`)
- ✅ **Phase 8** — VoIP signaling backend (1:1 + group rooms wired through Socket.IO; audited 2026-05-14, needs LAN smoke test only)
- ✅ **Phase 9** — Admin module (`public/admin.html` — 607 lines)
- ✅ **Phase 10** — Frontend bootstrap (vanilla HTML/JS, not React — 4 pages, ~3.3k lines)
- ✅ **Phase 11** — Auth pages (`public/index.html` — 1,296 lines incl. login flow)
- ✅ **Phase 12** — Chat dashboard (`public/chat.html` — 956 lines)
- ✅ **Phase 13** — VoIP call UI (1:1 + group call panels in `chat.html`, audited 2026-05-14; needs LAN smoke test only)
- ✅ **Phase 14** — Admin dashboard (analytics + management in `admin.html`)
- ✅ **Phase 15** — Reports, deployment, debugging docs (`feedback.html` + `DEPLOYMENT.md`)

**Estimated overall completion: ~95% (code complete; pending LAN smoke test + survey collection)**

## Known issues

- Secrets now read from `.env` (see `msuka-ip-v7/.env.example`); server warns if defaults are still in use.
- VoIP needs an end-to-end smoke test on the target LAN — see §7 checklist in `DEPLOYMENT.md`.

## Completion log

- 2026-05-14 — Phases 1–7, 9–12, 14 — Done — verified by inspection of `server.js` and `public/*.html`
- 2026-05-14 — Phases 8, 13, 15 — Partial — WebRTC + deployment docs incomplete
- 2026-05-14 — Secrets moved to `.env` (JWT, AES, MySQL creds) with inline loader; `.env.example` + `.gitignore` added
- 2026-05-14 — VoIP signaling audited (1:1 + group), wiring verified end-to-end in code; marked Phase 8 & 13 ✅
- 2026-05-14 — `DEPLOYMENT.md` written (MySQL, env, firewall, secure-context note, smoke-test checklist); Phase 15 ✅
- 2026-05-20 — ESLint added (flat config + `eslint-plugin-html` for inline `<script>` blocks); `lint`/`lint:fix` npm scripts; removed dead sparkline code in `admin.html` (`pushSparkPoint` + orphaned `loadSparkHistory`/`saveSparkHistory`/`storageKey`/`SPARK_HISTORY_KEY`); `npm run lint` clean — 0 problems

## Notes

- Demo target: roughly **April–May 2026** per the Gantt chart in the capstone.
- Final deliverable: working LAN deployment + capstone evaluation survey (Likert, 20–30 respondents) — survey form (`feedback.html`) already built.
- Defense priority: be able to explain every line of code in oral defense — avoid one-shot generation.
- Remaining work (~5%): run the §7 LAN smoke test from `DEPLOYMENT.md` on the demo host, then collect the 20–30 survey responses via `feedback.html`.
