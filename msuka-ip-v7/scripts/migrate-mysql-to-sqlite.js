// ═══════════════════════════════════════════════════════════════════
//  MSUkaIP — One-time data migration: XAMPP/MySQL → SQLite
//
//  Run with:  npm run db:migrate-from-mysql        (XAMPP MySQL must be running)
//  Options:   --force   wipe existing SQLite rows first
//
//  Copies all 7 tables preserving primary-key IDs (so FKs and conv_keys
//  stay valid). Timestamps arrive from mysql2 as JS Dates and are stored
//  as localtime 'YYYY-MM-DD HH:MM:SS' strings by the db.js adapter —
//  identical to what the app now writes.
//
//  Safe to re-run: refuses to touch a non-empty SQLite DB unless --force.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

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

const FORCE = process.argv.includes('--force');

// Copy order respects foreign keys (users first, join tables after parents)
const TABLES = {
  users:            ['id','name','email','password_hash','role','account_status','status','created_at'],
  groups_table:     ['id','name','created_by','created_at'],
  group_members:    ['id','group_id','user_id'],
  messages:         ['id','sender_id','conv_key','type','text','file_name','file_url','file_size','file_type','created_at'],
  calls:            ['id','caller_id','receiver_id','status','started_at','ended_at','duration','created_at'],
  audit_logs:       ['id','user_id','action','details','created_at'],
  survey_responses: ['id','respondent_name','respondent_type','device','response_date','scores_json','mean_a','mean_b','mean_c','mean_d','overall','created_at'],
};

(async () => {
  const db = require('../db');
  db.ensureSchema();
  console.log(`\n🗄️   Target SQLite: ${db.DB_PATH}`);

  // Guard: don't merge into a DB that already has data
  const [[{ n: existing }]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM users) + (SELECT COUNT(*) FROM messages) AS n`);
  if (existing > 0 && !FORCE) {
    console.error(`✗ SQLite DB already has ${existing} rows in users/messages.`);
    console.error('  Re-run with --force to wipe it first, or delete msukaip.db and retry.');
    process.exit(1);
  }

  let mysqlConn;
  try {
    const mysql = require('mysql2/promise');
    mysqlConn = await mysql.createConnection({
      host:     process.env.MYSQL_HOST     || 'localhost',
      user:     process.env.MYSQL_USER     || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'msukaip',
      connectTimeout: 5000,
      dateStrings: false
    });
  } catch (e) {
    console.error('✗ Cannot reach MySQL — start XAMPP MySQL first. (' + e.message + ')');
    process.exit(1);
  }
  console.log('✅  MySQL connected');

  db.raw.exec('BEGIN IMMEDIATE');
  try {
    if (FORCE) {
      // Reverse FK order for deletes
      for (const t of Object.keys(TABLES).reverse()) db.raw.exec(`DELETE FROM ${t}`);
      db.raw.exec("DELETE FROM sqlite_sequence"); // reset AUTOINCREMENT counters
      console.log('🧹  Existing SQLite rows wiped (--force)');
    }

    for (const [table, cols] of Object.entries(TABLES)) {
      let rows;
      try {
        [rows] = await mysqlConn.query(`SELECT ${cols.join(',')} FROM ${table}`);
      } catch (e) {
        console.warn(`  ! ${table}: skipped (${e.message})`);
        continue;
      }
      const placeholders = cols.map(() => '?').join(',');
      const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;
      for (const row of rows) {
        await db.query(sql, cols.map(c => row[c]));
      }
      console.log(`  ✓ ${table.padEnd(18)} ${rows.length} rows`);
    }

    db.raw.exec('COMMIT');
  } catch (e) {
    db.raw.exec('ROLLBACK');
    console.error('✗ Migration failed, rolled back:', e.message);
    process.exit(1);
  } finally {
    await mysqlConn.end();
  }

  // Verify FK integrity of the migrated data
  const viol = db.raw.prepare('PRAGMA foreign_key_check').all();
  if (viol.length) {
    console.warn(`⚠️   ${viol.length} foreign-key violation(s) found — run npm run db:audit for details`);
  } else {
    console.log('✅  Foreign-key check clean');
  }
  console.log('\n🎉  Migration complete. Start the app with: npm start\n');
})().catch(e => { console.error(e); process.exit(1); });
