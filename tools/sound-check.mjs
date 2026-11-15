// Sound check on a save: counts the sound events made close up, zoomed out, and with music and sounds turned off.
// Usage: node tools/sound-check.mjs [save]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2] ?? 'shots/s14.json';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => {
  localStorage.setItem('railhaven2', s);
  window.__snd = { osc: 0, noise: 0 };
  const P = AudioContext.prototype, o = P.createOscillator, b = P.createBufferSource;
  P.createOscillator = function () { window.__snd.osc++; return o.call(this); };
  P.createBufferSource = function () { window.__snd.noise++; return b.call(this); };
}, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1000);
await page.evaluate(() => window.railhaven.openCard(null));
await page.mouse.click(200, 400); // first tap unlocks sound
const count = async (label, ms, setup) => {
  await page.evaluate(setup ?? (() => {}));
  await page.waitForTimeout(300);
  const a = await page.evaluate(() => ({ ...window.__snd }));
  await page.waitForTimeout(ms);
  const b = await page.evaluate(() => ({ ...window.__snd, state: window.railhaven.sound.ac?.state, src: window.railhaven.hear().sources.map(h => h.kind + (h.moving ? '>' : '')).join(' ') }));
  console.log(label.padEnd(26), `oscillators +${b.osc - a.osc}, noise +${b.noise - a.noise}, sources ${b.src}, ${b.state}`);
};
// close up over the busiest place: the building with the most trains near it
await count('close up (z 1.8)', 6000, () => {
  // the spot where the most things make a sound: try each train and keep the best
  const r = window.railhaven, g = r.game, c = g.s.camera; c.z = 1.8; let best = null, bn = -1;
  for (const t of g.s.trains) { if (!t.at) continue; c.x = t.at.x; c.y = t.at.y; const k = r.hear().sources.filter(h => h.vol > 0.2).reduce((a, h) => a + (h.moving ? 3 : 1), 0); if (k > bn) { bn = k; best = t.at; } }
  c.x = best.x; c.y = best.y;
});
await count('zoomed out (z 0.4)', 6000, () => { window.railhaven.game.s.camera.z = 0.4; });
await count('sounds off, close up', 6000, () => { window.railhaven.sound.set('sfx', false); window.railhaven.game.s.camera.z = 1.8; });
await count('music off too', 6000, () => { window.railhaven.sound.set('music', false); });
await page.evaluate(() => { window.railhaven.sound.set('music', true); window.railhaven.sound.set('sfx', true); });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
