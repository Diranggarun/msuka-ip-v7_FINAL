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
async function setupHttps() {
  try {
    const certDir  = path.join(__dirname, 'certs');
    const keyPath  = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      const selfsigned = require('selfsigned');
      const pems = await selfsigned.generate(
        [{ name: 'commonName', value: 'msukaip.lan' }],
        { days: 3650, keySize: 2048 }
      );
      fs.mkdirSync(certDir, { recursive: true });
      fs.writeFileSync(keyPath, pems.private);
      fs.writeFileSync(certPath, pems.cert);
      console.log('🔐  Generated self-signed TLS certificate in certs/');
    }
    httpsServer = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app);
    io.attach(httpsServer);
  } catch (e) {
    console.warn(`⚠️   HTTPS disabled (${e.message}) — voice calls will only work on http://localhost:${process.env.PORT || 3000}.`);
  }
}
app.use(express.json());
app.use(express.static(path.join(__dirname,'public'),{
  setHeaders:(res,filePath)=>{
    if(filePath.endsWith('.html')) res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  }
}));

// ── Secrets — read from environment, fall back to dev defaults ───────────────
// For LAN/production deployment, set JWT_SECRET, AES_SECRET, AES_SALT, and
// optionally SQLITE_PATH in a .env file or the OS environment. See .env.example.
const JWT_SECRET = process.env.JWT_SECRET || 'msuka-ip-secret-2025';
const AES_SECRET = process.env.AES_SECRET || 'MSUkaIP-CICS-AES256-SecureKey-2025!';
const AES_SALT   = process.env.AES_SALT   || 'msukaip-salt';
const AES_KEY    = crypto.scryptSync(AES_SECRET, AES_SALT, 32); // 256-bit key

if (JWT_SECRET === 'msuka-ip-secret-2025' || AES_SECRET === 'MSUkaIP-CICS-AES256-SecureKey-2025!') {
  console.warn('⚠️   Using built-in dev secrets — set JWT_SECRET and AES_SECRET in environment for LAN/production deployment.');
}

