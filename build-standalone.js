// Bundles index.html (login + chat) and admin.html (admin dashboard)
// into ONE self-contained HTML file with mocked Socket.io + REST so the
// prototype demonstrates the full UI offline: conversations, messages,
// voice notes, notifications, online users, admin stats and pending list.
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, 'msuka-ip-v7', 'public');
const OUT = path.join(__dirname, 'MSUkaIP-UI-Prototype.html');

// ---------- generate a tiny valid silent WAV so voice bubbles show duration ----------
function makeSilentWavDataUri(seconds) {
  const sampleRate = 8000;
  const numSamples = Math.round(sampleRate * seconds);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return 'data:audio/wav;base64,' + buf.toString('base64');
}
const VOICE_3S = makeSilentWavDataUri(3);
const VOICE_5S = makeSilentWavDataUri(5);

// ---------- helpers ----------
const mime = ext => ({
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', svg: 'image/svg+xml'
}[ext.toLowerCase()]);

function inlineAssets(html) {
  const refs = new Set();
  const re = /['"(]\/([\w\-]+\.(?:png|jpg|jpeg|webp|svg))['")]/g;
  let m;
  while ((m = re.exec(html)) !== null) refs.add(m[1]);
  for (const name of refs) {
    const file = path.join(PUB, name);
    if (!fs.existsSync(file)) { console.warn('  skip missing', name); continue; }
    const ext = name.split('.').pop();
    const b64 = fs.readFileSync(file).toString('base64');
    const dataUri = `data:${mime(ext)};base64,${b64}`;
    const escName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`/${escName}`, 'g'), dataUri);
    console.log('  inlined', name, '(' + (b64.length/1024).toFixed(0) + ' KB)');
  }
  return html;
}

function replaceFontLink(html) {
  return html.replace(
    /<link href="\/fonts\/google-fonts\.css" rel="stylesheet"\/?>/,
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">'
  );
}

