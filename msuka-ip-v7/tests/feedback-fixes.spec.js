// ═══════════════════════════════════════════════════════════════════
//  MSUkaIP – tests for the survey-feedback fixes (2026-11-07)
//  History shows the newest messages, replies, reactions, per-chat drafts,
//  adding group members, "Forgot password", the app's own dialogs, and
//  Enter = new line on phones.
//  Run against a TEST COPY only: BASE_URL + SQLITE_PATH (see CLAUDE.md).
// ═══════════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const STAMP = Date.now();
test.setTimeout(60000); // two browsers + sockets per test; the suite default (15s) is too tight under load
const U1 = { name: 'Fx One', email: `fxone${STAMP}@cics.msu.edu`, password: 'fxpass1234' };
const U2 = { name: 'Fx Two', email: `fxtwo${STAMP}@cics.msu.edu`, password: 'fxpass1234' };
const U3 = { name: 'Fx Three', email: `fxthree${STAMP}@cics.msu.edu`, password: 'fxpass1234' };


async function adminToken(request) {
  const r = await request.post(`${BASE_URL}/api/admin/login`, { data: { email: 'admin@cics.msu.edu', password: 'admin123' } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).token;
}

async function chatLogin(page, u) {
  await page.goto(`${BASE_URL}/index.html`);
  await page.fill('#login-email', u.email);
  await page.fill('#login-password', u.password);
  await page.click('button.btn-login');
  await page.waitForSelector('#app', { state: 'visible', timeout: 8000 });
  const accept = page.locator('.agree-accept');
  if (await accept.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      // eslint-disable-next-line no-undef -- browser context
      for (const sel of ['.agree-body', '.agree-card']) { const el = document.querySelector(sel); if (el) el.scrollTop = el.scrollHeight; }
    });
    // eslint-disable-next-line no-undef -- browser context
    await page.waitForFunction(() => !document.getElementById('agree-check').disabled, null, { timeout: 4000 });
    await page.check('#agree-check');
    await accept.click();
    await page.locator('#agree-overlay').waitFor({ state: 'hidden', timeout: 4000 });
  }
}

async function openGeneral(page) {
  // Wait until the chat list exists (sockets connect after login), then open.
  // eslint-disable-next-line no-undef -- browser context
  await page.waitForFunction(() => typeof conversations === 'object' && !!conversations.group_general, null, { timeout: 15000 });
  // eslint-disable-next-line no-undef -- browser context
  await page.evaluate(() => openConversation('group_general'));
  await expect(page.locator('#chat-title')).toBeVisible();
}

async function send(page, text) {
  await page.fill('#msg-input', text);
  await page.locator('#msg-input').press('Enter');
  await expect(page.locator('#messages-area .msg-row.mine', { hasText: text }).last()).toBeVisible({ timeout: 5000 });
}

test.beforeAll(async ({ request }) => {
  if (process.env.BASE_URL && !process.env.SQLITE_PATH)
    throw new Error('Run these against a DB copy: set SQLITE_PATH too.');
  const token = await adminToken(request);
  for (const u of [U1, U2, U3]) {
    const r = await request.post(`${BASE_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` }, data: { ...u, role: 'student' } });
    expect(r.ok()).toBeTruthy();
  }
});

test('F1 history shows the newest messages after a reload', async ({ page }) => {
  await chatLogin(page, U1);
  await openGeneral(page);
  const text = `newest-check ${STAMP}`;
  await send(page, text);
  await page.reload();                      // the session survives a reload
  await page.waitForSelector('#app', { state: 'visible', timeout: 8000 });
  await openGeneral(page);
  await expect(page.locator('#messages-area .msg-row', { hasText: text })).toBeVisible({ timeout: 8000 });
});