// AES-256-GCM is authenticated encryption: the authTag detects tampering on
// the ciphertext at decrypt time. A fresh 12-byte IV per message is mandatory
// — never reuse an IV with the same key. The capstone defense talking point
// is "confidentiality + integrity in one operation, FIPS 140 approved cipher."
//
// The catch{return text} is a soft-fail: if scrypt or createCipheriv ever
// throws (e.g. corrupted AES_KEY), the message is still stored in plaintext
// rather than dropped. The trade-off is documented in DECISIONS.md.
function encryptMessage(text) {
  try {
    const iv         = crypto.randomBytes(12);              // 96-bit IV for GCM
    const cipher     = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
    const encrypted  = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag    = cipher.getAuthTag();                 // 128-bit auth tag
    // Store as: iv(hex):authTag(hex):ciphertext(hex)
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
  } catch { return text; } // fallback: store plain if encryption fails
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

const UPLOAD_DIR = path.join(__dirname,'public','uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR,{recursive:true});

const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null,UPLOAD_DIR),
  filename:    (req,file,cb) => cb(null, Date.now()+'-'+Math.round(Math.random()*1e6)+path.extname(file.originalname))
});
const ALLOWED = ['image/jpeg','image/jpg','image/png','image/gif','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const upload = multer({ storage, limits:{fileSize:5*1024*1024}, fileFilter:(req,file,cb)=>{ if(ALLOWED.includes(file.mimetype)) cb(null,true); else cb(new Error('File type not allowed')); } });

// SQLite (node:sqlite) — WAL mode, foreign_keys ON. See db.js.
const db = require('./db');

async function setupDatabase() {
  try {
    db.ensureSchema();
    console.log(`✅  SQLite ready: ${db.DB_PATH}`);
    console.log('✅  Tables, indexes & integrity constraints ensured');

    const accounts = [
      { name:'Admin', email:'admin@cics.msu.edu', password:'admin123', role:'admin', status:'approved' },
      { name:'Student Demo', email:'student@cics.msu.edu', password:'student123', role:'student', status:'approved' },
    ];
    for (const acc of accounts) {
      const hash = await bcrypt.hash(acc.password, 10);
      const [rows] = await db.query('SELECT id FROM users WHERE email=?',[acc.email]);
      if (rows.length===0) { await db.query('INSERT INTO users (name,email,password_hash,role,account_status) VALUES (?,?,?,?,?)',[acc.name,acc.email,hash,acc.role,acc.status]); console.log(`✅  Created: ${acc.email} / ${acc.password}`); }
      else { await db.query('UPDATE users SET password_hash=?,name=?,role=?,account_status=? WHERE email=?',[hash,acc.name,acc.role,acc.status,acc.email]); console.log(`🔄  Reset:   ${acc.email} / ${acc.password}`); }
    }
    // Reset ALL users to offline on server start (in case of crash/restart)
    await db.query("UPDATE users SET status = 'offline'");
    console.log('✅  All users reset to offline');
    console.log('\n🎉  Login:\n    student@cics.msu.edu / student123\n    admin@cics.msu.edu   / admin123\n');
  } catch (err) { console.error('❌  DB failed:', err.message); process.exit(1); }
}

function verifyToken(req,res,next) {
  const auth=req.headers.authorization;
  if(!auth) return res.status(401).json({error:'No token'});
  try { req.user=jwt.verify(auth.replace('Bearer ',''),JWT_SECRET); next(); }
  catch { res.status(401).json({error:'Invalid token'}); }
}
function adminOnly(req,res,next) { if(req.user?.role!=='admin') return res.status(403).json({error:'Admin only'}); next(); }

const ALLOWED_EMAIL_DOMAINS = ['cics.msu.edu','s.msumain.edu.ph','msumain.edu.ph'];
app.post('/api/register', async (req,res) => {
  const {name,email,password,role='student'}=req.body;
  if(!name||!email||!password) return res.status(400).json({error:'All fields required'});
  if(password.length<6) return res.status(400).json({error:'Password must be at least 6 characters'});
  if(!['student','faculty'].includes(role)) return res.status(400).json({error:'Invalid role'});
  const emailLower = String(email).trim().toLowerCase();
  const domain = emailLower.split('@')[1] || '';
  if(!ALLOWED_EMAIL_DOMAINS.includes(domain)) return res.status(400).json({error:'Only institutional emails are allowed (e.g. @cics.msu.edu, @s.msumain.edu.ph).'});
  try {
    const [ex]=await db.query('SELECT id FROM users WHERE email=?',[email.trim()]);
    if(ex.length>0) return res.status(409).json({error:'Email already registered'});
    const hash=await bcrypt.hash(password,10);
    const [r]=await db.query('INSERT INTO users (name,email,password_hash,role,account_status) VALUES (?,?,?,?,?)',[name,email.trim(),hash,role,'pending']);
    await db.query('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)',[r.insertId,'REGISTER',`${name} registered`]);
    res.json({message:'Account created! Wait for admin approval.'});
  } catch(err){ res.status(500).json({error:'Server error'}); }
});

// ── Chat login (students & faculty only — admin is BLOCKED) ───────────────────
app.post('/api/login', async (req,res) => {
  const {email,password}=req.body;
  if(!email||!password) return res.status(400).json({error:'Email and password required'});
  try {
    const [rows]=await db.query('SELECT * FROM users WHERE email=?',[email.trim()]);
    if(!rows.length) return res.status(401).json({error:'Invalid credentials'});
    const user=rows[0];
    if(!await bcrypt.compare(password,user.password_hash)) return res.status(401).json({error:'Invalid credentials'});
    if(user.account_status==='pending')  return res.status(403).json({error:'Account pending admin approval.'});
    if(user.account_status==='rejected') return res.status(403).json({error:'Account rejected. Contact admin.'});
    // ADMIN accounts must use the Admin Dashboard — not the chat app
    if(user.role==='admin') return res.status(403).json({error:'Admin accounts must login at the Admin Dashboard. Please go to /admin.html'});
    const token=jwt.sign({id:user.id,email:user.email,name:user.name,role:user.role},JWT_SECRET,{expiresIn:'8h'});
    await db.query('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)',[user.id,'LOGIN',`${user.name} logged in via Chat`]);
    console.log(`✅  Chat Login: ${user.name} (${user.role})`);
    res.json({token,name:user.name,role:user.role});
  } catch(err){ res.status(500).json({error:'Server error'}); }
});

// ── Admin login (admin only — students & faculty are BLOCKED) ─────────────────
app.post('/api/admin/login', async (req,res) => {
  const {email,password}=req.body;
  if(!email||!password) return res.status(400).json({error:'Email and password required'});
  try {
    const [rows]=await db.query('SELECT * FROM users WHERE email=?',[email.trim()]);
    if(!rows.length) return res.status(401).json({error:'Invalid credentials'});
    const user=rows[0];
    if(!await bcrypt.compare(password,user.password_hash)) return res.status(401).json({error:'Invalid credentials'});
    if(user.role!=='admin') return res.status(403).json({error:'Access denied. This portal is for Admin accounts only.'});
    if(user.account_status!=='approved') return res.status(403).json({error:'Account not approved.'});
    const token=jwt.sign({id:user.id,email:user.email,name:user.name,role:user.role},JWT_SECRET,{expiresIn:'8h'});
    await db.query('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)',[user.id,'LOGIN',`${user.name} logged in via Admin Dashboard`]);
    console.log(`🛡️   Admin Login: ${user.name}`);
    res.json({token,name:user.name,role:user.role});
  } catch(err){ res.status(500).json({error:'Server error'}); }
});

app.post('/api/upload', verifyToken, (req,res) => {
  upload.single('file')(req,res,async(err)=>{
    if(err instanceof multer.MulterError) return res.status(400).json({error: err.code==='LIMIT_FILE_SIZE'?'Max 5MB allowed':err.message});
    if(err) return res.status(400).json({error:err.message});
    if(!req.file) return res.status(400).json({error:'No file'});
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
    await db.query('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)',[req.user.id,'DELETE_GROUP',`Deleted group ID ${id}: ${rows[0].name}`]);
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
    // Use real-time in-memory map for accurate online count
    const onlineCount = onlineUsers.size;
    res.json({totalUsers, onlineUsers:onlineCount, pendingUsers, totalMessages, totalCalls});
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
  try { const [r]=await db.query("SELECT id,name,email,role,created_at FROM users WHERE account_status='pending' ORDER BY created_at ASC"); res.json(r); }
  catch { res.status(500).json({error:'Server error'}); }
});
app.put('/api/admin/users/:id/approve',verifyToken,adminOnly,async(req,res)=>{
  try {
    const [r]=await db.query('SELECT name,email FROM users WHERE id=?',[req.params.id]);
    if(!r.length) return res.status(404).json({error:'User not found'});
    await db.query("UPDATE users SET account_status='approved' WHERE id=?",[req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)',[req.user.id,'APPROVE',`Approved: ${r[0].email}`]);
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
    await db.query('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)',[req.user.id,'REJECT',`Rejected: ${r[0].email}`]);
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
    res.json(enriched);
  } catch { res.status(500).json({error:'Server error'}); }
});
app.post('/api/admin/users',verifyToken,adminOnly,async(req,res)=>{
  const {name,email,password,role='student'}=req.body;
  if(!name||!email||!password) return res.status(400).json({error:'All fields required'});
  try {
    const [ex]=await db.query('SELECT id FROM users WHERE email=?',[email]);
    if(ex.length>0) return res.status(409).json({error:'Email exists'});
    const hash=await bcrypt.hash(password,10);
    const [r]=await db.query('INSERT INTO users (name,email,password_hash,role,account_status) VALUES (?,?,?,?,?)',[name,email,hash,role,'approved']);
    await db.query('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)',[req.user.id,'ADD_USER',`Added: ${email}`]);
    res.json({message:'User added',id:r.insertId});
  } catch(err){ res.status(500).json({error:'Server error'}); }
});
app.put('/api/admin/users/:id',verifyToken,adminOnly,async(req,res)=>{
  const {name,email,password,role}=req.body;
  try {
    if(password&&password.trim()!=='') { const h=await bcrypt.hash(password,10); await db.query('UPDATE users SET name=?,email=?,password_hash=?,role=? WHERE id=?',[name,email,h,role,req.params.id]); }
    else await db.query('UPDATE users SET name=?,email=?,role=? WHERE id=?',[name,email,role,req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)',[req.user.id,'EDIT_USER',`Edited ID ${req.params.id}`]);
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
    await db.query('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)',[req.user.id,'DELETE_USER',`Deleted: ${r[0].email}`]);
    res.json({message:'Deleted'});
  } catch(err){ res.status(500).json({error:'Server error: '+err.message}); }
});
app.get('/api/admin/logs',verifyToken,adminOnly,async(req,res)=>{
  try { const [r]=await db.query('SELECT l.*,u.name AS user_name FROM audit_logs l LEFT JOIN users u ON l.user_id=u.id ORDER BY l.created_at DESC LIMIT 100'); res.json(r); }
  catch { res.status(500).json({error:'Server error'}); }
});
app.get('/api/admin/messages',verifyToken,adminOnly,async(req,res)=>{
  // Privacy: admins are not allowed to read user message content.
  res.status(403).json({error:'Message content is private and cannot be viewed by administrators.'});
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
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="msukaip-survey.csv"');
    res.send(lines.join('\r\n'));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// Socket.IO
const onlineUsers=new Map();
const activeRooms=new Map();

io.use((socket,next)=>{
  const token=socket.handshake.auth?.token;
  if(!token) return next(new Error('Auth required'));
  try { socket.user=jwt.verify(token,JWT_SECRET); next(); }
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

  // Always join general room
  socket.join('group_general');

  // Get messages for a conversation
  socket.on('messages:get', async({key})=>{
    try {
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
      await db.query('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)',[id,'DELETE_MESSAGE',`Deleted msg ${msgId} from ${m.conv_key}`]);

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
  socket.on('room:join',({roomId})=>{ socket.join(roomId); if(!activeRooms.has(roomId))activeRooms.set(roomId,new Set()); activeRooms.get(roomId).add(socket.id); socket.to(roomId).emit('room:peer-joined',{socketId:socket.id,name,role}); const members=[...activeRooms.get(roomId)].filter(s=>s!==socket.id).map(s=>({socketId:s,...onlineUsers.get(s)})); socket.emit('room:members',{roomId,members}); });
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
