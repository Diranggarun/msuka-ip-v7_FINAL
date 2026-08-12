// ═══════════════════════════════════════════════════════════════════
//  Mobile layout & secure-origin regression guards
//
//  Every test here failed before a specific fix on 2026-08-11 and passes
//  after it. They exist because all five defects were introduced by ordinary
//  styling edits and were invisible on a desktop window — the same way the
//  .auth-card height cap in 1.11 was silently overwritten once before.
//
//  Field context: two phones (Android + iPhone) at CICS hit every one of these.
// ═══════════════════════════════════════════════════════════════════
const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PHONE    = { width: 360, height: 800 };   // common Android
const NARROW   = { width: 320, height: 720 };   // narrowest phone still in use

// Elements wider than the viewport that the user cannot scroll to are invisible
// bugs. Decorative absolutely-positioned blobs and containers that are
// deliberately horizontal scrollers are excluded.
async function overflowingElements(page) {
  /* eslint-disable no-undef -- evaluated in the browser page context */
  return page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.position === 'absolute' && !el.textContent.trim()) return;
      if (el.closest('.admin-rail')) return;                    // intentional scroll strip
      if (el.tagName === 'TABLE' || el.closest('table')) return; // min-width:520 inside overflow-x card
      if (r.right > window.innerWidth + 1 || r.left < -1) {
        bad.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
                 (el.className ? '.' + String(el.className).split(' ').filter(Boolean)[0] : ''));
      }
    });
    return bad;
  });
  /* eslint-enable no-undef */
}

