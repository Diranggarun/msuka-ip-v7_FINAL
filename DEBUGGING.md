# Known Errors and Fixes

> Brief symptom → root cause → fix.
> Add a new section whenever you solve a non-obvious problem during the build.

The stack is **Node.js + Express + Socket.IO + SQLite + vanilla HTML/JS**. Anything mentioning Python/FastAPI/Vite from older notes is no longer relevant, and anything mentioning MySQL/XAMPP predates the 2026-07-18 SQLite migration.

---

## Environment & startup

### `⚠️ Using built-in dev secrets — set JWT_SECRET and AES_SECRET …`
**Cause:** No `.env` file in `msuka-ip-v7/`, so the server fell back to hard-coded development secrets.
**Fix:** `Copy-Item .env.example .env` inside `msuka-ip-v7/`, fill in strong `JWT_SECRET`, `AES_SECRET`, `AES_SALT`, then restart. The warning disappears.
**Important:** Once you set `AES_SECRET` / `AES_SALT`, never rotate them — older encrypted messages would become unreadable.

### `Cannot find module 'node:sqlite'`
**Cause:** Node is older than 22.5. The database driver is a Node built-in introduced in 22.5, so there is nothing to `npm install` — the runtime itself is too old.
**Fix:** `node --version`, then upgrade to Node 22.5+ (LTS 22.x or newer) and restart.

### `SQLITE_BUSY` / `database is locked`
**Cause:** A second process has `msukaip.db` open for writing — usually `node db-audit.js`, `npm run backup`, or a SQLite GUI left open while the server runs.
**Fix:** Close the other tool. WAL mode plus a 5-second `busy_timeout` normally absorb this, so a persistent lock means something is genuinely holding the file.

### Server exits immediately: `NODE_ENV=production but JWT_SECRET/AES_SECRET are the built-in dev defaults`
**Cause:** Intentional. In production the server refuses to boot on dev secrets — otherwise anyone with repo access could forge admin tokens and decrypt stored messages.
**Fix:** Put real `JWT_SECRET` and `AES_SECRET` values in `.env` (see `.env.example`), or unset `NODE_ENV` for local development.

