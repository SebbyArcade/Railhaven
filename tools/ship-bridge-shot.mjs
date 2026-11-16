// 🌉 A cargo ship passing under a rail bridge: lays track from Ashford across the nearest water (as bridge-shot does),
// puts a loaded ship under the middle of the bridge and screenshots it. Usage: npm run build && node tools/ship-bridge-shot.mjs [seed] [out.png]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
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
  // a cargo ship sailing across under the middle of the bridge, at right angles to it
  const p = dx ? n : 1, ships = (g.s.ships ??= []);
  (g.s.buildings ??= []).push({ id: 9901, kind: 'dock', x: 2, y: 2, horizontal: true, side: 1, lvl: 1, stock: 0 }); // far off, so the ship has somewhere to sail to
  ships.push({ id: 901, at: 9901, to: 9901, path: [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(k => m + k * p), pos: 4, hold: [{ good: 'wood', n: 40, to: 9901 }, { good: 'coal', n: 30, to: 9901 }], wait: 0 });
  window.__ship = ships.at(-1);
  return { len: path.length, bar, from };
});
console.log(JSON.stringify(res));
await page.click('[data-skip]').catch(() => {});
// hold the ship under the bridge (it has nowhere real to go) and take the shot
await page.evaluate(() => { const s = window.__ship, p = s.path; setInterval(() => { s.to = 9901; s.path = p; s.pos = 4; s.wait = 0; }, 5); });
await page.waitForTimeout(4000);
await page.screenshot({ path: process.argv[3] || 'shots/ship-bridge.png' });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
