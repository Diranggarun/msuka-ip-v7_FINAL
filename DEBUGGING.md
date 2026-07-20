# Known Errors and Fixes

> Brief symptom → root cause → fix.
> Add a new section whenever you solve a non-obvious problem during the build.

The stack is **Node.js + Express + Socket.IO + MySQL + vanilla HTML/JS**. Anything mentioning Python/FastAPI/Vite from older notes is no longer relevant.

---

## Environment & startup

### `⚠️ Using built-in dev secrets — set JWT_SECRET and AES_SECRET …`
**Cause:** No `.env` file in `msuka-ip-v7/`, so the server fell back to hard-coded development secrets.
**Fix:** `Copy-Item .env.example .env` inside `msuka-ip-v7/`, fill in strong `JWT_SECRET`, `AES_SECRET`, `AES_SALT`, then restart. The warning disappears.
**Important:** Once you set `AES_SECRET` / `AES_SALT`, never rotate them — older encrypted messages would become unreadable.

### `ER_ACCESS_DENIED_ERROR: Access denied for user 'root'@'localhost'`
**Cause:** Wrong `MYSQL_PASSWORD` in `.env` (or empty when your MySQL needs one).
**Fix:** Verify with `mysql -u root -p` first. Set the matching password in `.env` and restart `npm start`.

