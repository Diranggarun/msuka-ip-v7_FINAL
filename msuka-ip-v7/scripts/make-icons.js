// ── Generate every logo image and icon from the MSUkaIP torch logo set ──────
//
// Sources live in scripts/logo-src/ (not served): the torch + wordmark, the
// torch mark and the stacked sticker logo, each in an "on maroon" and an
// "on light" colourway, plus the two
// app icons (maroon for students, gold for the admin portal). The logo SVGs had
// their background removed and were cropped so the soft glow is never cut off
// and the artwork sits centred in its box.
//
// The pages use WebP copies, not the SVGs: the woven patterns make each SVG
// about 700 KB, while a sharp WebP is a small fraction of that, which matters
// for phones. Widths are about 3x the largest size each logo is shown at.
//
// Two icons need an opaque square: iOS paints a transparent apple-touch-icon
// black, and Android crops the maskable icon to the launcher's shape (so it
// gets padding to keep the torch inside the safe zone).
//
//   node scripts/make-icons.js
//
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
/* global Image, document -- used only inside page.evaluate(), which runs in the browser */

const SRC = path.join(__dirname, 'logo-src');
const PUB = path.join(__dirname, '..', 'frontend');
const MAROON = '#721922';
const GOLD = '#E8A030';

// Logos shown in the pages, as WebP. Height follows from each SVG's shape.
const LOGOS = [
  { src: 'msukaip-logo-on-maroon.svg',  file: 'msukaip-logo-on-maroon.webp',  width: 1200 },
  { src: 'msukaip-logo-on-light.svg',   file: 'msukaip-logo-on-light.webp',   width: 1200 },
  { src: 'msukaip-torch-on-maroon.svg', file: 'msukaip-torch-on-maroon.webp', width: 240 },
  { src: 'msukaip-sticker-on-maroon.svg', file: 'msukaip-sticker-on-maroon.webp', width: 600 },
  { src: 'msukaip-sticker-on-light.svg',  file: 'msukaip-sticker-on-light.webp',  width: 600 },
];

// Square icons, as PNG. `pad` is the empty margin on each side, as a fraction.
const ICONS = [
  { src: 'app-icon-gold.svg',          file: 'tab-icon-64.png',       size: 64,  pad: 0,    bg: 'transparent' },
  { src: 'app-icon-maroon.svg',        file: 'icon-192.png',          size: 192, pad: 0,    bg: 'transparent' },
  { src: 'app-icon-maroon.svg',        file: 'icon-512.png',          size: 512, pad: 0,    bg: 'transparent' },
  { src: 'app-icon-maroon.svg',        file: 'icon-180.png',          size: 180, pad: 0,    bg: MAROON },
  { src: 'app-icon-maroon.svg',        file: 'icon-maskable-512.png', size: 512, pad: 0.10, bg: MAROON },
  { src: 'app-icon-gold.svg',          file: 'tab-icon-192.png',      size: 192, pad: 0,    bg: 'transparent' },
  { src: 'app-icon-gold.svg',          file: 'admin-icon-180.png',    size: 180, pad: 0,    bg: GOLD },
];

// Inlined as a data URI: a page built with setContent has no origin, so it
// cannot fetch a file:// path.
const dataUri = (file) =>
  'data:image/svg+xml;base64,' + fs.readFileSync(path.join(SRC, file)).toString('base64');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const { src, file, width } of LOGOS) {
    // Draw onto a canvas and export WebP there: Playwright screenshots are PNG/JPEG only.
    const base64 = await page.evaluate(async ({ uri, width }) => {
      const img = new Image(); img.src = uri; await img.decode();
      const c = document.createElement('canvas');
      c.width = width; c.height = Math.round(width * img.naturalHeight / img.naturalWidth);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.9).split(',')[1];
    }, { uri: dataUri(src), width });
    fs.writeFileSync(path.join(PUB, file), Buffer.from(base64, 'base64'));
    console.log('  ' + file.padEnd(30) + Math.round(base64.length * 0.75 / 1024) + ' KB');
  }

  for (const { src, file, size, pad, bg } of ICONS) {
    const inner = size - Math.round(size * pad) * 2;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px;background:${bg};
                  display:flex;align-items:center;justify-content:center;">
        <img src="${dataUri(src)}" style="width:${inner}px;height:${inner}px;object-fit:contain">
      </div></body>`);
    await page.waitForTimeout(250);
    // omitBackground keeps the page's default white out of the transparent icons.
    await page.screenshot({ path: path.join(PUB, file), omitBackground: bg === 'transparent' });
    console.log('  ' + file.padEnd(30) + size + 'x' + size + '  ' + bg);
  }
  await browser.close();
})();