### `EADDRINUSE :::3000`
**Cause:** Another process is already on port 3000 (probably a previous `npm start` that didn't quit).
**Fix:**
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
Or change `PORT=3001` in `.env`.

### The database file is missing or you want a clean slate
**Cause:** There is no "database doesn't exist" error anymore — `msukaip.db` is created automatically on first start, and `setupDatabase()` creates all seven tables plus indexes.
**Fix:** To reset completely, stop the server, **back up first** (`npm run backup`), delete `msukaip.db` (plus the `-wal` and `-shm` files beside it), and restart. You get a fresh schema and re-seeded demo accounts. All existing messages and users are gone — this is destructive.

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
**Fix:** Open the app at `https://<server-ip>:3443`. The server generates its certificate into `certs/` on first start and prints the URL. The browser will warn that it does not trust it — click through once, or install the local CA from `https://<server-ip>:3443/msukaip-ca.crt` to remove the warning entirely (steps in `LAN-TEST-GUIDE.md` §4b). On the server host itself, `http://localhost:3000` also works.

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

### Admin dashboard content is invisible on a phone or tablet (rail fills the screen)

**Cause:** `admin.html`'s phone rules live in a `@media (max-width:768px)` block written against `#app.open`, but `login()` only set an inline `style.display='flex'` and never added the class. Without it `#app` kept `flex-direction:row`, so the rail — which the same media block sets to `width:100%!important` — consumed the entire row and `.admin-main` collapsed to **0px**. Nothing overflowed and no error was thrown; the content was simply not there.

**Fix:** `login()` now calls `document.getElementById('app').classList.add('open')` before setting the inline style.

**Why it went unnoticed:** test 6.12 asserted no horizontal scroll and a full-width rail. Both were true the whole time the page was unusable. It now measures `.admin-main`'s own width, which reads 0 against the unfixed page. When a responsive test passes, check that it measures the thing that would actually be missing.

### A chart drawn while its tab is hidden comes back stretched

**Cause:** `renderMainChart()` sizes itself from the element. A `display:none`
panel measures 0, and the existing `|| 620` fallback then baked 620px into the
SVG viewBox. `loadStats()` refreshes every 5 seconds whatever tab is open, so
sitting on Pending was enough to corrupt the Overview chart. It returned
*stretched*, not blank, which is the harder failure to notice.

**Fix:** store the series, skip the draw when the host has no width, redraw in
`switchTab('overview')`. Test 5.17 fails without it: viewBox 620 against a 641px
host.

### A wide table spills off the page above 768px

**Cause:** `.card{overflow-x:auto}` lived only inside the `max-width:768px`
block. A 7-column table is wider than its card at plenty of desktop widths too —
it just happened to fit while the root font was 16px. Raising it to 18px pushed
the pending table from 954px to 1061px and the page began scrolling sideways at
900/1100/1280px.

**Fix:** the rule belongs on the base `.card`. Test 6.13 covers desktop widths;
6.11 never could, because it only ever visits `/admin.html` logged out and so has
only ever measured the login screen.

### A media-query fallback that reads correctly but does nothing

**Cause:** the `prefers-reduced-transparency` block was written above the
`.left-panel` / `.icon-rail` rules it needed to override. Media queries add no
specificity, so the later panel rules won and the fallback was dead from the
commit that introduced it. Nothing warns you; the source looks right.

**Fix:** move it below both rules (it now sits beside the phone-layout block,
which is late for the same reason). Test 2.13 flips the rule's own
`media.mediaText` to `all` and asserts the computed `backdrop-filter` is `none`
— Playwright cannot emulate the media feature, but the cascade is the part worth
locking. Same trap as the phone layout block in `index.html`.

### Presence keeps broadcasting a stale display name after a rename

**Cause:** `onlineUsers` caches the name captured at socket handshake.
`PUT /api/user/profile` updated the database, and calling `broadcastPresence()`
alone re-sent the old name to everyone.

**Fix:** correct the in-memory entries for that user before broadcasting. The
JWT's copy stays stale until the next sign-in, which only affects that user's own
token, not what others see.

### Phone shows "Voice features are blocked on this address"
**Cause:** the phone opened `http://<lan-ip>:3000`. Browsers only expose
`getUserMedia` on a secure origin; `localhost` qualifies but a LAN IP over plain
HTTP does not, so the microphone is unavailable and calls/voice messages die.
**Fix:** the server now 302-redirects LAN clients from HTTP to
`https://<host>:3443`, so nobody can land on the insecure origin. `localhost`,
`/socket.io/`, and non-GET requests are exempt — redirecting a POST would drop
its body, and the Playwright suite drives the app on `http://localhost:3000`.

### Login card and hero text cut off on a 360px Android, with no way to scroll
**Cause:** two hard-coded widths. `.auth-card` was `width:400px`, which overflows
any screen under 440px, and `.landing-wrap` used `grid-template-columns:1fr` —
shorthand for `minmax(auto,1fr)`, whose `auto` floor is the item's min-content
width, so that 400px card stretched the whole column. `#auth-screen` sets
`overflow-x:hidden`, so the excess was clipped rather than scrollable: measured
`scrollWidth` 360 while 30 elements extended to 411–456px.
**Fix:** `width:min(400px,100%)` on the card and `minmax(0,1fr)` on the grid.
Verified 0 overflowing elements at both 360px and 320px on all three pages.

### Random test failures that move around between runs (9.10, 9.12, 13.x, smoke)
**Cause:** this is the real root of the "Firefox feedback-form flake" in
CLAUDE.md, and it is not Firefox-specific. `playwright.config.js` defines two
projects, Chrome and Firefox, and Playwright runs them **concurrently against
the same server and the same database**. Tests that mutate shared state then
race each other:
  - `9.10` changes a user's password while the other browser is authenticating
    as that user, so one of the two sees a dead credential.
  - `9.12` asserts audit-log totals that the other browser is actively growing.
  - `13.x` / smoke failures are timeouts from two browsers plus video capture
    competing for the machine.
The giveaway is that the failing set changes between runs while the pass count
stays the same, and every failure passes when run on its own.

**Fix:** run one project at a time before treating anything as a regression:

```
npx playwright test --project=Chrome  --workers=1
npx playwright test --project=Firefox --workers=1
```

Verified 2026-08-11: **114 passed / 0 failed on each project** run this way,
against the same build where the combined run reported 12-14 failures. If you
need the combined run to be trustworthy, the projects need separate databases
(`SQLITE_PATH`) and separate ports rather than a shared backend.

One genuine environment note: `9.12` asserts `all.total > 100`, so it needs an
*aged* audit log. The live DB has tens of thousands of rows; a brand-new scratch
DB starts empty and fails that line until the suite's own activity fills it.

### Screen reader announces form fields as unlabelled ("edit text, blank")
**Cause:** 24 controls across the three pages had a visible `<label>` sitting
beside them, but with no `for` attribute and no wrapping — nothing associated
the label with its input. Visually it looked correct, which is why it survived;
programmatically the fields had no name. Tapping the label also failed to focus
the field, losing a tap target that matters on a phone.
Found by auditing against WCAG 2.1 SC 1.3.1 / 4.1.2 (`ui-ux-pro-max`, rule
"Form Labels", severity High), not by anything visible on screen.
**Fix:** `for` on every label paired with an id; `aria-label` on the controls
that have no visible label by design (conversation search, emoji search, the two
file inputs, the message box, admin user search, broadcast box). Test 14.6
guards all three pages. Verified 0 unnamed controls of 19 / 115 / 14.

### Login screen scrolls only a little, then stops dead
**Cause:** `body` is the app shell — `height:100vh; overflow:hidden` — so the
page itself never scrolls and `#auth-screen` is what scrolls. But `#auth-screen`
used `min-height:100vh`, so it *grew* to its content (1085px in an 800px
window). The excess was clipped by the body, and its own scroll range is content
minus **its own** height, not minus the viewport — 100px instead of 285px. A
swipe moved barely at all and stopped, and the login button below the fold was
only reachable because scrolling condenses the sticky header and reclaims space.
**Fix:** `height:100vh; height:100dvh` instead of `min-height:100vh`, pinning it
to the viewport so its scroll range covers the whole overflow. Range went
100px → 285px and the sign-in button is reachable by ordinary scrolling. `dvh`
is listed second so mobile browsers, where the URL bar makes `vh` overshoot,
take it and older engines keep the `vh` fallback.
Do **not** "fix" this by removing `max-height` from `.auth-card` — that cap is
what keeps the taller Create Account form on screen, and tests 1.11 and 1.12
guard it.

### Admin dashboard shows one nav tab at a time on a phone
**Cause:** the desktop rail is vertical and sets `width:100%` on `.rail-tab`. The
mobile media query turns the rail horizontal with `flex:1 0 auto`, whose
`flex-basis:auto` reads that same `width:100%` — so every tab became a full
screen wide, giving a 3557px scroll strip holding ten tabs.
**Fix:** `flex:0 0 auto;width:auto` in the mobile block, so tabs size to their
icon. Rail scroll width 3557px → 444px; eight of ten tabs visible at 360px. The
44px minimum is kept deliberately — shrinking to fit all ten would mean 36px
targets, below the accessible minimum, so the short swipe is the better trade.

### "Export CSV" unreachable on the admin Feedback panel at 320px
**Cause:** `.card-header` is a `flex-wrap:nowrap` row — title left, buttons
right. On a 320px screen the button group ran 8px past the viewport and clipped
the export control, which is how survey data leaves the system for Chapter 4.
**Fix:** `.card-header{flex-wrap:wrap;gap:.5rem;}` below 768px.

### Add-user form fields off-screen on the admin dashboard
**Cause:** `.form-grid` stayed at `1fr 1fr` on mobile — two 192px columns inside
a 267px card, pushing email and role past the edge. The `.card` has
`overflow-x:auto` so it technically scrolled, but a form is not a table and
should fit rather than scroll.
**Fix:** `grid-template-columns:minmax(0,1fr)` below 768px. Note the wide tables
in the same cards are *intentional* — `table{min-width:520px}` inside
`.card{overflow-x:auto}` is the deliberate responsive-table pattern, so table
overflow there is by design and must not be "fixed".

### Survey submit button appears to do nothing on iPhone
**Cause:** validation used `alert()`. iOS adds a "Suppress dialogs" button to
repeated alerts; once a respondent taps it, every later prompt is swallowed
silently, so an incomplete form just refuses to submit with no explanation.
**Fix:** `flagField()` shows the message next to the offending field, scrolls it
into view, and outlines it — which also tells the respondent *where* the gap is.

### A popover opens, is "visible", and is still painted over

**Cause:** `.topbar` carries a `backdrop-filter`, and backdrop-filter creates a
stacking context. The notification panel's `z-index:900` therefore only ranked it
*inside* the top bar; the bar itself was at `z-index:auto` and lost to content
further down the document, so the KPI tiles drew straight over the open panel.

**Fix:** an explicit `z-index` on `.topbar`, commented as load-bearing so nobody
tidies it away.

**Why it was missed:** every measurement passed. The element was rendered, its
computed visibility was correct, and a Playwright check said so. Only the
screenshot showed it buried — and `document.elementFromPoint` inside the panel's
own bounds is what finally named the culprit. If a popover looks wrong but reads
as visible, hit-test a point inside it rather than trusting `isVisible()`.

### `messageRows.filter is not a function`

**Cause:** the top-bar search caches each list's rows so it can re-render a
filtered view. `/api/admin/messages` answers **403 by design** — message content
is private even from administrators — so the cache held `{error: ...}` rather
than an array, and the first search on that tab threw.

**Fix:** every cache is guarded with `Array.isArray(body) ? body : []`, and the
Messages tab now states that content is withheld instead of rendering a bare "no
messages", which read as "nobody has chatted".

**Worth remembering:** a route that returns a non-array on purpose will break any
code that assumes the happy shape. The 403 was correct; the caller was not.

## Adding new entries

When you hit a new error and solve it, add a section using this format:

```
### <Exact error message or short symptom>
**Cause:** <what was actually wrong>
**Fix:** <commands or code that resolved it>
```

Keep entries scannable. If a fix needs more than ~10 lines, link to a longer explanation in the relevant file's comments or in `DECISIONS.md`.
