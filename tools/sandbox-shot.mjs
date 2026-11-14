// Lay a test layout through the real tools, run trains, and take screenshots. Usage: node tools/sandbox-shot.mjs [outDir]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] || 'shots');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242');
await page.waitForTimeout(300);
const res = await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, cx = g.world.cx, cy = g.world.cy;
  const sq = (x, y) => (cy + y) * n + cx + x;
  g.s.money = 1e6;
  for (let r = 0; r < 14; r++) for (let a = 0; a < 64; a++) { /* reveal more for the test */ }
  const paint = pts => { T.mode = 'rail'; T.plan = null; if (!T.dragStart(sq(...pts[0]))) return 'no start'; for (const p of pts.slice(1)) T.dragOver(sq(...p)); const bar = T.bar(); const len = T.plan.path.length; T.confirm(); return (bar && bar.text) + ' len ' + len; };
  const terr = []; for (let y = -1; y <= 9; y++) { let r = ''; for (let x = -1; x <= 9; x++) r += g.world.terr[sq(x, y)]; terr.push(r); }
  const log = [];
  log.push(paint([[0, 0], [6, 0], [6, 4]]));          // east then a wide corner south
  log.push(paint([[6, 4], [0, 4], [0, 2]]));   // round to make a loop-ish line
  log.push(paint([[3, 0], [3, 2]]));                   // a branch south from the main line
  T.mode = 'double'; T.dbl.clear(); for (let x = 1; x <= 5; x++) T.dbl.add(sq(x, 4)); T.confirm();
  T.mode = 'train'; T.tapSquare(sq(2, 0)); T.mode = 'train'; T.tapSquare(sq(4, 4));
  T.mode = 'pan';
  const [a, b] = g.s.trains;
  if (a) g.sys.sendTo(a, sq(0, 2)); if (b) g.sys.sendTo(b, sq(3, 2));
  g.s.camera.x = (cx + 2.2) * 32; g.s.camera.y = (cy + 2.5) * 32; g.s.camera.z = 2.2;
  return { terr, log, trains: g.s.trains.length, pieces: g.net.pieces.length, money: g.s.money };
});
console.log(JSON.stringify(res));
const dbg = () => page.evaluate(() => window.railhaven.game.s.trains.map(t => ({ id: t.id, plan: t.plan.length, held: t.held, v: t.v, wait: t.wait, dest: t.dest, trail: t.trail.length, pause: t.pause })));
console.log(JSON.stringify(await dbg()));
for (const [k, wait] of [[1, 200], [2, 3000], [3, 6000], [4, 30000]]) { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/sandbox-${k}.png` }); }
console.log(JSON.stringify(await dbg()));
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