// ---------- chat stub: mocks Socket.io + REST so the messenger fills with data ----------
const chatStub = `
<script>
(function(){
  const VOICE_3S = ${JSON.stringify(VOICE_3S)};
  const VOICE_5S = ${JSON.stringify(VOICE_5S)};

  // === REST stub ===
  const ok = (data) => Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(data), text:()=>Promise.resolve(JSON.stringify(data)) });
  const me = { id:1, name:'Hussien Diranggarun', email:'hdiranggarun@s.msumain.edu.ph', role:'student', token:'demo' };

  const origFetch = window.fetch;
  window.fetch = function(url, opts){
    const u = String(url || '');
    try {
      if (u.startsWith('/api/login'))      return ok({ success:true, token:'demo', name:me.name, role:me.role });
      if (u.startsWith('/api/register'))   return ok({ success:true });
      if (u.startsWith('/api/upload/voice')) return ok({ success:true, url:VOICE_3S, file_url:VOICE_3S, file_size:24576 });
      if (u.startsWith('/api/upload'))      return ok({ success:true, url:'', file_url:'', file_size:0 });
      if (u.startsWith('/api/'))            return ok({ success:true });
    } catch(e){}
    return origFetch.apply(this, arguments);
  };

  // === Mock Socket.io ===
  const FAKE_USERS = [
    { name:'Bash',              email:'bash@s.msumain.edu.ph',     role:'student', socketId:'s2' },
    { name:'Aisha Mangondato',  email:'aisha@s.msumain.edu.ph',    role:'student', socketId:'s3' },
    { name:'Dr. Maria Santos',  email:'msantos@msumain.edu.ph',    role:'faculty', socketId:'s4' },
    { name:'Juan dela Cruz',    email:'jdelacruz@s.msumain.edu.ph',role:'student', socketId:'s5' },
    { name:'Prof. Ramon Lim',   email:'rlim@msumain.edu.ph',       role:'faculty', socketId:'s6' }
  ];
  const FAKE_GROUPS = [
    { id:101, name:'BSIT 3-A',           created_by_name:'Dr. Maria Santos', created_at:new Date(Date.now()-30*86400e3).toISOString() },
    { id:102, name:'Capstone Group 7',   created_by_name:'Juan dela Cruz',   created_at:new Date(Date.now()-14*86400e3).toISOString() }
  ];
  const t = (mins) => new Date(Date.now() - mins*60e3).toISOString();
  const PRIVATE_BASH = [
    { sender:'Bash',                content:'kumusta?',                                    text:'kumusta?',                                    timestamp:t(45), type:'text', convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Bash' },
    { sender:'Bash',                content:'asdasdasdasdasdASDASDASDASDASDASDASDASDasdasd', text:'asdasdasdasdasdASDASDASDASDASDASDASDASDasdasd', timestamp:t(43), type:'text', convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Bash' },
    { sender:'Hussien Diranggarun', content:'asdasdasdasdasd',                              text:'asdasdasdasdasd',                              timestamp:t(40), type:'text', convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Hussien Diranggarun' },
    { sender:'Hussien Diranggarun', content:'asd',                                          text:'asd',                                          timestamp:t(39), type:'text', convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Hussien Diranggarun' },
    { sender:'Bash',                content:'asd',                                          text:'asd',                                          timestamp:t(38), type:'text', convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Bash' },
    { sender:'Hussien Diranggarun', content:'ASDASDASDasd',                                 text:'ASDASDASDasd',                                 timestamp:t(36), type:'text', convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Hussien Diranggarun' },
    { sender:'Bash',                content:'asd\\\\',                                       text:'asd\\\\',                                       timestamp:t(35), type:'text', convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Bash' },
    { sender:'Bash',                content:'asd',                                          text:'asd',                                          timestamp:t(34), type:'text', convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Bash' },
    { sender:'Bash',                content:'aasd',                                         text:'aasd',                                         timestamp:t(33), type:'text', convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Bash' },
    { sender:'Hussien Diranggarun', type:'voice', file_url:VOICE_3S, file_name:'voice.wav', file_size:28672, timestamp:t(8),  convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Hussien Diranggarun' },
    { sender:'Bash',                type:'voice', file_url:VOICE_5S, file_name:'voice.wav', file_size:50483, timestamp:t(6),  convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Bash' },
    { sender:'Bash',                type:'voice', file_url:VOICE_3S, file_name:'voice.wav', file_size:33792, timestamp:t(4),  convKey:'private_bash@s.msumain.edu.ph', convType:'private', senderName:'Bash' }
  ];
  const PRIVATE_AISHA = [
    { sender:'Aisha Mangondato',    text:'Got the notes, thanks!',                          timestamp:t(120), type:'text', convKey:'private_aisha@s.msumain.edu.ph', convType:'private', senderName:'Aisha Mangondato' },
    { sender:'Hussien Diranggarun', text:'welcome 👍',                                       timestamp:t(118), type:'text', convKey:'private_aisha@s.msumain.edu.ph', convType:'private', senderName:'Hussien Diranggarun' }
  ];
  const PRIVATE_FACULTY = [
    { sender:'Dr. Maria Santos',    text:'See you in class tomorrow.',                      timestamp:t(200), type:'text', convKey:'private_msantos@msumain.edu.ph', convType:'private', senderName:'Dr. Maria Santos' }
  ];
  const GLOBAL_MSGS = [
    { sender:'CICS Office',         text:'📢 Reminder: Orientation Friday 9 AM at the AVR.', timestamp:t(180), type:'announcement', convKey:'group_general', convType:'group', senderName:'CICS Office' },
    { sender:'Dr. Maria Santos',    text:'Slides for Week 8 are uploaded sa Drive.',         timestamp:t(160), type:'text',         convKey:'group_general', convType:'group', senderName:'Dr. Maria Santos' },
    { sender:'Juan dela Cruz',      text:'Thanks po, Maam.',                                 timestamp:t(150), type:'text',         convKey:'group_general', convType:'group', senderName:'Juan dela Cruz' },
    { sender:'Aisha Mangondato',    text:'See you all sa lab later.',                        timestamp:t(20),  type:'text',         convKey:'group_general', convType:'group', senderName:'Aisha Mangondato' }
  ];
  const GROUP_BSIT3A = [
    { sender:'Dr. Maria Santos',    text:'Pasahan ng project sa Friday, walang extensions.', timestamp:t(300), type:'text', convKey:'group_101', convType:'group', senderName:'Dr. Maria Santos' },
    { sender:'Juan dela Cruz',      text:'Noted po Maam!',                                   timestamp:t(290), type:'text', convKey:'group_101', convType:'group', senderName:'Juan dela Cruz' },
    { sender:'Hussien Diranggarun', text:'Same here po',                                     timestamp:t(285), type:'text', convKey:'group_101', convType:'group', senderName:'Hussien Diranggarun' }
  ];
  const GROUP_CAPSTONE = [
    { sender:'Juan dela Cruz',      text:'Meeting tonight 8 PM Discord?',                    timestamp:t(60),  type:'text', convKey:'group_102', convType:'group', senderName:'Juan dela Cruz' },
    { sender:'Hussien Diranggarun', text:'Sige game.',                                       timestamp:t(58),  type:'text', convKey:'group_102', convType:'group', senderName:'Hussien Diranggarun' },
    { sender:'Aisha Mangondato',    text:'Ako din!',                                         timestamp:t(56),  type:'text', convKey:'group_102', convType:'group', senderName:'Aisha Mangondato' }
  ];

  const HISTORY = {
    'private_bash@s.msumain.edu.ph':     PRIVATE_BASH,
    'private_aisha@s.msumain.edu.ph':    PRIVATE_AISHA,
    'private_msantos@msumain.edu.ph':    PRIVATE_FACULTY,
    'group_general':                      GLOBAL_MSGS,
    'group_101':                          GROUP_BSIT3A,
    'group_102':                          GROUP_CAPSTONE
  };

  function FakeSocket(){
    const listeners = {};
    const sock = {
      on(ev, fn){ (listeners[ev] = listeners[ev] || []).push(fn); return sock; },
      off(ev, fn){ if (listeners[ev]) listeners[ev] = listeners[ev].filter(f=>f!==fn); return sock; },
      emit(ev, payload){ handleClientEmit(ev, payload); return sock; },
      _fire(ev, ...args){ (listeners[ev]||[]).forEach(fn => { try{ fn(...args); }catch(e){ console.warn(e); } }); }
    };

    function handleClientEmit(ev, payload){
      if (ev === 'groups:get'){
        setTimeout(() => sock._fire('groups:list', FAKE_GROUPS), 30);
      }
      if (ev === 'messages:get'){
        const key = payload && payload.key;
        const messages = HISTORY[key] || [];
        setTimeout(() => sock._fire('messages:history', { key, messages }), 30);
      }
      if (ev === 'message:send'){
        const key = payload && payload.convKey;
        const text = payload && payload.text;
        const now = new Date().toISOString();
        const mine = { sender: me.name, senderName: me.name, content:text, text, type:'text', timestamp:now, convKey:key, convType: key && key.startsWith('group_') ? 'group' : 'private' };
        (HISTORY[key] = HISTORY[key] || []).push(mine);
        setTimeout(() => sock._fire('message:new', mine), 50);
        // Auto-reply on private chat with Bash to make the demo feel alive
        if (key === 'private_bash@s.msumain.edu.ph') {
          const replies = ['ok!', 'haha 😂', 'got it', 'sige', 'noted', 'wait lang'];
          const r = replies[Math.floor(Math.random() * replies.length)];
          const reply = { sender:'Bash', senderName:'Bash', content:r, text:r, type:'text', timestamp:new Date().toISOString(), convKey:key, convType:'private' };
          HISTORY[key].push(reply);
          setTimeout(() => sock._fire('message:new', reply), 1500);
        }
      }
      if (ev === 'typing:start' || ev === 'typing:stop') {/* noop */}
    }

    // Fire initial events that the chat app expects after auth
    setTimeout(() => {
      sock._fire('connect');
      sock._fire('users:update', FAKE_USERS);
      sock._fire('groups:list', FAKE_GROUPS);
      // Pre-load Bash conversation so the badge appears
      sock._fire('messages:history', { key:'private_bash@s.msumain.edu.ph', messages:PRIVATE_BASH });
      sock._fire('messages:history', { key:'group_general',                 messages:GLOBAL_MSGS });
    }, 40);

    // Simulate a fresh incoming message so the notification badge animates
    setTimeout(() => {
      const incoming = { sender:'Aisha Mangondato', senderName:'Aisha Mangondato', content:'May class tayo ba bukas?', text:'May class tayo ba bukas?', type:'text', timestamp:new Date().toISOString(), convKey:'private_aisha@s.msumain.edu.ph', convType:'private' };
      (HISTORY['private_aisha@s.msumain.edu.ph'] = HISTORY['private_aisha@s.msumain.edu.ph'] || []).push(incoming);
      sock._fire('message:new', incoming);
    }, 4000);

    return sock;
  }

  window.io = function(){ return FakeSocket(); };

  // === Intercept window.open so the rail's Admin/Feedback buttons switch views ===
  const origOpen = window.open;
  window.open = function(url) {
    const u = String(url || '');
    if (u.includes('admin.html'))    { parent.postMessage('switch:admin', '*');    return null; }
    if (u.includes('feedback.html')) { parent.postMessage('switch:feedback', '*'); return null; }
    return origOpen.apply(this, arguments);
  };

  // === Wrapper navigation ===
  window.addEventListener('message', (e) => {
    if (e.data === 'goto:chat') {
      try {
        const emailEl = document.querySelector('#login-email, input[type=email]');
        const passEl  = document.querySelector('#login-password, input[type=password]');
        if (emailEl) emailEl.value = me.email;
        if (passEl)  passEl.value  = 'demo123';
        if (typeof login === 'function') login();
        else {
          const btn = Array.from(document.querySelectorAll('button')).find(b => /sign in|log in|login/i.test(b.textContent||''));
          if (btn) btn.click();
        }
        // After login, auto-open the BASH private chat to mirror screenshot
        setTimeout(() => {
          try {
            if (typeof switchNav === 'function') switchNav('private', document.getElementById('nav-private'));
            if (typeof openConversation === 'function') openConversation('private_bash@s.msumain.edu.ph');
          } catch(err){}
        }, 600);
      } catch(err){}
    }
    if (e.data === 'goto:login') {
      try {
        sessionStorage.removeItem('msuka_user');
        const auth = document.getElementById('auth-screen');
        const app  = document.getElementById('app');
        if (auth) auth.style.display = 'flex';
        if (app)  app.style.display  = 'none';
      } catch(err){}
    }
  });
})();
<\/script>
`;

