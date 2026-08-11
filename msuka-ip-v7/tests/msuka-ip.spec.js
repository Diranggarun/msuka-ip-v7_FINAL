// ═══════════════════════════════════════════════════════════════════
//  MSUkaIP – Playwright Test Suite
//  Chapter 3: System Testing (Section 3.4)
//  Tests: Login, Register, Chat, File Upload, Admin Dashboard
//
//  Selectors updated for the modernized UI (icon-rail navigation,
//  single-page index.html, Global Chat opened from the rail).
// ═══════════════════════════════════════════════════════════════════

const { test, expect } = require('@playwright/test');

// ── Test Config ───────────────────────────────────────────────────
const BASE_URL    = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@cics.msu.edu';
const ADMIN_PASS  = 'admin123';
const USER_EMAIL  = 'student@cics.msu.edu';
const USER_PASS   = 'student123';

// ── Shared helpers ────────────────────────────────────────────────
async function studentLogin(page) {
  await page.goto(BASE_URL);
  await page.fill('#login-email', USER_EMAIL);
  await page.fill('#login-password', USER_PASS);
  await page.click('button.btn-login');
  await page.waitForSelector('#app', { state: 'visible', timeout: 8000 });
  // A user must accept the terms agreement after login before the chat is
  // usable; it overlays the app, so tests dismiss it exactly as a user would.
  await acceptAgreement(page);
}

// Accept the post-login terms modal if it is showing. No-op when it isn't
// (e.g. already accepted earlier in the same browser session).
// Clear the gate only — scroll the terms and tick consent — without pressing
// "I Agree". Lets a test assert the enable/disable transitions on their own.
async function acceptAgreementGateOnly(page) {
  await page.evaluate(() => {
    for (const sel of ['.agree-body', '.agree-card']) {
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      const el = document.querySelector(sel);
      if (el) el.scrollTop = el.scrollHeight;
    }
  });
  // eslint-disable-next-line no-undef -- evaluated in the browser page context
  await page.waitForFunction(() => !document.getElementById('agree-check').disabled,
    null, { timeout: 4000 });
  await page.check('#agree-check');
}

async function acceptAgreement(page) {
  const accept = page.locator('.agree-accept');
  if (await accept.isVisible().catch(() => false)) {
    // The agreement is now gated: the consent box unlocks only after the terms
    // have been scrolled to the end, and "I Agree" only after that box is
    // ticked. So a test has to do what a user does.
    await acceptAgreementGateOnly(page);
    await accept.click();
    await page.locator('#agree-overlay').waitFor({ state: 'hidden', timeout: 4000 });
  }
}

async function adminLogin(page) {
  await page.goto(`${BASE_URL}/admin.html`);
  await page.fill('#login-email', ADMIN_EMAIL);
  await page.fill('#login-password', ADMIN_PASS);
  await page.click('button.btn-primary');
  await page.waitForSelector('#app', { state: 'visible', timeout: 8000 });
}

