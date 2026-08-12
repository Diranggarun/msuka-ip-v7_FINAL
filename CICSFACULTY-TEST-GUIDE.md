# Testing MSUkaIP on CICSFaculty — offline field guide

**Read this on the laptop. Claude cannot help you while you are on CICSFaculty,
because that network has no internet.** Everything you need is in this file.

CICSFaculty having no internet is not a problem — MSUkaIP never uses the
internet. No CDNs, no external fonts, no STUN/TURN servers. A working demo on a
network with no ISP is exactly the claim Chapter 4 makes, so **screenshot the
"No internet" indicator** on both devices. That is evidence, not an error.

---

## Part 1 — Laptop setup

### Step 1. Forget the old network

Windows keeps jumping back to `DIS@CICS LinkCode 1` because it is open and has
internet. It will do this mid-demo if you let it.

Settings → Network & internet → Wi-Fi → **Manage known networks** →
`DIS@CICS LinkCode 1` → **Forget**

### Step 2. Connect to CICSFaculty

Wifi icon → **CICSFaculty** → tick **Connect automatically** → **Connect** →
enter the WPA2 password.

Windows will say **"No internet, secured"**. That is correct and expected. Do
not let Windows talk you into switching back.

If it asks *"Do you want your PC to be discoverable on this network?"* →
answer **Yes**.

### Step 3. Confirm you are actually on it

Open PowerShell and run:

```
netsh wlan show interfaces
```

Look for `SSID : CICSFaculty` and `State : connected`. If it still says
`DIS@CICS LinkCode 1`, Step 1 did not take — go back and forget it again.

### Step 4. Find your IP address

```
ipconfig
```

Find the block named **Wireless LAN adapter Wi-Fi** and read its **IPv4
Address**. It should look like `192.168.89.134`.

**Write it here: ____________________**

Ignore these — they are not your wifi:
- `192.168.56.1` — VirtualBox adapter
- anything starting `169.254.` — means DHCP failed, reconnect

### Step 5. Start the server

```
cd C:\Users\diran\OneDrive\Desktop\msuka-ip-v7_Final\msuka-ip-v7
node server.js
```

Wait for the final lines. The server now prints **every** address with its
adapter name, so pick the one marked `(Wi-Fi)`:

```
🔐  Voice calls from LAN clients — use the address on your wifi adapter:
      https://192.168.56.1:3443    (Ethernet 2)     ← WRONG, VirtualBox
      https://192.168.89.134:3443  (Wi-Fi)          ← THIS ONE
```

You should also see `🔐  Generated self-signed TLS certificate` listing your new
IP. That regeneration is why the server must be started *after* joining
CICSFaculty — a certificate made for the old network will fail on the phone.

**Leave this window open.** Closing it stops the server.

### Step 6. Prove it works on the laptop first

Open a browser on the laptop:

```
https://<your-ip>:3443
```

Click through the certificate warning (Advanced → Proceed). If the login page
does not appear here, **stop** — nothing else will work until it does. Jump to
Troubleshooting.

---

## Part 2 — Phone setup

### Step 7. Connect the phone to CICSFaculty

- Same network, same password
- **Turn mobile data OFF** — this is essential. When wifi has no internet,
  phones silently fall back to cellular and will never see your laptop.
- The phone will warn about no internet. Choose to **stay connected**
  (Android: "Yes"/"Keep"; iPhone: ignore the warning).

### Step 8. Check the phone got the right address

Settings → Wi-Fi → tap **CICSFaculty** → read the **IP address**.

**It must start with `192.168.89.`** — same first three numbers as the laptop.

**Write it here: ____________________**

- Starts with `192.168.89.` → you are on the same network. Continue.
- Starts with anything else → wrong network, rejoin.
- Starts with `169.254.` → no address received, forget the network and rejoin.

### Step 9. Test plain HTTP first

On the phone, type this exactly — `http`, port `3000`, no `s`:

```
http://<laptop-ip>:3000
```

This has no certificate warning, so it tests one thing only: can the phone
reach the laptop at all.

- **Login page appears** → the network works. Go to Step 10.
- **Fails** → go to Troubleshooting, section B.

### Step 10. Switch to HTTPS for the real demo

```
https://<laptop-ip>:3443
```

Certificate warning → **Advanced** → **Proceed to … (unsafe)**.
Android may say *"Continue to site (unsafe)"*. If there is no proceed link at
all, type `thisisunsafe` while the warning is on screen.

**Use HTTPS for everything from here.** Browsers only grant microphone access on
a secure origin — voice calls and voice messages fail silently on port 3000.

---

## Part 3 — The smoke test — screenshot every step

