# Prompt — frontend usability pass + gold/burgundy palette (MSUkaIP)

> **Read this first.** "Not user friendly" is too vague to act on, and an
> assistant handed a vague redesign request will rewrite whole pages. That
> breaks tests and produces code that can't be explained in oral defense. So
> this brief asks for an **audit first**, then a token-level palette swap,
> then usability fixes one at a time, with approval between stages.

---

Act as a senior UI/UX engineer who works in plain HTML, CSS and JavaScript.

I want to make the MSUkaIP frontend easier to use and move it to a new
gold/burgundy palette. **Do not rebuild the pages.** Improve what exists, in
small changes I can explain line by line.

## Stack (actual, not placeholder)

- Three self-contained pages in `msuka-ip-v7/frontend/`: `index.html` (login +
  chat app), `admin.html` (admin dashboard) and `feedback.html` (survey). CSS
  and JS live inline in each page.
- Vanilla HTML/CSS/JS. **No React, no Tailwind, no bundler, no build step.**
- Offline LAN: **no CDNs, no Google Fonts links, no external images or icons.**
  Fonts are self-hosted in `frontend/fonts/` (Cinzel for headings, Nunito for
  body). Keep them.
- Each page defines its colors as CSS variables in `:root` (`--maroon`,
  `--gold`, `--paper`, `--ink`, `--text-dark`, …). Spacing (`--sp-*`), radius
  (`--r-*`) and motion (`--ease-*`, `--dur-*`) tokens already exist. Reuse them.
- Existing JS helpers (`appendMessage`, `showAuthMsg`, `fileSrc`, …) and all
  element ids are used by the Playwright tests in `msuka-ip-v7/tests/`. **Do
  not rename ids or classes the tests select on** without updating the test.

## Installed skills — use them

I have design skills installed in `.claude/skills/` (see the routing table in
`CLAUDE.md`). **Invoke the right skill before each stage** and tell me which one
you used. Most were written for React/Tailwind sites, so the rule for all of
them is: **take the reasoning, never paste their code.** Everything that lands
in `frontend/*.html` must be vanilla CSS/JS in the existing compact style.

| Stage | Skill | Use it for |
|---|---|---|
| 1 — Audit | `redesign-existing-projects` | Audit before changing anything (supports vanilla CSS) |
| 1 — Audit | `impeccable` | Critique: hierarchy, accessibility, spacing, empty/loading/error states |
| 1 — Audit | `ui-ux-pro-max:ui-ux-pro-max` | UX guideline lookup (touch targets, forms, contrast). **Ignore its palette and style suggestions** |
| 2 — Palette | `impeccable` | Applying the palette and checking contrast |
| 2 — Palette | `frontend-design` | Typography and visual direction. Its "take an aesthetic risk" advice stops at the palette below and Cinzel/Nunito |
| 3 — Fixes | `emil-design-eng` | Small polish and "invisible details" |
| 3 — Fixes | `apple-design` | Interaction feel, sheets/drawers, reduced motion |
| 3 — Motion | `find-animation-opportunities` · `review-animations` | Only if a fix involves motion. Read-only; they plan, you implement by hand |

**Do not use** these without asking me first and explaining why:
- `full-output-enforcement`: it demands huge unabridged output, the opposite
  of small, explainable changes.
- `gpt-taste`: it needs GSAP and a landing-page structure. This is a chat app.
- `minimalist-ui`, `industrial-brutalist-ui`, `high-end-visual-design`: each
  brings its own palette and fonts, which would replace the MSU colors.
- `design-taste-frontend`, `stitch-design-taste`: for landing pages and
  Google Stitch.
- `image-to-code`, `imagegen-frontend-*`, `brandkit`: they generate images and
  then React/Tailwind code.

## New palette

| Role | Hex | Use for |
|---|---|---|
| Gold | `#D4AF37` | Accents, active states, borders, icons, buttons with dark text |
| Burgundy | `#6E0D25` | Primary brand color, nav/sidebar, primary buttons, headings |
| Blush | `#FCEFF9` | Page and panel backgrounds |

Measured contrast (WCAG AA needs 4.5:1 for normal text, 3:1 for large text and UI):