// ---------- admin stub: matches the live-app screenshot ----------
const adminStub = `
<script>
(function(){
  const ok = (data) => Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(data), text:()=>Promise.resolve(JSON.stringify(data)) });
  const stats = { totalUsers:12, onlineUsers:2, pendingUsers:3, totalMessages:284, totalCalls:39 };
  const pending = [
    { id:201, name:'HUSSIEN_test_3', email:'Hussien@cics.msumain.edu', role:'student', created_at:new Date('2026-04-16T15:28:08').toISOString() },
    { id:202, name:'HUSSIEN_test_4', email:'Hamdie@cics.msumain.edu',  role:'faculty', created_at:new Date('2026-04-16T15:29:06').toISOString() },
    { id:203, name:'Sahara Lominog', email:'Sahara@gmai.,/',            role:'student', created_at:new Date('2026-05-14T14:00:35').toISOString() }
  ];
  const ddays = (n) => new Date(Date.now() - n*86400e3).toISOString();
  const users = [
    { id:1,  name:'CICS Office',         email:'cics@msumain.edu.ph',         role:'admin',   account_status:'active', status:'approved', online:1, created_at:ddays(120) },
    { id:2,  name:'Hussien Diranggarun', email:'hdiranggarun@s.msumain.edu.ph', role:'student', account_status:'active', status:'approved', online:1, created_at:ddays(15)  },
    { id:3,  name:'Bash',                email:'bash@s.msumain.edu.ph',       role:'student', account_status:'active', status:'approved', online:1, created_at:ddays(20)  },
    { id:4,  name:'Aisha Mangondato',    email:'aisha@s.msumain.edu.ph',      role:'student', account_status:'active', status:'approved', online:0, created_at:ddays(45)  },
    { id:5,  name:'Juan dela Cruz',      email:'jdelacruz@s.msumain.edu.ph',  role:'student', account_status:'active', status:'approved', online:0, created_at:ddays(60)  },
    { id:6,  name:'Dr. Maria Santos',    email:'msantos@msumain.edu.ph',      role:'faculty', account_status:'active', status:'approved', online:0, created_at:ddays(95)  },
    { id:7,  name:'Prof. Ramon Lim',     email:'rlim@msumain.edu.ph',         role:'faculty', account_status:'active', status:'approved', online:0, created_at:ddays(40)  },
    { id:8,  name:'Dr. Anna Salim',      email:'asalim@msumain.edu.ph',       role:'faculty', account_status:'active', status:'approved', online:0, created_at:ddays(80)  },
    { id:9,  name:'Maria Lopez',         email:'mlopez@s.msumain.edu.ph',     role:'student', account_status:'active', status:'approved', online:0, created_at:ddays(10)  },
    { id:10, name:'Carlos Reyes',        email:'creyes@s.msumain.edu.ph',     role:'student', account_status:'active', status:'approved', online:0, created_at:ddays(8)   },
    { id:11, name:'Joseph Mangundayao',  email:'jmangu@s.msumain.edu.ph',     role:'student', account_status:'active', status:'approved', online:0, created_at:ddays(5)   },
    { id:12, name:'Demo Student',        email:'demo@s.msumain.edu.ph',       role:'student', account_status:'active', status:'approved', online:0, created_at:ddays(2)   }
  ];
  // Logs — renderer reads: user_name, action, details, created_at. Icons key off action.
  const logs = [
    { id:1, user_name:'CICS Office',         action:'APPROVE',      details:'Approved user "Aisha Mangondato"',   created_at:ddays(0) },
    { id:2, user_name:'Hussien Diranggarun', action:'LOGIN',        details:'Signed in',                            created_at:ddays(0) },
    { id:3, user_name:'CICS Office',         action:'REJECT',       details:'Rejected pending request from spammer@x.com', created_at:ddays(1) },
    { id:4, user_name:'CICS Office',         action:'ADD_USER',     details:'Pre-approved "Bash" (student)',       created_at:ddays(20) },
    { id:5, user_name:'CICS Office',         action:'EDIT_USER',    details:'Promoted Dr. Maria Santos to faculty',created_at:ddays(30) },
    { id:6, user_name:'CICS Office',         action:'BROADCAST',    details:'Sent announcement to Global Chat',    created_at:ddays(2) },
    { id:7, user_name:'CICS Office',         action:'APPROVE',      details:'Approved user "Juan dela Cruz"',      created_at:ddays(60) }
  ];
  // Messages — renderer reads: sender, type, text, created_at.
  const msgs = [
    { id:1, sender:'Juan dela Cruz',   type:'text',         text:'Pasahan na ng project bukas.',           created_at:ddays(0) },
    { id:2, sender:'CICS Office',      type:'announcement', text:'Reminder: Orientation Friday 9 AM at AVR.', created_at:ddays(0) },
    { id:3, sender:'Dr. Maria Santos', type:'text',         text:'Slides for Week 8 uploaded.',              created_at:ddays(1) },
    { id:4, sender:'Aisha Mangondato', type:'text',         text:'Got the notes, thanks!',                   created_at:ddays(1) },
    { id:5, sender:'Bash',             type:'voice',        text:'🎙️ Voice message (0:05)',                  created_at:ddays(1) },
    { id:6, sender:'Prof. Ramon Lim',  type:'text',         text:'Office hours moved to 2 PM.',              created_at:ddays(2) },
    { id:7, sender:'Hussien Diranggarun', type:'text',      text:'Same here po',                              created_at:ddays(2) }
  ];
  // Sparkline trends — renderer reads: data.labels[], data.range, and flat-number arrays per metric.
  const fmtLabel = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  const N = 10;
  const labels = Array.from({length:N}, (_,i) => fmtLabel(new Date(Date.now() - (N-1-i)*86400e3)));
  // Build a wiggly series that lands on the target value at the last bucket.
  const buildSeries = (end, swing) => {
    const arr = Array.from({length:N}, (_,i) => Math.max(0, Math.round(end - swing/2 + swing*Math.sin(i*0.85 + Math.random()) + (Math.random()-0.5)*swing*0.4)));
    arr[arr.length-1] = end;
    return arr;
  };
  const trends = {
    range:'day',
    labels,
    totalUsers:    buildSeries(12,  4),
    onlineUsers:   buildSeries(2,   4),
    pendingUsers:  buildSeries(3,   3),
    totalMessages: buildSeries(284, 60),
    totalCalls:    buildSeries(39,  16)
  };
  // Feedback — renderer reads: summary.avg_overall/avg_a..d/total, responses[].respondent_name/respondent_type/device/mean_a..d/overall/created_at/id
  const respondents = [
    { respondent_name:'Anonymous Student 1', respondent_type:'student', device:'Chrome · Windows', mean_a:4.7, mean_b:4.6, mean_c:4.5, mean_d:4.7, overall:4.63, comment:'Sobrang gamit ko siya araw-araw — clean UI!' },
    { respondent_name:'Prof. Ramon Lim',     respondent_type:'faculty', device:'Edge · Windows',   mean_a:4.3, mean_b:4.2, mean_c:4.0, mean_d:4.4, overall:4.23, comment:'Convenient for class announcements.' },
    { respondent_name:'Anonymous Student 2', respondent_type:'student', device:'Chrome · Android', mean_a:4.5, mean_b:4.4, mean_c:4.6, mean_d:4.5, overall:4.50, comment:'Faster than messenger for school stuff.' },
    { respondent_name:'Anonymous Student 3', respondent_type:'student', device:'Safari · iOS',     mean_a:4.6, mean_b:4.7, mean_c:4.5, mean_d:4.6, overall:4.60, comment:'Voice notes are very useful.' },
    { respondent_name:'Dr. Anna Salim',      respondent_type:'faculty', device:'Firefox · Windows',mean_a:4.2, mean_b:4.0, mean_c:4.1, mean_d:4.3, overall:4.15, comment:'Pending-approval queue is intuitive.' },
    { respondent_name:'Anonymous Student 4', respondent_type:'student', device:'Chrome · Android', mean_a:4.8, mean_b:4.9, mean_c:4.7, mean_d:4.8, overall:4.80, comment:'Notifications come in real-time, ang ganda!' },
    { respondent_name:'Anonymous Student 5', respondent_type:'student', device:'Chrome · Windows', mean_a:4.0, mean_b:3.9, mean_c:4.1, mean_d:4.0, overall:4.00, comment:'Great so far, dark mode would be nice.' },
    { respondent_name:'Dr. Maria Santos',    respondent_type:'faculty', device:'Chrome · Windows', mean_a:4.5, mean_b:4.6, mean_c:4.4, mean_d:4.5, overall:4.50, comment:'Group chat for sections is super helpful.' },
    { respondent_name:'Anonymous Student 6', respondent_type:'student', device:'Chrome · Android', mean_a:4.4, mean_b:4.5, mean_c:4.3, mean_d:4.5, overall:4.43, comment:'UI feels modern. Maganda yung design.' },
    { respondent_name:'Anonymous Student 7', respondent_type:'student', device:'Edge · Windows',   mean_a:4.6, mean_b:4.6, mean_c:4.5, mean_d:4.7, overall:4.60, comment:'Walang lag, gumagana lahat ng features.' }
  ].map((r,i) => ({ id:i+1, ...r, response_date:ddays(i), created_at:ddays(i) }));
  const avg = (arr, key) => arr.reduce((s,r) => s + r[key], 0) / arr.length;
  const survey = {
    summary: {
      avg_overall: Number(avg(respondents,'overall').toFixed(2)),
      avg_a:       Number(avg(respondents,'mean_a').toFixed(2)),
      avg_b:       Number(avg(respondents,'mean_b').toFixed(2)),
      avg_c:       Number(avg(respondents,'mean_c').toFixed(2)),
      avg_d:       Number(avg(respondents,'mean_d').toFixed(2)),
      total:       respondents.length
    },
    responses: respondents,
    count: respondents.length
  };
  // Per-response detail (viewFeedbackDetail) — adds scores breakdown
  const surveyById = (id) => {
    const r = respondents.find(x => x.id === Number(id));
    if (!r) return null;
    return { ...r, scores: {
      a:{ title:'System Usability', mean:r.mean_a, scores:[r.mean_a, r.mean_a-0.1, r.mean_a+0.1] },
      b:{ title:'Functionality',    mean:r.mean_b, scores:[r.mean_b, r.mean_b-0.1, r.mean_b+0.1] },
      c:{ title:'Performance',      mean:r.mean_c, scores:[r.mean_c, r.mean_c-0.2, r.mean_c+0.1] },
      d:{ title:'User Satisfaction',mean:r.mean_d, scores:[r.mean_d, r.mean_d,     r.mean_d-0.1] }
    }};
  };

  // Parse the body of a fetch so POST/PUT can mutate state realistically.
  const readBody = (opts) => {
    try { return opts && opts.body ? JSON.parse(opts.body) : {}; } catch { return {}; }
  };
  let nextUserId = 1000;
  let nextLogId  = 1000;

  const origFetch = window.fetch;
  window.fetch = function(url, opts){
    const u = String(url || '');
    const method = (opts && opts.method || 'GET').toUpperCase();
    try {
      if (u.startsWith('/api/admin/login'))           return ok({ success:true, token:'demo', name:'CICS Office', role:'admin' });
      if (u.startsWith('/api/admin/stats/trends'))    return ok(trends);
      if (u.startsWith('/api/admin/stats'))           return ok(stats);
      if (u.startsWith('/api/admin/pending'))         return ok(pending);

      // Approve pending user → move to users, update stats
      const approveMatch = u.match(/\\/api\\/admin\\/users\\/(\\d+)\\/approve/);
      if (approveMatch) {
        const id = Number(approveMatch[1]);
        const idx = pending.findIndex(p => p.id === id);
        if (idx !== -1) {
          const p = pending[idx];
          users.unshift({ id:p.id, name:p.name, email:p.email, role:p.role, account_status:'active', status:'approved', online:0, created_at:new Date().toISOString() });
          pending.splice(idx, 1);
          stats.pendingUsers = pending.length;
          stats.totalUsers   = users.length;
          logs.unshift({ id:++nextLogId, user_name:'CICS Office', action:'APPROVE', details:'Approved user "' + p.name + '"', created_at:new Date().toISOString() });
        }
        return ok({ success:true });
      }

      // Reject pending user → just remove from pending
      const rejectMatch = u.match(/\\/api\\/admin\\/users\\/(\\d+)\\/reject/);
      if (rejectMatch) {
        const id = Number(rejectMatch[1]);
        const idx = pending.findIndex(p => p.id === id);
        if (idx !== -1) {
          const p = pending[idx];
          pending.splice(idx, 1);
          stats.pendingUsers = pending.length;
          logs.unshift({ id:++nextLogId, user_name:'CICS Office', action:'REJECT', details:'Rejected pending request from ' + p.email, created_at:new Date().toISOString() });
        }
        return ok({ success:true });
      }

      // Edit user (PUT) or delete user (DELETE) by id
      const userIdMatch = u.match(/\\/api\\/admin\\/users\\/(\\d+)$/);
      if (userIdMatch) {
        const id = Number(userIdMatch[1]);
        const idx = users.findIndex(x => x.id === id);
        if (method === 'PUT' && idx !== -1) {
          const body = readBody(opts);
          users[idx] = { ...users[idx], name:body.name || users[idx].name, email:body.email || users[idx].email, role:body.role || users[idx].role };
          logs.unshift({ id:++nextLogId, user_name:'CICS Office', action:'EDIT_USER', details:'Edited user "' + users[idx].name + '"', created_at:new Date().toISOString() });
        } else if (method === 'DELETE' && idx !== -1) {
          const removed = users.splice(idx, 1)[0];
          stats.totalUsers = users.length;
          logs.unshift({ id:++nextLogId, user_name:'CICS Office', action:'DELETE_USER', details:'Deleted user "' + removed.name + '"', created_at:new Date().toISOString() });
        }
        return ok({ success:true });
      }

      // Add user (POST /api/admin/users) — add to approved list immediately
      if (u.startsWith('/api/admin/users') && method === 'POST') {
        const body = readBody(opts);
        const newUser = { id:++nextUserId, name:body.name, email:body.email, role:body.role || 'student', account_status:'active', status:'approved', online:0, created_at:new Date().toISOString() };
        users.unshift(newUser);
        stats.totalUsers = users.length;
        logs.unshift({ id:++nextLogId, user_name:'CICS Office', action:'ADD_USER', details:'Pre-approved "' + newUser.name + '" (' + newUser.role + ')', created_at:new Date().toISOString() });
        return ok({ success:true, user:newUser });
      }

      // List approved users
      if (u.startsWith('/api/admin/users'))           return ok(users);
      if (u.startsWith('/api/admin/logs'))            return ok(logs);
      if (u.startsWith('/api/admin/messages'))        return ok(msgs);
      if (u.startsWith('/api/admin/survey.csv')) {
        const csvHeader = 'id,respondent_name,respondent_type,device,mean_a,mean_b,mean_c,mean_d,overall,created_at\\n';
        const csvRows = respondents.map(r => [r.id, r.respondent_name, r.respondent_type, r.device, r.mean_a, r.mean_b, r.mean_c, r.mean_d, r.overall, r.created_at].join(',')).join('\\n');
        return ok(csvHeader + csvRows);
      }
      const surveyDetail = u.match(/\\/api\\/admin\\/survey\\/(\\d+)/);
      if (surveyDetail)                                return ok(surveyById(surveyDetail[1]) || {});
      if (u.startsWith('/api/admin/survey'))          return ok(survey);
      if (u.startsWith('/api/'))                       return ok({ success:true });
    } catch(e){ console.warn('admin stub error:', e); }
    return origFetch.apply(this, arguments);
  };
  window.WebSocket = function(){ return { send(){}, close(){}, addEventListener(){}, removeEventListener(){}, readyState:1 }; };
  window.io = function(){ return { on(){return this}, off(){return this}, emit(){return this} }; };

  // Auto-login when wrapper sends "goto:admin"
  window.addEventListener('message', (e) => {
    if (e.data === 'goto:admin') {
      try {
        const emailEl = document.getElementById('login-email');
        const passEl  = document.getElementById('login-password');
        if (emailEl) emailEl.value = 'admin@cics.msu.edu';
        if (passEl)  passEl.value  = 'demo';
        if (typeof login === 'function') login();
        else {
          const btn = Array.from(document.querySelectorAll('button')).find(b => /sign in|log in|login/i.test(b.textContent||''));
          if (btn) btn.click();
        }
      } catch(err){}
    }
  });
})();
<\/script>
`;

