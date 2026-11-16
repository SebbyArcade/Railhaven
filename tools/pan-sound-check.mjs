// Panning sound check: counts the effect sounds started while the map is panned quickly, then while it is still.
// Usage: npm run build && node tools/pan-sound-check.mjs [save]   (no save: a new game with a lumber camp)
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2];
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.text().startsWith('busiest') && console.log(m.text()));
await page.addInitScript(s => {
  if (s) localStorage.setItem('railhaven2', s);
  window.__snd = 0;
  const P = AudioContext.prototype, o = P.createOscillator, b = P.createBufferSource;
  P.createOscillator = function () { window.__snd++; return o.call(this); };
  P.createBufferSource = function () { window.__snd++; return b.call(this); };
}, file ? readFileSync(file, 'utf8') : '');
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1000);
await page.evaluate(() => window.railhaven.openCard(null));
await page.mouse.click(200, 400); // first tap unlocks sound
await page.evaluate(() => { // music off; the camera over the spot where the most things make a sound
  const r = window.railhaven, g = r.game, c = g.s.camera; r.sound.set('music', false); c.z = 1.8; let best = null, bn = -1;
  for (const t of g.s.trains) { const p = r.trainAt(t.id); if (!p) continue; c.x = p.x; c.y = p.y; const k = r.hear().sources.length; if (k > bn) { bn = k; best = p; } }
  if (best) { c.x = best.x; c.y = best.y; } window.__home = { x: c.x }; console.log('busiest spot: ' + bn + ' things in hearing');
});
const count = async (label, ms, move) => {
  const a = await page.evaluate(() => window.__snd), t0 = Date.now();
  while (Date.now() - t0 < ms) { if (move) await page.evaluate(() => { window.railhaven.game.s.camera.x = window.__home.x + 300 * Math.sin(performance.now() / 400); }); /* a finger swiping back and forth */ await page.waitForTimeout(16); }
  const b = await page.evaluate(() => ({ n: window.__snd, heard: window.railhaven.hear().sources.length }));
  console.log(label.padEnd(16), `sounds started ${b.n - a}, things in hearing ${b.heard}`);
};
await count('panning fast', 4000, true);
await page.evaluate(() => { window.railhaven.game.s.camera.x = window.__home.x; });
await count('still', 4000, false);
console.log(errors.join('\n') || 'no page errors');
await browser.close();