// Global Chat is opened from the icon-rail. The conversation object is
// created once the Socket.IO connection is up, so wait for it first.
async function openGlobalChat(page) {
  await page.waitForFunction(
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    () => typeof conversations !== 'undefined' && !!conversations['group_general'],
    null, { timeout: 8000 }
  );
  await page.click('#rail-globalchat');
  await page.waitForSelector('#chat-panel.active', { state: 'visible', timeout: 8000 });
}

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 1: Authentication
// ═══════════════════════════════════════════════════════════════════
test.describe('1. Authentication Tests', () => {

  test('1.1 Login page loads correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    // The landing hero is the page's single <h1>; the MSUkaIP brand label sits
    // in the sign-in card beside it.
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.auth-brand-name')).toContainText('MSUkaIP');
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    console.log('✅ Login page loaded successfully');
  });

  test('1.2 Register tab switches correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('#tab-register-btn');
    await expect(page.locator('#reg-name')).toBeVisible();
    await expect(page.locator('#reg-email')).toBeVisible();
    await expect(page.locator('#reg-password')).toBeVisible();
    console.log('✅ Register tab works');
  });

  test('1.3 Login with invalid credentials shows error', async ({ page }) => {
    await page.goto(BASE_URL);
    // Unique email per run: a fixed one accumulates failures across repeated
    // suite runs and trips the 5-attempt lockout (429), which would return
    // "Too many failed attempts" instead of the "Invalid credentials" this
    // test is checking. An unknown email still returns "Invalid credentials".
    await page.fill('#login-email', `wrong_${Date.now()}@cics.msu.edu`);
    await page.fill('#login-password', 'wrongpassword');
    await page.click('button.btn-login');
    await expect(page.locator('#login-msg')).toBeVisible();
    await expect(page.locator('#login-msg')).toContainText('Invalid');
    console.log('✅ Invalid login correctly rejected');
  });

  test('1.4 Login with empty fields shows error', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('button.btn-login');
    await expect(page.locator('#login-msg')).toContainText('fill in all fields');
    console.log('✅ Empty login validation works');
  });

  test('1.5 Successful login shows messenger UI', async ({ page }) => {
    await studentLogin(page);
    // Messenger app should appear
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('.left-panel')).toBeVisible();
    console.log('✅ Login successful — messenger UI visible');
  });

  test('1.6 Admin is redirected from the chat login to the Admin Dashboard', async ({ page }) => {
    // By design, admin accounts cannot sign in on the chat page — the
    // /api/login endpoint rejects them and points them at /admin.html.
    await page.goto(BASE_URL);
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PASS);
    await page.click('button.btn-login');
    await expect(page.locator('#login-msg')).toContainText('Admin');
    await expect(page.locator('#app')).toBeHidden();
    console.log('✅ Admin correctly directed to the Admin Dashboard');
  });

  test('1.7 Register with mismatched passwords shows error', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('#tab-register-btn');
    await page.fill('#reg-name', 'Test User');
    await page.fill('#reg-email', 'test@cics.msu.edu');
    await page.fill('#reg-password', 'password123');
    await page.fill('#reg-confirm', 'different123');
    await page.click('button.btn-register');
    await expect(page.locator('#reg-msg')).toContainText('do not match');
    console.log('✅ Password mismatch validation works');
  });

  test('1.8 Register with short password shows error', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('#tab-register-btn');
    await page.fill('#reg-name', 'Test User');
    await page.fill('#reg-email', 'test@cics.msu.edu');
    await page.fill('#reg-password', '123');
    await page.fill('#reg-confirm', '123');
    await page.click('button.btn-register');
    await expect(page.locator('#reg-msg')).toContainText('8 characters');
    console.log('✅ Short password validation works');
  });

  test('1.9 Terms agreement appears after login and must be accepted', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.fill('#login-email', USER_EMAIL);
    await page.fill('#login-password', USER_PASS);
    await page.click('button.btn-login');
    // The agreement overlays the app and must be dealt with first.
    await expect(page.locator('#agree-overlay')).toBeVisible();
    await expect(page.locator('#agree-title')).toContainText('Terms of Use');
    // Consent is gated: "I Agree" is disabled until the box is ticked, and the
    // box itself only unlocks once the terms have been read. The button being
    // disabled on open holds regardless of whether the terms need scrolling.
    await expect(page.locator('.agree-accept')).toBeDisabled();
    // Unticking must put the button back — the gate is not one-way.
    await acceptAgreementGateOnly(page);
    await expect(page.locator('.agree-accept')).toBeEnabled();
    await page.uncheck('#agree-check');
    await expect(page.locator('.agree-accept')).toBeDisabled();
    await page.check('#agree-check');
    await page.click('.agree-accept');
    await expect(page.locator('#agree-overlay')).toBeHidden();
    // After accepting, the chat is reachable.
    await expect(page.locator('.left-panel')).toBeVisible();
    console.log('✅ Agreement shown, accepted, chat unlocked');
  });

  // Regression guard: .auth-card once had overflow:hidden with no height cap,
  // which clipped the taller Create Account form on short viewports so the
  // submit button could not be reached. The fix (max-height + overflow-y:auto)
  // has been overwritten once by unrelated styling edits — this test fails if
  // that happens again.
  test('1.11 register submit stays reachable on a short viewport', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 600 });
    await page.goto(BASE_URL);
    await page.click('#tab-register-btn');
    // Without the height cap the card simply grows past the bottom of the
    // screen (805px tall in a 600px window) and nothing can scroll to its
    // footer. The cap is what keeps it on-screen and makes it scroll its own
    // content, so assert the card fits the viewport.
    const cardH = await page.locator('.auth-card')
      .evaluate(el => el.getBoundingClientRect().height);
    const viewportH = page.viewportSize().height;
    expect(cardH, 'auth card is taller than the screen, so its footer is unreachable')
      .toBeLessThanOrEqual(viewportH);
    // And the submit button must be genuinely clickable once scrolled to.
    const submit = page.locator('button.btn-register');
    await submit.scrollIntoViewIfNeeded();
    await submit.click({ trial: true });
    console.log(`✅ Register submit reachable at 420x600 (card ${Math.round(cardH)}px in ${viewportH}px viewport)`);
  });

  test('1.10 Declining the agreement signs the user out', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.fill('#login-email', USER_EMAIL);
    await page.fill('#login-password', USER_PASS);
    await page.click('button.btn-login');
    await expect(page.locator('#agree-overlay')).toBeVisible();
    await page.click('.agree-decline');
    // Declining logs out — back to the auth screen, app hidden.
    await expect(page.locator('#auth-screen')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    console.log('✅ Declining the agreement logs the user out');
  });

  // Regression guard: the pinned login header (.auth-sticky) condenses on scroll,
  // and it lives *inside* the element it scrolls. Condensing therefore shrinks
  // .auth-card's own scrollHeight, and if that takes the content below the point
  // where it still overflows, the browser clamps scrollTop back toward 0 — which
  // reads to the user as the Create Account form refusing to stay scrolled.
  //
  // Two separate mechanisms could re-introduce that, so both viewports matter:
  //   420x700 guards the condense gate in the scroll listener. Remove the
  //           `room - condenseReclaim > 48` term and this drops 150 -> 10.
  //   420x560 guards `overflow-anchor:none` on .auth-card. Restore Chrome's
  //           scroll anchoring and this drops to 0 after a few header flips.
  // Deleting either one fails this test on the viewport that covers it.
  for (const vh of [560, 700]) {
    test(`1.12 register form holds its scroll position at 420x${vh}`, async ({ page }) => {
      // Waiting out the card's entry animation plus the settle window costs ~19s
      // in Firefox with video capture on — over the 15s default. Triple it.
      test.slow();
      await page.setViewportSize({ width: 420, height: vh });
      await page.goto(BASE_URL);
      // .auth-card animates in (cardIn, .6s after a .52s delay). Scrolling before
      // that settles measures a still-transforming box and gives a bogus result.
      await page.waitForFunction(() => {
        // eslint-disable-next-line no-undef -- evaluated in the browser page context
        const c = document.querySelector('.auth-card');
        return c && c.getAnimations().every(a => a.playState === 'finished');
      });
      await page.click('#tab-register-btn');

      const card = page.locator('.auth-card');
      // The form must actually overflow, or the test proves nothing.
      const room = await card.evaluate(el => el.scrollHeight - el.clientHeight);
      expect(room, 'register form does not overflow, so there is nothing to hold')
        .toBeGreaterThan(100);

      await card.evaluate(el => { el.scrollTop = 150; });
      // The collapse is not instant: the header shrink is transitioned, so the
      // clamp walks scrollTop down over several frames. Wait it out, then sample
      // twice to confirm the position is settled and not still drifting.
      await page.waitForTimeout(1200);
      const settled = await card.evaluate(el => Math.round(el.scrollTop));
      await page.waitForTimeout(400);
      const stillThere = await card.evaluate(el => Math.round(el.scrollTop));

      expect(settled, 'scroll position collapsed back toward the top')
        .toBeGreaterThan(48);
      expect(stillThere, 'scroll position was still drifting after settling')
        .toBe(settled);
      console.log(`✅ Register scroll holds at 420x${vh} (asked for 150, settled at ${settled}, room ${room}px)`);
    });
  }

  // Switching tabs changes how tall the form is, so both halves of the scroll
  // state have to reset together. Clearing .is-condensed matters on its own: if
  // only scrollTop were reset, a card already at the top fires no scroll event,
  // and the header would stay condensed over a form that cannot scroll.
  test('1.13 switching auth tabs resets the card scroll state', async ({ page }) => {
    test.slow();   // same entry-animation + settle cost as 1.12
    await page.setViewportSize({ width: 420, height: 560 });
    await page.goto(BASE_URL);
    await page.waitForFunction(() => {
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      const c = document.querySelector('.auth-card');
      return c && c.getAnimations().every(a => a.playState === 'finished');
    });
    await page.click('#tab-register-btn');
    const card = page.locator('.auth-card');
    await card.evaluate(el => { el.scrollTop = 150; });
    await page.waitForTimeout(1200);
    // Sanity: we are genuinely scrolled and condensed before switching away.
    expect(await card.evaluate(el => Math.round(el.scrollTop))).toBeGreaterThan(48);
    expect(await page.locator('.auth-sticky').getAttribute('class')).toContain('is-condensed');

    await page.click('#tab-login-btn');
    expect(await card.evaluate(el => Math.round(el.scrollTop)),
      'card kept its old scroll offset after switching tabs').toBe(0);
    // Both header state classes have to clear. Switching to a form that is too
    // short to scroll fires no scroll event, so nothing else would ever reset them.
    const cls = await page.locator('.auth-sticky').getAttribute('class');
    expect(cls, 'header stayed condensed over the shorter Sign In form')
      .not.toContain('is-condensed');
    expect(cls, 'header kept its scrolled fill over a card back at the top')
      .not.toContain('is-scrolled');
    console.log('✅ Tab switch resets scrollTop and clears both header states');
  });

});

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 2: Messenger UI
// ═══════════════════════════════════════════════════════════════════
test.describe('2. Messenger UI Tests', () => {

  test.beforeEach(async ({ page }) => {
    await studentLogin(page);
  });

  // The rail carries only the destinations that have no filter-pill equivalent.
  // Groups and Private moved to the #nav-groups / #nav-private pills, which fire
  // the identical switchNav() calls the removed rail rows used to.
  test('2.1 Icon-rail navigation buttons are visible', async ({ page }) => {
    await expect(page.locator('#rail-global')).toBeVisible();
    await expect(page.locator('#rail-globalchat')).toBeVisible();
    await expect(page.locator('#rail-notif')).toBeVisible();
    await expect(page.locator('#nav-groups')).toBeVisible();
    await expect(page.locator('#nav-private')).toBeVisible();
    console.log('✅ Rail destinations + list filter pills visible');
  });

  test('2.2 Global Chat opens from the rail', async ({ page }) => {
    await openGlobalChat(page);
    await expect(page.locator('#section-globalchat')).toBeVisible();
    await expect(page.locator('#chat-panel')).toBeVisible();
    await expect(page.locator('#chat-title')).toContainText('Global Chat');
    console.log('✅ Global Chat opens correctly');
  });

  // The New Group affordance is now the floating + in the conversation list, which
  // is on screen for every tab rather than only inside the Groups section.
  test('2.3 Groups section is reachable and the New Group + is available', async ({ page }) => {
    await page.click('#nav-groups');
    await expect(page.locator('#section-groups')).toBeVisible();
    await expect(page.locator('.fab-new-group')).toBeVisible();
    await expect(page.locator('.fab-new-group')).toHaveAttribute('aria-label', 'New group');
    console.log('✅ Groups section visible with the floating New Group button');
  });

  test('2.4 Private section is reachable', async ({ page }) => {
    await page.click('#nav-private');
    await expect(page.locator('#section-private')).toBeVisible();
    console.log('✅ Private section visible');
  });

  test('2.5 Opening Global Chat shows message area', async ({ page }) => {
    await openGlobalChat(page);
    await expect(page.locator('#chat-panel')).toBeVisible();
    await expect(page.locator('#messages-area')).toBeVisible();
    await expect(page.locator('#msg-input')).toBeVisible();
    console.log('✅ Global Chat message area visible');
  });

  test('2.6 Input row has all buttons', async ({ page }) => {
    await openGlobalChat(page);
    await expect(page.locator('#attach-btn')).toBeVisible();
    await expect(page.locator('#msg-input')).toBeVisible();
    await expect(page.locator('#ptt-btn')).toBeVisible();
    await expect(page.locator('.send-btn')).toBeVisible();
    console.log('✅ All input buttons visible (attach, PTT, send)');
  });

  test('2.7 Search box accepts input', async ({ page }) => {
    await page.click('#nav-groups');
    await page.fill('#search-input', 'BSIT');
    await expect(page.locator('#search-input')).toHaveValue('BSIT');
    console.log('✅ Search box works');
  });

  test('2.8 New Group modal opens', async ({ page }) => {
    await page.click('#nav-groups');
    await page.click('.fab-new-group');
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await expect(page.locator('#group-name-input')).toBeVisible();
    console.log('✅ New Group modal opens');
  });

  test('2.9 New Group modal can be closed', async ({ page }) => {
    await page.click('#nav-groups');
    await page.click('.fab-new-group');
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await page.click('.btn-cancel');
    await expect(page.locator('#modal-overlay')).not.toBeVisible();
    console.log('✅ Group modal closes correctly');
  });

  test('2.11 Unread pill narrows the All list without breaking live updates', async ({ page }) => {
    await page.waitForFunction(
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      () => typeof conversations !== 'undefined' && !!conversations['group_general'],
      null, { timeout: 8000 });

    // Mark exactly one conversation unread so the filter has something to KEEP,
    // not just something to drop. group_general is skipped deliberately: Global
    // Chat renders as its own pinned item, never a row in #all-list, so marking
    // it unread would leave the filtered list empty and the test would pass
    // while proving nothing.
    const total = await page.evaluate(() => {
      /* eslint-disable no-undef -- evaluated in the browser page context */
      Object.values(conversations).forEach(c => { c.unread = 0; });
      const target = Object.entries(conversations).find(([k]) => k !== 'group_general');
      if (target) target[1].unread = 3;
      renderAllList();
      return { rows: document.querySelectorAll('#all-list .conv-item').length, marked: !!target };
      /* eslint-enable no-undef */
    });
    test.skip(!total.marked || total.rows === 0, 'needs at least one non-global conversation');
    expect(total.rows).toBeGreaterThan(0);

    await page.click('#nav-unread');
    await expect(page.locator('#nav-unread')).toHaveClass(/active/);
    const shown = await page.locator('#all-list .conv-item').count();
    const unread = await page.locator('#all-list .conv-item.unread').count();
    expect(shown, 'the unread conversation must survive the filter').toBeGreaterThan(0);
    expect(shown).toBe(unread);
    expect(shown).toBeLessThan(total.rows);

    // currentNav must stay 'global': the socket handlers test it to decide
    // whether to redraw this list, so 'unread' there would freeze the list as
    // new messages arrive.
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    expect(await page.evaluate(() => currentNav)).toBe('global');

    // Nothing unread must say so rather than render an empty panel.
    await page.evaluate(() => {
      /* eslint-disable no-undef -- evaluated in the browser page context */
      Object.values(conversations).forEach(c => { c.unread = 0; });
      renderAllList();
      /* eslint-enable no-undef */
    });
    await expect(page.locator('#all-list .le-title')).toHaveText('Nothing unread');

    await page.click('#nav-global');
    await expect(page.locator('#all-list .conv-item')).toHaveCount(total.rows);
    console.log(`✅ Unread pill filters ${total.rows} → ${shown}, keeps currentNav global, empties gracefully`);
  });

  test('2.12 Settings validates the password form before spending a request', async ({ page }) => {
    await page.click('#rail-settings');
    await expect(page.locator('#section-settings')).toBeVisible();
    // The name field is filled from the signed-in user on open, not at login.
    await expect(page.locator('#set-name')).toHaveValue(/\S/);

    // The + creates a group; on Settings it means nothing and used to sit on
    // top of the Change password button.
    await expect(page.locator('.fab-new-group')).toBeHidden();

    let calls = 0;
    page.on('request', r => { if (r.url().includes('/api/user/password')) calls++; });

    const submit = page.locator('.settings-card').last().locator('.set-btn');
    await page.fill('#set-cur', 'whatever123');
    await page.fill('#set-new', 'short');
    await page.fill('#set-confirm', 'short');
    await submit.click();
    await expect(page.locator('#password-msg')).toContainText('at least 8 characters');

    await page.fill('#set-new', 'longenough123');
    await page.fill('#set-confirm', 'different123');
    await submit.click();
    await expect(page.locator('#password-msg')).toContainText('do not match');

    // Neither of those should have reached the server — the endpoint shares the
    // login rate limiter, so a client-side mistake must not burn an attempt.
    expect(calls, 'client-side validation must not spend a request').toBe(0);
    console.log('✅ Settings blocks invalid password input without calling the API');
  });

  test('2.13 reduced-transparency fallback actually wins the cascade', async ({ page }) => {
    // Playwright cannot emulate prefers-reduced-transparency, so flip the
    // rule's own condition to `all` and read the computed value. That is the
    // part worth testing anyway: the block spent its first commit sitting
    // ABOVE .left-panel and .icon-rail, and a media query adds no specificity,
    // so the panel rules below simply won and the fallback was dead — while
    // reading, in the source, exactly as if it worked.
    const flipped = await page.evaluate(() => {
      let n = 0;
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch { continue; }
        for (const r of rules) {
          if (r.media && String(r.conditionText || r.media.mediaText).includes('reduced-transparency')) {
            r.media.mediaText = 'all'; n++;
          }
        }
      }
      return n;
    });
    expect(flipped, 'no prefers-reduced-transparency block found').toBeGreaterThan(0);

    const surfaces = await page.evaluate(() => {
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      const cs = s => getComputedStyle(document.querySelector(s));
      return {
        railFilter: cs('.icon-rail').backdropFilter,
        listFilter: cs('.left-panel').backdropFilter,
        railBg: cs('.icon-rail').backgroundColor,
        listBg: cs('.left-panel').backgroundColor,
      };
    });
    expect(surfaces.railFilter, 'rail still blurring under reduced transparency').toBe('none');
    expect(surfaces.listFilter, 'list still blurring under reduced transparency').toBe('none');
    // Opaque, or the text ends up sitting on the gate photograph.
    expect(surfaces.railBg).not.toContain('rgba(0, 0, 0, 0)');
    expect(surfaces.listBg).not.toContain('rgba(0, 0, 0, 0)');
    console.log('✅ Reduced-transparency fallback disables blur and paints both panels opaque');
  });

  test('2.14 Global Chat offers no group call, and the server refuses one', async ({ page }) => {
    await openGlobalChat(page);
    // Global Chat is a group by key, but calling it would be a full mesh across
    // every approved account — N(N-1)/2 peer connections.
    await expect(page.locator('#group-call-btn')).toBeHidden();
    await expect(page.locator('#call-btn')).toBeHidden();

    // Hiding the button is not the guard. Ask the server directly, the way the
    // console would.
    const refusal = await page.evaluate(() => new Promise(resolve => {
      /* eslint-disable no-undef -- evaluated in the browser page context */
      const t = setTimeout(() => resolve('(no reply)'), 4000);
      socket.once('room:error', ({ reason }) => { clearTimeout(t); resolve(reason); });
      socket.emit('room:join', { roomId: 'group_general' });
      /* eslint-enable no-undef */
    }));
    expect(refusal).toMatch(/does not support group calls/i);
    console.log('✅ Global Chat group call hidden in UI and refused by the server');
  });

  test('2.10 Logout button works', async ({ page }) => {
    await page.click('button[onclick="logout()"]');
    await expect(page.locator('#auth-screen')).toBeVisible();
    console.log('✅ Logout works — back to login screen');
  });

});

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 3: Messaging
// ═══════════════════════════════════════════════════════════════════
test.describe('3. Messaging Tests', () => {

  test.beforeEach(async ({ page }) => {
    await studentLogin(page);
    await openGlobalChat(page);
  });

  test('3.1 Can type in message input', async ({ page }) => {
    await page.fill('#msg-input', 'Hello CICS!');
    await expect(page.locator('#msg-input')).toHaveValue('Hello CICS!');
    console.log('✅ Can type in message input');
  });

  test('3.2 Send button is clickable', async ({ page }) => {
    await page.fill('#msg-input', 'Test message from Playwright');
    await page.click('.send-btn');
    // Input should be cleared after sending
    await expect(page.locator('#msg-input')).toHaveValue('');
    console.log('✅ Message sent — input cleared');
  });

  test('3.3 Message appears in chat after sending', async ({ page }) => {
    const testMsg = `Test message ${Date.now()}`;
    await page.fill('#msg-input', testMsg);
    await page.click('.send-btn');
    await expect(page.locator('.bubble', { hasText: testMsg })).toBeVisible({ timeout: 3000 });
    console.log('✅ Message appears in chat after sending');
  });

  test('3.4 Enter key sends message', async ({ page }) => {
    const testMsg = `Enter key test ${Date.now()}`;
    await page.fill('#msg-input', testMsg);
    await page.press('#msg-input', 'Enter');
    await expect(page.locator('.bubble', { hasText: testMsg })).toBeVisible({ timeout: 3000 });
    console.log('✅ Enter key sends message');
  });

  test('3.5 Empty message is not sent', async ({ page }) => {
    const msgsBefore = await page.locator('.bubble').count();
    await page.click('.send-btn');
    const msgsAfter = await page.locator('.bubble').count();
    expect(msgsAfter).toBe(msgsBefore);
    console.log('✅ Empty message not sent');
  });

  test('3.6 Message delivery speed (under 1 second)', async ({ page }) => {
    const testMsg = `Speed test ${Date.now()}`;
    const start = Date.now();
    await page.fill('#msg-input', testMsg);
    await page.click('.send-btn');
    await page.waitForSelector(`.bubble:has-text("${testMsg}")`, { timeout: 1000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
    console.log(`✅ Message delivered in ${elapsed}ms (under 1000ms requirement)`);
  });

});

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 4: File Upload
// ═══════════════════════════════════════════════════════════════════
test.describe('4. File Upload Tests', () => {

  test.beforeEach(async ({ page }) => {
    await studentLogin(page);
    await openGlobalChat(page);
  });

  test('4.1 Attach button is visible', async ({ page }) => {
    await expect(page.locator('#attach-btn')).toBeVisible();
    console.log('✅ Attach button visible');
  });

  test('4.2 File input accepts images', async ({ page }) => {
    const input = page.locator('#file-input');
    await expect(input).toHaveAttribute('accept', /image/);
    console.log('✅ File input accepts image types');
  });

  test('4.3 File input accepts PDFs', async ({ page }) => {
    const input = page.locator('#file-input');
    await expect(input).toHaveAttribute('accept', /\.pdf/);
    console.log('✅ File input accepts PDF');
  });

  test('4.4 PTT (push-to-talk) button is present', async ({ page }) => {
    await expect(page.locator('#ptt-btn')).toBeVisible();
    await expect(page.locator('#ptt-btn svg')).toBeVisible();
    console.log('✅ PTT button visible');
  });

});

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 5: Admin Dashboard
// ═══════════════════════════════════════════════════════════════════
test.describe('5. Admin Dashboard Tests', () => {

  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test('5.1 Admin dashboard loads after login', async ({ page }) => {
    await expect(page.locator('#app')).toBeVisible();
    console.log('✅ Admin dashboard loaded');
  });

  test('5.2 Stats cards are visible', async ({ page }) => {
    // The visible figure is rendered via the .slabel label (the #stat-* div
    // is a hidden data holder — see .stat-card .svalue{display:none} in CSS).
    await expect(page.locator('#lbl-total')).toBeVisible();
    await expect(page.locator('#lbl-online')).toBeVisible();
    await expect(page.locator('#lbl-messages')).toBeVisible();
    // The KPI row now shows Group chats as its fifth tile instead of Pending —
    // the pending queue already has the rail badge and the top-bar bell, so a
    // third copy was redundant. #lbl-pending is no longer in the DOM.
    await expect(page.locator('#lbl-groups')).toBeVisible();
    console.log('✅ Stats cards visible');
  });

  test('5.3 Overview is the default panel and Pending opens from the rail', async ({ page }) => {
    // The landing tab moved from Pending to Overview when the hero chart got
    // its own panel — Pending now starts at the top of the page instead of
    // ~600px below the stats block.
    await expect(page.locator('#tab-overview')).toBeVisible();
    await expect(page.locator('#tab-pending')).toBeHidden();
    await page.click('#rail-pending');
    await expect(page.locator('#tab-pending')).toBeVisible();
    await expect(page.locator('#tab-overview')).toBeHidden();
    console.log('✅ Overview is default; Pending reachable from the rail');
  });

  test('5.4 Users tab shows user table', async ({ page }) => {
    await page.click('button.rail-tab[title="Users"]');
    await expect(page.locator('#users-tbody')).toBeVisible();
    console.log('✅ Users table visible');
  });

  test('5.5 Add User tab shows form', async ({ page }) => {
    await page.click('button.rail-tab[title="Add User"]');
    await expect(page.locator('#new-name')).toBeVisible();
    await expect(page.locator('#new-email')).toBeVisible();
    await expect(page.locator('#new-password')).toBeVisible();
    console.log('✅ Add User form visible');
  });

  test('5.6 Audit Logs tab loads', async ({ page }) => {
    await page.click('button.rail-tab[title="Audit Logs"]');
    await expect(page.locator('#logs-list')).toBeVisible();
    console.log('✅ Audit Logs visible');
  });

  test('5.7 Non-admin cannot access admin dashboard', async ({ page, context }) => {
    const newPage = await context.newPage();
    await newPage.goto(`${BASE_URL}/admin.html`);
    await newPage.fill('#login-email', USER_EMAIL);
    await newPage.fill('#login-password', USER_PASS);
    await newPage.click('button.btn-primary');
    await expect(newPage.locator('.auth-error')).toContainText('Admin');
    console.log('✅ Non-admin blocked from admin dashboard');
  });

  test('5.8 Admin can add a new user', async ({ page }) => {
    await page.click('button.rail-tab[title="Add User"]');
    const testEmail = `testuser_${Date.now()}@cics.msu.edu`;
    await page.fill('#new-name', 'Playwright Test User');
    await page.fill('#new-email', testEmail);
    await page.fill('#new-password', 'test123456');
    await page.click('button.btn-add');
    await expect(page.locator('#add-success')).toBeVisible({ timeout: 3000 });
    console.log('✅ Admin can add new user');
  });

  test('5.9 Online Now and Approved Users panels populate', async ({ page }) => {
    await expect(page.locator('.au-row').first()).toBeVisible({ timeout: 8000 });

    // The heading count must match the rows the panel actually built (or the
    // "Showing N of M" caption when the 40-row cap kicks in).
    const total = Number((await page.locator('#au-count').textContent()).replace(/\D/g, ''));
    const rows = await page.locator('.au-row').count();
    expect(total).toBeGreaterThan(0);
    expect(rows).toBe(Math.min(total, 40));
    if (total > 40) await expect(page.locator('#au-shown')).toHaveText(`Showing 40 of ${total}`);

    // Online Now renders either avatars or an explicit empty state — never blank.
    const onText = (await page.locator('#on-avatars').textContent()).trim();
    const onAvatars = await page.locator('#on-avatars .av').count();
    expect(onAvatars > 0 || /Nobody is online/.test(onText)).toBeTruthy();
    console.log(`✅ Panels populated — ${rows}/${total} user rows, ${onAvatars} online avatar(s)`);
  });

  test('5.10 Role filter tabs split the user list without losing anyone', async ({ page }) => {
    await expect(page.locator('.au-row').first()).toBeVisible({ timeout: 8000 });
    const countFor = async (label) => {
      await page.click(`.au-tab:text-is("${label}")`);
      return Number((await page.locator('#au-count').textContent()).replace(/\D/g, ''));
    };
    const all = await countFor('All');
    const parts = (await countFor('Students')) + (await countFor('Faculty')) + (await countFor('Admins'));
    // Every approved account holds one of the three roles, so the parts must
    // sum to the whole — a mismatch means a role is unreachable in the UI.
    expect(parts).toBe(all);
    console.log(`✅ Role tabs partition the list exactly — ${parts} = ${all}`);
  });

  test('5.11 Panel escapes user-controlled names', async ({ page }) => {
    await expect(page.locator('.au-row').first()).toBeVisible({ timeout: 8000 });
    // Display names reach both panels; a scripted name must stay inert text.
    const injected = await page.evaluate(() => {
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      window.__xss = false;
      // eslint-disable-next-line no-undef
      renderApproved([{ id: 1, name: '<img src=x onerror="window.__xss=true">', email: 'x@cics.msu.edu',
        role: 'student', account_status: 'approved', status: 'offline', created_at: '2026-01-01 00:00:00' }]);
      // eslint-disable-next-line no-undef
      return { fired: window.__xss, imgs: document.querySelectorAll('.au-row img').length };
    });
    expect(injected.fired).toBe(false);
    expect(injected.imgs).toBe(0);
    console.log('✅ Scripted display name renders as inert text in the panels');
  });

  test('5.12 Pending requests paginate ten to a page', async ({ page }) => {
    await page.click('#rail-pending');
    await page.waitForSelector('#pending-tbody tr td', { timeout: 8000 });
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    const total = await page.evaluate(() => pendingUsers.length);
    test.skip(total <= 10, 'needs more than one page of pending requests');

    const rows = await page.locator('#pending-tbody tr').count();
    expect(rows).toBe(10);
    await expect(page.locator('#pending-pager .pager-info')).toHaveText(`Showing 1–10 of ${total}`);
    // On page 1 there is nowhere back to go.
    await expect(page.locator('#pending-pager .pg').first()).toBeDisabled();

    // The final page holds the remainder, and Next is spent.
    const pages = Math.ceil(total / 10);
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    await page.evaluate((p) => gotoPending(p), pages);
    const lastRows = await page.locator('#pending-tbody tr').count();
    expect(lastRows).toBe(total - (pages - 1) * 10);
    await expect(page.locator('#pending-pager .pg').last()).toBeDisabled();
    console.log(`✅ Pending paginates — ${total} requests over ${pages} pages, last page has ${lastRows}`);
  });

  test('5.13 Search reaches pending requests that are not on the current page', async ({ page }) => {
    await page.click('#rail-pending');
    await page.waitForSelector('#pending-tbody tr td', { timeout: 8000 });
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    const total = await page.evaluate(() => pendingUsers.length);
    test.skip(total <= 10, 'needs more than one page of pending requests');

    // Deliberately target the very last record while sitting on page 1: a
    // filter that only hid visible rows could never find it.
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    const target = await page.evaluate(() => pendingUsers[pendingUsers.length - 1].email);
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    await page.evaluate(() => gotoPending(1));
    await page.fill('#tb-search-input', target);
    await expect(page.locator('#pending-tbody tr')).toHaveCount(1);
    await expect(page.locator('#pending-tbody tr').first()).toContainText(target);
    console.log('✅ Search finds a pending request from a later page');
  });

  test('5.14 Pager clamps when the queue shrinks under the current page', async ({ page }) => {
    await page.click('#rail-pending');
    await page.waitForSelector('#pending-tbody tr td', { timeout: 8000 });
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    const total = await page.evaluate(() => pendingUsers.length);
    test.skip(total <= 10, 'needs more than one page of pending requests');

    // Sit on the last page, then shrink the queue to one — what approving a
    // page's worth of requests does. Without the clamp the admin is left
    // staring at an empty page with no way back.
    const state = await page.evaluate(() => {
      /* eslint-disable no-undef -- evaluated in the browser page context */
      gotoPending(Math.ceil(pendingUsers.length / 10));
      pendingUsers = pendingUsers.slice(0, 1);
      renderPending();
      return { page: pendingPage, rows: document.querySelectorAll('#pending-tbody tr').length };
      /* eslint-enable no-undef */
    });
    expect(state.page).toBe(1);
    expect(state.rows).toBe(1);
    console.log('✅ Pager clamps to the last real page instead of stranding on an empty one');
  });

  test('5.15 Every KPI tile receives a value', async ({ page }) => {
    await page.waitForSelector('.kpi-row .stat-card', { timeout: 8000 });
    // Give /stats and /trends a moment to land.
    await expect(page.locator('#lbl-total')).not.toHaveAttribute('data-current', '—', { timeout: 8000 });

    // The visible figure comes from data-current via .slabel::after, so a tile
    // whose id nothing writes to keeps the '—' placeholder and looks plausible.
    // That is exactly what happened to the Group chats tile: stage 2 renamed the
    // ids but the refresh loop still targeted the old #lbl-pending, so one tile
    // was fed by nothing.
    const tiles = await page.evaluate(() =>
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      [...document.querySelectorAll('.kpi-row .slabel')].map(l => ({
        label: l.textContent.trim(),
        value: l.dataset.current,
      })));

    expect(tiles).toHaveLength(5);
    const unfed = tiles.filter(t => !t.value || t.value === '—');
    expect(unfed.map(t => t.label).join(', ')).toBe('');

    // The sparklines were removed in favour of the hero chart — no tile should
    // still be carrying one.
    expect(await page.locator('.kpi-row .stat-spark').count()).toBe(0);
    console.log(`✅ All 5 KPI tiles populated: ${tiles.map(t => `${t.label}=${t.value}`).join(' · ')}`);
  });

  test('5.18 Login monitor cards expand to a history chart, by keyboard, fetched once', async ({ page }) => {
    const series = [];
    page.on('request', r => { if (r.url().includes('/series')) series.push(r.url()); });

    await page.click('#rail-monitor');
    await page.waitForSelector('.mon-card', { timeout: 8000 });
    expect(series, 'history must not be fetched until a card is opened').toHaveLength(0);

    const card = page.locator('.mon-card').first();
    // A real <button>, not a div with an onclick — that is what makes Enter work
    // and lets aria-expanded be announced.
    expect(await card.evaluate(el => el.tagName)).toBe('BUTTON');
    await expect(card).toHaveAttribute('aria-expanded', 'false');

    await card.focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-expanded', 'true');
    await expect(card.locator('.mon-bar').first()).toBeVisible({ timeout: 8000 });
    expect(await card.locator('.mon-bar').count()).toBe(30);
    expect(series).toHaveLength(1);

    // Collapse and reopen: the answer is cached, so no second request.
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    expect(series, 'reopening must not refetch').toHaveLength(1);
    console.log('✅ Monitor card expands via keyboard, renders 30 days, fetches once');
  });

  test('5.19 Clicking a KPI tile plots that metric and survives a refresh', async ({ page }) => {
    await expect(page.locator('#main-chart svg')).toBeVisible({ timeout: 8000 });
    // Default state: two series, no tile pressed.
    await expect(page.locator('.ov-title')).toHaveText('Traffic');
    expect(await page.locator('.kpi-row .stat-card[aria-pressed="true"]').count()).toBe(0);

    // Tiles are buttons, not divs with onclick — that is what makes Enter work.
    expect(await page.locator('.kpi-row .stat-card').first().evaluate(el => el.tagName)).toBe('BUTTON');

    await page.click('.kpi-row .stat-card[data-metric="calls"]');
    await expect(page.locator('.ov-title')).toHaveText('Voice calls');
    await expect(page.locator('.kpi-row .stat-card[data-metric="calls"]')).toHaveAttribute('aria-pressed', 'true');
    // One series plotted means one legend entry; a two-item legend describing a
    // single line is the kind of thing that reads fine and is simply wrong.
    await expect(page.locator('.ov-legend span')).toHaveCount(1);

    // loadStats() calls refreshOverview() every 5 seconds. If the choice lived
    // in the DOM rather than in state, every tick would reset the chart.
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    await page.evaluate(() => refreshOverview());
    await page.waitForTimeout(500);
    await expect(page.locator('.ov-title')).toHaveText('Voice calls');
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    expect(await page.evaluate(() => selectedMetric)).toBe('calls');

    // The range toggle must re-plot the SELECTED metric, not fall back.
    await page.click('#range-toggle button[data-range="month"]');
    await page.waitForTimeout(900);
    await expect(page.locator('.ov-title')).toHaveText('Voice calls');
    await page.click('#range-toggle button[data-range="day"]');
    await page.waitForTimeout(700);

    // Clicking the active tile clears back to the comparison view.
    await page.click('.kpi-row .stat-card[data-metric="calls"]');
    await expect(page.locator('.ov-title')).toHaveText('Traffic');
    await expect(page.locator('.ov-legend span')).toHaveCount(2);
    console.log('✅ KPI tile selects the plotted metric, survives refresh and range change');
  });

  test('5.20 Every KPI tile has a plottable series, including Group chats', async ({ page }) => {
    await expect(page.locator('#main-chart svg')).toBeVisible({ timeout: 8000 });
    // Group chats had no trend series at all until totalGroups was added; the
    // tile was a control that could not plot anything. Assert every tile draws.
    for (const metric of ['total', 'online', 'messages', 'calls', 'groups']) {
      await page.click(`.kpi-row .stat-card[data-metric="${metric}"]`);
      await page.waitForTimeout(450);
      const drawn = await page.evaluate(() => {
        // eslint-disable-next-line no-undef -- evaluated in the browser page context
        const paths = [...document.querySelectorAll('#main-chart path[stroke]')]
          .filter(p => p.getAttribute('stroke') !== 'none');
        return { count: paths.length, d: (paths[0]?.getAttribute('d') || '').length };
      });
      expect(drawn.count, `${metric} plotted no line`).toBe(1);
      expect(drawn.d, `${metric} produced an empty path`).toBeGreaterThan(10);
      await page.click(`.kpi-row .stat-card[data-metric="${metric}"]`);
      await page.waitForTimeout(250);
    }
    console.log('✅ All five metrics plot a real series');
  });

  test('5.16 Overview is the landing tab and owns the hero chart', async ({ page }) => {
    await expect(page.locator('#tab-overview')).toHaveClass(/active/);
    await expect(page.locator('#main-chart svg')).toBeVisible({ timeout: 8000 });

    // The chart belongs to Overview only.
    await page.click('#rail-pending');
    await expect(page.locator('#main-chart')).toBeHidden();
    await expect(page.locator('#pending-tbody tr').first()).toBeVisible();
    console.log('✅ Hero chart is Overview-only; Pending renders without it');
  });

  test('5.17 Hero chart survives a refresh that lands while its tab is hidden', async ({ page }) => {
    await expect(page.locator('#main-chart svg')).toBeVisible({ timeout: 8000 });
    const width = () => page.evaluate(() => {
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      const el = document.getElementById('main-chart');
      const svg = el.querySelector('svg');
      return {
        host: Math.round(el.getBoundingClientRect().width),
        box: svg && Number(svg.getAttribute('viewBox').split(' ')[2]),
      };
    });
    const before = await width();
    expect(before.box).toBe(before.host);

    // loadStats() refreshes every 5s regardless of tab. A hidden element
    // measures 0, and renderMainChart's `|| 620` fallback would bake 620 into
    // the viewBox — the chart returns stretched, not blank, so it is easy to
    // miss. Force that refresh while hidden rather than waiting for the timer.
    await page.click('#rail-pending');
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    await page.evaluate(() => refreshOverview());
    await page.waitForTimeout(400);
    await page.click('#rail-overview');
    await page.waitForTimeout(500);

    const after = await width();
    expect(after.host).toBeGreaterThan(240);
    expect(after.box, 'chart viewBox no longer matches its container').toBe(after.host);
    console.log(`✅ Chart intact after a hidden refresh — viewBox ${after.box} = host ${after.host}`);
  });

});

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 6: Performance & Availability
// ═══════════════════════════════════════════════════════════════════
test.describe('6. Performance & Availability Tests', () => {

  test('6.1 System loads without internet (LAN only check)', async ({ page }) => {
    await page.goto(BASE_URL);
    // If server responds, system is working on LAN
    await expect(page.locator('#auth-screen')).toBeVisible({ timeout: 3000 });
    console.log('✅ System accessible on local network');
  });

  test('6.2 Page load time under 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE_URL);
    await page.waitForSelector('#login-email');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
    console.log(`✅ Page loaded in ${elapsed}ms`);
  });

  test('6.3 Login response under 2 seconds', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.fill('#login-email', USER_EMAIL);
    await page.fill('#login-password', USER_PASS);
    const start = Date.now();
    await page.click('button.btn-login');
    await page.waitForSelector('#app', { state: 'visible', timeout: 5000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    console.log(`✅ Login completed in ${elapsed}ms`);
  });

  test('6.4 UI is responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 size
    await page.goto(BASE_URL);
    await expect(page.locator('#auth-screen')).toBeVisible();
    await expect(page.locator('.auth-card')).toBeVisible();
    console.log('✅ UI visible on mobile viewport (390x844)');
  });

  test('6.5 UI is responsive on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad size
    await page.goto(BASE_URL);
    await expect(page.locator('#auth-screen')).toBeVisible();
    console.log('✅ UI visible on tablet viewport (768x1024)');
  });

  // 6.4 and 6.5 only ever checked the LOGIN screen, so they passed while the
  // chat itself was broken on phones: the rail + conversation list are wider
  // than a 375px screen, which squeezed the chat pane to 0px. These tests log
  // in and measure the real thing so that cannot regress unnoticed.
  test('6.7 phone: chat pane is usable after opening a conversation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await studentLogin(page);
    await openGlobalChat(page);

    const chatWidth  = await page.locator('.right-panel.center-panel').evaluate(el => el.getBoundingClientRect().width);
    const inputWidth = await page.locator('#msg-input').evaluate(el => el.getBoundingClientRect().width);
    expect(chatWidth).toBeGreaterThan(300);   // was 0 before the phone layout
    expect(inputWidth).toBeGreaterThan(120);  // was 80 when 5 buttons crowded it

    // The list gives way to the chat rather than sharing the width.
    await expect(page.locator('.left-panel')).toBeHidden();
    console.log(`✅ Phone chat usable — pane ${Math.round(chatWidth)}px, input ${Math.round(inputWidth)}px`);
  });

  test('6.8 phone: back button returns from chat to the conversation list', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await studentLogin(page);
    await openGlobalChat(page);

    const back = page.locator('.chat-back');
    await expect(back).toBeVisible();
    // Rounded because Firefox reports sub-pixel values (a 44px box measures
    // 43.999999) and this is a touch-target check, not a pixel-perfect one.
    const box = await back.boundingBox();
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);

    await back.click();
    await expect(page.locator('.left-panel')).toBeVisible();
    console.log('✅ Back button returns to conversation list');
  });

  test('6.9 phone: no page scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const path of ['/', '/feedback.html', '/admin.html']) {
      await page.goto(`${BASE_URL}${path}`);
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflows, `${path} scrolls horizontally at 375px`).toBe(false);
    }
    console.log('✅ No horizontal overflow on any page at 375px');
  });

  // The admin dashboard had no phone layout at all — at 320-414px its content
  // was 707px wide and the page scrolled sideways. Checked across the standard
  // breakpoints so it can't silently regress.
  test('6.11 no page scrolls sideways at any phone width', async ({ page }) => {
    for (const width of [320, 375, 414]) {
      for (const path of ['/', '/feedback.html', '/admin.html']) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`${BASE_URL}${path}`);
        // eslint-disable-next-line no-undef -- evaluated in the browser page context
        const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollW, `${path} overflows at ${width}px`).toBeLessThanOrEqual(width + 1);
      }
    }
    console.log('✅ No horizontal overflow on any page at 320/375/414px');
  });

  test('6.13 logged-in admin dashboard does not scroll sideways at desktop widths', async ({ page }) => {
    // 6.11 above only visits /admin.html logged out, so it measures the login
    // screen and has never seen the dashboard. Raising the root font size to
    // 18px pushed the 7-column pending table past its card at 900-1280px and
    // nothing caught it: .card had overflow-x:auto only inside the <=768px
    // block, so above that the table spilled off the page.
    await adminLogin(page);
    await page.click('#rail-pending');
    await page.waitForSelector('#pending-tbody tr td', { timeout: 8000 });

    for (const width of [900, 1100, 1280, 1654]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollW, `admin dashboard overflows at ${width}px`).toBeLessThanOrEqual(width + 1);
    }
    console.log('✅ Admin dashboard has no horizontal overflow at 900/1100/1280/1654px');
  });

  test('6.12 phone: admin dashboard is usable when logged in', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await adminLogin(page);
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollW, 'admin dashboard overflows on a phone').toBeLessThanOrEqual(376);

    // The side rail becomes a bottom tab bar, so it spans the full width.
    const railBox = await page.locator('.admin-rail').boundingBox();
    expect(Math.round(railBox.width)).toBeGreaterThan(300);

    // The two assertions above both passed while the dashboard was unusable:
    // #app kept flex-direction:row, so the full-width rail squeezed
    // .admin-main to 0px. Nothing overflowed and the rail was still wide —
    // the content was simply gone. Measure the content itself.
    const mainBox = await page.locator('.admin-main').boundingBox();
    expect(Math.round(mainBox.width), '.admin-main collapsed — dashboard content is not visible')
      .toBeGreaterThan(300);
    console.log(`✅ Admin usable on phone — content ${Math.round(mainBox.width)}px, rail is a ${Math.round(railBox.width)}px bottom bar`);
  });

  test('6.10 phone: survey answer targets meet the 44px touch minimum', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/feedback.html`);
    // Respondents fill this in on their phones — the Likert label is the hit
    // area because the radio input itself is display:none.
    const undersized = await page.evaluate(() =>
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      [...document.querySelectorAll('.likert-option label')]
        .filter(l => l.getBoundingClientRect().height < 44).length
    );
    expect(undersized).toBe(0);
    console.log('✅ All Likert targets ≥44px on phone');
  });

  test('6.6 Admin dashboard loads under 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}/admin.html`);
    await page.waitForSelector('#login-email');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
    console.log(`✅ Admin dashboard loaded in ${elapsed}ms`);
  });

});
