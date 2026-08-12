// ── Generate the home-screen / PWA icons from the MSUkaIP logo ──────────────
//
// Installed to a phone home screen, the app was showing a blank grey tile: the
// page declared no manifest and no apple-touch-icon, so Android fell back to a
// generic placeholder.
//
// The logo is a dark maroon-and-gold wordmark on transparency, so it cannot be
// used directly — on a dark launcher it would be invisible. These icons paint it
// on the cream paper colour, which is also what the rail disc does and for the
// same reason.
//
//   node scripts/make-icons.js
//
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUB = path.join(__dirname, '..', 'public');
const CREAM = '#FDF8F0';

// 192 and 512 are the two Android asks for; 180 is the iOS apple-touch-icon.
// `maskable` gets extra padding because Android crops it to whatever shape the
// launcher uses, and a mark that reaches the edge loses its corners.
const SIZES = [
  { file: 'icon-192.png',          size: 192, pad: 0.14 },
  { file: 'icon-512.png',          size: 512, pad: 0.14 },
  { file: 'icon-180.png',          size: 180, pad: 0.12 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.24 },
];

(async () => {
  // Inlined as a data URI: a page built with setContent has no origin, so it
  // cannot fetch a file:// path.
  const dataUri = 'data:image/png;base64,' +
    fs.readFileSync(path.join(PUB, 'msukaip-logo.png')).toString('base64');

  const browser = await chromium.launch();
  for (const { file, size, pad } of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inset = Math.round(size * pad);
    await page.setContent(`<body style="margin:0">
      <div style="width:${size}px;height:${size}px;background:${CREAM};
                  display:flex;align-items:center;justify-content:center;">
        <img src="${dataUri}" style="width:${size - inset * 2}px;height:${size - inset * 2}px;object-fit:contain">
      </div></body>`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(PUB, file) });
    await page.close();
    console.log('  ' + file.padEnd(24) + size + 'x' + size);
  }
  await browser.close();
})();
