// ═══════════════════════════════════════════════════════════════════
//  MSUkaIP — SQLite database adapter (replaces mysql2/XAMPP)
//
//  Uses Node's built-in `node:sqlite` (Node 22.5+) — no native deps.
//  Exposes a mysql2/promise-compatible surface so server.js keeps its
//  `const [rows] = await db.query(sql, params)` call sites unchanged:
//    - query(sql, params)  → [rows] for SELECT, [{insertId, affectedRows}] otherwise
//    - getConnection()     → { query, beginTransaction, commit, rollback, release }
//
//  Per-connection pragmas (SQLite requires these at open, not in DDL):
//    - foreign_keys = ON   → enforce FK cascades (OFF by default in SQLite)
//    - journal_mode = WAL  → readers don't block the writer (multi-user LAN app)
//    - busy_timeout = 5000 → external readers (backup/audit) wait instead of erroring
//
//  Concurrency note: all queries run synchronously on the Node event loop,
//  so writes are serialized in-process — SQLITE_BUSY can only come from a
//  second process (e.g. db-audit.js while the server runs), which WAL +
//  busy_timeout handle.
// ═══════════════════════════════════════════════════════════════════
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'msukaip.db');

const raw = new DatabaseSync(DB_PATH);
raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA foreign_keys = ON');
raw.exec('PRAGMA busy_timeout = 5000');
raw.exec('PRAGMA synchronous = NORMAL');

// Timestamps are stored as localtime 'YYYY-MM-DD HH:MM:SS' strings (same as
// the old XAMPP/MySQL TIMESTAMP behavior) so the frontend's
// `new Date(created_at)` keeps parsing them as local time.
function toSqlParam(v) {
  if (v instanceof Date) {
    const p = n => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}

async function query(sql, params = []) {
  const args = (params || []).map(toSqlParam);
  const stmt = raw.prepare(sql);
  if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql)) return [stmt.all(...args)];
  const info = stmt.run(...args);
  return [{ insertId: Number(info.lastInsertRowid), affectedRows: Number(info.changes) }];
}

// mysql2-pool-compatible "connection" — same underlying DB handle. Safe
// because the sync driver serializes everything on the event loop.
async function getConnection() {
  return {
    query,
    beginTransaction: async () => { raw.exec('BEGIN IMMEDIATE'); },
    commit:           async () => { raw.exec('COMMIT'); },
    rollback:         async () => { try { raw.exec('ROLLBACK'); } catch { /* no open txn */ } },
    release:          () => {}
  };
}

// Full schema — MySQL types translated to SQLite:
//   INT AUTO_INCREMENT PRIMARY KEY → INTEGER PRIMARY KEY AUTOINCREMENT
//   ENUM('a','b')                  → TEXT + CHECK(col IN ('a','b'))
//   VARCHAR/TEXT                   → TEXT      DECIMAL → REAL
//   TIMESTAMP DEFAULT CURRENT_TIMESTAMP → TEXT DEFAULT (datetime('now','localtime'))
// Called by server.js on boot and by scripts/migrate-mysql-to-sqlite.js.
function ensureSchema() {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('student','faculty','admin')) DEFAULT 'student',
      account_status TEXT CHECK(account_status IN ('pending','approved','rejected')) DEFAULT 'pending',
      status TEXT CHECK(status IN ('online','offline')) DEFAULT 'offline',
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS groups_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      conv_key TEXT NOT NULL DEFAULT 'group_general',
      type TEXT CHECK(type IN ('chat','announcement','system','file','image','voice')) DEFAULT 'chat',
      text TEXT NOT NULL,
      file_name TEXT NULL,
      file_url TEXT NULL,
      file_size INTEGER NULL,
      file_type TEXT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caller_id INTEGER,
      receiver_id INTEGER,
      status TEXT CHECK(status IN ('missed','answered','rejected')) DEFAULT 'missed',
      started_at TEXT NULL,
      ended_at TEXT NULL,
      duration INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT,
      details TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS survey_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      respondent_name TEXT NULL,
      respondent_type TEXT NOT NULL,
      device TEXT NOT NULL,
      response_date TEXT NULL,
      scores_json TEXT NOT NULL,
      mean_a REAL NOT NULL,
      mean_b REAL NOT NULL,
      mean_c REAL NOT NULL,
      mean_d REAL NOT NULL,
      overall REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages (conv_key, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at);
    CREATE INDEX IF NOT EXISTS idx_calls_created ON calls (created_at);
    CREATE INDEX IF NOT EXISTS idx_users_created ON users (created_at);
    CREATE INDEX IF NOT EXISTS idx_users_account_status ON users (account_status);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
    CREATE INDEX IF NOT EXISTS idx_survey_created ON survey_responses (created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_group_members ON group_members (group_id, user_id);
  `);

  // Guarded column migrations for databases created before these columns
  // existed (SQLite has no ADD COLUMN IF NOT EXISTS).
  const addCol = (table, ddl) => { try { raw.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`); } catch { /* already exists */ } };
  addCol('users',      'token_version INTEGER NOT NULL DEFAULT 0'); // session revocation (RA 10173 Tier 2)
  addCol('audit_logs', 'ip TEXT');                                  // accountability (§21)
  addCol('audit_logs', 'user_agent TEXT');
}

module.exports = { query, getConnection, ensureSchema, raw, DB_PATH };
