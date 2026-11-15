// The way into towns not on the railway, in Rails mode: arrows where track may come in, before and after a line
// ends beside a town (a dead-end station). Usage: node tools/entry-shot.mjs [seed]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const [seed = 4242] = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + seed);
await page.waitForTimeout(800);
// paint a stroke square by square from (x0, y0) through the corners, then confirm
const lay = pts => page.evaluate(pts => {
  const r = window.railhaven, g = r.game, n = g.world.n, T = r.tools;
  T.mode = 'rail'; T.cancel();
  let [x, y] = pts[0]; if (!T.dragStart(y * n + x)) return 'no start';
  for (const [tx, ty] of pts.slice(1)) while (x !== tx || y !== ty) { x += Math.sign(tx - x); if (x === tx) y += Math.sign(ty - y); T.dragOver(y * n + x); }
  T.confirm(); return g.track.size;
}, pts);
const info = await page.evaluate(() => {
  const r = window.railhaven, g = r.game, a = g.s.sites[0];
  g.s.fog.fill(255); g.s.money = 1e6; r.openCard(null); g.s.ms && (g.s.ms.lesson = 99); g.s.lesson = 99;
  const t = g.s.sites.filter(s => s.kind === 'town' && s !== a).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
  return { name: t.name, x: t.x, y: t.y, ax: a.x, ay: a.y };
});
const { x, y, ax, ay } = info;
// before: a line from Ashford heading toward the town, stopping a few squares short
console.log('laid', await lay([[ax, ay], [ax, y - 4]]));
const skip = async () => { for (const t of ['Skip lessons', "Let's go"]) { const b = page.getByText(t); if (await b.count()) await b.first().click().catch(() => {}); } };
const look = () => page.evaluate(([x, y]) => { const r = window.railhaven, g = r.game; r.tools.mode = 'rail'; r.openCard(null); g.s.camera.x = (x + 0.5) * 32; g.s.camera.y = (y - 1) * 32; g.s.camera.z = 1.6; }, [x, y]);
await page.waitForTimeout(300); await skip(); await look(); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/entry-before.png' });
// after: carry on down and end right beside the town's east side
console.log('laid', await lay([[ax, y - 4], [x + 5, y - 4], [x + 5, y], [x + 1, y]]));
await page.waitForTimeout(300); await skip(); await look(); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/entry-after.png' });
console.log(info, errors.join('\n') || 'no page errors');
await browser.close();
