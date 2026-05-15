# MSUkaIP — Oral Defense Cheat Sheet

A line-of-defense walkthrough of every non-trivial block in `msuka-ip-v7/server.js` and the three HTML pages, so you can answer **"explain what this line does"** for any panel question.

Read top-to-bottom once. The panel almost certainly will not ask about every section, but having read the whole thing once means you can pivot to any of them on demand.

---

## 1. The 30-second elevator pitch

> MSUkaIP is a LAN-first academic messenger for CICS that keeps text, file, image, voice, and VoIP communication working during internet outages. The backend is a single Node.js Express process with Socket.IO for real-time events and WebRTC for peer-to-peer voice. Data lives in a local MySQL instance; chat messages are encrypted at rest with AES-256-GCM. Front end is vanilla HTML/JS — no build step — so it deploys by copying a folder. Authentication uses JWT with bcrypt password hashing. There are separate login flows for the chat app and the admin dashboard.

If they ask "why those choices?" → quote `DECISIONS.md`. Each decision has a why-and-trade-off paragraph.

---

## 2. Stack divergence — the question you'll be asked

**Question:** "Your capstone paper says FastAPI + React + Vite. Why is the code Node.js + vanilla HTML?"

**Answer:** "Functional requirements stayed identical to the paper. We refined the stack during delivery for three reasons: (1) single-language (JavaScript everywhere) shortened debug cycles for our team, (2) the frontend deploys by file-copy with no build step, important for a Windows LAN demo, and (3) Node's event loop pairs naturally with Socket.IO. The architecture — REST + WebSocket signaling + WebRTC media + relational DB — is unchanged."

---

## 3. `server.js` — section by section

### 3.1 Imports & app bootstrap
```js
const express = require('express');  const http = require('http');
const { Server } = require('socket.io'); …
```
A standard Express + Socket.IO setup. `http.createServer(app)` wraps Express so Socket.IO can share the port. `app.use(express.static('public'))` serves the four HTML pages and the uploads folder.

### 3.2 The `.env` loader
```js
(() => { try { … fs.readFileSync(envPath) … } catch {} })();
```
A minimal in-line parser for KEY=VALUE lines so the project doesn't depend on the `dotenv` package. Strips quotes, ignores comments, only sets a variable if the OS hasn't already set it. **Why custom:** Avoid adding a 6 KB transitive dependency for one tiny function.

### 3.3 Secrets
```js
const JWT_SECRET = process.env.JWT_SECRET || 'msuka-ip-secret-2025';
const AES_SECRET = process.env.AES_SECRET || 'MSUkaIP-…';
const AES_KEY    = crypto.scryptSync(AES_SECRET, AES_SALT, 32);
```
- `JWT_SECRET` signs JWT tokens — must be at least 32 random bytes for HS256 to be safe.
- `AES_SECRET` + `AES_SALT` → derived through scrypt into a 256-bit AES key. scrypt is intentionally slow and memory-hard so even with a leaked salt it's expensive to brute-force the secret.
- Warns if dev defaults are still in use on boot.

**Panel hook:** "Why scrypt and not just store the key?" → scrypt key-stretching turns a weak password into a uniform 256-bit key, and is FIPS 140-friendly.

### 3.4 `encryptMessage` / `decryptMessage` — AES-256-GCM
```js
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
…
return iv:authTag:ciphertext (all hex)
```
- **Algorithm:** AES-256 in Galois/Counter Mode (GCM). Authenticated encryption — gives confidentiality AND integrity in one operation.
- **IV:** 96-bit (12 bytes), randomly generated *per message*. NIST recommends 96-bit IVs for GCM. **Never reuse an IV with the same key.**
- **Auth tag:** 128-bit. If anyone tampers with the ciphertext or auth-tag, decryption throws.
- **Storage format:** `iv(hex):authTag(hex):ciphertext(hex)` — three hex strings separated by colons, so we can `split(':')` on read.

**Soft-fail trade-off:** Inside `try{…} catch{ return text; }`. If for some reason the cipher fails, the message is stored in plaintext rather than dropped. This is documented in DECISIONS.md as an availability-over-confidentiality call.

**Panel hook:** "Why GCM instead of CBC?" → CBC needs a separate HMAC step for integrity; GCM does both at once, and is parallelizable.

