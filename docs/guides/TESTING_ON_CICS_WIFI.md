# MSUkaIP — Testing Guide on CICS Wi-Fi

This guide walks you through deploying and testing MSUkaIP on the College of
Information and Computing Sciences (CICS) Wi-Fi network. Follow each step in
order. Estimated setup time: 10–15 minutes.

---

## Step 1 — Pick the "host" laptop

One machine runs the Node server. Everyone else connects to it as a client.
Choose the most reliable laptop and keep it powered on throughout the testing
session.

> No XAMPP or MySQL is involved — the database is an embedded SQLite file that
> the server opens on its own. The host only needs Node.js 22.5+.

## Step 2 — Connect the host laptop to CICS Wi-Fi

Make sure the host laptop is on the same Wi-Fi SSID that the testers will
join. Both the server and the clients must be on the same network.

## Step 3 — Find the host's LAN IP address

On the host laptop, open **Command Prompt** and run:

    ipconfig

Look under your Wi-Fi adapter for **IPv4 Address**, for example:

    IPv4 Address. . . . . . . . . . . : 192.168.1.42

Write this address down. Testers will use it to connect.

## Step 4 — Allow Node through Windows Firewall (one-time)

Open **PowerShell as Administrator** and run:

    New-NetFirewallRule -DisplayName "MSUkaIP 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Domain

If Windows shows a firewall prompt when Node starts, tick **Private networks**
and click Allow.

## Step 5 — Start the services on the host

1. Open a Command Prompt in the project folder and run:

       cd C:\Users\diran\OneDrive\Desktop\msuka-ip-v7_Final\msuka-ip-v7
       npm start

2. Wait until the console prints:

       SQLite ready: ...\msukaip.db
       MSUkaIP: http://localhost:3000

   Leave this terminal window open.

## Step 6 — Verify on the host

In a browser on the host laptop, open:

- `http://localhost:3000` — should load the login page
- `http://<host-IP>:3000` (the address from Step 3) — should also load

If both load successfully, the server is reachable on the LAN.

## Step 7 — Test from a second device

On a classmate's phone or laptop **connected to the same CICS Wi-Fi**:

1. Open a browser.
2. Type `http://<host-IP>:3000` (e.g. `http://192.168.1.42:3000`).
3. Log in with the default account:
   - Email: `student@cics.msu.edu`
   - Password: `student123`
4. Or register a new account using an institutional email
   (`@cics.msu.edu`, `@s.msumain.edu.ph`, or `@msumain.edu.ph`).

## Step 8 — Test the full feature set

With at least two devices logged in, verify:

- Send text messages between accounts.
- Send an image (must be under 5 MB).
- Send a PDF or DOCX file (must be under 5 MB).
- Start a voice call. Allow microphone access when the browser asks.
- Create and use a group chat.
- Log in as administrator at `http://<host-IP>:3000/admin.html`
  - Email: `admin@cics.msu.edu`
  - Password: `admin123`

## Step 9 — Scaling test (toward 100 concurrent users)

For the Likert survey with 30 respondents:

- Have multiple testers join simultaneously on the same Wi-Fi.
- Monitor the server console on the host laptop. Each successful client login
  prints a "connected" line.
- Watch for lag, dropped messages, or call-quality degradation.
- Have respondents complete the survey at
  `http://<host-IP>:3000/feedback.html` after using the system.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Testers see "site can't be reached" | Windows Firewall is blocking port 3000. Redo Step 4. |
| Host IP changes each day | Re-run `ipconfig` and share the new IP, or ask CICS IT for a DHCP reservation. |
| Console shows `DB failed` on startup | Check the error text. `Cannot find module 'node:sqlite'` means Node is older than 22.5 — upgrade it. `database is locked` means another tool has `msukaip.db` open — close it. |
| Voice call fails between devices | Both peers must be on the same Wi-Fi subnet. Verify with `ipconfig`. |
| Browser blocks microphone | Use `http://<host-IP>:3000` directly (private IPs are treated as secure). Avoid `localhost` on remote devices. |
| Login page loads but cannot submit | The host laptop went to sleep or the server process stopped. Wake the laptop and restart `npm start`. If it returns `429`, the login rate limiter tripped after 5 failed attempts — wait 15 minutes or use a different account. |
| Testers on the same Wi-Fi cannot reach the host even with the correct IP | The Wi-Fi has **AP/client isolation** enabled. Ask CICS IT to disable client isolation on that SSID — otherwise no LAN application will work between devices. |

---

## Testing on LinkCode (CICS student Wi-Fi)

