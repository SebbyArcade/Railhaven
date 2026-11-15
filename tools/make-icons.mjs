// Draw the app icons (home screen and install) into public/. Usage: node tools/make-icons.mjs
import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage();
for (const [name, size, safe] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) {
  const url = await page.evaluate(([size, safe]) => {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), s = size / 100;
    if (safe) { x.fillStyle = '#2a1f14'; x.fillRect(0, 0, size, size); }
    else { x.fillStyle = '#2a1f14'; x.beginPath(); x.roundRect(2 * s, 2 * s, 96 * s, 96 * s, 22 * s); x.fill(); x.strokeStyle = '#c99a5b'; x.lineWidth = 3 * s; x.stroke(); }
    const k = safe ? 0.78 : 1, o = 50 * s * (1 - k);
    x.save(); x.translate(o, o); x.scale(k, k);
    // rails
    x.fillStyle = '#6b5132'; for (let i = 0; i < 9; i++) x.fillRect((8 + i * 10) * s, 74 * s, 5 * s, 10 * s);
    x.fillStyle = '#d8d0c0'; x.fillRect(6 * s, 76 * s, 88 * s, 2.2 * s); x.fillRect(6 * s, 81 * s, 88 * s, 2.2 * s);
    // the engine
    x.font = `${58 * s}px "Noto Color Emoji", "Apple Color Emoji", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🚂', 50 * s, 46 * s);
    x.restore();
    return c.toDataURL('image/png');
  }, [size, safe]);
  writeFileSync('public/' + name, Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