### 3.5 Multer file uploads
```js
const ALLOWED = ['image/jpeg', 'image/png', …];
const upload = multer({ storage, limits:{fileSize:5*1024*1024}, fileFilter:… });
```
- Files saved to `public/uploads/` with a timestamped random filename to prevent overwrites.
- 5 MB cap baked in — matches the capstone scope ("prevent local server congestion").
- Mimetype allowlist (not blocklist): JPEG, PNG, GIF, WebP, PDF, DOC, DOCX. Allowlist is safer than blocklist (rejects anything we didn't anticipate).
- Voice upload uses a separate multer with `audio/*` only and a 10 MB cap.

### 3.6 MySQL pool
```js
const db = mysql.createPool({ host, user, password, database, connectionLimit:10 });
```
Connection pool, not single connection — handles concurrent Socket.IO + REST traffic. `connectionLimit:10` because the demo target is ≤100 LAN users and each Socket.IO event borrows a connection for the duration of one query.

### 3.7 `setupDatabase()` — schema bootstrap
- All seven tables are created via `CREATE TABLE IF NOT EXISTS …`.
- Each `ALTER TABLE … ADD COLUMN …` is wrapped in `try{…}catch{}` so we can evolve the schema across runs without manual migrations. **This is the "migrations lite" pattern**: each shipped server has the right schema after one boot.
- `safeAlter` adds the seven performance/integrity indexes (composite `(conv_key, created_at)` for message history queries, single-column indexes for filtering admin views, `UNIQUE(group_id, user_id)` to stop double-membership rows).
- At the end: bcrypt-hashes the demo passwords and `UPSERT`s the demo admin + demo student so the seed is always consistent.
- Final line: `UPDATE users SET status='offline'` — resets every account to offline because a crash mid-session would have left rows marked "online" with no real socket behind them.

### 3.8 Auth middleware
```js
function verifyToken(req,res,next) {
  const auth = req.headers.authorization;
  …  req.user = jwt.verify(auth.replace('Bearer ',''), JWT_SECRET);
  next();
}
function adminOnly(req,res,next) { if (req.user?.role !== 'admin') return res.status(403)…; next(); }
```
- `verifyToken` runs on every authenticated REST route. Decoded JWT payload is attached to `req.user`.
- `adminOnly` chains after `verifyToken` for admin-only endpoints.

### 3.9 `/api/register`
- Validates name + email + password presence, password length ≥6.
- `bcrypt.hash(password, 10)` — bcrypt with 10 rounds. 10 is the sane default; ~100 ms per hash on commodity hardware, which is slow enough to defeat brute force without affecting UX.
- Account starts in `account_status='pending'` — must be approved by admin.
- Writes an audit log row.

### 3.10 `/api/login` and `/api/admin/login` — two separate flows
- `/api/login` is for students/faculty. Refuses `role='admin'` accounts.
- `/api/admin/login` is for admins. Refuses non-admins.
- Both reject `pending` and `rejected` accounts.
- Token expiry is **8 hours** (`expiresIn:'8h'`) — survives a full demo day plus prep.

**Panel hook:** "Why two endpoints?" → keeps admin auth audit trail separate; lets you change admin auth (e.g., 2FA later) without touching the user flow.

### 3.11 `/api/upload` — file message endpoint
- `verifyToken` first, then multer extracts the file.
- Decides `msgType` from `req.file.mimetype`:
  - `image/*` → `'image'`
  - everything else allowed → `'file'`
- Resolves the final `conv_key`. If the inbound key starts with `private_<email>`, calls `buildPrivateKey(req.user.email, targetEmail)` to canonicalize.
- INSERTs the message row, then emits `message:new` to the correct Socket.IO room.

### 3.12 Admin REST routes
- `GET /api/admin/stats` — totals + live online count from the in-memory `onlineUsers` Map (not the DB column — DB column lags).
- `GET /api/admin/pending` — `WHERE account_status='pending'`.
- `PUT /api/admin/users/:id/approve` — flips status; audit-log.
- `DELETE /api/admin/users/:id/reject` — manually NULL-out FK references in `messages`, `calls`, `audit_logs`, then `DELETE FROM users`. The FK definitions are `ON DELETE SET NULL` for messages/calls/audit_logs and `ON DELETE CASCADE` for group_members, so a child message stays in history but loses its sender link.
- `GET /api/admin/users`, `POST /api/admin/users`, `PUT /api/admin/users/:id`, `DELETE /api/admin/users/:id` — CRUD.
- `GET /api/admin/logs` — last 100 audit log rows.
- `GET /api/admin/messages` — last 200 messages, with `text` decrypted via `decryptMessage` for chat/announcement/system rows.

### 3.13 Survey routes
- `POST /api/survey` — **the only unauthenticated mutation in the system**. Anonymous-friendly. Validates `type` and `device` are present. Stores per-section means + the full `scores_json` so we can compute aggregates AND drill into each Likert question during Chapter 4 analysis.
- `GET /api/admin/survey` — returns rows + aggregate `avg_a/b/c/d/overall`.
- `GET /api/admin/survey/:id` — full row with parsed `scores`.
- `GET /api/admin/survey.csv` — proper CSV escape, `Content-Disposition: attachment`.

**Panel hook:** "Why is survey unauthenticated when everything else needs login?" → requiring a CICS account just to give feedback would skew the sample; LAN-only deployment limits spam exposure.

### 3.14 Socket.IO server
- `io.use((socket, next) => …)` — middleware that verifies the JWT on the handshake. Bad token → connection rejected.
- On `connection`: mark user online (DB + in-memory Map), broadcast updated user list, auto-join `group_general` (the broadcast channel).
- `groups:get` → fetches the user's groups, joins each `group_<id>` room.
- `messages:get` → returns the history of one conversation, decrypting chat/announcement/system rows.
- `message:send` → 1:1 OR group depending on the key prefix. Encrypts the text, INSERTs, then emits. Wrapped in try/catch; on DB error, emits `message:error` back to the sender.
- `broadcast:send` → admin-only, encrypts, INSERTs, emits to everyone.
- `typing:start/stop` → broadcasts to the room minus the sender.
- `group:create` → wrapped in a transaction (BEGIN/COMMIT/ROLLBACK) so a partial failure leaves no orphaned group.
- VoIP signaling: `call:initiate / accept / reject / end` plus `webrtc:offer / answer / ice-candidate` are pure relays — the server never carries audio.

### 3.15 `buildPrivateKey(emailA, emailB)`
```js
return 'private_' + (a < b ? a + '__' + b : b + '__' + a);
```
Sorting the emails alphabetically makes the conv_key deterministic. Both Alice's and Bob's clients compute the same key, so both query the same message history. **The defense panel might ask "what if Alice logs in from two browsers?"** → still the same key, so both browsers see the same conversation.

---

## 4. Front-end (`public/index.html`)

The chat app is a single-page application. Login screen and chat dashboard are two `<div>`s — login is shown, chat is hidden, and `login()` swaps them.

Key client-side patterns:
- **Token in localStorage** — survives reload.
- **Socket.IO auth handshake** — `io({auth:{token}})` sends the JWT.
- **In-memory `conversations` Map** keyed by `conv_key`. Updates on every `message:new`.
- **Notifications persisted per-user** to `localStorage` (`msukaip-notif-<email>`) so they survive logout/login.
- **WebRTC peer connection** built lazily on `call:accepted` (caller) or `webrtc:offer` (callee). Always uses Google STUN as a hint; on offline LAN, host candidates alone are enough.
- **Push-to-talk** uses MediaRecorder → blob → POST to `/api/upload/voice` — different from VoIP, this is record-and-send.

---

## 5. Database schema talking points

- 7 tables. See `ERD.md` for full detail.
- All `utf8mb4_unicode_ci` — full Unicode, including emojis.
- Foreign keys with `ON DELETE SET NULL` (messages/calls/audit_logs) keep history when a user is deleted. `ON DELETE CASCADE` (group_members) removes ghost memberships.
- Indexes: composite `(conv_key, created_at)` on messages because every history fetch filters AND orders on these two columns. `UNIQUE(group_id, user_id)` on group_members prevents double-add at the DB layer.
- `survey_responses` stores both per-section means AND the raw scores JSON, so any aggregate the panel wants in Chapter 4 — overall, per-section, per-question — is queryable.

---

## 6. The classic panel questions

| Question | One-line answer |
|---|---|
| "Why JWT and not sessions?" | Stateless — same token works for REST + Socket.IO without server-side session storage; scales horizontally. |
| "Why bcrypt rounds = 10?" | ~100 ms per hash on modern hardware. Defeats brute force without UX impact. Bcrypt is purpose-built for password hashing (memory + time hardness). |
| "Is AES-256-GCM overkill?" | No — capstone Section 1.3 Objective 3 mandates encrypted comms. GCM gives confidentiality + integrity in one operation and is FIPS 140 approved. |
| "How do you guarantee message ordering?" | Per-room ordering is preserved by Socket.IO's per-socket queue. Final order is the `created_at` timestamp in `messages` — what the history fetch ORDERs by. |
| "What if two users register the same email?" | `users.email` is `UNIQUE` — INSERT fails, route returns 409. |
| "What if VoIP STUN is unreachable on offline LAN?" | Same-subnet peers use host ICE candidates. Tested; works without internet on the same LAN segment. |
| "How do you prevent SQL injection?" | All queries use `mysql2` parameter binding (`db.query('… WHERE id=?',[id])`). No string concatenation anywhere. |
| "How do you handle uploads from malicious users?" | Mimetype allowlist (not blocklist), 5 MB cap, randomized filenames, served from a separate `/uploads/` URL path. No execution context. |
| "How would you scale to 1000 users?" | Two changes: split Socket.IO with a Redis adapter, and add a CDN for `/uploads/`. Database is already indexed for it. |
| "What happens if the server crashes mid-message?" | Three layers: (1) DB INSERT is atomic — partial messages don't exist. (2) Socket.IO retries the disconnected client. (3) On boot, `setupDatabase()` resets all users to `offline`. |
| "Why no migrations runner like Alembic / Knex?" | At this scale, idempotent `CREATE TABLE IF NOT EXISTS` + `try/catch ALTER TABLE` is simpler than a separate runner. If we cross 30+ schema changes we'd switch. |
| "Why a separate `survey_responses` table instead of reusing `audit_logs`?" | Audit logs are user-action history. Survey responses are research data with strict structure (Likert means as DECIMAL, response date, etc.). Different lifecycle. |
| "How do you know it works on the LAN?" | `npm run preflight` checks env + DB + LAN IP + firewall command. §7 of DEPLOYMENT.md is a 13-step smoke-test checklist. |

---

## 7. Demo-day script

1. Open admin: `http://localhost:3000/admin.html` → log in. Show dashboard.
2. In another browser tab/window: register a new account → admin tab shows it under Pending → click Approve.
3. Log in as the newly approved user → send a message to "Global Chat".
4. From the admin browser, log out and log in as student → reply.
5. Upload a small PDF/image.
6. Record a voice message (push-to-talk).
7. Create a group (pick 2 members).
8. Place a 1:1 voice call.
9. Place a group voice call.
10. Open the admin dashboard's Feedback tab → show the existing responses + click View on one.
11. Show the encryption — open MySQL Workbench, `SELECT id, conv_key, type, text FROM messages WHERE type='chat' LIMIT 5;` — point at the `iv:authTag:ciphertext` format.

---

## 8. Files to point at when the panel asks "where is X?"

| Concern | File | Roughly |
|---|---|---|
| AES encryption | `server.js` | lines ~50–75 |
| JWT sign/verify | `server.js` | lines ~140 (login) and 410 (socket middleware) |
| Bcrypt password hash | `server.js` | `/api/register`, `/api/login`, `/api/admin/users` |
| Schema bootstrap | `server.js` `setupDatabase()` | lines ~94–140 |
| Socket.IO message send | `server.js` `socket.on('message:send', …)` | lines ~470–510 |
| WebRTC signaling relay | `server.js` `webrtc:offer/answer/ice-candidate` | lines ~545–550 |
| Frontend login | `index.html` `login()` | line ~641 |
| Frontend WebRTC | `index.html` `startWebRTC()` | line ~894 |
| Audit log writer | `server.js` `INSERT INTO audit_logs` | scattered after each admin action |
| Survey POST | `server.js` `app.post('/api/survey', …)` | search for `/api/survey` |

---

## 9. If anything goes wrong on demo day

Open `DEBUGGING.md`. Every error message listed there is something we hit and solved during build, so the fix is one paragraph away.