LinkCode is run by the LinkCode Student Council, not by the project. Do not
change its switch or gateway yourself — ask its administrator.

**How it is built**

| Smart-switch port | Connected to |
| --- | --- |
| 1–2 | Internet uplinks (ISP 1, ISP 2) |
| 3 | OpenWrt captive-portal gateway (voucher login; routes all traffic) |
| 4–8 | Access points, each on its own VLAN |

**Why MSUkaIP fails there:** LinkCode enforces **client isolation** on the
access points and the gateway firewall. Each device can reach only the gateway
and the internet, so phones cannot reach the server laptop, and phones cannot
reach each other (which voice calls need — there is no TURN relay by design).
Confirmed 2026-08-11: the laptop reached the gateway, but no other client
answered.

**What to ask the LinkCode administrator for**

| Request | Chat, files, survey | Voice calls |
| --- | --- | --- |
| A. Dedicated VLAN: one switch port + one AP/SSID, no captive portal, no client isolation | Yes | Yes |
| B. Firewall exception: reserved IP for the server laptop, voucher bypass (MAC whitelist), all client VLANs allowed to reach it on TCP 3000 and 3443 | Yes | No |

Give them the laptop's Wi-Fi MAC address (`getmac /v`). Once it is set up,
restart the server so the HTTPS certificate covers the new IP, then open
`https://<server-ip>:3443` from a phone on LinkCode.

**Recommended: wired server on a dedicated VLAN + DHCP reservation**

Plugging the laptop into a switch port does nothing by itself — the port's
VLAN decides what it joins. An AP VLAN port keeps the captive portal and
isolation; ports 1–3 (uplinks, gateway) must never be used, as that breaks
LinkCode for everyone. All 8 ports are in use, so the admin must free one or
add a small switch.

Admin steps (example VLAN 50 "MSUkaIP"):

1. Create VLAN 50 on the smart switch.
2. Laptop port: VLAN 50 untagged (access). Gateway port 3 and one AP port:
   VLAN 50 tagged, alongside the existing VLANs.
3. OpenWrt gateway: new VLAN 50 interface with DHCP, no captive portal, and
   forwarding allowed within the zone.
4. That AP: new SSID (e.g. "MSUkaIP-Demo") on VLAN 50, client isolation OFF.
5. DHCP reservation: bind the laptop's Ethernet MAC to one fixed IP.

Then: plug in by Ethernet cable, run `ipconfig` (Ethernet IPv4), restart the
server (`npx pm2 restart msukaip`), and have phones join MSUkaIP-Demo and open
`https://<that-ip>:3443`. Test a message, a file, and a call between two phones.

**Static IP — what it does and does not fix**

| | Dedicated VLAN | Static IP (DHCP reservation) |
| --- | --- | --- |
| Removes client isolation | Yes | No |
| Address never changes (bookmarks, HTTPS cert stay valid) | No | Yes |
| Needed for the system to work | Yes | No, convenience |

Do both. If only one is possible, choose the VLAN — a static IP alone changes
nothing while isolation is on. Prefer a DHCP reservation set by the admin over
a manually typed static IP on the laptop: a guessed address can clash with
another device, and the voucher system may still block it. On the laptop's
Windows Mobile hotspot the address is already fixed at `192.168.137.1`.

**If neither is possible:** use the laptop's Windows Mobile hotspot
(phones join it and open `https://192.168.137.1:3443`) or a phone hotspot with
mobile data off. Both give a true offline LAN with no isolation.

---

## Tips

- Set the host laptop's power plan to **Never sleep** while plugged in.
- All testers must be on the **same Wi-Fi SSID** as the host.
- Bookmark `http://<host-IP>:3000` on each tester's device.
- Keep the Node console window open during the entire session; closing it
  stops the server.
- File transfers are capped at **5 MB**. Allowed types: JPEG, PNG, GIF, WebP,
  PDF, DOC, DOCX.

---

## Default credentials (reset on every server start)

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@cics.msu.edu` | `student123` |
| Admin | `admin@cics.msu.edu` | `admin123` |

Change these before any real deployment.

---

## Project objectives covered by this test

This test plan exercises the system against the project's stated objectives:

1. **LAN-only operation** — verified by Step 7 (no internet required after
   server is up).
2. **Real-time messaging and voice via WebRTC** — verified by Step 8.
3. **AES-256 encryption** — applied automatically to all stored messages.
4. **Institutional email authentication** — enforced at registration.
5. **5 MB file cap and approved document types** — enforced by the server.
6. **Up to 100 concurrent users** — exercised in Step 9.
7. **Likert-scale usability survey (30 respondents)** — collected via
   `/feedback.html`.