### `EADDRINUSE :::3000`
**Cause:** Another process is already on port 3000 (probably a previous `npm start` that didn't quit).
**Fix:**
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
Or change `PORT=3001` in `.env`.

### Server crashes on boot with `Unknown database 'msukaip'`
**Cause:** MySQL is running but the schema database wasn't created.
**Fix:** `CREATE DATABASE IF NOT EXISTS msukaip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;` then restart. Tables are created automatically by `setupDatabase()`.

---

## Socket.IO

### Client connects then immediately disconnects with `Auth required`
**Cause:** No JWT token passed in the socket handshake.
**Fix:** Confirm `io({ auth:{ token: currentUser.token } })` is being called after login. Inspect DevTools → Network → WS → Frames to confirm the auth payload is non-empty.

### `Invalid token` error after browser was left open overnight
**Cause:** JWT expires after 8 hours.
**Fix:** Log out and back in. To extend, change `expiresIn` in `jwt.sign(...)` inside `server.js` (currently `'8h'`).

### Messages sent but never delivered to the recipient
**Checklist:**
1. Is the recipient's socket connected? (`socket.connected === true` in their browser).
2. For 1:1, both clients must compute the **same** `conv_key`. Check `buildPrivateKey(emailA, emailB)` — emails are sorted alphabetically so the order they're passed in doesn't matter.
3. For groups, both clients must be in the same `group_<id>` room. Server's `groups:get` handler joins them automatically on connection.
4. Check server log for a `Send error: ...` line — if the DB write throws, server now emits `message:error` back to the sender.

### `message:error` toast appears in client
**Cause:** Server's INSERT into `messages` failed (usually a malformed `conv_key` or DB lock).
**Fix:** Check server console for the actual error. Most commonly fixed by retrying. If it persists, run `node db-audit.js` to inspect schema state.

---

## WebRTC (VoIP)

### `Voice features are blocked on this address…` alert
**Cause:** Browser blocks `getUserMedia` on non-secure origins — the page was opened via plain `http://<lan-ip>:3000`.
**Fix:** Open the app at `https://<server-ip>:3443` and accept the self-signed-certificate warning once. The server generates the cert into `certs/` automatically and prints the URL at startup (see `DEPLOYMENT.md` §6). On the server host itself, `http://localhost:3000` also works.

### `Microphone permission denied` alert
**Cause:** The user (or a site setting) actually denied mic permission.
**Fix:** Click the lock/mic icon in the address bar, allow the microphone, retry.

### Call connects but no audio
**Checklist:**
1. Both participants must have granted mic permission — check the address bar 🎤 icon.
2. Inspect `peerConnection.iceConnectionState` in DevTools — should reach `connected` or `completed`. Stuck on `checking` means ICE failure.
3. No STUN server is configured (`iceServers` is empty) — peers rely on host candidates, so both clients must be on the same subnet (same `/24`).
4. Check `peerConnection.getSenders()` — both should have an audio track.

### Audio works one direction only
**Cause:** Only one side called `getUserMedia` + `addTrack` before negotiation.
**Fix:** In `index.html`, both `startCall()` and `acceptCall()` must `await getUserMedia` and store `localStream` BEFORE the `webrtc:offer/answer` round-trip.

---

## File uploads

### `Max 5MB allowed`
**Cause:** The multer limit in `server.js` rejects files larger than 5 MB.
**Fix:** Intentional (per capstone scope). To raise, bump `fileSize:5*1024*1024` in the `multer` config.

### `File type not allowed`
**Cause:** The mimetype isn't in the allowlist (JPEG, PNG, GIF, WebP, PDF, DOC, DOCX).
**Fix:** Add the mimetype to the `ALLOWED` array in `server.js`. Be careful not to allow `application/octet-stream` (would defeat the purpose).

### Upload succeeds but file 404s when downloaded
**Cause:** Files saved to `public/uploads/` but the directory isn't there (gitignored or deleted between runs).
**Fix:** `setupDatabase()` doesn't create this folder — it's created lazily at the top of `server.js` (`fs.mkdirSync(UPLOAD_DIR, {recursive:true})`). Verify the folder exists and has write permission.

---

## Authentication

### Newly registered user gets "Account pending admin approval"
**Cause:** This is by design — every registration starts as `account_status='pending'`. An admin must approve via the dashboard.
**Fix:** Log in at `/admin.html` as admin and click Approve on the Pending tab.

### Admin tries to log in at `/` (chat) and gets 403
**Cause:** Intentional — admins must use `/admin.html`, students/faculty use `/`. The `/api/login` route blocks `role='admin'`, and `/api/admin/login` blocks non-admins.
**Fix:** Use the right URL.

---

## Database

### `Duplicate entry 'X-Y' for key 'uq_group_members'`
**Cause:** Trying to add a user to a group they're already in. The `UNIQUE(group_id, user_id)` index (added 2026-05-14) prevents the duplicate row.
**Fix:** Expected — the `group:create` handler now uses `INSERT IGNORE` so this no longer surfaces to the client.

### Old chat messages decrypt to gibberish after deployment
**Cause:** `AES_SECRET` or `AES_SALT` changed between the time the messages were written and now. `crypto.scryptSync` derives a different key, so decryption fails the auth tag and the soft-fail returns the raw ciphertext.
**Fix:** Restore the previous values in `.env`. If the previous values are lost, the messages are unrecoverable — set new values once and never rotate.

### Server log: `index note: Duplicate key name 'idx_…'`
**Cause:** Index already exists; `safeAlter` swallows it.
**Fix:** Cosmetic, ignore. Indexes are idempotent.

---

## Frontend / UI

### Changes don't show up after editing HTML/CSS
**Cause:** Browser cache.
**Fix:** **Ctrl + Shift + R** to bypass cache. If that doesn't help, open DevTools → Network → check "Disable cache" → reload.

### Notifications panel is empty after refresh
**Cause:** The panel reads from in-memory `notifList` which is reset on page load.
**Fix:** Notifications are persisted to `localStorage` per user (`msukaip-notif-<email>`) and reloaded after login. If you log out and back in, the list comes back.

### Red notification badge count is stuck
**Cause:** Old read state in localStorage. After clicking Mark all read, the badge should clear immediately.
**Fix:** If stuck, open DevTools → Application → Local Storage → delete the `msukaip-notif-<email>` key and reload.

---

## Adding new entries

When you hit a new error and solve it, add a section using this format:

```
### <Exact error message or short symptom>
**Cause:** <what was actually wrong>
**Fix:** <commands or code that resolved it>
```

Keep entries scannable. If a fix needs more than ~10 lines, link to a longer explanation in the relevant file's comments or in `DECISIONS.md`.