// ---------- feedback stub: just confirms submission, blocks the live POST ----------
const feedbackStub = `
<script>
(function(){
  const ok = (data) => Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(data), text:()=>Promise.resolve(JSON.stringify(data)) });
  const origFetch = window.fetch;
  window.fetch = function(url, opts){
    const u = String(url || '');
    try { if (u.startsWith('/api/')) return ok({ success:true, id: Math.floor(Math.random()*9000)+1000 }); } catch(e){}
    return origFetch.apply(this, arguments);
  };
  // Intercept the "Back to Chat" link so it routes through the prototype wrapper
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href="/"], a[href="./"], a[href="/admin.html"]').forEach(a => {
      const target = a.getAttribute('href') === '/admin.html' ? 'admin' : 'chat';
      a.addEventListener('click', e => {
        e.preventDefault();
        try { parent.postMessage('switch:' + target, '*'); } catch(err){}
      });
    });
  });
})();
<\/script>
`;

// ---------- build each iframe payload ----------
function buildChatHtml() {
  console.log('Building CHAT (index.html)…');
  let h = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  h = replaceFontLink(h);
  h = inlineAssets(h);
  // Remove the real socket.io client script (we mock window.io ourselves)
  h = h.replace(/<script src="\/socket\.io\/socket\.io\.js"><\/script>/, '');
  h = h.replace('</head>', chatStub + '</head>');
  return h;
}

