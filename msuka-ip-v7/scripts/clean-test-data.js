// ── Remove test-suite artifacts from the development database ────────────────
//
// Running the Playwright suite registers accounts, posts messages and submits
// survey responses. After many runs the dev database is mostly test noise: the
// admin dashboard shows hundreds of "Playwright Test User" rows, and the survey
// table — the one that has to hold the Chapter 4 evaluation data — is full of
// responses nobody gave.
//
// Deletes accounts whose email matches a test-suite pattern, everything they
// wrote, and ALL survey responses (every row in that table today is synthetic;
// see --dry-run output before trusting that).
//
// Keeps: the seeded demo accounts and their history.
//
//   node scripts/clean-test-data.js --dry-run   # report only, changes nothing
//   node scripts/clean-test-data.js             # delete
//
// Take a backup first: npm run backup
const db = require('../db');

const DRY = process.argv.includes('--dry-run');

// Emails the test suites generate. Anchored with a trailing separator so a real
// address could not be caught by a prefix — 'test@cics.msu.edu' is listed
// explicitly rather than as a wildcard for the same reason.
const TEST_PATTERNS = [
  'pwreg\\_%', 'pwpending\\_%', 'pwlife\\_%', 'smoke\\_%', 'b6\\_%',
  'pwchange\\_%', 'pwapi\\_%', 'testuser\\_%', 'wrong\\_%',
];
const TEST_EXACT = ['shortpw@cics.msu.edu', 'test@cics.msu.edu'];

const WHERE_TEST =
  '(' + TEST_PATTERNS.map(() => "email LIKE ? ESCAPE '\\'").join(' OR ') +
  ' OR email IN (' + TEST_EXACT.map(() => '?').join(',') + '))';
const PARAMS = [...TEST_PATTERNS, ...TEST_EXACT];

(async () => {
  const count = async (sql, p = []) => (await db.query(sql, p))[0][0].n;

  const before = {
    users:     await count('SELECT COUNT(*) n FROM users'),
    messages:  await count('SELECT COUNT(*) n FROM messages'),
    audit:     await count('SELECT COUNT(*) n FROM audit_logs'),
    survey:    await count('SELECT COUNT(*) n FROM survey_responses'),
  };
  const doomed = await count(`SELECT COUNT(*) n FROM users WHERE ${WHERE_TEST}`, PARAMS);

  const [keepers] = await db.query(`SELECT name,email,role FROM users WHERE NOT ${WHERE_TEST} ORDER BY id`, PARAMS);

  console.log(`${DRY ? 'DRY RUN — nothing will be deleted' : 'DELETING'}\n`);
  console.log('accounts to remove :', doomed, 'of', before.users);
  console.log('accounts to keep   :', keepers.length);
  keepers.forEach(u => console.log(`   keep  ${u.role.padEnd(8)} ${u.name.padEnd(20)} ${u.email}`));

  const msgs  = await count(`SELECT COUNT(*) n FROM messages   WHERE sender_id IN (SELECT id FROM users WHERE ${WHERE_TEST})`, PARAMS);
  const audit = await count(`SELECT COUNT(*) n FROM audit_logs WHERE user_id   IN (SELECT id FROM users WHERE ${WHERE_TEST})`, PARAMS);
  console.log(`\nmessages to remove : ${msgs} of ${before.messages}`);
  console.log(`audit rows to remove: ${audit} of ${before.audit}`);
  console.log(`survey rows to remove: ${before.survey} of ${before.survey}  (whole table — all synthetic)`);

  if (DRY) { console.log('\nDry run complete. Re-run without --dry-run to apply.'); return; }

  // Children first: messages and audit rows reference users.
  await db.query(`DELETE FROM messages   WHERE sender_id IN (SELECT id FROM users WHERE ${WHERE_TEST})`, PARAMS);
  await db.query(`DELETE FROM audit_logs WHERE user_id   IN (SELECT id FROM users WHERE ${WHERE_TEST})`, PARAMS);
  await db.query(`DELETE FROM group_members WHERE user_id IN (SELECT id FROM users WHERE ${WHERE_TEST})`, PARAMS);
  await db.query(`DELETE FROM users WHERE ${WHERE_TEST}`, PARAMS);
  await db.query('DELETE FROM survey_responses');

  const after = {
    users:    await count('SELECT COUNT(*) n FROM users'),
    messages: await count('SELECT COUNT(*) n FROM messages'),
    audit:    await count('SELECT COUNT(*) n FROM audit_logs'),
    survey:   await count('SELECT COUNT(*) n FROM survey_responses'),
  };
  console.log('\ntable            before     after');
  for (const k of Object.keys(before)) {
    console.log(`  ${k.padEnd(14)} ${String(before[k]).padStart(6)} -> ${String(after[k]).padStart(6)}`);
  }
  console.log('\nDone. The survey table is empty and ready for real Chapter 4 responses.');
})();
