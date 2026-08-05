const express = require('express');
const http = require('http');
const https = require('https');
const os = require('os');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto'); // Built-in Node.js — no install needed

// ── Minimal .env loader (no dotenv dependency) ───────────────────────────────
// Reads KEY=VALUE lines from .env in this folder, skipping blanks and #comments.
(() => {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const k = m[1];
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
    console.log('🔧  .env loaded');
  } catch { /* ignore — fall back to OS env or defaults */ }
})();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors:{ origin:'*' } });

// ── HTTPS — required for voice features from LAN clients ─────────────────────
// Browsers only expose getUserMedia on secure origins (https:// or localhost),
// so calls/PTT from any machine other than the server host need this endpoint.
// A self-signed cert is generated into certs/ on first run; each client
// accepts the browser warning once.
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
let httpsServer = null;
// Every IPv4 address a LAN client could use to reach this host.
function lanIPv4s() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => i.address);
}

async function setupHttps() {
  try {
    const certDir  = path.join(__dirname, 'certs');
    const keyPath  = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    const sansPath = path.join(certDir, '.sans'); // records which names the cert was built for

    // The certificate must list every address clients actually type, as Subject
    // Alternative Names — modern browsers ignore the legacy commonName entirely
    // and reject a cert whose SAN list doesn't include the host being visited.
    // The LAN IP can change between sessions (DHCP), so we rebuild the cert
    // whenever the current address set differs from the one it was made for.
    const ips = lanIPv4s();
    const wantSans = ['localhost', 'msukaip.lan', '127.0.0.1', ...ips].join(',');
    const haveSans = fs.existsSync(sansPath) ? fs.readFileSync(sansPath, 'utf8').trim() : '';
    const stale = !fs.existsSync(keyPath) || !fs.existsSync(certPath) || haveSans !== wantSans;

    if (stale) {
      const selfsigned = require('selfsigned');
      const altNames = [
        { type: 2, value: 'localhost' },      // type 2 = DNS name
        { type: 2, value: 'msukaip.lan' },
        { type: 7, ip: '127.0.0.1' },         // type 7 = IP address
        ...ips.map(ip => ({ type: 7, ip })),
      ];
      const pems = await selfsigned.generate(
        [{ name: 'commonName', value: 'msukaip.lan' }],
        { days: 3650, keySize: 2048, extensions: [{ name: 'subjectAltName', altNames }] }
      );
      fs.mkdirSync(certDir, { recursive: true });
      fs.writeFileSync(keyPath, pems.private);
      fs.writeFileSync(certPath, pems.cert);
      fs.writeFileSync(sansPath, wantSans);
      console.log(`🔐  Generated self-signed TLS certificate (valid for: ${wantSans})`);
    }
    httpsServer = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app);
    io.attach(httpsServer);
  } catch (e) {
    console.warn(`⚠️   HTTPS disabled (${e.message}) — voice calls will only work on http://localhost:${process.env.PORT || 3000}.`);
  }
}
// ── Security headers (OWASP A05: Security Misconfiguration) ───────────────────
// Set on every response before any route. No external dependency (Helmet) — the
// header set is small and each line is defensible in oral defense.
app.disable('x-powered-by');                                    // don't advertise Express
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');            // no MIME sniffing
  res.setHeader('X-Frame-Options','DENY');                      // clickjacking: never framed
  res.setHeader('Referrer-Policy','no-referrer');               // don't leak URLs off-site
  res.setHeader('Permissions-Policy','geolocation=(), camera=(), microphone=(self)'); // mic only for us
  // CSP: this app inlines its scripts/styles/handlers, so script/style need
  // 'unsafe-inline'; the value still blocks external/plugin content, framing,
  // and <base> hijacking. Output is separately escaped against XSS (A03).
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "+
    "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; "+
    "object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  // HSTS only over TLS (browsers ignore it on plain HTTP, and sending it there is off-spec).
  if (req.secure) res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname,'public'),{
  setHeaders:(res,filePath)=>{
    if(filePath.endsWith('.html')) res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  }
}));

// ── Secrets — read from environment, fall back to dev defaults ───────────────
// For LAN/production deployment, set JWT_SECRET, AES_SECRET, AES_SALT, and
// optionally SQLITE_PATH in a .env file or the OS environment. See .env.example.
const IS_PROD    = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'msuka-ip-secret-2025';
const AES_SECRET = process.env.AES_SECRET || 'MSUkaIP-CICS-AES256-SecureKey-2025!';
const AES_SALT   = process.env.AES_SALT   || 'msukaip-salt';
const AES_KEY    = crypto.scryptSync(AES_SECRET, AES_SALT, 32); // 256-bit key

if (JWT_SECRET === 'msuka-ip-secret-2025' || AES_SECRET === 'MSUkaIP-CICS-AES256-SecureKey-2025!') {
  // RA 10173 §20: dev secrets in production would let anyone with repo access
  // forge admin tokens and decrypt stored messages — refuse to boot.
  if (IS_PROD) {
    console.error('❌  NODE_ENV=production but JWT_SECRET/AES_SECRET are the built-in dev defaults. Set real secrets in .env (see .env.example) and restart.');
    process.exit(1);
  }
  console.warn('⚠️   Using built-in dev secrets — set JWT_SECRET and AES_SECRET in environment for LAN/production deployment.');
}