function buildAdminHtml() {
  console.log('Building ADMIN (admin.html)…');
  let h = fs.readFileSync(path.join(PUB, 'admin.html'), 'utf8');
  h = replaceFontLink(h);
  h = inlineAssets(h);
  h = h.replace('</head>', adminStub + '</head>');
  return h;
}

function buildFeedbackHtml() {
  console.log('Building FEEDBACK (feedback.html)…');
  let h = fs.readFileSync(path.join(PUB, 'feedback.html'), 'utf8');
  h = replaceFontLink(h);
  h = inlineAssets(h);
  h = h.replace('</head>', feedbackStub + '</head>');
  return h;
}

const chatHtml     = buildChatHtml();
const adminHtml    = buildAdminHtml();
const feedbackHtml = buildFeedbackHtml();

// srcdoc needs the inner HTML's double-quotes escaped
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// ---------- wrapper ----------
const wrapper = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>MSUkaIP — UI/UX Prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;background:#1a0a0a;font-family:'Nunito',sans-serif;color:#fff;overflow:hidden;}
  #demo-nav{position:fixed;top:0;left:0;right:0;height:54px;display:flex;align-items:center;gap:10px;padding:0 18px;background:linear-gradient(90deg,#4a0000,#6B0000,#4a0000);box-shadow:0 4px 16px rgba(0,0,0,.45);z-index:10;border-bottom:2px solid #D4A017;}
  #demo-nav .brand{font-family:'Cinzel',serif;font-weight:700;color:#FFD700;letter-spacing:.12em;font-size:.95rem;margin-right:14px;}
  #demo-nav .brand small{display:block;font-family:'Nunito',sans-serif;font-size:.62rem;font-weight:600;color:rgba(255,255,255,.7);letter-spacing:.14em;text-transform:uppercase;}
  #demo-nav button{appearance:none;border:1.5px solid rgba(255,215,0,.4);background:rgba(0,0,0,.25);color:#fff;font-family:'Nunito',sans-serif;font-size:.85rem;font-weight:700;padding:8px 16px;border-radius:8px;cursor:pointer;letter-spacing:.04em;transition:all .15s;}
  #demo-nav button:hover{background:rgba(255,215,0,.15);border-color:#FFD700;}
  #demo-nav button.active{background:#FFD700;color:#4a0000;border-color:#FFD700;font-weight:800;}
  #demo-nav .spacer{flex:1;}
  #demo-nav .badge{font-size:.62rem;font-weight:700;letter-spacing:.14em;color:#FFD700;background:rgba(0,0,0,.3);padding:5px 10px;border-radius:6px;border:1px solid rgba(255,215,0,.3);text-transform:uppercase;}
  .frame-stage{position:fixed;top:54px;left:0;right:0;bottom:0;background:#000;}
  .frame-stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:none;background:transparent;}
  .frame-stage iframe.active{display:block;}
