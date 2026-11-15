// Build a farm and a camp by Ashford, link them, buy two trains, run 3 game minutes, and screenshot the cards.
// Usage: node tools/economy-shot.mjs [seed] [width] [height]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [seed = 4242, W = 412, H = 915] = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + seed);
await page.waitForTimeout(300);
const res = await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0], A = a.y * n + a.x;
  const out = [];
  const near = (s) => [...s].sort((p, q) => Math.hypot(p % n - a.x, (p / n | 0) - a.y) - Math.hypot(q % n - a.x, (q / n | 0) - a.y));
  const rail = (path) => { T.mode = 'rail'; T.cancel(); T.dragStart(path[0]); for (const i of path.slice(1)) T.dragOver(i); const b = T.bar(); T.confirm(); T.mode = 'pan'; T.cancel(); return b && b.text; };
  out.push('line east: ' + rail([A, A + 6]));
  for (const k of ['farm', 'wood']) {
    T.chooseBuild(k); T.updateGlow(a.x, a.y);
    const spots = near(T.glow).filter(i => Math.hypot(i % n - a.x, (i / n | 0) - a.y) > 4);
    if (!spots.length) { out.push(k + ': no spot'); continue; }
    let pick = spots[0]; for (const i of spots.slice(0, 80)) { T.tapSquare(i); const b = T.bar(); if (b && !b.text.includes('⚠')) { pick = i; break; } T.preview = null; }
    T.preview = null; T.tapSquare(pick); out.push(k + ': ' + (T.bar() && T.bar().text)); T.confirm();
    T.mode = 'pan'; T.buildKind = null;
    const b = g.s.buildings.at(-1), ys = [b.x + b.y * n, b.horizontal ? b.x + 3 + b.y * n : b.x + (b.y + 3) * n];
    const end = near(ys)[0], st = b.horizontal ? (end === ys[0] ? -1 : 1) : (end === ys[0] ? -n : n);
    // join the yard to the line: from the nearest track square
    const froms = [...g.track.keys()].filter(i => !ys.includes(i) && g.linked.has(i)).sort((p, q) => Math.hypot(p % n - end % n, (p / n | 0) - (end / n | 0)) - Math.hypot(q % n - end % n, (q / n | 0) - (end / n | 0)));
    let r = null; for (const from of froms.slice(0, 12)) { r = rail([from, end + st, end]); if (r && b && g.linked.has(end)) break; }
    out.push('link: ' + r);
  }
  for (let k = 0; k < 2; k++) { T.mode = 'train'; out.push(T.bar().text); T.confirm(); T.mode = 'pan'; R.step(20); }
  R.step(170);
  out.push('money ' + Math.round(g.s.money) + ' earned ' + Math.round(g.s.earned || 0) + ' got ' + JSON.stringify(a.got) + ' orders ' + (g.s.orders || 0));
  g.s.camera.x = (a.x + 0.5) * 32; g.s.camera.y = (a.y - 1) * 32; g.s.camera.z = 1.8;
  R.openCard({ kind: 'town', id: a.id });
  return out;
});
console.log(res.join('\n'));
await page.waitForTimeout(1200); await page.screenshot({ path: 'shots/econ-town.png' });
await page.evaluate(() => { const R = window.railhaven, b = R.game.g ?? R.game.s.buildings[0]; R.openCard({ kind: 'bld', id: b.id }); });
await page.waitForTimeout(1200); await page.screenshot({ path: 'shots/econ-building.png' });
await page.evaluate(() => { const R = window.railhaven; R.openCard({ kind: 'train', id: R.game.s.trains[0].id }); });
await page.waitForTimeout(1200); await page.screenshot({ path: 'shots/econ-train.png' });
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
