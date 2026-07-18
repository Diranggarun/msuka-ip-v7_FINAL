// MSUkaIP — DB integrity audit (npm run db:audit) — SQLite edition.
// Safe to run while the server is up: WAL mode + busy_timeout in db.js.
const db = require('./db');

(async () => {
  console.log('--- DATABASE ---');
  console.log('file:', db.DB_PATH);
  console.log('journal_mode:', db.raw.prepare('PRAGMA journal_mode').get().journal_mode);
  console.log('foreign_keys:', Object.values(db.raw.prepare('PRAGMA foreign_keys').get())[0]);

  const tables = ['users','messages','groups_table','group_members','calls','audit_logs','survey_responses'];

  console.log('\n--- FOREIGN KEYS ---');
  for (const t of tables) {
    const fks = db.raw.prepare(`PRAGMA foreign_key_list(${t})`).all();
    for (const fk of fks) console.log(`${t}.${fk.from} → ${fk.table}.${fk.to} (on delete ${fk.on_delete})`);
  }

  console.log('\n--- FK VIOLATIONS (should be empty) ---');
  const viol = db.raw.prepare('PRAGMA foreign_key_check').all();
  if (viol.length === 0) console.log('(none)');
  else console.table(viol);

  console.log('\n--- INDEXES ---');
  const [idx] = await db.query(`SELECT tbl_name, name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name`);
  console.table(idx);

  console.log('\n--- ROW COUNTS ---');
  for (const t of tables) {
    const [r] = await db.query('SELECT COUNT(*) AS n FROM ' + t);
    console.log(t.padEnd(20) + r[0].n);
  }

  console.log('\n--- ORPHAN CHECK ---');
  const checks = [
    ['messages with bad sender_id', `SELECT COUNT(*) AS n FROM messages m WHERE m.sender_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id=m.sender_id)`],
    ['group_members with bad user_id', `SELECT COUNT(*) AS n FROM group_members gm WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id=gm.user_id)`],
    ['group_members with bad group_id', `SELECT COUNT(*) AS n FROM group_members gm WHERE NOT EXISTS (SELECT 1 FROM groups_table g WHERE g.id=gm.group_id)`],
    ['calls with bad caller_id', `SELECT COUNT(*) AS n FROM calls c WHERE c.caller_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id=c.caller_id)`],
    ['calls with bad receiver_id', `SELECT COUNT(*) AS n FROM calls c WHERE c.receiver_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id=c.receiver_id)`],
    ['audit_logs with bad user_id', `SELECT COUNT(*) AS n FROM audit_logs a WHERE a.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id=a.user_id)`],
    ['duplicate group_members rows', `SELECT COUNT(*) AS n FROM (SELECT group_id,user_id,COUNT(*) c FROM group_members GROUP BY group_id,user_id HAVING c>1) t`],
    ['users marked online but no recent activity (>15 min)', `SELECT COUNT(*) AS n FROM users WHERE status='online'`],
    ['messages with empty conv_key', `SELECT COUNT(*) AS n FROM messages WHERE conv_key IS NULL OR conv_key=''`],
    ['messages with NULL text', `SELECT COUNT(*) AS n FROM messages WHERE text IS NULL`],
    ['users with NULL role', `SELECT COUNT(*) AS n FROM users WHERE role IS NULL`],
    ['users with NULL account_status', `SELECT COUNT(*) AS n FROM users WHERE account_status IS NULL`],
  ];
  for (const [label, sql] of checks) {
    const [r] = await db.query(sql);
    console.log(label.padEnd(50), r[0].n);
  }

  console.log('\n--- INTEGRITY CHECK ---');
  console.log(db.raw.prepare('PRAGMA integrity_check').get().integrity_check);
})().catch(e => { console.error(e); process.exit(1); });
