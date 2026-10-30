// ── Build a static copy of the landing page for Vercel / Netlify ─────────────
//
// Vercel and Netlify only host static files, so they cannot run server.js
// (Socket.IO, SQLite, uploads). This copies just landing.html and the files it
// uses into site/, with landing.html renamed to index.html so it is the home
// page. The app buttons (Connect Now, admin, feedback) point at the real
// running server, passed in as APP_URL — e.g. the Cloudflare tunnel address.
//
//   node scripts/build-landing-site.js https://something.trycloudflare.com
//
// Without APP_URL the buttons keep their /index.html links, which only work
// when the page is served by server.js itself.
const fs = require('fs');
const path = require('path');

const appUrl = (process.argv[2] || '').replace(/\/+$/, '');
const src = path.join(__dirname, '..', 'frontend');
const out = path.join(__dirname, '..', 'site');

// Every file landing.html (and its manifest/font CSS) refers to.
const assets = ['manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'icon-maskable-512.png', 'msukaip-logo.png', 'msu-seal.png', 'cics-mark.webp',
  'nav-okir.png', 'hero-emblem.webp', 'fonts'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const a of assets) fs.cpSync(path.join(src, a), path.join(out, a), { recursive: true });

let html = fs.readFileSync(path.join(src, 'landing.html'), 'utf8');
if (appUrl) html = html.replace(/href="\/(index|admin|feedback)\.html"/g, `href="${appUrl}/$1.html"`);
fs.writeFileSync(path.join(out, 'index.html'), html);

console.log(`✅  site/ built${appUrl ? ` — app links point to ${appUrl}` : ' (no APP_URL: app links stay relative)'}`);
