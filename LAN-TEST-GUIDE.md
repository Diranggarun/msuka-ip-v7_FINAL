# Running MSUkaIP at the college — field guide

Two things on this machine will stop the demo working on college wifi. Fix both
**before you leave the house**, because one of them needs an administrator
password you may not want to be typing in a corridor.

---

## Before you leave — 10 minutes

### 1. The firewall rules will not apply on college wifi

Your rules exist and cover both ports:

```
MSUkaIP 3000    port=3000        profile=Domain, Private
MSUkaIP         port=3000 3443   profile=Domain, Private
```

The problem is `profile=Domain, Private`. Windows classifies an unrecognised
network as **Public**, and college wifi will be new to your laptop. Rules scoped
to Domain and Private simply do not apply on a Public network, so every phone
that tries to reach you gets a refused connection — with no error on your side.
The server looks fine. Nothing arrives.

**Fix — run PowerShell as Administrator** (right-click → *Run as administrator*;
`C:\WINDOWS\System32` in the title bar is not the same thing):

```powershell
New-NetFirewallRule -DisplayName "MSUkaIP LAN" -Direction Inbound -Protocol TCP -LocalPort 3000,3443 -Action Allow -Profile Any
```

`-Profile Any` is the whole point. Verify:

```powershell
Get-NetFirewallRule -DisplayName "MSUkaIP LAN" | Get-NetFirewallPortFilter
```

**Alternative if you cannot get administrator rights:** when Windows first asks
"Do you want your PC to be discoverable on this network?", answer **Yes** — that
marks the network Private and your existing rules will work. If you already
answered No, change it under Settings → Network → Wi-Fi → *(your network)* →
Network profile type → **Private**.

### 2. Clear the test data again

Nine test accounts came back from test runs after the last cleanup:

```
cd msuka-ip-v7
node scripts/backup.js
node scripts/clean-test-data.js
```

You do not want `pwreg_1786029423423@cics.msu.edu` on screen during a demo, and
you do not want fake rows mixed into the survey you are about to collect.

### 3. Charge everything and pack

- Laptop, charger
- A second device (phone is fine) — you cannot test a call alone
- Ideally a third, so someone can watch the admin dashboard while you demo

---

## At the college

### 4. Join the wifi and find your address

Your IP **will be different** from the one at home. Find it:

```powershell
ipconfig | findstr /i "IPv4"
```

Use the address on the wifi adapter — typically `10.x.x.x` or `192.168.x.x`.
**Ignore anything starting `169.254`**: that is a link-local fallback and means
you did not actually get an address from the network.

Also ignore `192.168.56.1` — that is your VirtualBox adapter, not the wifi.

### 5. Start the server

```
cd msuka-ip-v7
node server.js
```

Wait for the startup lines listing both the HTTP and HTTPS addresses.

### 6. Prove it works from the laptop first

Open `https://<your-ip>:3443` in your own browser. If that fails, nothing else
will — stop and fix it before involving anyone else.

### 7. Then from the second device

Same address, on the same wifi. You will get a certificate warning: the
certificate is self-signed, which is expected and is why the warning appears.
Tap **Advanced → Proceed**. On some Android builds the wording is *"Continue to
site (unsafe)"*.

**Use HTTPS, not HTTP.** Browsers only grant microphone access on a secure
origin, so voice will silently fail on port 3000.

---

## The smoke test itself — screenshot every step

These become your Chapter 4 figures.

| # | Step | What proves it |
|---|---|---|
| 1 | Register on the second device | Account lands as pending |
| 2 | Approve it from the admin dashboard | Approval workflow works |
| 3 | Log in on the second device | Two-tier login, student portal |
| 4 | Send a text both ways in Global Chat | Real-time messaging |
| 5 | Send an image | File pipeline, encrypted at rest |
| 6 | Send a PDF or DOCX | Document sharing, 5 MB cap |
| 7 | Hold the mic button, send a voice message | Push-to-talk |
| 8 | **Place a 1:1 voice call, confirm audio both ways** | The objective with no evidence yet |
| 9 | Send a broadcast from the admin dashboard | Admin announcement |
| 10 | Open Login Monitor, expand a card | Audit and monitoring |

Step 8 is the one that matters. Voice is the only specific objective with nothing
behind it in your evidence table.

### 8. Collect the survey while people are there

This is your best chance at respondents — they are on the network, they have just
seen the system, and you are standing in front of them.

```
https://<your-ip>:3443/feedback.html
```

Ask them to fill the comment box at the bottom. Watch the count climb in the
admin dashboard under Feedback.

---

## If something fails

**Second device cannot reach the server at all.**
Almost certainly the firewall profile (§1). Confirm both devices are on the *same*
wifi — many campuses run separate guest and staff networks that cannot see each
other. Check they share a subnet: if the laptop is `10.0.5.12` and the phone is
`10.0.9.44`, the network is segmented and peer-to-peer voice will not work even
if messaging does.

**Certificate warning has no "proceed" option.**
Some mobile browsers hide it. Chrome on Android: type `thisisunsafe` while the
warning is showing. Or use a different browser.

**Microphone permission never appears.**
You are on `http://` — switch to `https://` on port 3443.

**Call connects but there is no audio.**
Check `iceConnectionState` in DevTools. Stuck on `checking` means the two devices
cannot reach each other directly — they are on different subnets, or client
isolation is enabled on the access point. There is no STUN server by design, so
peers must be directly reachable. If the campus wifi isolates clients, use a phone
hotspot for the call demo and say so in the paper.

**Server exits at startup.**
Read the message. If it mentions dev secrets, `NODE_ENV` is set to production
somewhere — unset it. If it says `EADDRINUSE`, an old server is still running:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

## Fallback if the campus network defeats you

A phone hotspot with the laptop and one other device joined is still a genuine
LAN test — same code path, same peer-to-peer media, no internet dependency. Note
in Chapter 4 exactly which network the test ran on. An honest "tested on an
isolated wireless network because campus wifi enforces client isolation" is a
finding, not a failure, and it is a better answer than a demo that does not run.
