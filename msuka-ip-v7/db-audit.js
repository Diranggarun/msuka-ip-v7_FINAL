const m = require('mysql2/promise');
(async () => {
  const p = m.createPool({ host:'localhost', user:'root', password:'', database:'msukaip' });

  console.log('--- FOREIGN KEYS ---');
  const [fk] = await p.query(`SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='msukaip' AND REFERENCED_TABLE_NAME IS NOT NULL`);
  console.table(fk);

  console.log('\n--- INDEXES ---');
  const [idx] = await p.query(`SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='msukaip' ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`);
  console.table(idx);

  console.log('\n--- ROW COUNTS ---');
  for (const t of ['users','messages','groups_table','group_members','calls','audit_logs','survey_responses']) {
    const [r] = await p.query('SELECT COUNT(*) AS n FROM ' + t);
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
    const [r] = await p.query(sql);
    console.log(label.padEnd(50), r[0].n);
  }

  console.log('\n--- CHARSET / COLLATION ---');
  const [cs] = await p.query(`SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA='msukaip'`);
  console.table(cs);

  await p.end();
})().catch(e => { console.error(e); process.exit(1); });