test('F2 reply to a specific message shows the quote', async ({ page }) => {
  await chatLogin(page, U1);
  await openGeneral(page);
  const original = `original ${STAMP}`;
  await send(page, original);
  const row = page.locator('#messages-area .msg-row.mine', { hasText: original }).last();
  await row.hover();
  await row.locator('.msg-action-btn[title="Reply"]').click();
  await expect(page.locator('#reply-bar')).toBeVisible();
  await expect(page.locator('#reply-to-text')).toHaveText(original);
  const answer = `answer ${STAMP}`;
  await send(page, answer);
  await expect(page.locator('#reply-bar')).toBeHidden();
  const reply = page.locator('#messages-area .msg-row.mine', { hasText: answer }).last();
  await expect(reply.locator('.reply-quote')).toContainText(original);
});

test('F3 reactions reach the other person live and toggle off', async ({ browser }) => {
  const a = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  const b = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  await chatLogin(a, U1); await openGeneral(a);
  await chatLogin(b, U2); await openGeneral(b);
  const text = `react-me ${STAMP}`;
  await send(a, text);
  const theirs = b.locator('#messages-area .msg-row', { hasText: text }).last();
  await expect(theirs).toBeVisible({ timeout: 5000 });
  await theirs.hover();
  await theirs.locator('.msg-action-btn[title="React"]').click();
  await theirs.locator('.react-pick button[data-emoji="👍"]').click();
  await expect(theirs.locator('.react-chip.mine')).toHaveText('👍 1');
  const mine = a.locator('#messages-area .msg-row.mine', { hasText: text }).last();
  await expect(mine.locator('.react-chip')).toHaveText('👍 1', { timeout: 5000 });
  await theirs.locator('.react-chip').click();               // same emoji again removes it
  await expect(mine.locator('.react-chip')).toHaveCount(0, { timeout: 5000 });
  await a.context().close(); await b.context().close();
});

test('F4 an unsent draft stays with its own chat', async ({ page }) => {
  await chatLogin(page, U1);
  await openGeneral(page);
  await page.fill('#msg-input', 'half-typed for CICS Chat');
  // eslint-disable-next-line no-undef -- browser context
  await page.evaluate(email => openConversation('private_' + email), U2.email);
  await expect(page.locator('#msg-input')).toHaveValue('');
  await openGeneral(page);
  await expect(page.locator('#msg-input')).toHaveValue('half-typed for CICS Chat');
});

test('F5 members can be added to an existing group', async ({ browser }) => {
  const a = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  const b = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  await chatLogin(a, U1); await chatLogin(b, U2);
  const group = `Fx Group ${STAMP}`;
  // eslint-disable-next-line no-undef -- browser context
  await a.evaluate(name => socket.emit('group:create', { name, members: [] }), group);
  // eslint-disable-next-line no-undef -- browser context
  await a.waitForFunction(name => Object.values(conversations).some(c => c.name === name), group);
  // eslint-disable-next-line no-undef -- browser context
  await a.evaluate(name => openConversation(Object.keys(conversations).find(k => conversations[k].name === name)), group);
  await a.click('#add-members-btn');
  await expect(a.locator('#modal-title')).toContainText('Add members');
  await a.fill('#member-search', U2.email);
  await a.locator('#members-checklist .member-check', { hasText: U2.email }).locator('input').check();
  await a.click('#modal-overlay .btn-confirm');
  await expect(a.locator('#messages-area .msg-row.system', { hasText: `added ${U2.name}` })).toBeVisible({ timeout: 5000 });
  // eslint-disable-next-line no-undef -- browser context
  await b.waitForFunction(name => Object.values(conversations).some(c => c.name === name), group, { timeout: 5000 });
  await a.context().close(); await b.context().close();
});

