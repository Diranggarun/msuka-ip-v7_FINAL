# Prompt — secure real-time communications audit (MSUkaIP)

> **Read this first.** The original draft of this prompt asked an engineer to
> *implement* chat, voice, file transfer and auth. All four already exist in this
> codebase and are covered by tests. Handed over as a build request, an assistant
> would start rebuilding working code — which, days before a defense, is the
> expensive way to break something.
>
> So this is written as an **audit and hardening** brief. It states what is built,
> asks for verification rather than construction, and names the one requirement
> that is genuinely missing.

---

Act as a senior backend and network security engineer.

I have a working LAN-based messaging and VoIP system. I need you to **verify and
harden** its real-time communication security — not rebuild it. Assume every
feature below exists until you have read the code and found otherwise.

## Stack (actual, not placeholder)

- **Client:** vanilla HTML/CSS/JavaScript, no framework and no build step —
  three self-contained pages in `msuka-ip-v7/public/`
- **Server:** Node.js + Express + Socket.IO, all logic in `msuka-ip-v7/server.js`
- **Database:** SQLite via Node's built-in `node:sqlite` (WAL mode), single file
- **Storage:** local filesystem, `msuka-ip-v7/uploads/`, outside the web root
- **Auth:** JWT (`jsonwebtoken`) with a `token_version` claim for revocation
- **Constraint:** offline LAN. No CDNs, no external services, no STUN/TURN, no
  cloud storage. Anything requiring the internet is out of scope by design.

## What is already implemented

Verify each; do not rebuild.

**1 — Chat / text.** Socket.IO over the page's origin, so WSS when served from
the HTTPS endpoint. Events follow `namespace:action`. Message bodies are
encrypted at rest with AES-256-GCM, fail-closed. TLS is available on port 3443
via a self-signed certificate generated on first boot.

**2 — Voice calls.** WebRTC peer-to-peer audio. The server relays only SDP and
ICE candidates over Socket.IO; media never passes through it. WebRTC mandates
DTLS-SRTP, so call audio is encrypted browser-to-browser. `iceServers` is
deliberately empty — all peers share one LAN, so STUN/TURN would add a
dependency the system is built to avoid. Verified by `tests/voice-call.spec.js`:
ICE `connected`, DTLS `connected`, one audio track each way.

**3 — Images and files.** Authenticated `POST /api/upload` with a MIME allow-list
and a 5 MB cap. Files are encrypted at rest and stored outside `public/`, served
only through an authenticated `GET /uploads/:name`.

**4 — Identity.** 32 routes behind `verifyToken`; admin routes add `adminOnly`.
bcrypt at cost 12, minimum 8 characters. Login is rate-limited to five failures
per fifteen minutes per IP and account. Tokens expire after eight hours and every
request revalidates `token_version`, so a password change or an admin action
revokes outstanding sessions immediately.

## The one genuine gap

**Time-limited pre-signed URLs are not implemented.** Media URLs currently append
`?token=<jwt>` because `<img>` and `<audio>` tags cannot send an Authorization
header. That means a shared media URL carries a token valid for up to eight
hours and for the whole API, not just that one file.

Assess whether this matters for a single-LAN deployment, and if so propose the
smallest fix: a short-lived, single-file token — signed over the filename with a
few minutes' expiry and no other authority — rather than importing a cloud
storage SDK the offline constraint forbids.

## What I want from you

Work in this order. **Do not write code until the audit is agreed.**

1. **Read before judging.** `server.js` for routes, socket handlers, encryption
   and auth; `db.js` for the schema; `public/*.html` for the client side.
2. **Report per area** — chat, voice, files, identity — as: what exists, how it
   is verified today, and what a determined attacker on the same LAN could still
   do. Cite `file:line`.
3. **Rank findings by exploitability**, not by how easy they are to fix. Say
   plainly when something is already adequate; a list padded with non-issues
   hides the real one.
4. **Then, and only then**, name the specific files each change would touch and
   what would need to be re-tested.

## Constraints on any change you propose

- Offline LAN. No new external dependency, no CDN, no cloud service.
- No build step, no bundler, no framework. Inline `<style>`/`<script>`.
- Parameterized `?` placeholders only. This codebase has already had a group
  conversation IDOR and a stored XSS through display names; both were fixed and
  are covered by tests, so do not regress them.
- Do not weaken existing invariants to simplify anything: bcrypt stays at 12,
  encryption at rest stays fail-closed, rate limiting stays, portal separation
  between admin and student stays.
- Every change ships with a test that has been **demonstrated to fail without
  the fix**. A test that cannot fail is not a test.

## Ask before assuming

If a requirement conflicts with the offline-LAN constraint — pre-signed cloud
URLs, STUN/TURN, an external identity provider — say so and propose the LAN
equivalent rather than quietly adding a dependency that cannot ship.
