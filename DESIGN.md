# DESIGN.md — MSUkaIP Design System

The single source of truth for how MSUkaIP looks, moves, and feels. Every value
here is a CSS custom property defined identically in the `:root` block of all
three pages (`index.html`, `admin.html`, `feedback.html`), so the system is
shared, not copied.

**Identity is fixed.** The maroon/gold palette and the Cinzel/Nunito pairing are
the institutional identity of Mindanao State University — CICS, not a style
choice. New work extends this system; it does not replace it.

**Constraints that shape it:** offline LAN (no CDNs, no web fonts, no GSAP),
no build step (vanilla inline CSS/JS), and the capstone rule — every line must
be explainable in oral defense, so the system favours a small set of clear
tokens over cleverness.

---

## 1. Color

Primitive ramp (the brand):

| Token | Value | Use |
|---|---|---|
| `--maroon` | `#6B0000` | Primary brand, button fills, headings |
| `--maroon-dark` | `#4a0000` | Gradients, deep accents |
| `--maroon-light` | `#8B1A1A` | Gradient partner, hover |
| `--maroon-soft` | `#f9f0f0` | Tinted hover backgrounds |
| `--gold` / `--gold-bright` | `#D4A017` / `#FFD700` | Accent, on-maroon text, focus rings |
| `--gold-dark` / `--gold-soft` | `#B8860B` / `#fffbea` | Secondary gold, soft fills |

Neutrals are warm-biased toward the paper, never pure grey:

| Token | Value | Use |
|---|---|---|
| `--text-dark` | `#2a1a0a` | Body copy (16:1) |
| `--text-mid` | `#5a4a3a` | Secondary text |
| `--text-light` | `#7f6e5d` | Muted — **4.9:1**, meets WCAG AA |
| `--gray-100/200/400` | warm greys | Borders, dividers, fills |

> **Contrast is non-negotiable.** `--text-light` was darkened from `#9a8a7a`
> (3.35:1, failing) because it colours real content — message previews,
> timestamps. Any muted text must clear 4.5:1 against its actual background.

Semantic colours (separate from the accent): success `#1E7A44`, warning
`#8A5A00`, critical `#C0392B`. These signal state and never double as the brand
accent.

---

## 2. Typography

- **Display — Cinzel** (serif, inscriptional): headings, brand, hero. Echoes the
  MSU seal's engraved lettering. Self-hosted in `public/fonts/`.
- **Body — Nunito** (humanist sans): everything else. Self-hosted.
- **Data/mono** — the system mono stack for commit-like data and code.

The pairing works because it contrasts on an axis (serif display + humanist
sans), not two similar sans-serifs. Headings use `text-wrap: balance`; running
text stays near 65 characters wide.

---

## 3. Spacing & Radius

8px-based spacing scale — the standard for new UI:

`--sp-1: 4px` · `--sp-2: 8px` · `--sp-3: 12px` · `--sp-4: 16px` ·
`--sp-6: 24px` · `--sp-8: 32px` · `--sp-12: 48px`

Radius scale: `--r-sm: 8px` · `--r-md: 12px` · `--r-lg: 18px` · `--r-xl: 22px`.
Nested containers step **down** the scale for concentric curves.

---

## 4. Elevation (shadow)

`--shadow-sm/md/lg` — all maroon-tinted (`rgba(107,0,0,…)`), never harsh black.
Premium surfaces layer four parts: a top inner highlight, a faint gold
tray-edge ring, and two diffused ambient shadows (one neutral, one
maroon-tinted) — so a card reads as sitting in a frame, not pasted on. See the
sign-in card for the reference implementation.

---

## 5. Motion

Durations: `--dur-fast: .12s` · `--dur-base: .18s` · `--dur-slow: .32s`.

Easing tokens (the built-in CSS curves are too weak — these carry intention):

| Token | Curve | When |
|---|---|---|
| `--ease-out` | `cubic-bezier(.23,1,.32,1)` | Entrances, hovers — strong and responsive |
| `--ease-drawer` | `cubic-bezier(.32,.72,0,1)` | On-screen movement, sheets |
| `--ease-overshoot` | `cubic-bezier(.34,1.56,.64,1)` | **Rare delight only** — e.g. the once-per-login card entry |

**Rules of motion** (per the animation decision framework):

1. **Should it animate?** Actions seen 100+×/day (keyboard) never animate.
   Occasional (modals, toasts) get standard motion. Rare/first-time (login,
   onboarding) may add delight.
2. **Every animation needs a purpose** — feedback, spatial continuity, or
   preventing a jarring change. "Looks cool" on a frequent action is not one.
3. **Buttons confirm the press** — `:active` dips the control (scale ~.97) on a
   fast 60ms transition.
4. **Reduced motion is not optional** — every animation has a
   `@media (prefers-reduced-motion: reduce)` path (crossfade or instant).
5. **Animate only `transform` and `opacity`** — never layout properties.

---

## 6. Component patterns

- **Button-in-Button CTA** — a primary button's trailing arrow rides in its own
  circular well and glides right on hover (`--ease-out`). The well is tinted the
  button's complementary brand colour.
- **Cards carry state in form, not just number** — a login-monitor card with
  failed attempts gets a soft red wash and red border; a stat card is tinted its
  own metric colour. The whole card reads at a glance.
- **Icons are SVG line icons**, never emoji.
- **Texture** (paper grain) is composited into surface backgrounds *below*
  content, never floated over text.

---

## 7. Anti-patterns — do not ship these

| Banned | Instead | Source |
|---|---|---|
| Colored side-stripe border (>1px) on cards/alerts | Full border, or a background tint that means something | impeccable |
| Gradient text (`background-clip:text`) | One solid colour; emphasis via weight/size | impeccable |
| `transition: all` | Name the exact properties (`transform`, `box-shadow`) | emil-design-eng |
| Built-in `ease-out` / `ease-in-out` on UI | The custom easing tokens above | emil-design-eng |
| Emoji as icons | SVG line icons | ui-ux-pro-max |
| Muted grey text below 4.5:1 | Darken toward the ink end | ui-ux-pro-max |
| A second `<h1>` on a page | One `<h1>`; brand labels are styled `<div>`s | a11y |

---

## 8. Accessibility baseline

- Body/label text ≥ 4.5:1; large text ≥ 3:1.
- Touch targets ≥ 44×44px on phones; ≥ 8px apart.
- Visible keyboard focus (gold ring) on every interactive element.
- `prefers-reduced-motion` honoured everywhere.
- No page scrolls horizontally at 320 / 375 / 414 / 768 / 1024 / 1440.
  Verified by Playwright tests 6.9–6.12.

---

## 9. Provenance — which skill informed what

This system is the synthesis of the design skills applied during development,
each taken as *reasoning*, never pasted code:

- **ui-ux-pro-max** — accessibility, touch, breakpoint, and icon rules (§7–8).
- **impeccable** — the anti-pattern bans (§7) and the tints-not-stripes move.
- **emil-design-eng** (Emil Kowalski) — the motion framework, easing tokens, and
  button press feedback (§5).
- **high-end-visual-design** — layered card depth and the Button-in-Button CTA
  (§4, §6), applied *within* the maroon/gold identity, not its palette.

Skills deliberately **not** applied, and why: `gpt-taste` needs GSAP (forbidden
offline); `minimalist-ui` / `industrial-brutalist-ui` prescribe their own
palettes that would replace the MSU identity; `image-to-code` / `imagegen-*`
emit React, which this no-build vanilla project can't consume. See the routing
table in `CLAUDE.md`.
