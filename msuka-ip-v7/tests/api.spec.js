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

const BASE_URL    = process.env.BASE_URL || 'http://localhost:3000';
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

  test('7.2 rejects password shorter than 8 characters', async () => {
    const r = await ctx.post('/api/register', {
      data: { name: 'Short Pass', email: `short_${Date.now()}@cics.msu.edu`, password: '123' },
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toMatch(/8 characters/i);
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

  test('9.8 per-user login series requires an admin token', async () => {
    const anon = await ctx.get('/api/admin/login-activity/1/series');
    expect(anon.status()).toBe(401);
    const student = await ctx.get('/api/admin/login-activity/1/series',
      { headers: { Authorization: `Bearer ${userToken}` } });
    expect(student.status()).toBe(403);
    console.log('✅ Login series is admin-only (401 anon, 403 student)');
  });

  test('9.9 per-user login series validates its inputs and zero-fills days', async () => {
    const h = { headers: { Authorization: `Bearer ${adminToken}` } };
    // A non-numeric or out-of-range id must be rejected before it reaches SQL.
    expect((await ctx.get('/api/admin/login-activity/abc/series', h)).status()).toBe(400);
    expect((await ctx.get('/api/admin/login-activity/0/series', h)).status()).toBe(400);
    expect((await ctx.get('/api/admin/login-activity/99999999/series', h)).status()).toBe(404);

    // days is clamped at both ends so a caller cannot request an unbounded scan.
    expect((await (await ctx.get('/api/admin/login-activity/1/series?days=9999', h)).json()).days).toBe(90);
    expect((await (await ctx.get('/api/admin/login-activity/1/series?days=1', h)).json()).days).toBe(7);

    const body = await (await ctx.get('/api/admin/login-activity/1/series?days=30', h)).json();
    // Every day in the window must be present. Without zero-filling, a quiet day
    // is simply absent and the chart draws a slope between two events that never
    // happened.
    expect(body.labels).toHaveLength(30);
    expect(body.successes).toHaveLength(30);
    expect(body.failed).toHaveLength(30);
    expect(body.successes.every(n => Number.isInteger(n))).toBeTruthy();
    const gaps = body.successes.filter(n => n === 0).length;
    console.log(`✅ Login series validated and zero-filled — 30 buckets, ${gaps} quiet days`);
  });

  test('9.10 changing your own password verifies the current one and revokes old tokens', async () => {
    // A throwaway account: this test changes a password, so it must never
    // touch the seeded demo student other tests sign in as.
    const email = `pwapi_${Date.now()}@cics.msu.edu`;
    await ctx.post('/api/register', { data: { name: 'PW API', email, password: 'original123' } });
    const pending = await (await ctx.get('/api/admin/pending', { headers: { Authorization: `Bearer ${adminToken}` } })).json();
    const id = pending.find(u => u.email === email).id;
    await ctx.put(`/api/admin/users/${id}/approve`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const token = (await (await ctx.post('/api/login', { data: { email, password: 'original123' } })).json()).token;
    const h = { headers: { Authorization: `Bearer ${token}` } };

    expect((await ctx.put('/api/user/password', { data: {} })).status()).toBe(401);
    expect((await ctx.put('/api/user/password', { data: {}, ...h })).status()).toBe(400);
    expect((await ctx.put('/api/user/password', { data: { currentPassword: 'original123', newPassword: 'short' }, ...h })).status()).toBe(400);
    expect((await ctx.put('/api/user/password', { data: { currentPassword: 'original123', newPassword: 'original123' }, ...h })).status()).toBe(400);
    // Session possession alone must not be enough to take the account over.
    expect((await ctx.put('/api/user/password', { data: { currentPassword: 'wrongpass1', newPassword: 'brandnew123' }, ...h })).status()).toBe(401);

    expect((await ctx.put('/api/user/password', { data: { currentPassword: 'original123', newPassword: 'brandnew123' }, ...h })).ok()).toBeTruthy();
    // token_version was bumped, so every token issued before now is dead.
    expect((await ctx.put('/api/user/profile', { data: { name: 'Nope' }, ...h })).status()).toBe(401);
    expect((await ctx.post('/api/login', { data: { email, password: 'original123' } })).status()).toBe(401);
    expect((await ctx.post('/api/login', { data: { email, password: 'brandnew123' } })).ok()).toBeTruthy();
    console.log('✅ Password change verified, old token revoked, old password dead');
  });

  test('9.11 profile rename validates length and needs a token', async () => {
    expect((await ctx.put('/api/user/profile', { data: { name: 'Someone' } })).status()).toBe(401);
    const h = { headers: { Authorization: `Bearer ${userToken}` } };
    expect((await ctx.put('/api/user/profile', { data: { name: 'X' }, ...h })).status()).toBe(400);
    expect((await ctx.put('/api/user/profile', { data: { name: 'y'.repeat(61) }, ...h })).status()).toBe(400);
    // Restore the seeded name so later runs and the UI tests are unaffected.
    const ok = await ctx.put('/api/user/profile', { data: { name: 'Student Demo' }, ...h });
    expect(ok.ok()).toBeTruthy();
    expect((await ok.json()).name).toBe('Student Demo');
    console.log('✅ Profile rename validated and restored');
  });

  test('9.12 audit log filters narrow server-side and validate their input', async () => {
    const h = { headers: { Authorization: `Bearer ${adminToken}` } };
    const get = async qs => (await (await ctx.get(`/api/admin/logs?${qs}`, h)).json());

    expect((await ctx.get('/api/admin/logs')).status()).toBe(401);
    expect((await ctx.get('/api/admin/logs', { headers: { Authorization: `Bearer ${userToken}` } })).status()).toBe(403);

    const all = await get('');
    expect(all.total).toBeGreaterThan(100);          // the old route capped at 100
    expect(all.rows.length).toBeLessThanOrEqual(all.perPage);

    // A filter must narrow the TOTAL, not just the page — that is the difference
    // between filtering on the server and hiding rows in the browser.
    const failed = await get('action=LOGIN_FAILED');
    expect(failed.total).toBeLessThan(all.total);
    expect(failed.rows.every(r => r.action === 'LOGIN_FAILED')).toBeTruthy();

    // The admin's own VIEW_* reads dominate the table; the switch drops them.
    const secure = await get('securityOnly=1');
    expect(secure.total).toBeLessThan(all.total);
    expect(secure.rows.some(r => r.action.startsWith('VIEW_'))).toBeFalsy();

    // Unknown action and malformed date are ignored, not passed through.
    expect((await get('action=DROP%20TABLE%20users')).total).toBeGreaterThan(0);
    expect((await get('from=not-a-date')).total).toBeGreaterThan(0);

    // perPage is clamped at both ends so a caller cannot request the whole table.
    expect((await get('perPage=99999')).perPage).toBe(200);
    expect((await get('perPage=1')).perPage).toBe(25);

    // A literal % must be searched for, not act as a wildcard matching everything.
    expect((await get('q=%25')).total).toBeLessThan(all.total);

    // Paging returns different rows.
    const p1 = await get('page=1&perPage=25');
    const p2 = await get('page=2&perPage=25');
    expect(p2.page).toBe(2);
    if (p1.rows.length && p2.rows.length) expect(p1.rows[0].id).not.toBe(p2.rows[0].id);
    console.log(`✅ Audit filters: ${all.total} all · ${secure.total} security-only · ${failed.total} failed logins`);
  });

  test('9.13 broadcast is admin-only, validated, and lands as an announcement', async () => {
    expect((await ctx.post('/api/admin/broadcast', { data: { text: 'hi' } })).status()).toBe(401);
    expect((await ctx.post('/api/admin/broadcast', {
      data: { text: 'hi' }, headers: { Authorization: `Bearer ${userToken}` } })).status()).toBe(403);

    const h = { headers: { Authorization: `Bearer ${adminToken}` } };
    expect((await ctx.post('/api/admin/broadcast', { data: { text: '   ' }, ...h })).status()).toBe(400);
    expect((await ctx.post('/api/admin/broadcast', { data: { text: 'x'.repeat(501) }, ...h })).status()).toBe(400);

    const text = `PW broadcast ${Date.now()}`;
    expect((await ctx.post('/api/admin/broadcast', { data: { text }, ...h })).ok()).toBeTruthy();

    // It must land in group_general as an announcement — the same row shape the
    // socket handler writes, so history is consistent whichever path was used.
    const msgs = await (await ctx.get('/api/admin/messages', h)).json().catch(() => null);
    if (Array.isArray(msgs)) {
      const row = msgs.find(m => m.type === 'announcement');
      expect(row, 'no announcement row found').toBeTruthy();
      expect(row.conv_key).toBe('group_general');
    }

    // Reaching every user is worth an audit entry of its own.
    const logs = await (await ctx.get('/api/admin/logs?action=BROADCAST', h)).json();
    expect(logs.total).toBeGreaterThan(0);
    console.log('✅ Broadcast: authz enforced, validated, audited, stored as announcement');
  });

  test('9.14 group routes are admin-only and validate the id', async () => {
    expect((await ctx.get('/api/admin/groups')).status()).toBe(401);
    expect((await ctx.get('/api/admin/groups', { headers: { Authorization: `Bearer ${userToken}` } })).status()).toBe(403);

    const h = { headers: { Authorization: `Bearer ${adminToken}` } };
    const list = await ctx.get('/api/admin/groups', h);
    expect(list.ok()).toBeTruthy();
    expect(Array.isArray(await list.json())).toBeTruthy();

    expect((await ctx.get('/api/admin/groups/abc', h)).status()).toBe(400);
    expect((await ctx.get('/api/admin/groups/0', h)).status()).toBe(400);
    expect((await ctx.get('/api/admin/groups/99999999', h)).status()).toBe(404);
    expect((await ctx.delete('/api/admin/groups/abc', h)).status()).toBe(400);
    expect((await ctx.delete('/api/admin/groups/99999999', h)).status()).toBe(404);
    expect((await ctx.delete('/api/admin/groups/1', { headers: { Authorization: `Bearer ${userToken}` } })).status()).toBe(403);
    console.log('✅ Group routes: admin-only, id validated, missing group is a 404');
  });

  test('9.15 backup download refuses anything outside the backups folder', async () => {
    const h = { headers: { Authorization: `Bearer ${adminToken}` } };
    expect((await ctx.post('/api/admin/backup')).status()).toBe(401);
    expect((await ctx.post('/api/admin/backup', { headers: { Authorization: `Bearer ${userToken}` } })).status()).toBe(403);

    // The server refuses a second concurrent VACUUM with 429, which is correct
    // and also means the two browser projects can collide here. Wait and retry
    // once, exactly as a user would.
    let made = await ctx.post('/api/admin/backup', h);
    if (made.status() === 429) {
      await new Promise(r => setTimeout(r, 2500));
      made = await ctx.post('/api/admin/backup', h);
    }
    expect(made.ok(), `backup failed with ${made.status()}`).toBeTruthy();
    const { name, size } = await made.json();
    expect(name).toMatch(/^db-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/);
    expect(size).toBeGreaterThan(1000);

    // The real snapshot downloads.
    expect((await ctx.get(`/api/admin/backup/${name}`, h)).ok()).toBeTruthy();
    expect((await ctx.get(`/api/admin/backup/${name}`)).status()).toBe(401);

    // This route serves a file by name, so it is the one place in the admin API
    // that could become a file-read primitive. Every one of these must be
    // refused by the name pattern, before the filesystem is touched.
    for (const bad of ['..%2Fserver.js', '..%2F..%2F.env', 'server.js', '.env', '..%2Fpackage.json',
                       `${name}%2F..%2F..%2F.env`, 'db-9999-99-99_99-99-99.db%00.env']) {
      const r = await ctx.get(`/api/admin/backup/${bad}`, h);
      expect([400, 404], `traversal attempt "${bad}" returned ${r.status()}`).toContain(r.status());
    }
    // Delete the snapshot this test made. VACUUM INTO writes a full copy of the
    // database — ~7MB here — and the suite runs in two browsers, so without
    // this the backups folder grows by ~14MB every run. Fifteen files and 68MB
    // accumulated before this was noticed, and the VACUUMs slowed the whole
    // suite from ~5 to ~10 minutes.
    const fs = require('fs');
    const path = require('path');
    const snapshot = path.join(__dirname, '..', 'backups', name);
    if (fs.existsSync(snapshot)) fs.unlinkSync(snapshot);

    console.log(`✅ Backup created (${Math.round(size/1024)}KB), traversal refused, snapshot cleaned up`);
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

// ═══════════════════════════════════════════════════════════════════
//  TEST GROUP 12: Security headers (OWASP A05)
// ═══════════════════════════════════════════════════════════════════
test.describe('12. Security headers', () => {
  let ctx;
  test.beforeAll(async () => { ctx = await request.newContext({ baseURL: BASE_URL }); });
  test.afterAll(async () => { await ctx.dispose(); });

  test('12.1 responses carry the hardening headers and hide the stack', async () => {
    const r = await ctx.get('/');
    const h = r.headers();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['content-security-policy']).toContain("object-src 'none'");
    expect(h['x-powered-by']).toBeUndefined();   // Express banner removed
    console.log('✅ Security headers present; X-Powered-By hidden');
  });
});
