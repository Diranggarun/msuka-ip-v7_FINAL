// ═══════════════════════════════════════════════════════════════════
//  MSUkaIP — API & Security Suite
//  Chapter 3: System Testing — back-end / integration coverage
//
//  Complements the UI suites (msuka-ip.spec.js, smoke.spec.js) by
//  exercising the REST API directly. These tests are fast, deterministic
//  and verify the auth rules, security guards and a full account
//  lifecycle that the click-through tests cannot easily reach.
//
//  Run with:  npm test -- api
// ═══════════════════════════════════════════════════════════════════
const { test, expect, request } = require('@playwright/test');

const BASE_URL    = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@cics.msu.edu';
const ADMIN_PASS  = 'admin123';
const USER_EMAIL  = 'student@cics.msu.edu';
const USER_PASS   = 'student123';

// 1×1 transparent PNG — used for the file-upload integration test
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 7: Registration API
// ═══════════════════════════════════════════════════════════════════
test.describe('7. Registration API', () => {

  let ctx;
  test.beforeEach(async () => { ctx = await request.newContext({ baseURL: BASE_URL }); });
  test.afterEach(async () => { await ctx.dispose(); });

  test('7.1 rejects registration with missing fields', async () => {
    const r = await ctx.post('/api/register', { data: { email: 'x@cics.msu.edu' } });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toMatch(/required/i);
    console.log('✅ Missing fields rejected (400)');
  });

  test('7.2 rejects password shorter than 6 characters', async () => {
    const r = await ctx.post('/api/register', {
      data: { name: 'Short Pass', email: `short_${Date.now()}@cics.msu.edu`, password: '123' },
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toMatch(/6 characters/i);
    console.log('✅ Short password rejected (400)');
  });

  test('7.3 rejects non-institutional email domain', async () => {
    const r = await ctx.post('/api/register', {
      data: { name: 'Outsider', email: `person_${Date.now()}@gmail.com`, password: 'secret123' },
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toMatch(/institutional/i);
    console.log('✅ Non-institutional email rejected (400)');
  });

  test('7.4 accepts a valid institutional registration (lands in pending)', async () => {
    const email = `pwreg_${Date.now()}@cics.msu.edu`;
    const r = await ctx.post('/api/register', {
      data: { name: 'PW Register', email, password: 'secret123' },
    });
    expect(r.ok()).toBeTruthy();
    expect((await r.json()).message).toMatch(/approval/i);
    console.log('✅ Valid registration accepted — awaiting approval');
  });

  test('7.5 rejects a duplicate email', async () => {
    const r = await ctx.post('/api/register', {
      data: { name: 'Duplicate', email: USER_EMAIL, password: 'secret123' },
    });
    expect(r.status()).toBe(409);
    expect((await r.json()).error).toMatch(/already registered/i);
    console.log('✅ Duplicate email rejected (409)');
  });

});

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 8: Authentication API (portal separation)
// ═══════════════════════════════════════════════════════════════════
test.describe('8. Authentication API', () => {

  let ctx;
  test.beforeEach(async () => { ctx = await request.newContext({ baseURL: BASE_URL }); });
  test.afterEach(async () => { await ctx.dispose(); });

  test('8.1 chat login rejects invalid credentials', async () => {
    const r = await ctx.post('/api/login', { data: { email: USER_EMAIL, password: 'wrongpass' } });
    expect(r.status()).toBe(401);
    expect((await r.json()).error).toMatch(/invalid credentials/i);
    console.log('✅ Invalid chat credentials rejected (401)');
  });

  test('8.2 chat login rejects a freshly-registered (pending) account', async () => {
    const email = `pwpending_${Date.now()}@cics.msu.edu`;
    await ctx.post('/api/register', { data: { name: 'Pending User', email, password: 'secret123' } });
    const r = await ctx.post('/api/login', { data: { email, password: 'secret123' } });
    expect(r.status()).toBe(403);
    expect((await r.json()).error).toMatch(/pending/i);
    console.log('✅ Pending account blocked from chat (403)');
  });

  test('8.3 chat login blocks admin accounts (wrong portal)', async () => {
    const r = await ctx.post('/api/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
    expect(r.status()).toBe(403);
    expect((await r.json()).error).toMatch(/admin dashboard/i);
    console.log('✅ Admin blocked from chat portal (403)');
  });

  test('8.4 chat login succeeds for an approved student', async () => {
    const r = await ctx.post('/api/login', { data: { email: USER_EMAIL, password: USER_PASS } });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.token).toBeTruthy();
    expect(body.role).toBe('student');
    console.log('✅ Approved student login returns a token');
  });

  test('8.5 admin login blocks non-admin (student) accounts', async () => {
    const r = await ctx.post('/api/admin/login', { data: { email: USER_EMAIL, password: USER_PASS } });
    expect(r.status()).toBe(403);
    expect((await r.json()).error).toMatch(/admin/i);
    console.log('✅ Student blocked from admin portal (403)');
  });

  test('8.6 admin login succeeds for the admin account', async () => {
    const r = await ctx.post('/api/admin/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.token).toBeTruthy();
    expect(body.role).toBe('admin');
    console.log('✅ Admin login returns a token');
  });

});

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 9: Authorization & Security Guards
// ═══════════════════════════════════════════════════════════════════
test.describe('9. Authorization & Security', () => {

  let ctx, adminToken, userToken;

  test.beforeAll(async () => {
    ctx = await request.newContext({ baseURL: BASE_URL });
    adminToken = (await (await ctx.post('/api/admin/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASS } })).json()).token;
    userToken  = (await (await ctx.post('/api/login',       { data: { email: USER_EMAIL,  password: USER_PASS  } })).json()).token;
  });
  test.afterAll(async () => { await ctx.dispose(); });

  test('9.1 protected admin route rejects requests with no token', async () => {
    const r = await ctx.get('/api/admin/stats');
    expect(r.status()).toBe(401);
    expect((await r.json()).error).toMatch(/no token/i);
    console.log('✅ Missing token rejected (401)');
  });

  test('9.2 protected route rejects a malformed token', async () => {
    const r = await ctx.get('/api/admin/stats', { headers: { Authorization: 'Bearer not-a-real-token' } });
    expect(r.status()).toBe(401);
    expect((await r.json()).error).toMatch(/invalid token/i);
    console.log('✅ Malformed token rejected (401)');
  });

  test('9.3 admin route rejects a valid student token (privilege escalation blocked)', async () => {
    const r = await ctx.get('/api/admin/users', { headers: { Authorization: `Bearer ${userToken}` } });
    expect(r.status()).toBe(403);
    expect((await r.json()).error).toMatch(/admin only/i);
    console.log('✅ Student token cannot reach admin route (403)');
  });

  test('9.4 admins cannot read private message content (privacy guard)', async () => {
    const r = await ctx.get('/api/admin/messages', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(r.status()).toBe(403);
    expect((await r.json()).error).toMatch(/private/i);
    console.log('✅ Message content stays private even from admins (403)');
  });

  test('9.5 admin can read aggregate stats with a valid token', async () => {
    const r = await ctx.get('/api/admin/stats', { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body).toHaveProperty('totalUsers');
    expect(Number(body.totalUsers)).toBeGreaterThanOrEqual(0);
    console.log('✅ Admin can read aggregate stats');
  });

  test('9.6 survey submission requires respondent type and device', async () => {
    const r = await ctx.post('/api/survey', { data: { name: 'No Type' } });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toMatch(/required/i);
    console.log('✅ Survey rejects missing type/device (400)');
  });

});

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 10: Account Lifecycle (register → approve → login → delete)
// ═══════════════════════════════════════════════════════════════════
test.describe('10. Account Lifecycle', () => {

  test('10.1 a registered account becomes usable only after admin approval', async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });
    const email = `pwlife_${Date.now()}@cics.msu.edu`;
    const pass  = 'lifecycle123';

    // 1. Register — account starts in "pending"
    const reg = await ctx.post('/api/register', { data: { name: 'Lifecycle User', email, password: pass } });
    expect(reg.ok()).toBeTruthy();

    // 2. Admin logs in
    const adminToken = (await (await ctx.post('/api/admin/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASS } })).json()).token;
    const authHeader = { Authorization: `Bearer ${adminToken}` };

    // 3. The new account shows up in the pending queue
    const pending = await (await ctx.get('/api/admin/pending', { headers: authHeader })).json();
    const row = pending.find(u => u.email === email);
    expect(row, 'new account should appear in pending queue').toBeDefined();

    // 4. Login is still blocked while pending
    const blocked = await ctx.post('/api/login', { data: { email, password: pass } });
    expect(blocked.status()).toBe(403);

    // 5. Admin approves the account
    const approve = await ctx.put(`/api/admin/users/${row.id}/approve`, { headers: authHeader });
    expect(approve.ok()).toBeTruthy();

    // 6. Login now succeeds
    const ok = await ctx.post('/api/login', { data: { email, password: pass } });
    expect(ok.ok()).toBeTruthy();
    expect((await ok.json()).token).toBeTruthy();

    // 7. Cleanup — admin removes the test account
    const del = await ctx.delete(`/api/admin/users/${row.id}`, { headers: authHeader });
    expect(del.ok()).toBeTruthy();

    await ctx.dispose();
    console.log('✅ Full lifecycle verified: pending → approved → login → deleted');
  });

});

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 11: File Upload API (integration)
// ═══════════════════════════════════════════════════════════════════
test.describe('11. File Upload API', () => {

  let ctx, userToken;

  test.beforeAll(async () => {
    ctx = await request.newContext({ baseURL: BASE_URL });
    userToken = (await (await ctx.post('/api/login', { data: { email: USER_EMAIL, password: USER_PASS } })).json()).token;
  });
  test.afterAll(async () => { await ctx.dispose(); });

  test('11.1 upload rejects requests with no token', async () => {
    const r = await ctx.post('/api/upload');
    expect(r.status()).toBe(401);
    console.log('✅ Unauthenticated upload rejected (401)');
  });

  test('11.2 authenticated user can upload an image', async () => {
    const r = await ctx.post('/api/upload', {
      headers: { Authorization: `Bearer ${userToken}` },
      multipart: {
        convKey: 'group_general',
        file: { name: 'pw-test.png', mimeType: 'image/png', buffer: PNG_1x1 },
      },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.type).toBe('image');
    expect(body.file_url).toMatch(/^\/uploads\//);
    console.log(`✅ Image uploaded — served at ${body.file_url}`);
  });

  test('11.3 rejects a disallowed file type', async () => {
    const r = await ctx.post('/api/upload', {
      headers: { Authorization: `Bearer ${userToken}` },
      multipart: {
        convKey: 'group_general',
        file: { name: 'malware.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') },
      },
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toMatch(/not allowed/i);
    console.log('✅ Disallowed file type rejected (400)');
  });

});