test('F6 forgot password flags the account for the admin', async ({ request }) => {
  const r = await request.post(`${BASE_URL}/api/forgot-password`, { data: { email: U1.email } });
  expect(r.ok()).toBeTruthy();
  const unknown = await request.post(`${BASE_URL}/api/forgot-password`, { data: { email: `nobody${STAMP}@cics.msu.edu` } });
  expect((await unknown.json()).message).toBe((await r.json()).message); // no account enumeration
  const token = await adminToken(request);
  const users = await (await request.get(`${BASE_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(users.find(u => u.email === U1.email).reset_requested_at).toBeTruthy();
});

test('F7 delete asks with the app dialog, not the browser box', async ({ page }) => {
  await chatLogin(page, U1);
  await openGeneral(page);
  const text = `delete-me ${STAMP}`;
  await send(page, text);
  let nativeDialog = false;
  page.on('dialog', d => { nativeDialog = true; d.dismiss(); });
  const row = page.locator('#messages-area .msg-row.mine', { hasText: text }).last();
  await row.hover();
  await row.locator('.msg-action-btn[title="Delete message"]').click();
  await expect(page.locator('#app-dialog')).toBeVisible();
  await page.click('#app-dialog-cancel');
  await expect(row).toBeVisible();
  expect(nativeDialog).toBe(false);
});

test('F8 on a phone, Enter makes a new line instead of sending', async ({ browser, browserName }) => {
  test.skip(browserName === 'firefox', 'Firefox has no mobile emulation (isMobile)');
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await chatLogin(page, U1);
  await openGeneral(page);
  await page.fill('#msg-input', 'line one');
  await page.locator('#msg-input').press('Enter');
  await expect(page.locator('#msg-input')).not.toHaveValue('');
  await ctx.close();
});

test('F9 sign out asks first and Back closes an open chat', async ({ page }) => {
  await chatLogin(page, U1);
  await openGeneral(page);
  await page.goBack();                                   // phone Back: leave the chat, stay in the app
  await expect(page.locator('#app')).not.toHaveClass(/chat-open/);
  await expect(page.locator('#app')).toBeVisible();
  await page.click('#rail-signout');
  await expect(page.locator('#app-dialog')).toBeVisible();
  await page.click('#app-dialog-cancel');                // cancelling keeps you signed in
  await expect(page.locator('#app')).toBeVisible();
});

test('F10 load older messages pages back through a long chat', async ({ page }) => {
  await chatLogin(page, U1);
  await openGeneral(page);
  // CICS Chat on the DB copy has well over 100 messages.
  const btn = page.locator('#messages-area .load-older');
  await expect(btn).toBeVisible({ timeout: 8000 });
  // eslint-disable-next-line no-undef -- browser context
  const before = await page.evaluate(() => conversations.group_general.messages.length);
  await btn.click();
  // eslint-disable-next-line no-undef -- browser context
  await page.waitForFunction(n => conversations.group_general.messages.length > n, before, { timeout: 8000 });
});

test('F11 the sender sees "Seen" once the other person opens the chat', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await chatLogin(a, U1); await chatLogin(b, U2);
  // eslint-disable-next-line no-undef -- browser context
  await a.evaluate(email => openConversation('private_' + email), U2.email);
  await send(a, `seen-check ${STAMP}`);
  await expect(a.locator('.msg-seen')).toHaveCount(0);
  // eslint-disable-next-line no-undef -- browser context
  await b.waitForFunction(() => typeof conversations === 'object' && !!conversations.group_general);
  // eslint-disable-next-line no-undef -- browser context
  await b.evaluate(email => openConversation('private_' + email), U1.email);
  await expect(a.locator('.msg-seen')).toHaveText('Seen', { timeout: 8000 });
  await a.context().close(); await b.context().close();
});

test('F12 a file can only be opened by people in its chat', async ({ request }) => {
  const login = async u => (await (await request.post(`${BASE_URL}/api/login`, { data: { email: u.email, password: u.password } })).json()).token;
  const t1 = await login(U1), t3 = await login(U3);
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const up = await request.post(`${BASE_URL}/api/upload`, { headers: { Authorization: `Bearer ${t1}` },
    multipart: { convKey: 'private_' + U2.email, file: { name: 'fx.png', mimeType: 'image/png', buffer: PNG } } });
  expect(up.ok()).toBeTruthy();
  const url = (await up.json()).file_url;
  expect((await request.get(`${BASE_URL}${url}?token=${encodeURIComponent(t1)}`)).status()).toBe(200); // sender
  expect((await request.get(`${BASE_URL}${url}?token=${encodeURIComponent(t3)}`)).status()).toBe(404); // outsider
});
