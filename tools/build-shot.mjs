// Build one of each home industry near Ashford through the real tools, link one, and screenshot. Usage: node tools/build-shot.mjs [seed]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + (process.argv[2] || 4242));
await page.waitForTimeout(300);
const res = await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0];
  g.s.money = 1e6;
  const out = [];
  for (const k of ['wood', 'farm', 'stone', 'coal', 'wool']) {
    T.chooseBuild(k); T.updateGlow(a.x, a.y);
    const spots = [...T.glow].sort((p, q) => Math.hypot(p % n - a.x, (p / n | 0) - a.y) - Math.hypot(q % n - a.x, (q / n | 0) - a.y));
    if (!spots.length) { out.push(k + ': no spot'); continue; }
    T.tapSquare(spots[0]); const bar = T.bar(); T.confirm(); out.push(k + ': ' + (bar && bar.text));
  }
  T.mode = 'pan'; T.buildKind = null;
  const b = g.s.buildings[0];
  g.s.camera.x = (b.x + 2) * 32; g.s.camera.y = (b.y + 1) * 32; g.s.camera.z = 2.4;
  return out;
});
console.log(JSON.stringify(res));
await page.waitForTimeout(400); await page.screenshot({ path: 'shots/build-near.png' });
await page.evaluate(() => { const g = window.railhaven.game, a = g.s.sites[0]; g.s.camera.x = (a.x + 0.5) * 32; g.s.camera.y = (a.y + 0.5) * 32; g.s.camera.z = 1.0; });
await page.waitForTimeout(400); await page.screenshot({ path: 'shots/build-far.png' });
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
