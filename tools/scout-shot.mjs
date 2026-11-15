// A scout route being drawn from Ashford out into the fog, in a new game. Usage: node tools/scout-shot.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const r = window.railhaven, g = r.game, n = g.world.n, a = g.s.sites[0], path = [];
  for (let k = 0; k <= 14; k++) path.push(a.y * n + a.x + k);
  for (let k = 1; k <= 10; k++) path.push((a.y - k) * n + a.x + 14);
  r.openCard(null); if (g.s.ms) g.s.ms.actNew = false; g.found = [];
  r.tools.mode = 'scout'; r.tools.scout = { path, boat: false, from: a.id };
  g.s.camera.x = (a.x + 9) * 32; g.s.camera.y = (a.y - 3) * 32; g.s.camera.z = 1;
});
await page.waitForTimeout(1200); await page.screenshot({ path: 'shots/scout-route.png' });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
