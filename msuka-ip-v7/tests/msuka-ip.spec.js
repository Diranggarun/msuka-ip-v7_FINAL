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
async function acceptAgreement(page) {
  const accept = page.locator('.agree-accept');
  if (await accept.isVisible().catch(() => false)) {
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

});

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 2: Messenger UI
// ═══════════════════════════════════════════════════════════════════
test.describe('2. Messenger UI Tests', () => {

  test.beforeEach(async ({ page }) => {
    await studentLogin(page);
  });

  test('2.1 Icon-rail navigation buttons are visible', async ({ page }) => {
    await expect(page.locator('#rail-global')).toBeVisible();
    await expect(page.locator('#rail-globalchat')).toBeVisible();
    await expect(page.locator('#rail-groups')).toBeVisible();
    await expect(page.locator('#rail-private')).toBeVisible();
    console.log('✅ All rail navigation buttons visible');
  });

  test('2.2 Global Chat opens from the rail', async ({ page }) => {
    await openGlobalChat(page);
    await expect(page.locator('#section-globalchat')).toBeVisible();
    await expect(page.locator('#chat-panel')).toBeVisible();
    await expect(page.locator('#chat-title')).toContainText('Global Chat');
    console.log('✅ Global Chat opens correctly');
  });

  test('2.3 Groups section shows + New Group button', async ({ page }) => {
    await page.click('#rail-groups');
    await expect(page.locator('#section-groups')).toBeVisible();
    await expect(page.locator('#section-groups button')).toContainText('New Group');
    console.log('✅ Groups section with New Group button visible');
  });

  test('2.4 Private section is reachable', async ({ page }) => {
    await page.click('#rail-private');
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
    await page.click('#rail-groups');
    await page.fill('#search-input', 'BSIT');
    await expect(page.locator('#search-input')).toHaveValue('BSIT');
    console.log('✅ Search box works');
  });

  test('2.8 New Group modal opens', async ({ page }) => {
    await page.click('#rail-groups');
    await page.click('#section-groups button');
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await expect(page.locator('#group-name-input')).toBeVisible();
    console.log('✅ New Group modal opens');
  });

  test('2.9 New Group modal can be closed', async ({ page }) => {
    await page.click('#rail-groups');
    await page.click('#section-groups button');
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await page.click('.btn-cancel');
    await expect(page.locator('#modal-overlay')).not.toBeVisible();
    console.log('✅ Group modal closes correctly');
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

  test('5.3 Pending panel is visible by default', async ({ page }) => {
    await expect(page.locator('#tab-pending')).toBeVisible();
    console.log('✅ Pending panel visible');
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

  test('6.12 phone: admin dashboard is usable when logged in', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await adminLogin(page);
    // eslint-disable-next-line no-undef -- evaluated in the browser page context
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollW, 'admin dashboard overflows on a phone').toBeLessThanOrEqual(376);

    // The side rail becomes a bottom tab bar, so it spans the full width.
    const railBox = await page.locator('.admin-rail').boundingBox();
    expect(Math.round(railBox.width)).toBeGreaterThan(300);
    console.log(`✅ Admin usable on phone — no overflow, rail is a ${Math.round(railBox.width)}px bottom bar`);
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
