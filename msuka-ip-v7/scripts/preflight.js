// ═══════════════════════════════════════════════════════════════════
//  MSUkaIP — Pre-Demo Preflight Check
//
//  Run with:  npm run preflight
//
//  Verifies the demo host is actually ready: .env populated, SQLite
//  file readable, all 7 tables present, no stale "online" rows, demo
//  accounts exist. Prints LAN IP + the firewall command so you can
//  copy-paste it during setup.
//
//  Exits with code 0 if everything is OK, 1 if anything is missing.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load .env the same way server.js does
(() => {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch {}
})();

const C = { ok: '\x1b[32m✓\x1b[0m', bad: '\x1b[31m✗\x1b[0m', warn: '\x1b[33m!\x1b[0m', dim: '\x1b[2m', reset: '\x1b[0m' };
let failures = 0;
const issue = msg => { console.log(`  ${C.bad} ${msg}`); failures++; };
const ok    = msg => console.log(`  ${C.ok} ${msg}`);
const warn  = msg => console.log(`  ${C.warn} ${msg}`);

(async () => {

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  MSUkaIP — Preflight Check');
  console.log(`  ${new Date().toLocaleString()}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // ── .env presence + secret quality ─────────────────────────────────────
  console.log('🔐  Secrets & .env');
  const envExists = fs.existsSync(path.join(__dirname, '..', '.env'));
  if (!envExists) issue('.env not found — copy .env.example to .env and fill in real values');
  else ok('.env file found');

  const devJwt = 'msuka-ip-secret-2025';
  const devAes = 'MSUkaIP-CICS-AES256-SecureKey-2025!';
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === devJwt) issue('JWT_SECRET is missing or still the dev default');
  else if (process.env.JWT_SECRET.length < 32) warn('JWT_SECRET is shorter than 32 chars — consider longer');
  else ok(`JWT_SECRET set (${process.env.JWT_SECRET.length} chars)`);

  if (!process.env.AES_SECRET || process.env.AES_SECRET === devAes) issue('AES_SECRET is missing or still the dev default');
  else if (process.env.AES_SECRET.length < 32) warn('AES_SECRET is shorter than 32 chars — consider longer');
  else ok(`AES_SECRET set (${process.env.AES_SECRET.length} chars)`);

  if (!process.env.AES_SALT) warn('AES_SALT not set — using built-in default (OK but less random)');
  else ok('AES_SALT set');

  // ── Uploads dir ────────────────────────────────────────────────────────
  console.log('\n📁  Uploads directory');
  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    warn('public/uploads/ missing — server creates it on boot, but creating now');
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  try {
    const testFile = path.join(uploadsDir, '.preflight-test');
    fs.writeFileSync(testFile, 'x');
    fs.unlinkSync(testFile);
    ok('uploads dir writable');
  } catch (e) { issue('uploads dir NOT writable: ' + e.message); }

  // ── Database (SQLite) ──────────────────────────────────────────────────
  console.log('\n🗄️   Database');
  try {
    const db = require('../db');
    ok(`SQLite file: ${db.DB_PATH}`);

    const wal = db.raw.prepare('PRAGMA journal_mode').get().journal_mode;
    if (String(wal).toLowerCase() === 'wal') ok('WAL journal mode active');
    else warn(`journal_mode is "${wal}" — expected WAL`);
    const fkOn = db.raw.prepare('PRAGMA foreign_keys').get();
    if (Object.values(fkOn)[0] === 1) ok('foreign_keys pragma ON');
    else issue('foreign_keys pragma is OFF');

    const expected = ['users','groups_table','group_members','messages','calls','audit_logs','survey_responses'];
    const [tables] = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
    const names = tables.map(r => r.name);
    for (const t of expected) {
      if (names.includes(t)) {
        const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM ${t}`);
        ok(`Table \`${t}\` exists (${n} rows)`);
      } else {
        issue(`Table \`${t}\` MISSING — start the server once to auto-create`);
      }
    }

    if (names.includes('users')) {
      // Demo accounts
      const [demoAdmin]   = await db.query("SELECT id FROM users WHERE email='admin@cics.msu.edu'");
      const [demoStudent] = await db.query("SELECT id FROM users WHERE email='student@cics.msu.edu'");
      if (demoAdmin.length)   ok('Demo admin   account present');     else issue('Demo admin account MISSING');
      if (demoStudent.length) ok('Demo student account present'); else issue('Demo student account MISSING');

      // Stale online state
      const [[{ stale }]] = await db.query("SELECT COUNT(*) AS stale FROM users WHERE status='online'");
      if (stale > 0) warn(`${stale} user(s) currently marked online — server resets these on next boot`);
      else ok('No stale "online" rows');
    }
  } catch (e) {
    issue('SQLite: ' + e.message);
  }

  // ── Network ────────────────────────────────────────────────────────────
  console.log('\n🌐  Network');
  const port = Number(process.env.PORT || 3000);
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => i.address);
  if (!ips.length) warn('No external IPv4 address — clients on the LAN will not be able to reach this host');
  else {
    console.log(`  ${C.ok} Server will listen on port ${port}.`);
    console.log(`  ${C.dim}Other devices on the LAN can reach you at:${C.reset}`);
    for (const ip of ips) console.log(`     http://${ip}:${port}/`);
  }

  console.log(`\n  ${C.dim}Firewall rule (Admin PowerShell, run once):${C.reset}`);
  console.log(`     New-NetFirewallRule -DisplayName "MSUkaIP ${port}" -Direction Inbound -Protocol TCP -LocalPort ${port} -Action Allow`);

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  if (failures === 0) {
    console.log(`  ${C.ok} READY — preflight passed.`);
  } else {
    console.log(`  ${C.bad} NOT READY — ${failures} issue(s) above.`);
  }
  console.log('══════════════════════════════════════════════════════════\n');
  process.exit(failures > 0 ? 1 : 0);

})().catch(err => { console.error('Preflight crashed:', err); process.exit(1); });
