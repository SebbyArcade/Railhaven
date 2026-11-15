// Tap-to-extend rails and founding a town, in the real page. Usage: node tools/rail-shot.mjs [seed]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [seed = 4242] = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 800 }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + seed);
await page.waitForTimeout(300);
const out = await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0], A = a.y * n + a.x, o = [];
  T.mode = 'rail'; T.cancel();
  T.tapSquare(A); o.push('start ' + T.plan?.path.length);
  T.tapSquare(A + 6); o.push('tap 6 east → ' + T.plan.path.length + ' squares');
  T.tapSquare(A + 6 + 4 * n); o.push('tap 4 south → ' + T.plan.path.length + ' squares; bar: ' + T.bar()?.text);
  T.confirm(); o.push('built, track ' + g.track.size + ', plan continues from ' + (T.plan?.path[0] === A + 6 + 4 * n));
  g.s.camera.x = (a.x + 3) * 32; g.s.camera.y = (a.y + 2) * 32; g.s.camera.z = 1.8;
  return o;
});
console.log(out.join('\n'));
await page.waitForTimeout(500); await page.screenshot({ path: 'shots/rail-tap.png' });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
