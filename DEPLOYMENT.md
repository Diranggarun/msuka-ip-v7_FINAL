# MSUkaIP — LAN Deployment Guide

End-to-end instructions to get the chat + VoIP system running on a CICS LAN for
the capstone demo. Target host: any Windows 10/11 laptop or desktop with
Node.js 18+ and MySQL 8 installed.

---

## 1. Prerequisites (one-time, on the server host)

| Tool | Tested version | Install link |
|------|----------------|--------------|
| Node.js | 18.x or 20.x LTS | https://nodejs.org/en/download |
| MySQL Server | 8.0+ | https://dev.mysql.com/downloads/installer/ |
| Modern browser on every client | Chrome 120+ / Edge 120+ | Required for WebRTC + `getUserMedia` |

Verify after install:

```powershell
node --version
npm --version
mysql --version
```

---

## 2. Database setup

Open MySQL Shell or MySQL Workbench and create the schema:

```sql
CREATE DATABASE IF NOT EXISTS msukaip
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

You do **not** need to create tables manually — `server.js` runs `CREATE TABLE
IF NOT EXISTS` on every start and seeds two demo accounts:

- `admin@cics.msu.edu` / `admin123` (Admin dashboard only)
- `student@cics.msu.edu` / `student123` (Chat app)

If you use a non-root MySQL user, grant it ALL on `msukaip.*` and put the
credentials in `.env` (next step).

---

## 3. Install and configure

```powershell
cd msuka-ip-v7
npm install
Copy-Item .env.example .env
notepad .env
```

> **Offline machine?** `npm install` is the only step that needs internet.
> Run it once on any connected machine, then copy the entire `msuka-ip-v7`
> folder (including `node_modules/`) to the server via USB. Nothing else is
> downloaded at runtime: the database is Node's built-in SQLite (no native
> modules), socket.io serves its own client script, all fonts/images are
> local, and the TLS certificate is generated locally on first start.

Fill in `.env`:

```
JWT_SECRET=<paste 48+ random chars>
AES_SECRET=<paste another 48+ random chars>
AES_SALT=<paste 16+ random chars>
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=<your MySQL root password>
MYSQL_DATABASE=msukaip
PORT=3000
```

Generate strong secrets in PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | %{ Get-Random -Maximum 256 }))
```

**Important — rotating `AES_SECRET` or `AES_SALT` after messages exist will
make older encrypted messages unreadable.** Set these once, before going live.

---

## 4. Start the server

```powershell
npm start
```

Expected startup output:

```
🔧  .env loaded
🔐  AES-256-GCM encryption initialized
✅  MySQL connected
✅  Tables ready
✅  All users reset to offline
🚀  MSUkaIP: http://localhost:3000
🛡️   Admin:   http://localhost:3000/admin.html
```

If `JWT_SECRET` / `AES_SECRET` are missing, you'll see a warning telling you
to set them — do not demo without setting real values.

---

## 5. Expose to the LAN

Find the server host's LAN IP:

```powershell
ipconfig | findstr IPv4
```

Open Windows Firewall for inbound TCP on the chosen port (default 3000):

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "MSUkaIP 3000" -Direction Inbound `
  -Protocol TCP -LocalPort 3000 -Action Allow
```

From any client laptop on the same LAN, open:

```
http://<server-lan-ip>:3000/          ← chat app (students/faculty)
http://<server-lan-ip>:3000/admin.html ← admin dashboard
```

---

## 6. Browser requirements for VoIP

WebRTC's microphone access (`getUserMedia`) only works in a **secure context**.
The server now handles this itself: alongside HTTP on port 3000 it serves
**HTTPS on port 3443** (configurable via `HTTPS_PORT`) with a self-signed
certificate auto-generated into `certs/` on first run.

**Demo-day setup:** client laptops open `https://<server-lan-ip>:3443` and
accept the browser's certificate warning once (Advanced → Proceed). That's it —
mic access, calls, group calls and push-to-talk all work. The startup log
prints the exact URL to share.

Fallbacks if HTTPS is somehow unavailable:

1. **Run all participants on the same host** — `http://localhost:3000` is
   exempt from the secure-context rule.
2. **Enable the Chrome flag** on each client laptop:
   `chrome://flags/#unsafely-treat-insecure-origin-as-secure` →
   add `http://<server-lan-ip>:3000` → relaunch.

If a client lands on the plain-HTTP LAN URL and taps a voice feature, the app
now shows an alert pointing them at the HTTPS URL instead of a misleading
"microphone denied" error.

No STUN/TURN server is configured (`iceServers` is empty) — WebRTC peers on
the same LAN exchange host candidates directly, so calls work on a fully
offline network.

---

## 7. Smoke-test checklist (run before defense)

- [ ] Server starts, no `⚠️` warning about dev secrets.
- [ ] Admin login at `/admin.html` succeeds, dashboard loads stats.
- [ ] Student demo login at `/` succeeds.
- [ ] Send a chat message in **General** — appears for a second connected user.
- [ ] Send a private 1-on-1 message — only target sees it.
- [ ] Upload an image and a PDF — both render correctly in chat.
- [ ] Record and send a voice note — playback works.
- [ ] Create a group with 2 members — both see it in their sidebar.
- [ ] 1-on-1 voice call — caller ➜ ring ➜ accept ➜ both hear each other ➜ hangup.
- [ ] Group voice call — 3 participants hear each other.
- [ ] Admin approves a pending registration — user can now log in.
- [ ] Admin broadcasts an announcement — every connected client sees it.
- [ ] Restart `npm start` — all users reset to offline, no stale state.

---

## 8. Backup and recovery

Before demo day:

```powershell
mysqldump -u root -p msukaip > msukaip-backup.sql
Compress-Archive -Path msuka-ip-v7\public\uploads -DestinationPath uploads.zip
```

Restore:

```powershell
mysql -u root -p msukaip < msukaip-backup.sql
Expand-Archive uploads.zip -DestinationPath msuka-ip-v7\public\
```

---

## 9. Common issues

| Symptom | Cause / fix |
|---------|-------------|
| `❌ DB failed: ER_ACCESS_DENIED_ERROR` | Wrong `MYSQL_PASSWORD` in `.env`. |
| `EADDRINUSE :::3000` | Port already in use. Change `PORT` in `.env` or stop the other process. |
| Clients can connect to chat but mic is blocked | Browser secure-context rule — see §6. |
| Old messages show as gibberish | `AES_SECRET` / `AES_SALT` was changed after messages were stored. Restore the previous values. |
| Call rings but no audio | Check that both participants granted mic permission; verify firewall isn't blocking peer-to-peer UDP on the LAN. |
| Admin cannot log in at `/` | By design — admin must use `/admin.html`. |

---

## 10. After the demo

Feedback link (already built): `http://<server-lan-ip>:3000/feedback.html` — also reachable from the chat sidebar's **Feedback** button.

Export results from the `audit_logs` and `messages` tables for the
capstone evaluation chapter.
