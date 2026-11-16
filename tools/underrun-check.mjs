// Sound underrun check: plays a save close up with the phone-like CPU slowed down, and counts how often the sound card
// ran dry (Chrome's playbackStats) while idle, while rails are rebuilt (as when building or removing track), and while panning.
// Usage: npm run build && node tools/underrun-check.mjs save.json [cpu slowdown, default 6]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, slow = 6] = [process.argv[2], +(process.argv[3] ?? 6)];
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('railhaven2', s), readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1200);
await page.evaluate(() => window.railhaven.openCard(null));
await page.mouse.click(200, 400); // first tap unlocks sound
await page.evaluate(() => { // the camera over the spot where the most things make a sound
  const r = window.railhaven, g = r.game, c = g.s.camera; c.z = 1.8; let best = null, bn = -1;
  for (const t of g.s.trains) { const p = r.trainAt(t.id); if (!p) continue; c.x = p.x; c.y = p.y; const k = r.hear().sources.length; if (k > bn) { bn = k; best = p; } }
  if (best) { c.x = best.x; c.y = best.y; }
});
const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });
await page.waitForTimeout(1500);
console.log('sound buffer', await page.evaluate(() => window.railhaven.sound.ac?.baseLatency.toFixed(3)), 's');
const stats = () => page.evaluate(() => { const s = window.railhaven.sound.ac?.playbackStats; return s ? { ev: s.underrunEvents, ms: Math.round(s.underrunDuration * 1000) } : null; });
const run = async (label, ms, act) => {
  const a = await stats(), t0 = Date.now(); let longest = 0;
  while (Date.now() - t0 < ms) { const t1 = Date.now(); if (act) await page.evaluate(act); longest = Math.max(longest, Date.now() - t1); await page.waitForTimeout(250); }
  const b = await stats();
  console.log(label.padEnd(22), b && a ? `sound ran dry ${b.ev - a.ev} times (${b.ms - a.ms} ms)` : 'no playbackStats', act ? `· longest step ${longest} ms` : '');
};
await run('idle', 5000);
await run('rails rebuilt', 5000, () => { const r = window.railhaven, k = [...r.game.track.keys()].pop(); r.trackChanged([k]); });
await run('idle again', 5000);
console.log(errors.join('\n') || 'no page errors');
await browser.close();