// AES-256-GCM is authenticated encryption: the authTag detects tampering on
// the ciphertext at decrypt time. A fresh 12-byte IV per message is mandatory
// — never reuse an IV with the same key. The capstone defense talking point
// is "confidentiality + integrity in one operation, FIPS 140 approved cipher."
//
// Fail-closed (RA 10173 §20): if encryption ever throws, the error propagates
// and the message is NOT stored — callers catch it and tell the sender to
// retry. Silently storing plaintext (the old soft-fail) would defeat
// encryption-at-rest without anyone noticing.
function encryptMessage(text) {
  const iv         = crypto.randomBytes(12);              // 96-bit IV for GCM
  const cipher     = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const encrypted  = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();                 // 128-bit auth tag
  // Store as: iv(hex):authTag(hex):ciphertext(hex)
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptMessage(stored) {
  try {
    if (!stored || !stored.includes(':')) return stored; // not encrypted
    const parts = stored.split(':');
    if (parts.length !== 3) return stored;
    const iv        = Buffer.from(parts[0], 'hex');
    const authTag   = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const decipher  = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
  } catch { return stored; } // fallback: return as-is if decryption fails
}

console.log('🔐  AES-256-GCM encryption initialized');

// Uploads live OUTSIDE public/ so express.static can never serve them without
// auth — they're delivered only through the authenticated GET /uploads/:name
// route below. Files are encrypted at rest with the same AES-256-GCM key as
// messages (RA 10173 §20 — images, documents and voice notes are message
// content too).
const UPLOAD_DIR = path.join(__dirname,'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR,{recursive:true});

// One-time migration: move any legacy files out of the world-readable
// public/uploads/ into the private dir (they stay plaintext until re-uploaded;
// readFileDecrypted handles both formats).
const LEGACY_UPLOAD_DIR = path.join(__dirname,'public','uploads');
if (fs.existsSync(LEGACY_UPLOAD_DIR)) {
  for (const f of fs.readdirSync(LEGACY_UPLOAD_DIR)) {
    if (f === '.gitkeep') continue;
    try { fs.renameSync(path.join(LEGACY_UPLOAD_DIR, f), path.join(UPLOAD_DIR, f)); } catch {}
  }
}

// At-rest file format: 'MSKAENC1' magic + 12-byte IV + 16-byte GCM tag + ciphertext.
// Files without the magic are legacy plaintext and are served as-is.
const FILE_MAGIC = Buffer.from('MSKAENC1');
function encryptFileAtRest(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.subarray(0, 8).equals(FILE_MAGIC)) return; // already encrypted
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const enc    = Buffer.concat([cipher.update(data), cipher.final()]);
  fs.writeFileSync(filePath, Buffer.concat([FILE_MAGIC, iv, cipher.getAuthTag(), enc]));
}
function readFileDecrypted(filePath) {
  const data = fs.readFileSync(filePath);
  if (!data.subarray(0, 8).equals(FILE_MAGIC)) return data; // legacy plaintext
  const iv = data.subarray(8, 20), tag = data.subarray(20, 36), enc = data.subarray(36);
  const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null,UPLOAD_DIR),
  filename:    (req,file,cb) => cb(null, Date.now()+'-'+Math.round(Math.random()*1e6)+path.extname(file.originalname))
});
const ALLOWED = ['image/jpeg','image/jpg','image/png','image/gif','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const upload = multer({ storage, limits:{fileSize:5*1024*1024}, fileFilter:(req,file,cb)=>{ if(ALLOWED.includes(file.mimetype)) cb(null,true); else cb(new Error('File type not allowed')); } });

// SQLite (node:sqlite) — WAL mode, foreign_keys ON. See db.js.
const db = require('./db');

// ── Demo conversations (dev/demo only) ───────────────────────────────────────
// Populates the left panel with realistic classmates and message history so the
// list, its date groups and its unread badges can actually be seen and defended.
// Called ONLY from inside the same `!IS_PROD || SEED_DEMO=1` guard as the demo
// accounts — on a production boot neither runs, so no fake student ever exists
// on a real deployment.
//
// It writes through the normal tables with the normal encryption, so everything
// here is real data taking the real code path: nothing is hardcoded into the
// markup. Timestamps are backdated across three days on purpose, because that
// is what makes the TODAY / YESTERDAY / EARLIER grouping observable.
async function seedDemoConversations() {
  const peers = [
    { name:'Kisha Ramos',        email:'kisha@cics.msu.edu',  role:'student' },
    { name:'Tommy Uy',           email:'tommy@cics.msu.edu',  role:'student' },
    { name:'Ghost Delos Reyes',  email:'ghost@cics.msu.edu',  role:'student' },
    { name:'Dre Mangorsi',       email:'dre@cics.msu.edu',    role:'student' },
    { name:'Prof. Santos',       email:'santos@cics.msu.edu', role:'faculty' },
  ];
  // A fixed password for demo peers. They are seeded approved so they appear in
  // directories, but they are ordinary accounts with no elevated rights.
  const hash = await bcrypt.hash('demo1234', 12);
  const ids = {};
  for (const p of peers) {
    const [rows] = await db.query('SELECT id FROM users WHERE email=?',[p.email]);
    if (rows.length === 0) {
      const [r] = await db.query(
        'INSERT INTO users (name,email,password_hash,role,account_status) VALUES (?,?,?,?,?)',
        [p.name,p.email,hash,p.role,'approved']);
      ids[p.email] = r.insertId;
    } else ids[p.email] = rows[0].id;
  }

  const [me] = await db.query('SELECT id FROM users WHERE email=?',['student@cics.msu.edu']);
  if (!me.length) return;
  const myId = me[0].id;

  // Idempotency: if any peer has already spoken, the seed has run before. This
  // keeps a restart from stacking duplicate history, without wiping anything the
  // real user has since written.
  const peerIds = peers.map(p => ids[p.email]);
  const [already] = await db.query(
    `SELECT COUNT(*) AS n FROM messages WHERE sender_id IN (${peerIds.map(()=>'?').join(',')})`, peerIds);
  if (already[0].n > 0) { console.log('ℹ️   Demo conversations already present — not reseeding'); return; }

  // 'YYYY-MM-DD HH:MM:SS' localtime, matching the column's own default format.
  const at = (daysAgo, hh, mm) => {
    const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hh, mm, 0, 0);
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
  };
  const say = async (senderId, convKey, text, when) => db.query(
    'INSERT INTO messages (sender_id,conv_key,type,text,created_at) VALUES (?,?,?,?,?)',
    [senderId, convKey, 'chat', encryptMessage(text), when]);

  // Private threads. buildPrivateKey sorts the addresses, so the key matches
  // exactly what the live send path would produce for the same two people.
  const pk = e => buildPrivateKey('student@cics.msu.edu', e);
  await say(ids['kisha@cics.msu.edu'], pk('kisha@cics.msu.edu'), 'Naka-submit ka na ba ng capstone chapter 2?', at(0,8,41));
  await say(myId,                      pk('kisha@cics.msu.edu'), 'Hindi pa, tinatapos ko pa yung ERD ngayon.',  at(0,8,44));
  await say(ids['kisha@cics.msu.edu'], pk('kisha@cics.msu.edu'), 'Alright! See you later.',                     at(0,8,47));

  await say(ids['tommy@cics.msu.edu'], pk('tommy@cics.msu.edu'), 'Pakisend na lang yung defense schedule.',      at(0,8,28));
  await say(ids['tommy@cics.msu.edu'], pk('tommy@cics.msu.edu'), 'Picking up the product now...',                at(0,8,30));

  await say(ids['ghost@cics.msu.edu'], pk('ghost@cics.msu.edu'), 'Wassup, where you at??',                       at(0,8,12));

  await say(myId,                      pk('dre@cics.msu.edu'),   'Send the file when you can.',                  at(1,21,15));

  await say(ids['santos@cics.msu.edu'], pk('santos@cics.msu.edu'), 'Meeting moved to Thursday, 10:00 AM.',       at(2,18,45));

  // A little life in the broadcast channel too, dated earlier so the Global
  // Chat preview is not empty on first open.
  await say(ids['santos@cics.msu.edu'], 'group_general', 'Reminder: system maintenance this weekend.',           at(2,10,20));

  console.log(`✅  Seeded ${peers.length} demo classmates and their conversations`);
}

async function setupDatabase() {
  try {
    db.ensureSchema();
    console.log(`✅  SQLite ready: ${db.DB_PATH}`);
    console.log('✅  Tables, indexes & integrity constraints ensured');

    // Demo accounts with known passwords are a dev/demo convenience only —
    // in production they'd be a standing backdoor (and the boot-time password
    // reset would undo any credential rotation). Seed only outside production,
    // or when SEED_DEMO=1 is set explicitly.
    if (!IS_PROD || process.env.SEED_DEMO === '1') {
      const accounts = [
        { name:'Admin', email:'admin@cics.msu.edu', password:'admin123', role:'admin', status:'approved' },
        { name:'Student Demo', email:'student@cics.msu.edu', password:'student123', role:'student', status:'approved' },
      ];
      for (const acc of accounts) {
        const hash = await bcrypt.hash(acc.password, 12);
        const [rows] = await db.query('SELECT id FROM users WHERE email=?',[acc.email]);
        if (rows.length===0) { await db.query('INSERT INTO users (name,email,password_hash,role,account_status) VALUES (?,?,?,?,?)',[acc.name,acc.email,hash,acc.role,acc.status]); console.log(`✅  Created: ${acc.email} / ${acc.password}`); }
        else { await db.query('UPDATE users SET password_hash=?,name=?,role=?,account_status=? WHERE email=?',[hash,acc.name,acc.role,acc.status,acc.email]); console.log(`🔄  Reset:   ${acc.email} / ${acc.password}`); }
      }
      console.log('\n🎉  Login:\n    student@cics.msu.edu / student123\n    admin@cics.msu.edu   / admin123\n');
      await seedDemoConversations();
    } else {
      console.log('ℹ️   Demo account seeding skipped (NODE_ENV=production)');
    }
    // Reset ALL users to offline on server start (in case of crash/restart)
    await db.query("UPDATE users SET status = 'offline'");
    console.log('✅  All users reset to offline');
  } catch (err) { console.error('❌  DB failed:', err.message); process.exit(1); }
}

// Tokens carry a `tv` (token_version) claim checked against the users table on
// every request — bumping the DB value instantly revokes all of a user's
// outstanding JWTs (logout, password change, reject, delete). RA 10173 Tier 2.
async function tokenStillValid(payload) {
  try {
    const [rows] = await db.query('SELECT token_version FROM users WHERE id=?',[payload.id]);
    return rows.length > 0 && (rows[0].token_version||0) === (payload.tv||0);
  } catch { return false; }
}
async function bumpTokenVersion(userId) {
  await db.query('UPDATE users SET token_version=token_version+1 WHERE id=?',[userId]);
  disconnectUserSockets(userId);
}
function disconnectUserSockets(userId) {
  for (const [sid,u] of onlineUsers.entries()) {
    if (u.id === userId) io.sockets.sockets.get(sid)?.disconnect(true);
  }
}

async function verifyToken(req,res,next) {
  const auth=req.headers.authorization;
  if(!auth) return res.status(401).json({error:'No token'});
  try {
    const payload=jwt.verify(auth.replace('Bearer ',''),JWT_SECRET);
    if(!await tokenStillValid(payload)) return res.status(401).json({error:'Session expired or revoked'});
    req.user=payload; next();
  }
  catch { res.status(401).json({error:'Invalid token'}); }
}
function adminOnly(req,res,next) { if(req.user?.role!=='admin') return res.status(403).json({error:'Admin only'}); next(); }

// Like verifyToken, but also accepts ?token= — needed because <img>/<audio>/<a>
// tags can't send an Authorization header. Only used for the uploads route.
async function verifyTokenAllowQuery(req,res,next) {
  const auth = req.headers.authorization;
  const token = auth ? auth.replace('Bearer ','') : req.query.token;
  if(!token) return res.status(401).json({error:'No token'});
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if(!await tokenStillValid(payload)) return res.status(401).json({error:'Session expired or revoked'});
    req.user = payload; next();
  }
  catch { res.status(401).json({error:'Invalid token'}); }
}

// ── Audit logging (RA 10173 §21 accountability) ──────────────────────────────
// Central helper: every security-relevant event lands in audit_logs with actor,
// source IP and user agent. `req` may be an Express request or a Socket.IO
// socket. Failures are logged to console — never silently swallowed.
async function logAudit(userId, action, details, req) {
  try {
    const ip = req?.ip || req?.handshake?.address || req?.socket?.remoteAddress || null;
    const ua = req?.headers?.['user-agent'] || req?.handshake?.headers?.['user-agent'] || null;
    await db.query('INSERT INTO audit_logs (user_id,action,details,ip,user_agent) VALUES (?,?,?,?,?)',[userId,action,details,ip,ua]);
  } catch (e) { console.warn('audit log failed:', e.message); }
}

