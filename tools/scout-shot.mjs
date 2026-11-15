// Scout mode: start rings, a drawn route, then the scout on its way. Usage: node tools/scout-shot.mjs [seed]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + (process.argv[2] || 4242));
await page.waitForTimeout(300);
await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0];
  T.setMode('rail'); T.dragStart(a.y * n + a.x); for (let k = 1; k <= 4; k++) T.dragOver(a.y * n + a.x - k); T.confirm(); T.setMode('pan');
  g.s.camera.x = a.x * 32; g.s.camera.y = (a.y - 6) * 32; g.s.camera.z = 1.1;
});
await page.click('#bar [data-mode="scout"]'); await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/scout-1.png' });
const r = await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0], st = a.y * n + a.x;
  T.tapSquare(st); T.tapSquare(st - 14 * n); T.tapSquare(st - 14 * n - 5);
  return { path: T.scout?.path.length, bar: document.getElementById('ctext').textContent };
});
await page.waitForTimeout(300); console.log(JSON.stringify(r)); await page.screenshot({ path: 'shots/scout-2.png' });
await page.click('#ok'); await page.waitForTimeout(3500);
await page.screenshot({ path: 'shots/scout-3.png' });
console.log(await page.evaluate(() => document.getElementById('toast').textContent));
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
