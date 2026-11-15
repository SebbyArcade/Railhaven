// Lay track from Ashford across the nearest water and screenshot the bridge. Usage: node tools/bridge-shot.mjs [seed]
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
  g.s.money = 1e7; g.s.fog.fill(255);
  const W = g.world.terr, start = a.y * n + a.x, prev = new Map([[start, -1]]), q = [start];
  let hit = -1, from = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const i = q[h], x = i % n, y = (i / n) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * n + x + dx; if (prev.has(j)) continue;
      if (!W[j] && !g.world.deep[j]) { // water: does a crossing of 2-6 squares in this direction reach land?
        let k = 1; while (k < 8 && !W[(y + dy * k) * n + x + dx * k] && !g.world.deep[(y + dy * k) * n + x + dx * k]) k++;
        if (k >= 3 && k < 8 && W[(y + dy * k) * n + x + dx * k] && W[(y + dy * k) * n + x + dx * k] !== 4) { hit = i; from = k; prev.set(-2, [dx, dy]); break; }
        continue;
      }
      if (W[j] !== 1 && W[j] !== 2 && W[j] !== 3) continue;
      if (g.s.sites.some(s => s.kind !== 'town' && s.y * n + s.x === j)) continue;
      prev.set(j, i); q.push(j);
    }
  }
  if (hit < 0) return 'no crossing';
  const path = []; for (let i = hit; i !== -1; i = prev.get(i)) path.unshift(i);
  const [dx, dy] = prev.get(-2); const hx = hit % n, hy = (hit / n) | 0;
  for (let k = 1; k <= from + 1; k++) path.push((hy + dy * k) * n + hx + dx * k);
  T.mode = 'rail'; T.plan = null; T.dragStart(path[0]); for (const p of path.slice(1)) T.dragOver(path.indexOf(p) >= 0 ? p : p);
  const bar = T.bar(); T.confirm();
  const m = path[path.length - 2 - Math.floor(from / 2)];
  g.s.camera.x = (m % n + 0.5) * 32; g.s.camera.y = ((m / n | 0) + 0.5) * 32; g.s.camera.z = 2.2; T.mode = 'pan';
  return { len: path.length, bar, from };
});
console.log(JSON.stringify(res));
await page.waitForTimeout(500); await page.screenshot({ path: 'shots/bridge.png' });
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
