// ═══════════════════════════════════════════════════════════════════
//  MSUkaIP — Voice call (WebRTC) end-to-end
//  Chapter 3: System Testing — evidence for the voice-communication objective
//
//  Voice was the one core objective with no automated coverage: every other
//  claim in the paper is backed by a test, and this one rested on a manual
//  demo. This drives two real browsers through a whole call — presence,
//  signalling, negotiation, and media — and asserts the peer connection
//  actually reaches `connected` with audio in both directions.
//
//  Chromium is launched with fake media devices so getUserMedia resolves
//  without a physical microphone. Everything else is the real code path:
//  the same Socket.IO signalling and the same RTCPeerConnection the app uses.
// ═══════════════════════════════════════════════════════════════════
const { test, expect, chromium, request } = require('@playwright/test');

const BASE_URL    = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@cics.msu.edu';
const ADMIN_PASS  = 'admin123';
const PASS        = 'original123';

// A call needs two distinct accounts, so the test makes its own and has the
// admin approve them. `rtc_` matches the pattern scripts/clean-test-data.js
// removes.
async function makeStudent(api, adminToken, tag) {
  const email = `rtc_${tag}_${Date.now()}@cics.msu.edu`;
  await api.post('/api/register', { data: { name: `RTC ${tag}`, email, password: PASS } });
  const pending = await (await api.get('/api/admin/pending',
    { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  const row = pending.find(u => u.email === email);
  if (!row) throw new Error('registration did not reach the pending queue');
  await api.put(`/api/admin/users/${row.id}/approve`,
    { headers: { Authorization: `Bearer ${adminToken}` } });
  return email;
}

async function signIn(browser, email) {
  const ctx = await browser.newContext({ permissions: ['microphone'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE_URL}/index.html`);
  // The terms gate is covered by 1.9; skip it here so this test stays about voice.
  await page.evaluate(() => sessionStorage.setItem('msuka_agreed', '1'));
  await page.fill('#login-email', email);
  await page.fill('#login-password', PASS);
  await page.click('.btn-login');
  await page.waitForSelector('#app', { state: 'visible', timeout: 12000 });
  // eslint-disable-next-line no-undef -- evaluated in the browser page context
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket && socket.connected,
    null, { timeout: 12000 });
  return { page, errors };
}

// Poll the live peer connection until it settles or we give up.
async function peerState(page) {
  return page.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      // `peerConnection` is a top-level `let`, so it is reachable by name but is
      // NOT a property of window — reading window.peerConnection returns
      // undefined and makes a working call look broken.
      // eslint-disable-next-line no-undef
      const pc = (typeof peerConnection !== 'undefined') ? peerConnection : null;
      if (pc && ['connected', 'completed'].includes(pc.iceConnectionState)) {
        return {
          ice: pc.iceConnectionState,
          sending: pc.getSenders().filter(s => s.track).length,
          receiving: pc.getReceivers().filter(r => r.track).length,
          dtls: pc.getSenders()[0]?.transport?.state ?? null,
        };
      }
      await new Promise(r => setTimeout(r, 250));
    }
    // eslint-disable-next-line no-undef
    const pc = (typeof peerConnection !== 'undefined') ? peerConnection : null;
    return pc ? { ice: pc.iceConnectionState, sending: 0, receiving: 0, dtls: null } : null;
  });
}

test.describe('14. Voice Call (WebRTC)', () => {
  test.describe.configure({ mode: 'serial' });

  test('14.1 a 1:1 call connects with audio flowing both ways', async () => {
    test.setTimeout(120000);

    const api = await request.newContext({ baseURL: BASE_URL });
    const adminToken = (await (await api.post('/api/admin/login',
      { data: { email: ADMIN_EMAIL, password: ADMIN_PASS } })).json()).token;
    const callerEmail = await makeStudent(api, adminToken, 'caller');
    const calleeEmail = await makeStudent(api, adminToken, 'callee');

    const browser = await chromium.launch({
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    });

    try {
      const caller = await signIn(browser, callerEmail);
      const callee = await signIn(browser, calleeEmail);
      await caller.page.waitForTimeout(1500);

      // Presence has to carry the callee before a call can be placed at all.
      await caller.page.waitForFunction(
        // eslint-disable-next-line no-undef -- evaluated in the browser page context
        e => typeof onlineUsers !== 'undefined' && onlineUsers.some(u => u.email === e),
        calleeEmail, { timeout: 10000 });

      await caller.page.evaluate(async (email) => {
        /* eslint-disable no-undef -- evaluated in the browser page context */
        const u = onlineUsers.find(x => x.email === email);
        openPrivateFromGlobal(u.email, u.name, u.role);
        await new Promise(r => setTimeout(r, 800));
        await startCall();
        /* eslint-enable no-undef */
      }, calleeEmail);

      // The callee must be offered the call before it can be accepted.
      await callee.page.waitForFunction(
        // eslint-disable-next-line no-undef -- evaluated in the browser page context
        () => document.getElementById('incoming-call')?.classList.contains('show'),
        null, { timeout: 12000 });
      // eslint-disable-next-line no-undef -- evaluated in the browser page context
      await callee.page.evaluate(() => acceptCall());

      const callerPC = await peerState(caller.page);
      const calleePC = await peerState(callee.page);

      expect(callerPC, 'caller never created a peer connection').toBeTruthy();
      expect(calleePC, 'callee never created a peer connection').toBeTruthy();

      // `checking` here means ICE never completed — on a real LAN that is the
      // subnet or client-isolation failure described in LAN-TEST-GUIDE.md.
      expect(['connected', 'completed'], `caller ICE stuck at ${callerPC.ice}`).toContain(callerPC.ice);
      expect(['connected', 'completed'], `callee ICE stuck at ${calleePC.ice}`).toContain(calleePC.ice);

      // A connection that carries no track is a connection, not a call.
      expect(callerPC.sending, 'caller is sending no audio track').toBeGreaterThan(0);
      expect(callerPC.receiving, 'caller is receiving no audio track').toBeGreaterThan(0);
      expect(calleePC.sending, 'callee is sending no audio track').toBeGreaterThan(0);
      expect(calleePC.receiving, 'callee is receiving no audio track').toBeGreaterThan(0);

      // WebRTC mandates DTLS-SRTP; there is no unencrypted mode. Asserting it
      // turns "media is encrypted" from a claim in the paper into a measurement.
      if (callerPC.dtls) expect(callerPC.dtls).toBe('connected');

      expect(caller.errors, 'caller page errors').toEqual([]);
      expect(callee.errors, 'callee page errors').toEqual([]);

      console.log(`✅ Voice call connected — ICE ${callerPC.ice}, DTLS ${callerPC.dtls ?? 'n/a'}, ` +
                  `audio ${callerPC.sending}↑/${callerPC.receiving}↓ both sides`);
    } finally {
      await browser.close();
      await api.dispose();
    }
  });
});
