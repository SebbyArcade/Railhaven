// Panning speed check: draw time per frame while the map pans back and forth, at each zoom. Usage:
//   npx vite build --minify false --outDir /tmp/rh && node tools/pan-speed-check.mjs /tmp/rh/index.html save.json 0.2,0.6,1.8 [profile.cpuprofile]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [html, save, zs = '0.25', out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 860, height: 950 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(save, 'utf8'));
await page.goto('file://' + resolve(html));
await page.waitForTimeout(1500);
const cdp = await page.context().newCDPSession(page);
for (const z of zs.split(',').map(Number)) {
  await page.evaluate(z => { const r = window.railhaven; r.openCard(null); const c = r.game.s.camera; c.z = z; const n = r.game.world.n; window.__h = { x: n * 16, y: n * 16 };
    if (!window.__wrapped) { window.__wrapped = 1; const R = r.renderer, d = R.draw.bind(R); window.__dt = []; R.draw = (...a) => { const t = performance.now(); d(...a); window.__dt.push(performance.now() - t); }; } }, z);
  await page.waitForTimeout(500);
  if (out) await cdp.send('Profiler.enable'), await cdp.send('Profiler.setSamplingInterval', { interval: 200 }), await cdp.send('Profiler.start');
  await page.evaluate(() => { window.__dt = []; window.__pan = true; const f = () => { if (!window.__pan) return; const c = window.railhaven.game.s.camera, t = performance.now(); c.x = window.__h.x + 600 * Math.sin(t / 700); c.y = window.__h.y + 400 * Math.cos(t / 900); requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await page.waitForTimeout(4000);
  const dt = await page.evaluate(() => { window.__pan = false; return window.__dt; });
  if (out) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(out.replace('.cpuprofile', `-${z}.cpuprofile`), JSON.stringify(profile)); }
  dt.sort((a, b) => a - b);
  console.log(`zoom ${z}: frames ${dt.length}, draw median ${dt[dt.length >> 1].toFixed(1)} ms, p90 ${dt[Math.floor(dt.length * 0.9)].toFixed(1)} ms, max ${dt.at(-1).toFixed(1)} ms`);
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