// Authenticated + decrypting delivery of uploaded files (replaces the old
// unauthenticated express.static exposure of public/uploads).
const UPLOAD_MIME = {
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.gif':'image/gif', '.webp':'image/webp',
  '.pdf':'application/pdf', '.doc':'application/msword',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.webm':'audio/webm', '.ogg':'audio/ogg', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.m4a':'audio/mp4'
};
app.get('/uploads/:name', verifyTokenAllowQuery, (req,res) => {
  const name = path.basename(req.params.name); // strips any ../ traversal
  const fp = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(fp)) return res.status(404).json({error:'Not found'});
  try {
    const buf = readFileDecrypted(fp);
    res.setHeader('Content-Type', UPLOAD_MIME[path.extname(name).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Content-Disposition','inline');
    res.setHeader('Cache-Control','private, no-store');
    res.send(buf);
  } catch { res.status(500).json({error:'File unreadable'}); }
});

// ── Login rate limiting (in-memory, per IP+email) ─────────────────────────────
// 5 failed attempts within 15 minutes locks that IP+email pair for 15 minutes.
// Counters clear on successful login; the map is pruned to avoid growth.
const loginFailures = new Map(); // key -> { count, firstAt }
const RATE_MAX = 5, RATE_WINDOW_MS = 15*60*1000;
const rateKey = (req,email) => `${req.ip || req.socket.remoteAddress || '?'}|${String(email||'').trim().toLowerCase()}`;
function loginLocked(key) {
  const e = loginFailures.get(key);
  if (!e) return false;
  if (Date.now() - e.firstAt > RATE_WINDOW_MS) { loginFailures.delete(key); return false; }
  return e.count >= RATE_MAX;
}
function recordLoginFailure(key) {
  const e = loginFailures.get(key);
  if (!e || Date.now() - e.firstAt > RATE_WINDOW_MS) loginFailures.set(key, { count: 1, firstAt: Date.now() });
  else e.count++;
}
setInterval(() => {
  for (const [k, e] of loginFailures.entries()) if (Date.now() - e.firstAt > RATE_WINDOW_MS) loginFailures.delete(k);
}, 5*60*1000).unref();

const ALLOWED_EMAIL_DOMAINS = ['cics.msu.edu','s.msumain.edu.ph','msumain.edu.ph'];
app.post('/api/register', async (req,res) => {
  const {name,email,password,role='student'}=req.body;
  if(!name||!email||!password) return res.status(400).json({error:'All fields required'});
  if(password.length<8) return res.status(400).json({error:'Password must be at least 8 characters'});
  if(!['student','faculty'].includes(role)) return res.status(400).json({error:'Invalid role'});
  const emailLower = String(email).trim().toLowerCase();
  const domain = emailLower.split('@')[1] || '';
  if(!ALLOWED_EMAIL_DOMAINS.includes(domain)) return res.status(400).json({error:'Only institutional emails are allowed (e.g. @cics.msu.edu, @s.msumain.edu.ph).'});
  try {
    const [ex]=await db.query('SELECT id FROM users WHERE email=?',[email.trim()]);
    if(ex.length>0) return res.status(409).json({error:'Email already registered'});
    const hash=await bcrypt.hash(password,12);
    const [r]=await db.query('INSERT INTO users (name,email,password_hash,role,account_status) VALUES (?,?,?,?,?)',[name,email.trim(),hash,role,'pending']);
    await logAudit(r.insertId,'REGISTER',`${name} registered`,req);
    res.json({message:'Account created! Wait for admin approval.'});
  } catch(err){ res.status(500).json({error:'Server error'}); }
});

// ── Chat login (students & faculty only — admin is BLOCKED) ───────────────────
app.post('/api/login', async (req,res) => {
  const {email,password}=req.body;
  if(!email||!password) return res.status(400).json({error:'Email and password required'});
  const rk = rateKey(req,email);
  if(loginLocked(rk)) return res.status(429).json({error:'Too many failed attempts. Try again in 15 minutes.'});
  try {
    const [rows]=await db.query('SELECT * FROM users WHERE email=?',[email.trim()]);
    if(!rows.length) { recordLoginFailure(rk); await logAudit(null,'LOGIN_FAILED',`Unknown email at Chat login: ${String(email).trim()}`,req); return res.status(401).json({error:'Invalid credentials'}); }
    const user=rows[0];
    if(!await bcrypt.compare(password,user.password_hash)) { recordLoginFailure(rk); await logAudit(user.id,'LOGIN_FAILED',`Wrong password at Chat login: ${user.email}`,req); return res.status(401).json({error:'Invalid credentials'}); }
    loginFailures.delete(rk);
    if(user.account_status==='pending')  return res.status(403).json({error:'Account pending admin approval.'});
    if(user.account_status==='rejected') return res.status(403).json({error:'Account rejected. Contact admin.'});
    // ADMIN accounts must use the Admin Dashboard — not the chat app
    if(user.role==='admin') return res.status(403).json({error:'Admin accounts must login at the Admin Dashboard. Please go to /admin.html'});
    const token=jwt.sign({id:user.id,email:user.email,name:user.name,role:user.role,tv:user.token_version||0},JWT_SECRET,{expiresIn:'8h'});
    await logAudit(user.id,'LOGIN',`${user.name} logged in via Chat`,req);
    console.log(`✅  Chat Login: ${user.name} (${user.role})`);
    res.json({token,name:user.name,role:user.role});
  } catch(err){ res.status(500).json({error:'Server error'}); }
});

// ── Admin login (admin only — students & faculty are BLOCKED) ─────────────────
app.post('/api/admin/login', async (req,res) => {
  const {email,password}=req.body;
  if(!email||!password) return res.status(400).json({error:'Email and password required'});
  const rk = rateKey(req,email);
  if(loginLocked(rk)) return res.status(429).json({error:'Too many failed attempts. Try again in 15 minutes.'});
  try {
    const [rows]=await db.query('SELECT * FROM users WHERE email=?',[email.trim()]);
    if(!rows.length) { recordLoginFailure(rk); await logAudit(null,'LOGIN_FAILED',`Unknown email at Admin login: ${String(email).trim()}`,req); return res.status(401).json({error:'Invalid credentials'}); }
    const user=rows[0];
    if(!await bcrypt.compare(password,user.password_hash)) { recordLoginFailure(rk); await logAudit(user.id,'LOGIN_FAILED',`Wrong password at Admin login: ${user.email}`,req); return res.status(401).json({error:'Invalid credentials'}); }
    loginFailures.delete(rk);
    if(user.role!=='admin') { await logAudit(user.id,'LOGIN_FAILED',`Non-admin attempted Admin portal: ${user.email}`,req); return res.status(403).json({error:'Access denied. This portal is for Admin accounts only.'}); }
    if(user.account_status!=='approved') return res.status(403).json({error:'Account not approved.'});
    const token=jwt.sign({id:user.id,email:user.email,name:user.name,role:user.role,tv:user.token_version||0},JWT_SECRET,{expiresIn:'8h'});
    await logAudit(user.id,'LOGIN',`${user.name} logged in via Admin Dashboard`,req);
    console.log(`🛡️   Admin Login: ${user.name}`);
    res.json({token,name:user.name,role:user.role});
  } catch(err){ res.status(500).json({error:'Server error'}); }
});

// ── Logout — revokes ALL of the user's outstanding tokens ─────────────────────
// Bumping token_version invalidates every JWT issued before this call (all
// tabs/devices) and disconnects live sockets. Client-side token discard alone
// is not real session termination.
app.post('/api/logout', verifyToken, async(req,res)=>{
  try {
    await bumpTokenVersion(req.user.id);
    await logAudit(req.user.id,'LOGOUT',`${req.user.name} logged out`,req);
    res.json({message:'Logged out'});
  } catch { res.status(500).json({error:'Server error'}); }
});

app.post('/api/upload', verifyToken, (req,res) => {
  upload.single('file')(req,res,async(err)=>{
    if(err instanceof multer.MulterError) return res.status(400).json({error: err.code==='LIMIT_FILE_SIZE'?'Max 5MB allowed':err.message});
    if(err) return res.status(400).json({error:err.message});
    if(!req.file) return res.status(400).json({error:'No file'});
    // Encrypt at rest before anything references the file (fail-closed)
    try { encryptFileAtRest(req.file.path); }
    catch { fs.unlink(req.file.path,()=>{}); return res.status(500).json({error:'Could not secure file — upload cancelled'}); }
    const isImage=req.file.mimetype.startsWith('image/');
    const fileUrl=`/uploads/${req.file.filename}`;
    const msgType=isImage?'image':'file';
    const convKey=req.body.convKey||'group_general';

    try {
      // For private chats, build consistent key
      let realKey = convKey;
      let targetEmail = null;
      if (convKey.startsWith('private_')) {
        targetEmail = convKey.replace('private_','');
        realKey = buildPrivateKey(req.user.email, targetEmail);
      }

      const [result]=await db.query(
        'INSERT INTO messages (sender_id,conv_key,type,text,file_name,file_url,file_size,file_type) VALUES (?,?,?,?,?,?,?,?)',
        [req.user.id,realKey,msgType,req.file.originalname,req.file.originalname,fileUrl,req.file.size,req.file.mimetype]
      );

      const msg={
        id:result.insertId, type:msgType,
        sender:req.user.name, role:req.user.role,
        text:req.file.originalname,
        file_name:req.file.originalname, file_url:fileUrl,
        file_size:req.file.size, file_type:req.file.mimetype,
        timestamp:new Date().toISOString()
      };

      if (targetEmail) {
        // Private chat — send to target and sender only
        const targetSocket = [...onlineUsers.entries()].find(([,u])=>u.email===targetEmail)?.[0];
        if (targetSocket) io.to(targetSocket).emit('message:new',{...msg, convKey:'private_'+req.user.email});
        // Send back to uploader
        const senderSocket = [...onlineUsers.entries()].find(([,u])=>u.email===req.user.email)?.[0];
        if (senderSocket) io.to(senderSocket).emit('message:new',{...msg, convKey});
      } else {
        // Group chat
        io.to(realKey).emit('message:new',{...msg, convKey:realKey});
      }

      console.log(`📎  ${req.user.name} uploaded: ${req.file.originalname}`);
      res.json({message:'Uploaded',...msg, convKey});
    } catch(err){ console.error('Upload error:',err.message); res.status(500).json({error:'Server error'}); }
  });
});

// Voice message upload
const voiceUpload = multer({
  storage,
  limits:{fileSize:10*1024*1024},
  fileFilter:(req,file,cb)=>{ if(file.mimetype.startsWith('audio/')) cb(null,true); else cb(new Error('Audio only')); }
});

app.post('/api/upload/voice', verifyToken, (req,res) => {
  voiceUpload.single('file')(req,res,async(err)=>{
    if(err) return res.status(400).json({error:err.message});
    if(!req.file) return res.status(400).json({error:'No file'});
    // Encrypt at rest before anything references the file (fail-closed)
    try { encryptFileAtRest(req.file.path); }
    catch { fs.unlink(req.file.path,()=>{}); return res.status(500).json({error:'Could not secure file — upload cancelled'}); }
    const fileUrl=`/uploads/${req.file.filename}`;
    const convKey=req.body.convKey||'group_general';
    try {
      let realKey=convKey, targetEmail=null;
      if(convKey.startsWith('private_')) {
        targetEmail=convKey.replace('private_','');
        realKey=buildPrivateKey(req.user.email,targetEmail);
      }
      const [result]=await db.query(
        'INSERT INTO messages (sender_id,conv_key,type,text,file_name,file_url,file_size,file_type) VALUES (?,?,?,?,?,?,?,?)',
        [req.user.id,realKey,'voice','Voice message',req.file.originalname,fileUrl,req.file.size,req.file.mimetype]
      );
      const msg={id:result.insertId,type:'voice',sender:req.user.name,role:req.user.role,text:'Voice message',file_name:req.file.originalname,file_url:fileUrl,file_size:req.file.size,file_type:req.file.mimetype,timestamp:new Date().toISOString()};
      if(targetEmail) {
        const targetSocket=[...onlineUsers.entries()].find(([,u])=>u.email===targetEmail)?.[0];
        if(targetSocket) io.to(targetSocket).emit('message:new',{...msg,convKey:'private_'+req.user.email});
        const senderSocket=[...onlineUsers.entries()].find(([,u])=>u.email===req.user.email)?.[0];
        if(senderSocket) io.to(senderSocket).emit('message:new',{...msg,convKey});
      } else {
        io.to(realKey).emit('message:new',{...msg,convKey:realKey});
      }
      res.json({message:'Voice uploaded',...msg});
    } catch(err){ res.status(500).json({error:'Server error'}); }
  });
});

// Delete group (creator or admin)
app.delete('/api/groups/:id', verifyToken, async(req,res)=>{
  const {id}=req.params;
  try {
    const [rows]=await db.query('SELECT * FROM groups_table WHERE id=?',[id]);
    if(!rows.length) return res.status(404).json({error:'Group not found'});
    // Only creator or admin can delete
    if(rows[0].created_by!==req.user.id && req.user.role!=='admin')
      return res.status(403).json({error:'Only the group creator or admin can delete this group'});
    await db.query('UPDATE messages SET sender_id=NULL WHERE conv_key=?',['group_'+id]);
    await db.query('DELETE FROM group_members WHERE group_id=?',[id]);
    await db.query('DELETE FROM groups_table WHERE id=?',[id]);
    await logAudit(req.user.id,'DELETE_GROUP',`Deleted group ID ${id}: ${rows[0].name}`,req);
    // Notify all connected users
    io.emit('group:deleted',{groupId:id,key:'group_'+id});
    console.log(`🗑️  Group deleted: ${rows[0].name}`);
    res.json({message:'Group deleted'});
  } catch(err){ res.status(500).json({error:'Server error: '+err.message}); }
});

// Admin routes
app.get('/api/admin/stats',verifyToken,adminOnly,async(req,res)=>{
  try {
    const [[{totalUsers}]]=await db.query("SELECT COUNT(*) AS totalUsers FROM users WHERE account_status='approved'");
    const [[{pendingUsers}]]=await db.query("SELECT COUNT(*) AS pendingUsers FROM users WHERE account_status='pending'");
    const [[{totalMessages}]]=await db.query('SELECT COUNT(*) AS totalMessages FROM messages');
    const [[{totalCalls}]]=await db.query('SELECT COUNT(*) AS totalCalls FROM calls');
    const [[{totalGroups}]]=await db.query('SELECT COUNT(*) AS totalGroups FROM groups_table');
    // Use real-time in-memory map for accurate online count
    const onlineCount = onlineUsers.size;
    res.json({totalUsers, onlineUsers:onlineCount, pendingUsers, totalMessages, totalCalls, totalGroups});
  } catch { res.status(500).json({error:'Server error'}); }
});
// Time-bucketed history for the admin sparkline cards.
// Returns 5 arrays aligned to N buckets ending at "now", for range = day|month|year.
app.get('/api/admin/stats/trends', verifyToken, adminOnly, async (req, res) => {
  try {
    const range = ['day','month','year'].includes(req.query.range) ? req.query.range : 'day';
    const CFG = {
      day:   { points: 10, fmt: '%Y-%m-%d', startOf: d => { const x=new Date(d); x.setHours(0,0,0,0); return x; }, step: d => { const x=new Date(d); x.setDate(x.getDate()+1); return x; }, key: d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` },
      month: { points: 12, fmt: '%Y-%m',    startOf: d => new Date(d.getFullYear(), d.getMonth(), 1), step: d => new Date(d.getFullYear(), d.getMonth()+1, 1), key: d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` },
      year:  { points: 6,  fmt: '%Y',       startOf: d => new Date(d.getFullYear(), 0, 1), step: d => new Date(d.getFullYear()+1, 0, 1), key: d => `${d.getFullYear()}` },
    };
    const cfg = CFG[range];
    // Build N bucket boundaries [start_i, end_i) ending at the current period.
    const now = new Date();
    const lastStart = cfg.startOf(now);
    const buckets = [];
    let cur = lastStart;
    for (let i = 0; i < cfg.points; i++) {
      buckets.unshift({ start: new Date(cur), end: cfg.step(new Date(cur)), key: cfg.key(cur) });
      cur = new Date(cur);
      const prev = new Date(cur); prev.setTime(prev.getTime() - 1);
      cur = cfg.startOf(prev);
    }
    const oldest = buckets[0].start;
    // One bucketed query per metric. strftime bucket → row count.
    const qBucketed = (sql, args=[]) => db.query(sql, args).then(([r]) => {
      const m = new Map();
      for (const row of r) m.set(String(row.bk), Number(row.cnt) || 0);
      return m;
    });
    const [msgMap, callMap, newUserMap, newPendingMap, activeMap] = await Promise.all([
      // Messages created in bucket
      qBucketed(`SELECT strftime('${cfg.fmt}',created_at) AS bk, COUNT(*) AS cnt FROM messages WHERE created_at >= ? GROUP BY bk`, [oldest]),
      // Calls created in bucket
      qBucketed(`SELECT strftime('${cfg.fmt}',created_at) AS bk, COUNT(*) AS cnt FROM calls WHERE created_at >= ? GROUP BY bk`, [oldest]),
      // New users registered in bucket (any status)
      qBucketed(`SELECT strftime('${cfg.fmt}',created_at) AS bk, COUNT(*) AS cnt FROM users WHERE created_at >= ? GROUP BY bk`, [oldest]),
      // New pending users registered in bucket
      qBucketed(`SELECT strftime('${cfg.fmt}',created_at) AS bk, COUNT(*) AS cnt FROM users WHERE account_status='pending' AND created_at >= ? GROUP BY bk`, [oldest]),
      // Active users in bucket (distinct senders, proxy for "online" history)
      qBucketed(`SELECT strftime('${cfg.fmt}',created_at) AS bk, COUNT(DISTINCT sender_id) AS cnt FROM messages WHERE sender_id IS NOT NULL AND created_at >= ? GROUP BY bk`, [oldest]),
    ]);
    // Baseline counts BEFORE the window so cumulative series stay accurate.
    const [[{baseUsers}]]    = await db.query('SELECT COUNT(*) AS baseUsers    FROM users    WHERE created_at < ?', [oldest]);
    const [[{baseMessages}]] = await db.query('SELECT COUNT(*) AS baseMessages FROM messages WHERE created_at < ?', [oldest]);
    const [[{baseCalls}]]    = await db.query('SELECT COUNT(*) AS baseCalls    FROM calls    WHERE created_at < ?', [oldest]);
    let runUsers = Number(baseUsers)||0, runMessages = Number(baseMessages)||0, runCalls = Number(baseCalls)||0;
    const out = { range, labels: [], totalUsers: [], onlineUsers: [], pendingUsers: [], totalMessages: [], totalCalls: [] };
    for (const b of buckets) {
      runUsers    += newUserMap.get(b.key)    || 0;
      runMessages += msgMap.get(b.key)        || 0;
      runCalls    += callMap.get(b.key)       || 0;
      out.labels.push(b.key);
      out.totalUsers.push(runUsers);
      out.totalMessages.push(runMessages);
      out.totalCalls.push(runCalls);
      out.onlineUsers.push(activeMap.get(b.key) || 0);
      out.pendingUsers.push(newPendingMap.get(b.key) || 0);
    }
    // Anchor the final point to the current real value (online is real-time, not a bucket count).
    const liveOnline = onlineUsers.size;
    if (out.onlineUsers.length) out.onlineUsers[out.onlineUsers.length-1] = liveOnline;
    res.json(out);
  } catch (e) {
    console.error('stats/trends error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/pending',verifyToken,adminOnly,async(req,res)=>{
  try {
    const [r]=await db.query("SELECT id,name,email,role,created_at FROM users WHERE account_status='pending' ORDER BY created_at ASC");
    await logAudit(req.user.id,'VIEW_PENDING',`Viewed pending registrations (${r.length})`,req);
    res.json(r);
  }
  catch { res.status(500).json({error:'Server error'}); }
});
app.put('/api/admin/users/:id/approve',verifyToken,adminOnly,async(req,res)=>{
  try {
    const [r]=await db.query('SELECT name,email FROM users WHERE id=?',[req.params.id]);
    if(!r.length) return res.status(404).json({error:'User not found'});
    await db.query("UPDATE users SET account_status='approved' WHERE id=?",[req.params.id]);
    await logAudit(req.user.id,'APPROVE',`Approved: ${r[0].email}`,req);
    res.json({message:'Approved'});
  } catch { res.status(500).json({error:'Server error'}); }
});
app.delete('/api/admin/users/:id/reject',verifyToken,adminOnly,async(req,res)=>{
  try {
    const [r]=await db.query('SELECT name,email FROM users WHERE id=?',[req.params.id]);
    if(!r.length) return res.status(404).json({error:'User not found'});
    await db.query('UPDATE messages   SET sender_id=NULL WHERE sender_id=?',[req.params.id]);
    await db.query('UPDATE calls      SET caller_id=NULL WHERE caller_id=?',[req.params.id]);
    await db.query('UPDATE calls      SET receiver_id=NULL WHERE receiver_id=?',[req.params.id]);
    await db.query('UPDATE audit_logs SET user_id=NULL WHERE user_id=?',[req.params.id]);
    await db.query('DELETE FROM users WHERE id=?',[req.params.id]);
    disconnectUserSockets(parseInt(req.params.id)); // row gone -> tokens auto-revoked; drop live sockets too
    await logAudit(req.user.id,'REJECT',`Rejected: ${r[0].email}`,req);
    res.json({message:'Rejected'});
  } catch(err){ res.status(500).json({error:'Server error: '+err.message}); }
});
app.get('/api/admin/users',verifyToken,adminOnly,async(req,res)=>{
  try {
    const [rows]=await db.query("SELECT id,name,email,role,account_status,status,created_at FROM users WHERE account_status!='pending' ORDER BY created_at DESC");
    // Enrich with real-time online status from in-memory map
    const onlineEmails = new Set([...onlineUsers.values()].map(u=>u.email));
    const enriched = rows.map(u=>({
      ...u,
      status: onlineEmails.has(u.email) ? 'online' : 'offline'
    }));
    await logAudit(req.user.id,'VIEW_USERS',`Viewed user list (${rows.length})`,req);
    res.json(enriched);
  } catch { res.status(500).json({error:'Server error'}); }
});
app.post('/api/admin/users',verifyToken,adminOnly,async(req,res)=>{
  const {name,email,password,role='student'}=req.body;
  if(!name||!email||!password) return res.status(400).json({error:'All fields required'});
  if(password.length<8) return res.status(400).json({error:'Password must be at least 8 characters'});
  try {
    const [ex]=await db.query('SELECT id FROM users WHERE email=?',[email]);
    if(ex.length>0) return res.status(409).json({error:'Email exists'});
    const hash=await bcrypt.hash(password,12);
    const [r]=await db.query('INSERT INTO users (name,email,password_hash,role,account_status) VALUES (?,?,?,?,?)',[name,email,hash,role,'approved']);
    await logAudit(req.user.id,'ADD_USER',`Added: ${email}`,req);
    res.json({message:'User added',id:r.insertId});
  } catch(err){ res.status(500).json({error:'Server error'}); }
});
app.put('/api/admin/users/:id',verifyToken,adminOnly,async(req,res)=>{
  const {name,email,password,role}=req.body;
  if(password&&password.trim()!==''&&password.length<8) return res.status(400).json({error:'Password must be at least 8 characters'});
  if(role!==undefined&&!['student','faculty','admin'].includes(role)) return res.status(400).json({error:'Invalid role'});
  // Prevent an admin from demoting their own account and locking everyone out
  if(parseInt(req.params.id)===req.user.id&&role&&role!=='admin') return res.status(400).json({error:'Cannot change your own role'});
  try {
    const [before]=await db.query('SELECT role,email FROM users WHERE id=?',[req.params.id]);
    if(!before.length) return res.status(404).json({error:'User not found'});
    const passwordChanged=!!(password&&password.trim()!=='');
    if(passwordChanged) { const h=await bcrypt.hash(password,12); await db.query('UPDATE users SET name=?,email=?,password_hash=?,role=? WHERE id=?',[name,email,h,role,req.params.id]); }
    else await db.query('UPDATE users SET name=?,email=?,role=? WHERE id=?',[name,email,role,req.params.id]);
    // Password or role change revokes the user's existing sessions
    if(passwordChanged||(role&&role!==before[0].role)) await bumpTokenVersion(parseInt(req.params.id));
    const detail=`Edited ID ${req.params.id} (${before[0].email})`+
      (role&&role!==before[0].role?`, role: ${before[0].role} -> ${role}`:'')+
      (passwordChanged?', password changed':'');
    await logAudit(req.user.id,'EDIT_USER',detail,req);
    res.json({message:'Updated'});
  } catch(err){ res.status(500).json({error:'Server error'}); }
});
app.delete('/api/admin/users/:id',verifyToken,adminOnly,async(req,res)=>{
  if(parseInt(req.params.id)===req.user.id) return res.status(400).json({error:'Cannot delete yourself'});
  try {
    const [r]=await db.query('SELECT name,email FROM users WHERE id=?',[req.params.id]);
    if(!r.length) return res.status(404).json({error:'Not found'});
    await db.query('UPDATE messages   SET sender_id=NULL WHERE sender_id=?',[req.params.id]);
    await db.query('UPDATE calls      SET caller_id=NULL WHERE caller_id=?',[req.params.id]);
    await db.query('UPDATE calls      SET receiver_id=NULL WHERE receiver_id=?',[req.params.id]);
    await db.query('UPDATE audit_logs SET user_id=NULL WHERE user_id=?',[req.params.id]);
    await db.query('DELETE FROM users WHERE id=?',[req.params.id]);
    disconnectUserSockets(parseInt(req.params.id)); // row gone -> tokens auto-revoked; drop live sockets too
    await logAudit(req.user.id,'DELETE_USER',`Deleted: ${r[0].email}`,req);
    res.json({message:'Deleted'});
  } catch(err){ res.status(500).json({error:'Server error: '+err.message}); }
});
app.get('/api/admin/logs',verifyToken,adminOnly,async(req,res)=>{
  try {
    const [r]=await db.query('SELECT l.*,u.name AS user_name FROM audit_logs l LEFT JOIN users u ON l.user_id=u.id ORDER BY l.created_at DESC LIMIT 100');
    await logAudit(req.user.id,'VIEW_LOGS','Viewed audit logs',req);
    res.json(r);
  }
  catch { res.status(500).json({error:'Server error'}); }
});
app.get('/api/admin/messages',verifyToken,adminOnly,async(req,res)=>{
  // Privacy: admins are not allowed to read user message content.
  res.status(403).json({error:'Message content is private and cannot be viewed by administrators.'});
});

// Per-user login-activity summary for the admin monitoring cards. Built entirely
// from audit_logs (LOGIN = success, LOGIN_FAILED = failed attempt), so no new
// tracking is introduced — this just aggregates what security logging already
// records. LEFT JOIN keeps a user even with zero activity.
app.get('/api/admin/login-activity',verifyToken,adminOnly,async(req,res)=>{
  try {
    const [rows]=await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.account_status,
              SUM(CASE WHEN l.action='LOGIN'        THEN 1 ELSE 0 END) AS successes,
              SUM(CASE WHEN l.action='LOGIN_FAILED' THEN 1 ELSE 0 END) AS failed,
              MAX(CASE WHEN l.action='LOGIN' THEN l.created_at END)    AS last_login
         FROM users u
         LEFT JOIN audit_logs l ON l.user_id=u.id
        GROUP BY u.id
        ORDER BY (last_login IS NULL), last_login DESC`);
    await logAudit(req.user.id,'VIEW_LOGIN_ACTIVITY','Viewed login-activity monitor',req);
    res.json(rows);
  }
  catch { res.status(500).json({error:'Server error'}); }
});

// ── Account settings (the signed-in user's own record) ──────────────────────
// Change own password. Verifying the CURRENT password matters: a stolen or
// borrowed session must not be enough to take the account over permanently.
app.put('/api/user/password',verifyToken,async(req,res)=>{
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword     = String(req.body?.newPassword || '');
    if (!currentPassword || !newPassword) return res.status(400).json({error:'Both current and new password are required'});
    if (newPassword.length < 8)           return res.status(400).json({error:'New password must be at least 8 characters'});
    if (newPassword === currentPassword)  return res.status(400).json({error:'New password must be different from the current one'});

    // Shares the login limiter. Without it this route is a brute-force oracle
    // for the current password to anyone holding a token.
    const key = rateKey(req, req.user.email);
    if (loginLocked(key)) return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});

    const [rows] = await db.query('SELECT password_hash FROM users WHERE id=?',[req.user.id]);
    if (!rows.length) return res.status(404).json({error:'User not found'});
    if (!await bcrypt.compare(currentPassword, rows[0].password_hash)) {
      recordLoginFailure(key);
      await logAudit(req.user.id,'PASSWORD_CHANGE_FAILED','Wrong current password supplied',req);
      return res.status(401).json({error:'Current password is incorrect'});
    }

    await db.query('UPDATE users SET password_hash=? WHERE id=?',[await bcrypt.hash(newPassword,12), req.user.id]);
    await logAudit(req.user.id,'PASSWORD_CHANGED','Changed own password',req);
    // Revokes every outstanding token for this account, this session included,
    // and drops their sockets. Signing back in is the point: if someone else
    // held a session, a password change they did not make must not leave it
    // alive. Simpler to reason about than refreshing the current token.
    await bumpTokenVersion(req.user.id);
    res.json({ message:'Password changed. Please sign in again.' });
  }
  catch { res.status(500).json({error:'Server error'}); }
});

// Change own display name. Deliberately the only editable profile field —
// email and role identify the account and are the admin's to change.
app.put('/api/user/profile',verifyToken,async(req,res)=>{
  try {
    const name = String(req.body?.name || '').trim();
    if (name.length < 2 || name.length > 60) return res.status(400).json({error:'Name must be between 2 and 60 characters'});
    await db.query('UPDATE users SET name=? WHERE id=?',[name, req.user.id]);
    await logAudit(req.user.id,'PROFILE_UPDATED',`Display name set to "${name}"`,req);
    // Presence carries the name captured at socket handshake, so the in-memory
    // copy has to be corrected as well — broadcasting on its own would just
    // re-send the old one. The JWT's copy stays stale until the next sign-in,
    // which only affects this user's own token, not what others see.
    for (const u of onlineUsers.values()) if (u.id === req.user.id) u.name = name;
    broadcastPresence();
    res.json({ name });
  }
  catch { res.status(500).json({error:'Server error'}); }
});

// Per-user login history for the monitor cards. /login-activity above returns
// totals only, so it cannot back a chart — this groups the same audit_logs rows
// by day for one user.
app.get('/api/admin/login-activity/:userId/series',verifyToken,adminOnly,async(req,res)=>{
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({error:'Invalid user id'});
    // Bounded so a caller cannot ask for an arbitrarily large scan.
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));

    const [urows] = await db.query('SELECT id,name,email FROM users WHERE id=?',[userId]);
    if (!urows.length) return res.status(404).json({error:'User not found'});

    const since = new Date(Date.now() - (days-1)*86400000);
    const sinceStr = `${since.getFullYear()}-${String(since.getMonth()+1).padStart(2,'0')}-${String(since.getDate()).padStart(2,'0')} 00:00:00`;
    const [rows] = await db.query(
      `SELECT substr(created_at,1,10) AS d,
              SUM(CASE WHEN action='LOGIN'        THEN 1 ELSE 0 END) AS successes,
              SUM(CASE WHEN action='LOGIN_FAILED' THEN 1 ELSE 0 END) AS failed
         FROM audit_logs
        WHERE user_id=? AND created_at>=? AND action IN ('LOGIN','LOGIN_FAILED')
        GROUP BY d ORDER BY d ASC`, [userId, sinceStr]);

    // Zero-fill: a day with no activity must plot as 0, not be skipped. Without
    // this the line joins across the gap and invents a slope that never happened.
    const byDay = new Map(rows.map(r => [r.d, r]));
    const labels = [], successes = [], failed = [];
    for (let i = 0; i < days; i++) {
      const t = new Date(since.getFullYear(), since.getMonth(), since.getDate() + i);
      const key = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
      const hit = byDay.get(key);
      labels.push(key);
      successes.push(Number(hit?.successes) || 0);
      failed.push(Number(hit?.failed) || 0);
    }

    await logAudit(req.user.id,'VIEW_LOGIN_SERIES',`Viewed ${days}-day login history for user ${userId}`,req);
    res.json({ userId, name: urows[0].name, days, labels, successes, failed });
  }
  catch { res.status(500).json({error:'Server error'}); }
});

// ── Survey responses ────────────────────────────────────────────────────────
// Public submit (no auth) — anonymous respondents fill this in after the demo.
// This is the only unauthenticated POST in the system; respondents shouldn't
// be required to create an account just to give Likert feedback. We validate
// `type` and `device` to keep junk submissions from corrupting the dataset,
// but accept anonymous `name` for the Chapter-4 evaluation.
app.post('/api/survey', async (req, res) => {
  const { name, type, device, date, sectionScores, overall } = req.body || {};
  if (!type || !device) return res.status(400).json({ error: 'Respondent type and device are required' });
  if (!sectionScores || typeof sectionScores !== 'object') return res.status(400).json({ error: 'sectionScores required' });
  try {
    const a = Number(sectionScores.a?.mean ?? 0);
    const b = Number(sectionScores.b?.mean ?? 0);
    const c = Number(sectionScores.c?.mean ?? 0);
    const d = Number(sectionScores.d?.mean ?? 0);
    const ov = Number(overall ?? ((a + b + c + d) / 4));
    await db.query(
      'INSERT INTO survey_responses (respondent_name,respondent_type,device,response_date,scores_json,mean_a,mean_b,mean_c,mean_d,overall) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [name || null, type, device, date || null, JSON.stringify(sectionScores), a, b, c, d, ov]
    );
    res.json({ message: 'Response saved' });
  } catch (err) {
    console.error('Survey save error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/survey', verifyToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id,respondent_name,respondent_type,device,response_date,mean_a,mean_b,mean_c,mean_d,overall,created_at FROM survey_responses ORDER BY created_at DESC');
    const [[agg]] = await db.query('SELECT COUNT(*) AS total, AVG(mean_a) AS avg_a, AVG(mean_b) AS avg_b, AVG(mean_c) AS avg_c, AVG(mean_d) AS avg_d, AVG(overall) AS avg_overall FROM survey_responses');
    await logAudit(req.user.id,'VIEW_SURVEY',`Viewed survey responses (${rows.length})`,req);
    res.json({ responses: rows, summary: agg });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/survey/:id', verifyToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM survey_responses WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    let scores = {};
    try { scores = JSON.parse(row.scores_json); } catch {}
    res.json({ ...row, scores });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/survey.csv', verifyToken, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id,respondent_name,respondent_type,device,response_date,mean_a,mean_b,mean_c,mean_d,overall,scores_json,created_at FROM survey_responses ORDER BY created_at ASC');
    const csvEsc = v => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\r\n]/.test(s) ? `"${s}"` : s;
    };
    const header = ['id','name','type','device','date','mean_a','mean_b','mean_c','mean_d','overall','scores_json','created_at'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([r.id, r.respondent_name, r.respondent_type, r.device, r.response_date, r.mean_a, r.mean_b, r.mean_c, r.mean_d, r.overall, r.scores_json, r.created_at].map(csvEsc).join(','));
    }
    await logAudit(req.user.id,'EXPORT_SURVEY_CSV',`Exported survey CSV (${rows.length} rows)`,req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="msukaip-survey.csv"');
    res.send(lines.join('\r\n'));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Socket.IO
const onlineUsers=new Map();
const activeRooms=new Map();

io.use(async (socket,next)=>{
  const token=socket.handshake.auth?.token;
  if(!token) return next(new Error('Auth required'));
  try {
    const payload=jwt.verify(token,JWT_SECRET);
    if(!await tokenStillValid(payload)) return next(new Error('Session expired or revoked'));
    socket.user=payload; next();
  }
  catch { next(new Error('Invalid token')); }
});

function broadcastPresence(){
  // Deduplicate by email so a user with multiple tabs appears once.
  const seen = new Set();
  const unique = [];
  for(const u of onlineUsers.values()){
    if(seen.has(u.email)) continue;
    seen.add(u.email); unique.push(u);
  }
  io.emit('users:update', unique);
}
function userHasOtherSockets(userId, excludeSocketId){
  for(const [sid,u] of onlineUsers.entries()){
    if(sid!==excludeSocketId && u.id===userId) return true;
  }
  return false;
}

io.on('connection', async(socket)=>{
  const {id,email,name,role}=socket.user;
  onlineUsers.set(socket.id,{id,email,name,role,socketId:socket.id});
  await db.query('UPDATE users SET status=? WHERE id=?',['online',id]);
  console.log(`🟢  ${name} connected`);
  broadcastPresence();

  // Get groups for this user
  socket.on('groups:get', async()=>{
    try {
      const [groups]=await db.query(`
        SELECT g.id, g.name, g.created_at, g.created_by, u.name AS created_by_name
        FROM groups_table g
        INNER JOIN group_members gm ON g.id=gm.group_id
        LEFT JOIN users u ON g.created_by=u.id
        WHERE gm.user_id=?
        ORDER BY g.created_at DESC
      `,[id]);
      socket.emit('groups:list',groups);
      groups.forEach(g=>socket.join('group_'+g.id));
    } catch(err){ console.error(err.message); }
  });

  // Conversation summaries for the left panel.
  // Why this exists: nothing previously told the client which conversations a
  // user already has. It learned of a private chat only when a message arrived
  // live, or when the user opened it by hand — so on a fresh login the Private
  // list was built from whoever happened to be online, and months of history
  // were invisible. This returns ONE row per conversation (the newest message),
  // which is all the list needs for its preview line, timestamp and ordering;
  // full history stays with messages:get, which is fetched on demand.
  // Access is decided here, never by the client: the key set is the general
  // room, the groups this user belongs to, and private keys carrying its own
  // address, so no conversation the caller cannot see is ever enumerated.
  socket.on('conversations:get', async()=>{
    try {
      const [myGroups]=await db.query(
        'SELECT g.id FROM groups_table g INNER JOIN group_members gm ON g.id=gm.group_id WHERE gm.user_id=?',[id]);
      const keys=['group_general',...myGroups.map(g=>'group_'+g.id)];
      // buildPrivateKey sorts the two addresses, so this user's email is on one
      // side or the other — both patterns are checked.
      const [privateKeys]=await db.query(
        "SELECT DISTINCT conv_key FROM messages WHERE conv_key LIKE 'private\\_%' ESCAPE '\\' AND (conv_key LIKE ? OR conv_key LIKE ?)",
        ['private_'+email+'__%','%__'+email]);
      privateKeys.forEach(r=>keys.push(r.conv_key));

      const summaries=[];
      for(const key of keys){
        const [rows]=await db.query(
          `SELECT m.type,m.text,m.file_name,m.created_at,u.name AS sender_name
             FROM messages m LEFT JOIN users u ON m.sender_id=u.id
            WHERE m.conv_key=? ORDER BY m.id DESC LIMIT 1`,[key]);
        if(!rows.length) continue;
        const m=rows[0];
        // The client addresses a private chat as `private_<other email>`, while
        // the database stores the sorted canonical key — translate here so the
        // client keeps using the key shape the rest of its code expects.
        let clientKey=key, peer=null;
        if(key.startsWith('private_')){
          const pair=key.slice('private_'.length).split('__');
          const otherEmail=pair[0]===email?pair[1]:pair[0];
          const [u]=await db.query('SELECT name,email,role FROM users WHERE email=?',[otherEmail]);
          peer=u[0]||{name:otherEmail,email:otherEmail,role:'student'};
          clientKey='private_'+peer.email;
        }
        summaries.push({
          convKey:clientKey, peer,
          lastType:m.type,
          // Only chat text is encrypted at rest; file rows store the filename.
          lastText:m.type==='chat'?decryptMessage(m.text):(m.file_name||''),
          lastSender:m.sender_name,
          lastTime:m.created_at
        });
      }
      socket.emit('conversations:summary',summaries);
    } catch(err){ console.error('conversations:get failed:',err.message); }
  });

  // Always join general room
  socket.join('group_general');

  // Get messages for a conversation
  socket.on('messages:get', async({key})=>{
    try {
      // Refuse history for a group the caller does not belong to (RA 10173).
      if(!(await canAccessConv(id, key))){
        await logAudit(id,'ACCESS_DENIED',`Blocked messages:get on ${key}`,socket);
        return socket.emit('messages:history',{key,messages:[]});
      }
      let rows;
      if(key.startsWith('private_')) {
        const targetEmail=key.replace('private_','');
        const convKey=buildPrivateKey(email,targetEmail);
        [rows]=await db.query(`SELECT m.id,m.conv_key,m.type,m.text,m.file_name,m.file_url,m.file_size,m.file_type,m.created_at AS timestamp,u.name AS sender,u.role FROM messages m LEFT JOIN users u ON m.sender_id=u.id WHERE m.conv_key=? ORDER BY m.created_at ASC LIMIT 100`,[convKey]);
      } else {
        [rows]=await db.query(`SELECT m.id,m.conv_key,m.type,m.text,m.file_name,m.file_url,m.file_size,m.file_type,m.created_at AS timestamp,u.name AS sender,u.role FROM messages m LEFT JOIN users u ON m.sender_id=u.id WHERE m.conv_key=? ORDER BY m.created_at ASC LIMIT 100`,[key]);
      }
      // Decrypt text for chat/announcement messages
      const decrypted = rows.map(m => ({
        ...m,
        text: (m.type==='chat'||m.type==='announcement'||m.type==='system') ? decryptMessage(m.text) : m.text
      }));
      socket.emit('messages:history',{key,messages:decrypted});
    } catch(err){ console.error('Messages get error:',err.message); }
  });

  // Send message — encrypted with AES-256-GCM
  socket.on('message:send', async({text,convKey})=>{
    const t=text?.trim(); if(!t||!convKey) return;
    try {
      // Refuse posting into a group the caller does not belong to (RA 10173).
      if(!(await canAccessConv(id, convKey))){
        await logAudit(id,'ACCESS_DENIED',`Blocked message:send to ${convKey}`,socket);
        return socket.emit('message:error',{convKey,reason:'You are not a member of this conversation.'});
      }
      let realKey=convKey;
      if(convKey.startsWith('private_')) {
        const targetEmail=convKey.replace('private_','');
        realKey=buildPrivateKey(email,targetEmail);
      }
      // Encrypt before storing in database
      const encrypted = encryptMessage(t);
      const [result]=await db.query('INSERT INTO messages (sender_id,conv_key,type,text) VALUES (?,?,?,?)',[id,realKey,'chat',encrypted]);
      // Send plain text to clients (decrypted in transit via Socket.IO over LAN)
      const msg={id:result.insertId,type:'chat',sender:name,role,text:t,convKey,timestamp:new Date().toISOString()};

      if(convKey.startsWith('private_')) {
        const targetEmail=convKey.replace('private_','');
        const targetSocket=[...onlineUsers.entries()].find(([,u])=>u.email===targetEmail)?.[0];
        if(targetSocket) io.to(targetSocket).emit('message:new',{...msg,convKey:'private_'+email});
        socket.emit('message:new',msg);
      } else {
        io.to(realKey).emit('message:new',{...msg,convKey:realKey});
      }
    } catch(err){
      console.error('Send error:',err.message);
      socket.emit('message:error', { convKey, reason: 'Failed to save message — please try again.' });
    }
  });

  // Delete a message — sender or admin only
  socket.on('message:delete', async({id:msgId,convKey})=>{
    if(!msgId||!convKey) return;
    try {
      const [rows]=await db.query('SELECT id,sender_id,conv_key,file_url FROM messages WHERE id=?',[msgId]);
      if(!rows.length) return socket.emit('message:error',{msgId,convKey,reason:'Message not found'});
      const m=rows[0];
      // Permission: sender or admin
      if(m.sender_id!==id && role!=='admin'){
        return socket.emit('message:error',{msgId,convKey,reason:'You can only delete your own messages'});
      }
      await db.query('DELETE FROM messages WHERE id=?',[msgId]);
      // Best-effort: remove orphaned upload from disk
      if(m.file_url && m.file_url.startsWith('/uploads/')){
        const filePath=path.join(UPLOAD_DIR,path.basename(m.file_url));
        fs.unlink(filePath,()=>{}); // ignore errors — file may already be gone
      }
      await logAudit(id,'DELETE_MESSAGE',`Deleted msg ${msgId} from ${m.conv_key}`,socket);

      // Broadcast deletion. For private chats the canonical conv_key is sorted,
      // but each client uses `private_<other_email>` locally — so emit per recipient.
      if(m.conv_key.startsWith('private_')){
        const parts=m.conv_key.replace('private_','').split('__');
        const [emailA,emailB]=parts;
        for(const [sid,u] of onlineUsers.entries()){
          if(u.email===emailA||u.email===emailB){
            const otherEmail = u.email===emailA ? emailB : emailA;
            io.to(sid).emit('message:deleted',{id:msgId,convKey:'private_'+otherEmail});
          }
        }
      } else {
        io.to(m.conv_key).emit('message:deleted',{id:msgId,convKey:m.conv_key});
      }
      console.log(`🗑️   ${name} deleted message ${msgId}`);
    } catch(err){
      console.error('Delete message error:',err.message);
      socket.emit('message:error',{msgId,convKey,reason:'Failed to delete — please try again.'});
    }
  });

  // Broadcast (admin) — also encrypted
  socket.on('broadcast:send', async({text})=>{
    if(role!=='admin') return;
    const t=text?.trim(); if(!t) return;
    try {
      const encrypted = encryptMessage(t);
      await db.query('INSERT INTO messages (sender_id,conv_key,type,text) VALUES (?,?,?,?)',[id,'group_general','announcement',encrypted]);
      io.emit('message:new',{type:'announcement',sender:name,text:t,convKey:'group_general',timestamp:new Date().toISOString()});
    } catch (err) {
      console.error('Broadcast error:', err.message);
      socket.emit('message:error', { convKey: 'group_general', reason: 'Broadcast failed — please try again.' });
    }
  });

  // Typing — for private chats, send to the recipient's socket using THEIR convKey
  // (i.e. private_<sender_email>); for groups, broadcast to the room.
  const sendTyping=(convKey,typing)=>{
    if(!convKey) convKey='group_general';
    if(convKey.startsWith('private_')) {
      const targetEmail=convKey.replace('private_','').toLowerCase();
      const targetSocket=[...onlineUsers.entries()].find(([,u])=>String(u.email).toLowerCase()===targetEmail)?.[0];
      if(targetSocket) io.to(targetSocket).emit('typing:update',{name,convKey:'private_'+email,typing});
    } else {
      socket.broadcast.to(convKey).emit('typing:update',{name,convKey,typing});
    }
  };
  socket.on('typing:start',({convKey})=>sendTyping(convKey,true));
  socket.on('typing:stop', ({convKey})=>sendTyping(convKey,false));

  // Create group — transactional so a partial-failure leaves no orphaned group
  socket.on('group:create', async({name:gname,members})=>{
    const trimmed = (gname || '').trim();
    if (!trimmed) { socket.emit('group:error', { reason: 'Group name is required' }); return; }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query('INSERT INTO groups_table (name,created_by) VALUES (?,?)',[trimmed,id]);
      const gid = result.insertId;
      // Use INSERT OR IGNORE so the unique (group_id,user_id) index protects against dupes
      await conn.query('INSERT OR IGNORE INTO group_members (group_id,user_id) VALUES (?,?)',[gid,id]);
      for (const m of (members || [])) {
        const [u] = await conn.query('SELECT id FROM users WHERE email=?',[m.email]);
        if (u.length) await conn.query('INSERT OR IGNORE INTO group_members (group_id,user_id) VALUES (?,?)',[gid,u[0].id]);
      }
      await conn.commit();

      const key = 'group_'+gid;
      const allEmails = [email, ...(members || []).map(m => m.email)];
      for (const [sid,u] of onlineUsers.entries()) {
        if (allEmails.includes(u.email)) {
          io.to(sid).socketsJoin(key);
          io.to(sid).emit('groups:list', [{ id: gid, name: trimmed, created_at: new Date().toISOString() }]);
        }
      }
      console.log(`👥  Group created: ${trimmed}`);
    } catch (err) {
      try { await conn.rollback(); } catch {}
      console.error('Group create error:', err.message);
      socket.emit('group:error', { reason: 'Could not create group — please try again.' });
    } finally {
      conn.release();
    }
  });

  // VoIP
  socket.on('call:initiate',async({targetSocketId})=>{
    const target=onlineUsers.get(targetSocketId); if(!target)return;
    const [r]=await db.query('INSERT INTO calls (caller_id,receiver_id,status) VALUES (?,?,?)',[id,target.id,'missed']);
    io.to(targetSocketId).emit('call:incoming',{callId:r.insertId,from:{socketId:socket.id,name,role}});
    socket.emit('call:ringing',{callId:r.insertId,targetName:target.name});
  });
  socket.on('call:accept',async({callId,callerSocketId})=>{ await db.query("UPDATE calls SET status=?,started_at=datetime('now','localtime') WHERE id=?",['answered',callId]); io.to(callerSocketId).emit('call:accepted',{callId,answererSocketId:socket.id,answererName:name}); });
  socket.on('call:reject',async({callId,callerSocketId})=>{ await db.query('UPDATE calls SET status=? WHERE id=?',['rejected',callId]); io.to(callerSocketId).emit('call:rejected',{rejectedBy:name}); });
  socket.on('call:end',async({callId,targetSocketId})=>{
    let wasAnswered = false;
    try {
      const [rows] = await db.query('SELECT started_at FROM calls WHERE id=?',[callId]);
      wasAnswered = !!(rows[0] && rows[0].started_at);
    } catch {}
    await db.query(`UPDATE calls SET ended_at=datetime('now','localtime'),
      duration=CAST(strftime('%s',datetime('now','localtime')) AS INTEGER)-CAST(strftime('%s',COALESCE(started_at,datetime('now','localtime'))) AS INTEGER)
      WHERE id=?`,[callId]);
    if(targetSocketId){
      io.to(targetSocketId).emit(wasAnswered ? 'call:ended' : 'call:cancelled', {endedBy:name, cancelledBy:name});
    }
  });
  socket.on('webrtc:offer',        ({targetSocketId,offer})    =>io.to(targetSocketId).emit('webrtc:offer',        {offer,    fromSocketId:socket.id}));
  socket.on('webrtc:answer',       ({targetSocketId,answer})   =>io.to(targetSocketId).emit('webrtc:answer',       {answer}));
  socket.on('webrtc:ice-candidate',({targetSocketId,candidate})=>io.to(targetSocketId).emit('webrtc:ice-candidate',{candidate}));

  // Group call
  socket.on('room:join',async({roomId})=>{
    if(!roomId || typeof roomId!=='string') return;
    // A group call room is the group's own key, so only its members may join —
    // same access rule as the group's messages. Refusing here stops a non-member
    // from receiving a private call's peer list and WebRTC signaling.
    if(!(await canAccessConv(id, roomId))){
      await logAudit(id,'ACCESS_DENIED',`Blocked room:join on ${roomId}`,socket);
      return socket.emit('room:error',{reason:'You are not a member of this call.'});
    }
    socket.join(roomId); if(!activeRooms.has(roomId))activeRooms.set(roomId,new Set()); activeRooms.get(roomId).add(socket.id); socket.to(roomId).emit('room:peer-joined',{socketId:socket.id,name,role}); const members=[...activeRooms.get(roomId)].filter(s=>s!==socket.id).map(s=>({socketId:s,...onlineUsers.get(s)})); socket.emit('room:members',{roomId,members});
  });
  socket.on('room:leave',({roomId})=>{ socket.leave(roomId); if(activeRooms.has(roomId)){activeRooms.get(roomId).delete(socket.id); if(activeRooms.get(roomId).size===0)activeRooms.delete(roomId);} socket.to(roomId).emit('room:peer-left',{socketId:socket.id,name}); });
  socket.on('room:offer',        ({targetSocketId,offer})    =>io.to(targetSocketId).emit('room:offer',        {offer,    fromSocketId:socket.id}));
  socket.on('room:answer',       ({targetSocketId,answer})   =>io.to(targetSocketId).emit('room:answer',       {answer,   fromSocketId:socket.id}));
  socket.on('room:ice-candidate',({targetSocketId,candidate})=>io.to(targetSocketId).emit('room:ice-candidate',{candidate,fromSocketId:socket.id}));

  socket.on('disconnect',async()=>{
    for(const [roomId,members] of activeRooms.entries()) { if(members.has(socket.id)){members.delete(socket.id); socket.to(roomId).emit('room:peer-left',{socketId:socket.id,name}); if(members.size===0)activeRooms.delete(roomId);} }
    onlineUsers.delete(socket.id);
    // Only mark DB offline if this user has no other active sockets.
    if(!userHasOtherSockets(id, socket.id)){
      await db.query('UPDATE users SET status=? WHERE id=?',['offline',id]);
      console.log(`🔴  ${name} disconnected`);
    }
    broadcastPresence();
  });
});

// Deterministic key for a 1:1 conversation. Sorting the two emails guarantees
// that Alice→Bob and Bob→Alice resolve to the same conv_key — so both clients
// query the same row set from `messages` regardless of who opens the chat.
function buildPrivateKey(email1,email2) {
  return 'private_'+(email1<email2?email1+'__'+email2:email2+'__'+email1);
}

// Authorization gate for group conversations (RA 10173 — access control).
// A conv_key of the form `group_<id>` is private to its members. Without this
// check any authenticated user could read or post to any group just by guessing
// the id, since the client supplies the key. `group_general` is the open
// college-wide room and is intentionally exempt. Returns true if `userId` may
// access `convKey`; non-group keys pass through (private 1:1 keys are already
// bound to the caller's own email by buildPrivateKey).
async function canAccessConv(userId, convKey) {
  if (!convKey || !convKey.startsWith('group_') || convKey === 'group_general') return true;
  const gid = convKey.slice('group_'.length);
  if (!/^\d+$/.test(gid)) return false; // malformed group key
  const [rows] = await db.query('SELECT 1 FROM group_members WHERE group_id=? AND user_id=? LIMIT 1', [gid, userId]);
  return rows.length > 0;
}

const PORT=process.env.PORT||3000;
setupDatabase().then(async ()=>{
  await setupHttps();
  server.listen(PORT,'0.0.0.0',()=>{
    console.log(`🚀  MSUkaIP: http://localhost:${PORT}`);
    console.log(`🛡️   Admin:   http://localhost:${PORT}/admin.html`);
  });
  if (httpsServer) httpsServer.listen(HTTPS_PORT,'0.0.0.0',()=>{
    const lan = Object.values(os.networkInterfaces()).flat().find(i=>i && i.family==='IPv4' && !i.internal);
    console.log(`🔐  Voice calls from LAN clients: https://${lan?lan.address:'<this-machine-ip>'}:${HTTPS_PORT}`);
  });
});