test.describe('14. Mobile layout regressions', () => {

  // Was: .auth-card had a hard width:400px, and .landing-wrap used
  // grid-template-columns:1fr whose implicit auto floor took the card's
  // min-content width. #auth-screen clips overflow-x, so 30 elements ran out to
  // 456px with no way to scroll to them — "Create Account" was cut mid-word.
  for (const size of [PHONE, NARROW]) {
    test(`14.1 login page has no clipped content at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(BASE_URL);
      await page.waitForSelector('.auth-card');
      const bad = await overflowingElements(page);
      expect(bad, `elements clipped off-screen: ${bad.join(', ')}`).toEqual([]);

      // the card itself must fit, and the Create Account tab must be on-screen
      const card = await page.locator('.auth-card').boundingBox();
      expect(card.width).toBeLessThanOrEqual(size.width);
      const tab = await page.locator('#tab-register-btn').boundingBox();
      expect(tab.x + tab.width).toBeLessThanOrEqual(size.width);
      console.log(`✅ ${size.width}px: no clipped content, card ${Math.round(card.width)}px`);
    });
  }

  // Was: #auth-screen used min-height:100vh, so it grew to its content (1085px
  // in an 800px window) inside a body pinned at 100vh/overflow:hidden. Its own
  // scroll range was content-minus-its-own-height (100px) instead of
  // content-minus-viewport (285px), so a swipe barely moved and stopped dead.
  test('14.2 auth screen scrolls its full content, not a clipped fraction', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(BASE_URL);
    await page.waitForSelector('.auth-card');

    /* eslint-disable no-undef -- evaluated in the browser page context */
    const m = await page.evaluate(() => {
      const s = document.getElementById('auth-screen');
      return { clientH: s.clientHeight, scrollH: s.scrollHeight, viewportH: window.innerHeight };
    });
    /* eslint-enable no-undef */
    // The scroller must BE the viewport, otherwise the body clips its tail.
    expect(m.clientH, 'auth screen must match the viewport, not grow past it')
      .toBe(m.viewportH);

    // And the sign-in button must come into view by ordinary scrolling.
    const btn = page.locator('button.btn-login');
    await btn.scrollIntoViewIfNeeded();
    const box = await btn.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(m.viewportH);
    console.log(`✅ auth screen = viewport (${m.clientH}px), scroll range ${m.scrollH - m.clientH}px, login button reachable`);
  });

  // Was: .rail-tab inherits width:100% from the desktop vertical rail. Once the
  // rail turns horizontal on mobile, flex-basis:auto read that 100% and every
  // tab became a full screen wide — one tab visible at a time in a 3557px strip.
  test('14.3 admin nav tabs are icon-sized on a phone', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`${BASE_URL}/admin.html`);
    await page.fill('#login-email', 'admin@cics.msu.edu');
    await page.fill('#login-password', 'admin123');
    await page.click('button.btn-primary');   // same selector the smoke suite uses
    await page.waitForSelector('.rail-tab', { state: 'visible', timeout: 8000 });

    const widths = await page.locator('.rail-tab').evaluateAll(
      els => els.map(e => Math.round(e.getBoundingClientRect().width)));
    // No tab may span the screen, and 44px is the touch-target floor.
    for (const w of widths) {
      expect(w, `a nav tab is ${w}px wide on a ${PHONE.width}px screen`).toBeLessThan(120);
      expect(w).toBeGreaterThanOrEqual(44);
    }
    // most of the rail should be visible at once, not one tab at a time
    const railScroll = await page.locator('.admin-rail').evaluate(e => e.scrollWidth);
    expect(railScroll).toBeLessThan(PHONE.width * 2);
    console.log(`✅ admin tabs ${widths[0]}px each, rail strip ${railScroll}px`);
  });

  // Was: .form-grid kept two fixed columns inside a 267px card, pushing the
  // email and role fields off-screen — adding a user meant swiping sideways.
  test('14.4 admin add-user form fits the screen', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`${BASE_URL}/admin.html`);
    await page.fill('#login-email', 'admin@cics.msu.edu');
    await page.fill('#login-password', 'admin123');
    await page.click('button.btn-primary');   // same selector the smoke suite uses
    await page.waitForSelector('#rail-add', { state: 'visible', timeout: 8000 });
    await page.click('#rail-add');
    await page.waitForSelector('#new-email', { state: 'visible' });

    for (const id of ['#new-name', '#new-email', '#new-password']) {
      const b = await page.locator(id).boundingBox();
      expect(b.x, `${id} starts off-screen`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, `${id} extends past the screen`).toBeLessThanOrEqual(PHONE.width);
    }
    console.log('✅ add-user fields all within the viewport');
  });

  // Was: 24 form controls across the three pages had a visible <label> sitting
  // next to them but no `for` attribute and no wrapping, so nothing associated
  // the two. A screen reader announced "edit text, blank", and tapping the label
  // did not focus the field — a real loss on a phone, where the label is often
  // the bigger target. WCAG 2.1 SC 1.3.1 / 4.1.2.
  for (const page_ of ['/', '/feedback.html', '/admin.html']) {
    test(`14.6 every form control on ${page_} has an accessible name`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto(`${BASE_URL}${page_}`);
      /* eslint-disable no-undef -- evaluated in the browser page context */
      const unnamed = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('input, select, textarea').forEach(el => {
          if (el.type === 'hidden') return;
          const byFor  = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          const byWrap = el.closest('label');
          const byAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
          if (!byFor && !byWrap && !byAria) out.push(el.id || el.name || el.type);
        });
        return out;
      });
      /* eslint-enable no-undef */
      expect(unnamed, `controls with no label/aria-label: ${unnamed.join(', ')}`).toEqual([]);
      console.log(`✅ ${page_}: all form controls have an accessible name`);
    });
  }

  // Was: every tester opened http://<lan-ip>:3000, where the browser hides
  // getUserMedia, so voice calls and voice messages were impossible.
  test('14.5 LAN clients are redirected to HTTPS, localhost is not', async () => {
    const url  = new URL(BASE_URL);
    const ctx  = await request.newContext({ ignoreHTTPSErrors: true });

    // localhost is already a secure origin and the suite drives it — never redirect.
    const local = await ctx.get(BASE_URL, { maxRedirects: 0 });
    expect(local.status(), 'localhost must not be redirected').toBe(200);

    // A LAN address must be sent to the HTTPS port so the mic is available.
    const os   = require('os');
    const lan  = Object.values(os.networkInterfaces()).flat()
      .find(i => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'));
    test.skip(!lan, 'no non-internal IPv4 address on this machine');

    const res = await ctx.get(`http://${lan.address}:${url.port}/`, { maxRedirects: 0 });
    expect(res.status(), 'LAN HTTP must redirect').toBe(302);
    expect(res.headers()['location']).toMatch(/^https:\/\//);

    // A POST must NOT be redirected — a 302 would silently drop its body.
    const post = await ctx.post(`http://${lan.address}:${url.port}/api/login`,
      { data: { email: 'nobody@cics.msu.edu', password: 'wrong' }, maxRedirects: 0 });
    expect(post.status(), 'POST must reach the handler, not a redirect').not.toBe(302);

    await ctx.dispose();
    console.log(`✅ ${lan.address} → ${res.headers()['location']}; localhost 200; POST not redirected`);
  });
});