</style>
</head>
<body>
<nav id="demo-nav">
  <span class="brand">MSUkaIP<small>Prototype Demo</small></span>
  <button data-view="login" class="active">1. Login Screen</button>
  <button data-view="chat">2. Chat Screen</button>
  <button data-view="feedback">3. Feedback Form</button>
  <button data-view="admin">4. Admin Dashboard</button>
  <span class="spacer"></span>
  <span class="badge">UI / UX Prototype</span>
</nav>
<div class="frame-stage">
  <iframe id="frame-chat"     class="active" srcdoc="${esc(chatHtml)}"></iframe>
  <iframe id="frame-feedback"               srcdoc="${esc(feedbackHtml)}"></iframe>
  <iframe id="frame-admin"                  srcdoc="${esc(adminHtml)}"></iframe>
</div>
<script>
  const frames = {
    chat:     document.getElementById('frame-chat'),
    feedback: document.getElementById('frame-feedback'),
    admin:    document.getElementById('frame-admin')
  };
  const buttons = document.querySelectorAll('#demo-nav button[data-view]');
  let currentView = 'login';

  function send(frame, msg){
    try { frame.contentWindow.postMessage(msg, '*'); } catch(e){}
  }
  function show(view){
    currentView = view;
    buttons.forEach(b => b.classList.toggle('active', b.dataset.view === view));
    // Login + Chat live in the same iframe (#frame-chat) — switch frames per view.
    Object.values(frames).forEach(f => f.classList.remove('active'));
    if (view === 'admin')         { frames.admin.classList.add('active');    send(frames.admin,    'goto:admin'); }
    else if (view === 'feedback') { frames.feedback.classList.add('active'); send(frames.feedback, 'goto:feedback'); }
    else                          { frames.chat.classList.add('active');     send(frames.chat,     view === 'chat' ? 'goto:chat' : 'goto:login'); }
  }
  buttons.forEach(b => b.addEventListener('click', () => show(b.dataset.view)));

  // Re-send the goto message once each iframe finishes loading so the very first click sticks.
  frames.chat.addEventListener('load',     () => { if (currentView === 'login' || currentView === 'chat') send(frames.chat, currentView === 'chat' ? 'goto:chat' : 'goto:login'); });
  frames.admin.addEventListener('load',    () => { if (currentView === 'admin')    send(frames.admin, 'goto:admin'); });
  frames.feedback.addEventListener('load', () => { if (currentView === 'feedback') send(frames.feedback, 'goto:feedback'); });

  // Iframes ask the wrapper to switch views (e.g., chat → Feedback rail button)
  window.addEventListener('message', (e) => {
    const d = String(e.data || '');
    if (d.startsWith('switch:')) show(d.slice(7));
  });
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, wrapper);
const size = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log('\nWrote ' + OUT + ' (' + size + ' MB)');
