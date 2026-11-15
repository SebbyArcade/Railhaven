// Sound controls check: the 🔊 button on the map, the volume bars in Settings, and one-off sounds when you build.
// Usage: node tools/volume-shot.mjs [outdir]   (after npm run build)
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const out = process.argv[2] ?? 'shots';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(() => {
  window.__snd = { osc: 0, noise: 0 };
  const P = AudioContext.prototype, o = P.createOscillator, b = P.createBufferSource;
  P.createOscillator = function () { window.__snd.osc++; return o.call(this); };
  P.createBufferSource = function () { window.__snd.noise++; return b.call(this); };
});
await page.goto('file://' + resolve('dist/index.html') + '?new');
await page.waitForTimeout(1200);
await page.evaluate(() => window.railhaven.openCard(null));
await page.mouse.click(200, 400); // first tap unlocks sound
await page.waitForTimeout(500);
const snd = () => page.evaluate(() => ({ ...window.__snd }));
// building a camp next to Ashford makes a one-off sound
const a = await snd();
await page.evaluate(() => { const r = window.railhaven, g = r.game, t = g.s.sites[0]; g.s.money += 1e5; r.game.s.orders = (g.s.orders ?? 0) + 1; g.s.camera.x = (t.x + 0.5) * 32; g.s.camera.y = (t.y + 0.5) * 32; g.s.camera.z = 1.8; });
await page.waitForTimeout(400);
const b = await snd();
console.log('order filled:', `oscillators +${b.osc - a.osc}`);
await page.screenshot({ path: `${out}/sound-map.png` });
// quick mute: nothing new is made
await page.click('#mute'); await page.waitForTimeout(800);
const c = await snd(); await page.waitForTimeout(3000); const d = await snd();
console.log('muted 3 s:', `oscillators +${d.osc - c.osc}, noise +${d.noise - c.noise}`, await page.evaluate(() => window.railhaven.sound.settings.muted));
await page.screenshot({ path: `${out}/sound-muted.png` });
await page.click('#mute'); await page.waitForTimeout(3000); const e = await snd();
console.log('unmuted 3 s:', `oscillators +${e.osc - d.osc}, noise +${e.noise - d.noise}`);
// Settings page with the volume bars
await page.evaluate(() => window.railhaven.openCard({ kind: 'game', id: 0, page: 'settings' }));
await page.waitForTimeout(400);
await page.click('[data-act="vol"][data-k="musicVol"][data-v="5"]');
await page.click('[data-act="vol"][data-k="sfxVol"][data-v="2"]');
await page.waitForTimeout(300);
console.log('settings:', JSON.stringify(await page.evaluate(() => window.railhaven.sound.settings)));
await page.screenshot({ path: `${out}/sound-settings.png` });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
