# MSUkaIP — CICS LAN Messenger

LAN-first chat, file sharing, and voice-calling system for the College of Information and Computing Sciences, Mindanao State University — Main Campus. Capstone project.

## Stack

- **Backend:** Node.js + Express
- **Real-time:** Socket.IO
- **Voice calls:** WebRTC peer-to-peer (server only signals)
- **Database:** MySQL 8 (`mysql2/promise`)
- **Auth:** JWT (`jsonwebtoken`) + bcryptjs
- **Encryption:** AES-256-GCM for chat message text
- **Frontend:** Vanilla HTML/JS (no build step) — `public/index.html`, `public/admin.html`, `public/feedback.html`

## Quick start (local dev)

```powershell
cd msuka-ip-v7
npm install
Copy-Item .env.example .env
notepad .env                  # set JWT_SECRET, AES_SECRET, MYSQL_PASSWORD
npm start
```

Then open:
- Chat → http://localhost:3000/
- Admin → http://localhost:3000/admin.html
- Feedback → http://localhost:3000/feedback.html

Default seeded accounts (rotated on every server start, so demos can't drift):

| Email | Password | Role |
|---|---|---|
| `admin@cics.msu.edu` | `admin123` | Admin |
| `student@cics.msu.edu` | `student123` | Student |

**Change before LAN deployment** — see `DEPLOYMENT.md`.

## Folder layout

```
msuka-ip-v7_Final/
├── msuka-ip-v7/                  # Application code
│   ├── server.js                 # Express + Socket.IO + all REST routes
│   ├── public/                   # Static frontend (4 HTML pages + fonts + uploads)
│   │   ├── index.html            # Login + Chat SPA
│   │   ├── admin.html            # Admin dashboard
│   │   ├── feedback.html         # Anonymous Likert capstone survey
│   │   ├── fonts/                # Self-hosted Cinzel + Nunito woff2
│   │   ├── uploads/              # User-uploaded files (gitignored)
│   │   └── msukaip-logo.png      # Brand logo
│   ├── tests/                    # Playwright specs
│   ├── db-audit.js               # Standalone schema + integrity audit script
│   ├── .env.example              # Template for secrets / DB creds
│   ├── package.json
│   └── playwright.config.js
├── README.md                     # This file
├── DEPLOYMENT.md                 # LAN deployment guide (firewall, secrets, smoke test)
├── PROGRESS.md                   # Phase checklist + completion log
├── ERD.md                        # Database schema reference
├── DECISIONS.md                  # Build decisions log
├── DEBUGGING.md                  # Known errors + fixes
├── AUDIT.md                      # Codebase audit snapshot
└── PROMPTS.md                    # Original 15-phase build spec
```

## Documentation map

| If you want to… | Read |
|---|---|
| Set up a development environment | This file (Quick start) |
| Deploy to a LAN for demo / defense | `DEPLOYMENT.md` |
| Understand what's done and what's not | `PROGRESS.md` |
| Learn the database schema | `ERD.md` |
| Understand why a thing was built a certain way | `DECISIONS.md` |
| Debug a specific error | `DEBUGGING.md` |
| See the original build plan | `PROMPTS.md` |

## Key features

- **Two-tier authentication:** Admin accounts must use `/admin.html`; students/faculty use `/` (chat). Login routes are separate and cross-blocked.
- **Account approval workflow:** New registrations land as `pending` until an admin approves them in the dashboard.
- **End-to-end-ish encryption:** Chat messages are encrypted with AES-256-GCM at rest. The server holds the key (it has to — it serves history to multiple clients), so this protects against DB exfiltration, not against a compromised server.
- **Real-time messaging:** Socket.IO `message:new` broadcast per room. Private rooms use a deterministic `private_<sortedEmailA>__<sortedEmailB>` key.
- **File sharing:** PDF, DOCX, JPEG, PNG, GIF, WebP. 5 MB cap.
- **Voice messages:** Push-to-talk record-and-send (10 MB cap, audio/* only).
- **1:1 + group VoIP calls:** WebRTC with Socket.IO for signaling. Caller, callee, and group rooms.
- **Admin dashboard:** Pending approvals, user CRUD, audit log, recent messages, feedback dashboard with per-section bars, CSV export.
- **Anonymous capstone survey:** Likert form persists to `survey_responses` so 20–30 respondents can be aggregated for Chapter 4 analysis.
- **Offline-LAN ready:** Self-hosted fonts, local STUN-fallback for VoIP, all features (except internet-only icons for VoIP STUN) work without internet.

## Environment variables

See `msuka-ip-v7/.env.example`. The minimum required for production deployment:

```
JWT_SECRET=<48+ random characters>
AES_SECRET=<48+ random characters>     # never rotate after messages exist
AES_SALT=<16+ random characters>       # never rotate
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=<your MySQL password>
MYSQL_DATABASE=msukaip
PORT=3000
```

Generate strong secrets in PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | %{ Get-Random -Maximum 256 }))
```

## Database

Schema is auto-created at boot by `setupDatabase()`. 7 tables: `users`, `groups_table`, `group_members`, `messages`, `calls`, `audit_logs`, `survey_responses`. Detailed in `ERD.md`.

Audit the DB at any time:

```powershell
cd msuka-ip-v7
node db-audit.js
```

This dumps FK relationships, indexes, row counts, orphan-record checks, and collation. Useful for verifying integrity before demo day.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Run the server (`node server.js`) |
| `npm run dev` | Run with `nodemon` for auto-reload |
| `npm test` | Run Playwright smoke tests |
| `npm run test:headed` | Run Playwright with a visible browser |
| `npm run test:report` | Open the HTML report from the last run |

## License

Capstone project, College of Information and Computing Sciences, Mindanao State University — Main Campus. Internal use only.