| Pair | Ratio | Verdict |
|---|---|---|
| Burgundy text on Blush | 10.79 | ✅ body text OK |
| White text on Burgundy | 12.02 | ✅ |
| Gold text on Burgundy | 5.72 | ✅ |
| Dark text `#2A1A0A` on Gold | 7.99 | ✅ gold buttons need dark labels |
| Dark text `#2A1A0A` on Blush | 15.08 | ✅ |
| **Gold text on Blush** | **1.89** | ❌ **never use gold for text on light backgrounds** |
| **Current `--text-light #7F6E5D` on Blush** | **4.39** | ❌ **must be darkened** (timestamps, previews) |

Rules:
- Map the palette onto the **existing variable names** (`--maroon` → burgundy,
  `--gold` → gold, `--paper`/`--off-white` → blush), and derive the
  `-dark`/`-light`/`-soft` shades from the new hexes. Swapping tokens must
  recolor the app with near-zero changes to individual rules.
- After the swap, search each page for **hard-coded colors** (`#6B0000`,
  `#D4A017`, `rgba(107,0,0,…)`, `rgba(212,160,23,…)`) and replace them with
  variables.
- Blush is pink-tinted, while the old paper was warm cream. Check that message
  bubbles, cards and inputs still separate visibly from the background. Use a
  border or a slightly deeper tint if they don't.

## Stage 1 — Usability audit (read-only, no edits)

Invoke `redesign-existing-projects` and `impeccable` first. Start the server (`npm start` from `msuka-ip-v7/`) and open each page at
**360px, 768px and 1280px**. Log in as `student@cics.msu.edu` / `student123`
for the chat and `admin@cics.msu.edu` / `admin123` for the dashboard.

Report the **top 10 usability problems**, ranked by how much they hurt a
first-time student. For each one, give:
- where it is (page, element id or selector, line number)
- what goes wrong for the user, concretely (for example, "the send button is
  32px on a phone, below the 44px tap minimum")
- the smallest fix

Check at least these:
- **First use:** can a new student register, log in, find the General chat and
  send a message without guessing?
- **Navigation:** is it always clear which chat or tab is open, and how to get
  back?
- **Feedback:** does every action (send, upload, call, approve, error) show
  what happened? Are empty, loading and error states present?
- **Readability:** text size, line length, contrast, crowded areas.
- **Touch:** tap targets ≥ 44px, nothing hidden behind hover-only controls on
  phones.
- **Forms:** labels (not placeholder-only), clear error messages, the password
  rule (8+ chars) stated up front.
- **Consistency:** the same action looks and behaves the same on all three
  pages.

**Stop after Stage 1 and wait for me to pick which items to fix.**

## Stage 2 — Palette swap

Invoke `impeccable` (and `frontend-design` for typography questions). Tokens
first, then hard-coded colors, across all three pages. Then
re-measure contrast on every text/background pair actually in use and fix any
that fail AA. Show me before/after screenshots of the login screen, chat,
admin overview and survey.

## Stage 3 — Usability fixes

Invoke `emil-design-eng` and `apple-design`, plus the animation skills if a
fix involves motion. Only the items I approved from Stage 1, **one item per
change**. Each change
should be explainable in a sentence and use the existing tokens and helpers.

## Constraints

- No new dependencies, frameworks, CDNs or external assets.
- No rewriting whole sections or pages. Change rules and markup in place.
- Keep the MSU identity: logos, seal, Cinzel/Nunito.
- Respect `prefers-reduced-motion`. Don't add decorative animation.
- No security regressions: keep escaping user text before `innerHTML`, and
  keep `fileSrc()` for media URLs.

## Done means

- `npm run lint` is clean.
- `npx playwright test` passes. The Firefox feedback-form radio flake may need
  one retry; a second failure is a real regression.
- Every text/background pair in use meets WCAG AA.
- No horizontal scroll at 360px on any page.
- `PROGRESS.md` has a log entry and `DECISIONS.md` records the palette change
  and why.
- A short summary of every change, file and line, in plain words I can repeat
  in my defense, including which skill informed each change.
