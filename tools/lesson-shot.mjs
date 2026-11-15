// Mira's lessons on a new game: follow the gold ring through the first lessons. Usage: node tools/lesson-shot.mjs [seed]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + (process.argv[2] || 4242));
await page.waitForTimeout(1500);
await page.click('#card button[data-act="close"]'); await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/lesson-1.png' });
const tut = () => page.evaluate(() => window.railhaven.game.s.tut);
const ringed = async () => (await page.$('.tutHi')) !== null;
// lesson 1: follow the ring (Build → Lumber Camp → ✓ Build)
for (let k = 0; k < 4 && (await tut()) === 0; k++) { if (await ringed()) await page.click('.tutHi'); await page.waitForTimeout(700); if (k === 1) await page.screenshot({ path: 'shots/lesson-1b.png' }); }
console.log('after lesson 1 steps: tut', await tut());
await page.waitForTimeout(1200);
// lesson 2: Show me, then lay track from Ashford to the ringed square
await page.click('#mission button[data-show]'); await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/lesson-2.png' });
// a finger drag, square by square: across, then up or down to the ringed square, then onto the yard end
await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0], b = g.s.buildings[0], o = T.ring, ox = o % n, oy = (o / n) | 0;
  const end = b.horizontal ? (ox < b.x ? o + 1 : o - 1) : (oy < b.y ? o + n : o - n);
  T.dragStart(a.y * n + a.x); let x = a.x, y = a.y;
  while (x !== ox) { x += Math.sign(ox - x); T.dragOver(y * n + x); }
  while (y !== oy) { y += Math.sign(oy - y); T.dragOver(y * n + x); }
  T.dragOver(end);
});
await page.waitForTimeout(600);
if (await ringed()) await page.click('.tutHi');
await page.waitForTimeout(1500);
console.log('after lesson 2: tut', await tut());
// lesson 3: no engine shed yet? the lesson asks for a straight stretch first: lay 4 straight squares off the line
await page.screenshot({ path: 'shots/lesson-3.png' });
console.log('shed before:', await page.evaluate(() => !!window.railhaven.game.s.shed));
await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0];
  if (g.s.shed) return;
  T.mode = 'rail'; T.cancel();
  const near = [...g.linked].sort((p, q) => Math.hypot(p % n - a.x, ((p / n) | 0) - a.y) - Math.hypot(q % n - a.x, ((q / n) | 0) - a.y));
  for (const i of near) for (const d of [1, -1, n, -n]) {
    if (g.s.shed) return;
    if (![1, 2, 3, 4].every(k => !g.track.has(i + d * k) && g.world.terr[i + d * k] === 1)) continue;
    T.cancel(); if (!T.dragStart(i)) continue;
    for (let k = 1; k <= 4; k++) T.dragOver(i + d * k);
    const b = T.bar(); if (!b?.can) continue;
    T.confirm();
  }
});
await page.waitForTimeout(600);
console.log('shed after:', await page.evaluate(() => !!window.railhaven.game.s.shed));
// lesson 3: the ring is on 🚂 Train, then ✓ Buy
for (let k = 0; k < 3 && (await tut()) === 2; k++) { if (await ringed()) await page.click('.tutHi'); await page.waitForTimeout(1200); }
console.log('after lesson 3: tut', await tut());
await page.screenshot({ path: 'shots/lesson-4.png' });
// lesson 4: follow the ring to build the farm, then join it the same way
for (let k = 0; k < 4 && !(await page.evaluate(() => window.railhaven.game.s.buildings.some(b => b.kind === 'farm'))); k++) { if (await ringed()) await page.click('.tutHi'); await page.waitForTimeout(700); }
await page.waitForTimeout(1200);
await page.click('#mission button[data-show]'); await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/lesson-4b.png' });
await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, b = g.s.buildings.find(q => q.kind === 'farm'), o = T.ring; if (o === null) return;
  const ox = o % n, oy = (o / n) | 0, end = b.horizontal ? (ox < b.x ? o + 1 : o - 1) : (oy < b.y ? o + n : o - n);
  // from the nearest railway square: across, then up or down
  const s0 = [...g.linked].sort((p, q) => Math.hypot(p % n - ox, ((p / n) | 0) - oy) - Math.hypot(q % n - ox, ((q / n) | 0) - oy))[0];
  T.dragStart(s0); let x = s0 % n, y = (s0 / n) | 0;
  while (x !== ox) { x += Math.sign(ox - x); T.dragOver(y * n + x); }
  while (y !== oy) { y += Math.sign(oy - y); T.dragOver(y * n + x); }
  T.dragOver(end);
});
await page.waitForTimeout(500); if (await ringed()) await page.click('.tutHi'); await page.waitForTimeout(1500);
console.log('after lesson 4: tut', await tut());
await page.evaluate(() => window.railhaven.step(240)); await page.waitForTimeout(1500);
console.log('after 4 game minutes: tut', await tut(), 'orders', await page.evaluate(() => window.railhaven.game.s.orders));
await page.screenshot({ path: 'shots/lesson-6.png' });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
