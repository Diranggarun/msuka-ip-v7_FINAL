// ── Load test: 50–100 simultaneous users (Chapter 4, Table 4.4) ──────────────
//
// Measures the two non-functional requirements from Table 3.1:
//   - a text message is delivered in under 1 second
//   - the server stays up with 50–100 users connected at once
//
// NEVER run this against the real database: it creates accounts and posts
// messages. Run a second server on a COPY of the database instead:
//
//   1. npm run backup                                  (makes backups/db-<time>.db)
//   2. copy that file somewhere, e.g. C:\temp\load.db
//   3. $env:SQLITE_PATH='C:\temp\load.db'; node scripts/load-test.js seed 100
//   4. $env:NODE_ENV='production'; $env:SQLITE_PATH='C:\temp\load.db';
//      $env:PORT='4000'; $env:HTTPS_PORT='4443'; node backend/server.js
//   5. node scripts/load-test.js run 100 5 http://localhost:4000
//
// "run <users> <messages each> <server>" connects every user to CICS Chat,
// has each send its messages a second apart (start times spread out), and
// one extra "observer" user times how long each message takes to arrive.
// The sockets live in one headless Chromium page, which loads the same
// socket.io client the real chat page uses.
const path = require('path');

const PASSWORD = 'LoadTest123';
const email = i => `loadtest_${i}@cics.msu.edu`;
const LIVE_PORTS = ['3000', '3443'];

async function seed(n) {
  const dbFile = process.env.SQLITE_PATH;
  // Refuse the real database: it must be an explicit copy somewhere else.
  if (!dbFile || path.resolve(dbFile) === path.resolve(__dirname, '..', 'msukaip.db')) {
    console.error('Set SQLITE_PATH to a COPY of the database (see the top of this file).'); process.exit(1);
  }
  const db = require('../backend/db');
  const bcrypt = require('bcryptjs');
  await db.ensureSchema();
  const hash = await bcrypt.hash(PASSWORD, 12);
  for (let i = 0; i <= n; i++) { // account 0 is the observer
    await db.query(
      "INSERT OR IGNORE INTO users (name,email,password_hash,role,account_status) VALUES (?,?,?,'student','approved')",
      [`Load Test ${i}`, email(i), hash]);
  }
  console.log(`Seeded ${n + 1} accounts in ${dbFile} (loadtest_0 … loadtest_${n}).`);
}

async function login(base, i) {
  const r = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email(i), password: PASSWORD }),
  });
  const d = await r.json();
  if (!d.token) throw new Error(`login ${email(i)}: ${d.error}`);
  return d.token;
}

async function run(users, perUser, base) {
  if (LIVE_PORTS.includes(new URL(base).port || '80')) {
    console.error('Refusing to load-test the live server ports (3000/3443). Use a test server on a copy.'); process.exit(1);
  }
  // Log everyone in, 10 at a time (each login is a bcrypt check on the server).
  const tokens = [];
  for (let i = 0; i <= users; i += 10) {
    const batch = [];
    for (let k = i; k < Math.min(i + 10, users + 1); k++) batch.push(login(base, k));
    tokens.push(...await Promise.all(batch));
  }
  console.log(`Logged in ${tokens.length} accounts (1 observer + ${users} senders).`);

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base + '/');
  await page.addScriptTag({ url: '/socket.io/socket.io.js' });

  const result = await page.evaluate(async ({ tokens, perUser }) => {
    /* global io */ // runs inside the browser page, where socket.io.js defines io
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const connect = t => new Promise(resolve => {
      const s = io({ auth: { token: t }, transports: ['websocket'], forceNew: true, reconnection: false });
      s.on('connect', () => resolve(s));
      s.on('connect_error', () => resolve(null));
    });
    const sockets = await Promise.all(tokens.map(connect));
    const [observer, ...senders] = sockets;
    const connected = sockets.filter(Boolean).length;
    if (!observer) return { connected, error: 'observer could not connect' };

    // The observer notes when each test message arrives.
    const sentAt = new Map(), delays = [];
    observer.on('message:new', m => {
      const t0 = sentAt.get(m.text);
      if (t0 !== undefined) { delays.push(performance.now() - t0); sentAt.delete(m.text); }
    });
    let errors = 0;
    senders.forEach(s => s && s.on('message:error', () => errors++));

    // Every sender sends perUser messages, 1 s apart, start times spread over 1 s.
    const started = performance.now();
    await Promise.all(senders.map(async (s, i) => {
      if (!s) return;
      await wait(Math.random() * 1000);
      for (let k = 0; k < perUser; k++) {
        const text = `loadtest ${i}-${k}-${Math.random().toString(36).slice(2, 8)}`;
        sentAt.set(text, performance.now());
        s.emit('message:send', { text, convKey: 'group_general' });
        await wait(1000);
      }
    }));
    await wait(3000); // let the last messages arrive
    const seconds = (performance.now() - started) / 1000;
    sockets.forEach(s => s && s.disconnect());
    return { connected, sent: senders.filter(Boolean).length * perUser, received: delays.length,
             lost: sentAt.size, errors, delays, seconds };
  }, { tokens, perUser });
  await browser.close();

  if (result.error) { console.error(result.error); process.exit(1); }
  const d = result.delays.sort((a, b) => a - b);
  const avg = d.reduce((a, b) => a + b, 0) / (d.length || 1);
  const p95 = d[Math.floor(d.length * 0.95)] || 0;
  const alive = await fetch(base + '/api/config').then(r => r.ok).catch(() => false);
  console.log(`
Simultaneous connections : ${result.connected} of ${tokens.length}
Messages sent / received : ${result.sent} / ${result.received}  (lost ${result.lost}, errors ${result.errors})
Average delivery time    : ${avg.toFixed(1)} ms
95th percentile          : ${p95.toFixed(1)} ms
Slowest delivery time    : ${(d[d.length - 1] || 0).toFixed(1)} ms
Under 1 second           : ${d.filter(x => x < 1000).length} of ${d.length}
Test duration            : ${result.seconds.toFixed(1)} s
Server still responding  : ${alive ? 'yes' : 'NO'}`);
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === 'seed') seed(Number(a) || 100);
else if (cmd === 'run') run(Number(a) || 100, Number(b) || 5, c || 'http://localhost:4000');
else console.log('Usage: node scripts/load-test.js seed <users>  |  run <users> <messagesEach> <serverUrl>');
