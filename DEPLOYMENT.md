# MSUkaIP — LAN Deployment Guide

End-to-end instructions to get the chat + VoIP system running on a CICS LAN for
the capstone demo. Target host: any Windows 10/11 laptop or desktop with
**Node.js 22.5+** installed. No database server is required.

---

## 1. Prerequisites (one-time, on the server host)

| Tool | Tested version | Install link |
|------|----------------|--------------|
| Node.js | **22.5+** (required — the app uses the built-in `node:sqlite` module) | https://nodejs.org/en/download |
| Modern browser on every client | Chrome 120+ / Edge 120+ | Required for WebRTC + `getUserMedia` |

Verify after install:

```powershell
node --version   # must be v22.5.0 or higher
npm --version
```

> **No MySQL / XAMPP needed.** The database is an embedded SQLite file driven by
> Node's built-in `node:sqlite`. There is no service to install, start, or secure.

---

## 2. Database setup

**There is nothing to do in this step.** The database is a single file created
automatically on first start at `msuka-ip-v7/msukaip.db`.

On every boot, `server.js` runs `CREATE TABLE IF NOT EXISTS` for all seven
tables and (outside production) seeds two demo accounts:

- `admin@cics.msu.edu` / `admin123` (Admin dashboard only)
- `student@cics.msu.edu` / `student123` (Chat app)

> **Production note:** when `NODE_ENV=production`, demo-account seeding is
> skipped and the server refuses to boot with the built-in dev secrets. Set real
> `JWT_SECRET` / `AES_SECRET` values in `.env` (next step), or force the demo
> accounts for a supervised defense run with `SEED_DEMO=1`.

To move the database elsewhere, set `SQLITE_PATH` in `.env`. To inspect schema
and integrity at any time: `node db-audit.js`.

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
PORT=3000
# Optional — defaults to msuka-ip-v7/msukaip.db
#SQLITE_PATH=./msukaip.db
# Uncomment for a real deployment (refuses dev secrets, skips demo seeding)
#NODE_ENV=production
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
✅  SQLite ready: ...\msuka-ip-v7\msukaip.db
✅  Tables, indexes & integrity constraints ensured
🔄  Reset:   admin@cics.msu.edu / admin123
🔄  Reset:   student@cics.msu.edu / student123
✅  All users reset to offline
🚀  MSUkaIP: http://localhost:3000
🛡️   Admin:   http://localhost:3000/admin.html
```

The two `🔄 Reset` lines are the demo accounts being re-seeded — they disappear
once `NODE_ENV=production` is set.

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

Before demo day, run the built-in backup helper:

```powershell
cd msuka-ip-v7
npm run backup
```

This writes a timestamped snapshot into `msuka-ip-v7/backups/`:

- `db-<timestamp>.db` — the full SQLite database, taken with `VACUUM INTO` so
  it is a consistent copy **even while the server is running**
- `uploads-<timestamp>.zip` — the encrypted uploads folder

Restore is a file copy — stop the server first:

```powershell
Copy-Item backups\db-<timestamp>.db msukaip.db -Force
Expand-Archive backups\uploads-<timestamp>.zip -DestinationPath . -Force
```

> Restore the **uploads archive together with the database** from the same
> timestamp. Files are encrypted with `AES_SECRET`/`AES_SALT`, so a restore into
> an install with different secrets will not decrypt.

---

## 9. Common issues

| Symptom | Cause / fix |
|---------|-------------|
| `SQLITE_BUSY` / `database is locked` | Another process has the DB open (e.g. `db-audit.js` or a SQLite viewer). WAL + a 5 s busy timeout normally absorb this — close the other tool and retry. |
| `Cannot find module 'node:sqlite'` | Node is older than 22.5. Check `node --version` and upgrade. |
| Server exits immediately with a secrets error | `NODE_ENV=production` with the built-in dev secrets. Set real `JWT_SECRET`/`AES_SECRET` in `.env`. |
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