These become your Chapter 4 figures.

Demo logins:
- `student@cics.msu.edu` / `student123` — chat only
- `admin@cics.msu.edu` / `admin123` — admin portal only

| # | Step | What it proves |
|---|---|---|
| 1 | Register a new account on the phone | Account lands as pending |
| 2 | Approve it from the admin dashboard on the laptop | Approval workflow |
| 3 | Log in on the phone | Two-tier login, student portal |
| 4 | Send text both ways in Global Chat | Real-time messaging |
| 5 | Send an image | File pipeline, encrypted at rest |
| 6 | Send a PDF or DOCX | Document sharing, 5 MB cap |
| 7 | Hold the mic button, send a voice message | Push-to-talk |
| 8 | **1:1 voice call, confirm audio both ways** | The objective with no evidence yet |
| 9 | Send a broadcast from the admin dashboard | Admin announcement |
| 10 | Open Login Monitor, expand a card | Audit and monitoring |

Admin dashboard: `https://<laptop-ip>:3443/admin.html`
Feedback survey:  `https://<laptop-ip>:3443/feedback.html`

**Step 8 matters most.** Voice is your only specific objective with nothing
behind it in the evidence table. Do it before you run out of time or helpers.

### Collect survey responses while people are standing there

Send them to `https://<laptop-ip>:3443/feedback.html`. Watch the count climb in
the admin dashboard under Feedback. The survey table is empty and ready — every
response you collect is real.

---

## Part 4 — Troubleshooting

### A. Laptop itself cannot open the page

**Server exited.** Read the message in the terminal.
- Mentions dev secrets → `NODE_ENV` is set to production. Run `$env:NODE_ENV=''`
  then start again.
- Says `EADDRINUSE` → an old server is still running:

```
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Wrong address.** You used the VirtualBox address. Use the one the server
labelled `(Wi-Fi)`.

### B. Phone cannot reach the laptop

Work through these in order.

1. **Is mobile data off?** Single most common cause. Turn it off.
2. **Is the phone's IP `192.168.89.x`?** (Step 8.) If not, it is not on this
   network.
3. **Is the laptop still on CICSFaculty?** Run `netsh wlan show interfaces`
   again — Windows may have hopped back to a network with internet.
4. **Did the laptop's IP change?** DHCP can reassign it. Re-run `ipconfig`; if
   it changed, restart the server so the certificate is rebuilt.
5. **Test from the laptop toward the phone.** Using the phone's IP from Step 8:

```
ping 192.168.89.XXX
```

   - **Replies** → the network carries traffic between devices. The problem is
     the address or port you typed on the phone, not the network.
   - **No replies** → could be the phone's own firewall dropping ping, which is
     normal, so this alone is not proof. But combined with Step 9 failing, it
     points to client isolation on the access point.

6. **If everything above checks out and it still fails**, the access point is
   enforcing **client isolation** — it refuses to pass traffic between wifi
   clients. This is AP configuration; no change on your laptop can defeat it.
   This is exactly what `DIS@CICS LinkCode 1` was doing. Go to Part 5.

### C. Call connects but there is no audio

Open DevTools on the laptop (F12) and check `iceConnectionState`.
- Stuck on `checking` → the two devices cannot reach each other directly.
  There is no STUN server by design, so peers must be directly reachable.
- Reaches `connected` but silence → check the phone is not muted and that the
  browser was granted microphone permission (HTTPS only).

### D. Microphone permission never appears

You are on `http://`. Switch to `https://` on port 3443.

---

## Part 5 — Fallback: phone hotspot

If CICSFaculty also isolates clients, use a phone hotspot. This is still a
genuine LAN test — same code, same peer-to-peer media, no internet.

1. On the phone: **mobile data OFF**, then turn the **hotspot ON**
2. Connect the laptop to the phone's hotspot
3. Re-run Steps 3–6 (new IP, restart the server so the certificate rebuilds)
4. The phone reaches the laptop over the hotspot link

Record in Chapter 4 exactly which network the test ran on. An honest *"tested on
an isolated wireless network because campus wifi enforces client isolation"* is
a **finding, not a failure** — and it is a better result than a demo that does
not run.

---

## Quick reference — fill this in

```
Laptop IP  : 192.168.89. ______      (from Step 4)
Phone IP   : 192.168.89. ______      (from Step 8)

Phone opens : https://192.168.89.______:3443
Admin       : https://192.168.89.______:3443/admin.html
Survey      : https://192.168.89.______:3443/feedback.html

Start server: cd C:\Users\diran\OneDrive\Desktop\msuka-ip-v7_Final\msuka-ip-v7
              node server.js
```
