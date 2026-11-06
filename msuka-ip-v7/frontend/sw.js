// ── MSUkaIP service worker: offline app shell ────────────────────────────────
// Keeps a copy of the pages, fonts and pictures so the chat screen still opens
// when the Wi-Fi blips. It never stores messages, files or anything from the
// API — only the public "shell" that every visitor downloads anyway.
//
// Bump CACHE_VERSION whenever a file in SHELL changes: the new worker then
// downloads a fresh copy and the 'activate' step deletes the old cache.
const CACHE_VERSION = 'msukaip-shell-v1';

// Exactly the static files index.html and landing.html load. Nothing else is
// ever served from the cache (see the fetch handler).
const SHELL = [
  '/', '/index.html', '/landing.html', '/manifest.webmanifest',
  '/socket.io/socket.io.js',                 // the Socket.IO client script only
  '/fonts/google-fonts.css',
  '/fonts/8vIJ7ww63mVu7gt7-GT7LEc.woff2', '/fonts/8vIJ7ww63mVu7gt79mT7.woff2',
  '/fonts/XRXV3I6Li01BKofIMeaBXso.woff2', '/fonts/XRXV3I6Li01BKofINeaB.woff2',
  '/fonts/XRXV3I6Li01BKofIO-aBXso.woff2', '/fonts/XRXV3I6Li01BKofIOOaBXso.woff2',
  '/fonts/XRXV3I6Li01BKofIOuaBXso.woff2',
  '/vendor/qrcode-generator.js',
  '/tab-icon-64.png', '/tab-icon-192.png', '/icon-180.png', '/icon-192.png', '/icon-512.png',
  '/msukaip-logo-on-light.webp', '/msukaip-logo-on-maroon.webp', '/msukaip-sticker-on-maroon.webp',
  '/msukaip-torch-on-maroon.webp', '/msu-seal.png', '/msu-seal-lines-340.png', '/cics-mark.webp',
  '/hero-emblem.webp', '/nav-okir.png', '/login-okir.png', '/header-pattern.png', '/list-header-pattern.png',
];
// The two pages fetched network-first. admin.html and feedback.html are left
// out on purpose: the admin dashboard must always show live data, and the
// survey has to be submitted online, so an old offline copy would only mislead.
const PAGES = ['/', '/index.html', '/landing.html'];

// Install: download the whole shell into a new versioned cache.
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();                        // take over without waiting for old tabs to close
});

// Activate: delete caches from older versions so stale files don't pile up.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // Not handled here (the browser goes straight to the network as normal):
  //  - non-GET requests: logins, uploads, survey posts must reach the server;
  //  - other origins;
  //  - /api/* and /uploads/*: private, logged-in data (RA 10173) — caching it
  //    would leave readable copies on the device after logout;
  //  - Socket.IO traffic other than the client script: live polling and
  //    websocket frames, meaningless once replayed from a cache;
  //  - anything not in SHELL, including admin.html and feedback.html.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // socket.io.js is network-first too: after an `npm update` of socket.io the
  // client must match the server, so a stale cached copy must never win.
  if ((PAGES.includes(url.pathname) && req.mode === 'navigate') || url.pathname === '/socket.io/socket.io.js') {
    event.respondWith(networkFirst(req, url.pathname));
  } else if (SHELL.includes(url.pathname) && !url.search) {
    event.respondWith(cacheFirst(req));
  }
});

// Pages: try the server first so updates show at once; keep the fresh copy;
// fall back to the saved copy only when the network fails.
async function networkFirst(req, path) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(path, res.clone());
    return res;
  } catch {
    return (await cache.match(path)) || Response.error();
  }
}

// Fonts, pictures, scripts: they only change with a new CACHE_VERSION, so the
// saved copy is used first and the network only when it is missing.
async function cacheFirst(req) {
  const cached = await caches.match(req);
  return cached || fetch(req);
}
