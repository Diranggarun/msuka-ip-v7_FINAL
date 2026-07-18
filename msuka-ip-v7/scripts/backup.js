// ═══════════════════════════════════════════════════════════════════
//  MSUkaIP — Backup helper (npm run backup)
//
//  Creates a timestamped snapshot of:
//    1. The full SQLite database (via VACUUM INTO) → backups/db-<ts>.db
//    2. The uploads folder                         → backups/uploads-<ts>.zip
//
//  Use before any risky operation, before LAN deploy, and right
//  before the defense itself for insurance.
// ═══════════════════════════════════════════════════════════════════
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env
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

const stamp     = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const backupDir = path.join(__dirname, '..', 'backups');
const uploads   = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(backupDir, { recursive: true });

console.log(`\n📦  MSUkaIP backup — ${stamp}\n`);

// 1. SQLite snapshot — VACUUM INTO is an online, consistent copy (safe while
//    the server is running thanks to WAL mode).
const dbFile = path.join(backupDir, `db-${stamp}.db`);
try {
  const db = require('../db');
  console.log(`  → ${dbFile}`);
  db.raw.exec(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);
  const size = fs.statSync(dbFile).size;
  console.log(`     ${(size/1024).toFixed(1)} KB ✓`);
} catch (e) {
  console.error(`     ✗ SQLite backup failed: ${e.message}`);
  process.exit(1);
}

// 2. uploads.zip — PowerShell Compress-Archive
const zipFile = path.join(backupDir, `uploads-${stamp}.zip`);
try {
  if (fs.existsSync(uploads) && fs.readdirSync(uploads).length > 0) {
    console.log(`  → ${zipFile}`);
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${uploads}\\*' -DestinationPath '${zipFile}' -Force"`, { stdio: ['ignore', 'inherit', 'inherit'] });
    const size = fs.statSync(zipFile).size;
    console.log(`     ${(size/1024).toFixed(1)} KB ✓`);
  } else {
    console.log(`     (uploads folder empty — skipping zip)`);
  }
} catch (e) {
  console.error(`     ✗ uploads zip failed: ${e.message}`);
  process.exit(1);
}

console.log(`\n✓ Backup complete in ${backupDir}\n`);
console.log(`Restore later with (server stopped):`);
console.log(`  Copy-Item "${dbFile}" "${require('../db').DB_PATH}" -Force`);
console.log(`  Expand-Archive "${zipFile}" -DestinationPath "${path.dirname(uploads)}" -Force\n`);
