// ── Generate the tab / home-screen / PWA icons from the MSUkaIP mark ────────
//
// Installed to a phone home screen, the app was showing a blank grey tile: the
// page declared no manifest and no apple-touch-icon, so Android fell back to a
// generic placeholder.
//
// Source is msukaip-mark.svg: the lamp-in-speech-bubble cut from the MSUkaIP
// logo, with its own cream sticker outline, so it reads on light and dark tabs
// alike and needs no background. Two icons still get one, because their
// platforms require an opaque square: iOS paints a transparent apple-touch-icon
// black, and Android's maskable icon is cropped to the launcher's shape. Those
// use the cream paper colour, never the maroon.
//
//   node scripts/make-icons.js
//
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUB = path.join(__dirname, '..', 'frontend');
const CREAM = '#FDF8F0';

// 192 and 512 are the two Android asks for; 180 is the iOS apple-touch-icon.
// `maskable` gets extra padding because Android crops it to whatever shape the
// launcher uses, and a mark that reaches the edge loses its corners.
const SIZES = [
  { file: 'icon-192.png',          size: 192, pad: 0.04, bg: 'transparent' },
  { file: 'icon-512.png',          size: 512, pad: 0.04, bg: 'transparent' },
  { file: 'icon-180.png',          size: 180, pad: 0.10, bg: CREAM },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.20, bg: CREAM },
];

(async () => {
  // Inlined as a data URI: a page built with setContent has no origin, so it
  // cannot fetch a file:// path.
  const dataUri = 'data:image/svg+xml;base64,' +
    fs.readFileSync(path.join(PUB, 'msukaip-mark.svg')).toString('base64');

  const browser = await chromium.launch();
  for (const { file, size, pad, bg } of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inset = Math.round(size * pad);
    await page.setContent(`<body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px;background:${bg};
                  display:flex;align-items:center;justify-content:center;">
        <img src="${dataUri}" style="width:${size - inset * 2}px;height:${size - inset * 2}px;object-fit:contain">
      </div></body>`);
    await page.waitForTimeout(250);
    // omitBackground keeps the page's default white out of the transparent icons.
    await page.screenshot({ path: path.join(PUB, file), omitBackground: bg === 'transparent' });
    await page.close();
    console.log('  ' + file.padEnd(24) + size + 'x' + size + '  ' + bg);
  }
  await browser.close();
})();
