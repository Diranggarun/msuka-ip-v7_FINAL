// ═══════════════════════════════════════════════════════════════════
//  MSUkaIP — Smoke Suite (60-second sanity check before defense day)
//
//  Complements the full `msuka-ip.spec.js` suite. This file verifies
//  the most critical paths that we recently added or hardened:
//    - Server is reachable
//    - Student login lands in chat
//    - Admin login lands in admin dashboard
//    - Notifications rail button + panel work
//    - Feedback form submits and persists
//    - Admin survey endpoint returns the new row
//
//  Run with:  npm test -- smoke
// ═══════════════════════════════════════════════════════════════════
const { test, expect, request } = require('@playwright/test');

const BASE_URL    = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@cics.msu.edu';
const ADMIN_PASS  = 'admin123';
const USER_EMAIL  = 'student@cics.msu.edu';
const USER_PASS   = 'student123';

test.describe('Smoke — system reachable & auth working', () => {

  test('server responds at root', async ({ page }) => {
    const resp = await page.goto(BASE_URL);
    expect(resp.status()).toBe(200);
    await expect(page.locator('#login-email')).toBeVisible();
  });

  test('student can log in and chat dashboard renders', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.fill('#login-email', USER_EMAIL);
    await page.fill('#login-password', USER_PASS);
    await page.click('button:has-text("Sign In"), button[onclick="login()"]');
    await expect(page.locator('#app')).toBeVisible({ timeout: 8000 });
    // Rail buttons we recently added should be visible after login
    await expect(page.locator('#rail-notif')).toBeVisible();
    await expect(page.locator('#rail-globalchat')).toBeVisible();
  });

  test('admin can log in and admin dashboard renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin.html`);
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PASS);
    await page.click('button:has-text("Sign In"), button[onclick="login()"]');
    // Admin rail buttons
    await expect(page.locator('.rail-tab', { hasText: 'Pending' })).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.rail-tab', { hasText: 'Feedback' })).toBeVisible();
  });

});

test.describe('Smoke — notifications panel', () => {

  test('clicking Notifications rail tab swaps left panel to notifications view', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.fill('#login-email', USER_EMAIL);
    await page.fill('#login-password', USER_PASS);
    await page.click('button:has-text("Sign In"), button[onclick="login()"]');
    await expect(page.locator('#app')).toBeVisible({ timeout: 8000 });

    await page.click('#rail-notif');
    // Title in left panel header should flip to "Notifications"
    await expect(page.locator('.left-header-titles h2')).toHaveText('Notifications', { timeout: 4000 });
    // Section visible
    await expect(page.locator('#section-notif')).toBeVisible();
  });

});

test.describe('Smoke — survey persistence (recent feature)', () => {

  test('public POST /api/survey saves and admin GET /api/admin/survey returns it', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });

    // 1. Submit a feedback response anonymously (no auth)
    const sectionScores = {
      a: { title:'System Usability',  scores:[5,4,5,4,5], mean:4.60 },
      b: { title:'Functionality',     scores:[5,5,4,4,4,5,5], mean:4.57 },
      c: { title:'Performance',       scores:[4,5,5,4,5], mean:4.60 },
      d: { title:'User Satisfaction', scores:[5,5,5,4,5], mean:4.80 },
    };
    const overall = 4.64;
    const tag = 'smoke_' + Date.now();
    const post = await ctx.post('/api/survey', {
      data: { name: tag, type: 'Student (4th Year IT/CS)', device: 'Desktop/Laptop (Windows)', date: '2026-05-14', sectionScores, overall },
    });
    expect(post.ok()).toBeTruthy();

    // 2. Admin logs in, fetches survey, finds our row
    const login = await ctx.post('/api/admin/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
    expect(login.ok()).toBeTruthy();
    const { token } = await login.json();

    const got = await ctx.get('/api/admin/survey', { headers: { Authorization: `Bearer ${token}` } });
    expect(got.ok()).toBeTruthy();
    const body = await got.json();
    const found = body.responses.find(r => r.respondent_name === tag);
    expect(found).toBeDefined();
    expect(Number(found.overall)).toBeCloseTo(4.64, 1);

    // 3. CSV export endpoint is wired and content-type is correct
    const csv = await ctx.get('/api/admin/survey.csv', { headers: { Authorization: `Bearer ${token}` } });
    expect(csv.ok()).toBeTruthy();
    expect(csv.headers()['content-type']).toContain('text/csv');

    await ctx.dispose();
  });

});

test.describe('Smoke — feedback form renders', () => {

  test('feedback page loads with all four sections + submit', async ({ page }) => {
    await page.goto(`${BASE_URL}/feedback.html`);
    await expect(page.locator('h2')).toContainText('Feedback');
    // Four section panels
    for (const sec of ['a','b','c','d']) {
      await expect(page.locator(`#section-${sec}`)).toBeVisible();
    }
    await expect(page.locator('button:has-text("Submit Feedback")')).toBeVisible();
  });

});
