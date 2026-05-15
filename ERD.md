# Database Schema Reference

**Database:** MySQL 8 · **Name:** `msukaip` · **Driver:** `mysql2/promise` (Node)
Generated from the actual running schema on 2026-05-14 (see `msuka-ip-v7/db-audit.js`).

## Tables (7)

| Table | Rows it stores | FK relationships |
|---|---|---|
| `users` | Student / Faculty / Admin accounts | Referenced by most other tables |
| `groups_table` | Group-chat metadata | `created_by → users` |
| `group_members` | Group ↔ user membership | `group_id → groups_table`, `user_id → users` |
| `messages` | Chat / file / image / voice / announcement / system | `sender_id → users` |
| `calls` | VoIP call records | `caller_id → users`, `receiver_id → users` |
| `audit_logs` | Admin action trail | `user_id → users` |
| `survey_responses` | Anonymous capstone evaluation feedback | (none — public POST endpoint) |

## Tables in detail

### users
```
id              INT PK AUTO_INCREMENT
name            VARCHAR(100)   NOT NULL
email           VARCHAR(150)   UNIQUE NOT NULL
password_hash   VARCHAR(255)   NOT NULL                  -- bcryptjs (10 rounds)
role            ENUM('student','faculty','admin')        DEFAULT 'student'
account_status  ENUM('pending','approved','rejected')    DEFAULT 'pending'
status          ENUM('online','offline')                 DEFAULT 'offline'
created_at      TIMESTAMP                                DEFAULT CURRENT_TIMESTAMP
```
Indexes: `PRIMARY(id)`, `UNIQUE(email)`, `idx_users_account_status`, `idx_users_status`.

### groups_table
(Named with `_table` suffix because `groups` is a MySQL reserved word.)
```
id           INT PK AUTO_INCREMENT
name         VARCHAR(100) NOT NULL
created_by   INT NULL    FK → users(id) ON DELETE SET NULL
created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
```

### group_members
```
id         INT PK AUTO_INCREMENT
group_id   INT NOT NULL FK → groups_table(id) ON DELETE CASCADE
user_id    INT NOT NULL FK → users(id)        ON DELETE CASCADE
```
Indexes: `UNIQUE(group_id, user_id)` (added 2026-05-14 to prevent double-add).

### messages
```
id           INT PK AUTO_INCREMENT
sender_id    INT NULL                                   FK → users(id) ON DELETE SET NULL
conv_key     VARCHAR(200) NOT NULL                      -- 'group_<id>' or 'private_<email-pair>'
type         ENUM('chat','announcement','system','file','image','voice') DEFAULT 'chat'
text         TEXT NOT NULL                              -- AES-256-GCM ciphertext for chat/announcement/system
file_name    VARCHAR(255) NULL
file_url     VARCHAR(500) NULL
file_size    INT NULL
file_type    VARCHAR(100) NULL
created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- Legacy columns left from prior schema (not read/written by server.js):
receiver_id  INT NULL
is_read      TINYINT(1) DEFAULT 0
```
Indexes: `PRIMARY(id)`, `idx_messages_conv_created(conv_key, created_at)`, `idx_messages_created(created_at)`.

**Encryption note:** Text for `chat`, `announcement`, `system` types is stored as `iv(hex):authTag(hex):ciphertext(hex)` via AES-256-GCM. File/image/voice rows store the original filename in `text` for display. See `encryptMessage` / `decryptMessage` in `server.js`.

### calls
```
id            INT PK AUTO_INCREMENT
caller_id     INT NULL  FK → users(id) ON DELETE SET NULL
receiver_id   INT NULL  FK → users(id) ON DELETE SET NULL
status        ENUM('missed','answered','rejected') DEFAULT 'missed'
started_at    TIMESTAMP NULL
ended_at      TIMESTAMP NULL
duration      INT DEFAULT 0    -- seconds, computed via TIMESTAMPDIFF on call:end
```

### audit_logs
```
id           INT PK AUTO_INCREMENT
user_id      INT NULL FK → users(id) ON DELETE SET NULL
action       VARCHAR(100)
details      TEXT
created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```
Indexes: `PRIMARY(id)`, `idx_audit_created`.

Action codes used: `LOGIN`, `REGISTER`, `APPROVE`, `REJECT`, `ADD_USER`, `EDIT_USER`, `DELETE_USER`, `DELETE_GROUP`, `BROADCAST`.

### survey_responses
```
id                INT PK AUTO_INCREMENT
respondent_name   VARCHAR(150) NULL                -- nullable: anonymous responses allowed
respondent_type   VARCHAR(100) NOT NULL            -- e.g. 'Student (4th Year IT/CS)', 'Faculty Member'
device            VARCHAR(100) NOT NULL
response_date     DATE NULL                        -- self-reported by respondent
scores_json       TEXT NOT NULL                    -- full Likert breakdown per question
mean_a            DECIMAL(4,2) NOT NULL            -- Section A (Usability) mean
mean_b            DECIMAL(4,2) NOT NULL            -- Section B (Functionality) mean
mean_c            DECIMAL(4,2) NOT NULL            -- Section C (Performance) mean
mean_d            DECIMAL(4,2) NOT NULL            -- Section D (Satisfaction) mean
overall           DECIMAL(4,2) NOT NULL            -- Weighted mean across all sections
created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```
Indexes: `PRIMARY(id)`, `idx_survey_created`.

## Seed data

On every server start (`setupDatabase` in `server.js`):

| Email | Password | Role | Status |
|---|---|---|---|
| `admin@cics.msu.edu` | `admin123` | admin | approved |
| `student@cics.msu.edu` | `student123` | student | approved |

Passwords are rotated on each start so demo accounts can't be left altered. **Change before LAN deployment.**

## Conv_key conventions

- **Global broadcast channel:** `group_general` (special — always exists, every connected socket joins on connect)
- **Group chat:** `group_<numeric-group-id>` (e.g. `group_42`)
- **Private 1-on-1:** `private_<sortedEmailA>__<sortedEmailB>` — deterministic via `buildPrivateKey()` so both peers query the same rows regardless of who opens the chat first.

## Charset

All tables use `utf8mb4_unicode_ci` — supports emojis, Filipino, and any Unicode characters in usernames/messages.

## Schema evolution

The schema is created at boot by `setupDatabase()` using `CREATE TABLE IF NOT EXISTS` + idempotent `ALTER TABLE … ADD COLUMN` blocks wrapped in try/catch. No external migration runner — schema changes are made directly in `server.js` and applied on the next start.

## Audit tooling

Run `node msuka-ip-v7/db-audit.js` to dump:
- Foreign keys
- Indexes
- Row counts
- Orphan-record checks (messages with bad sender_id, dupes in group_members, etc.)
- Charset/collation across all tables
