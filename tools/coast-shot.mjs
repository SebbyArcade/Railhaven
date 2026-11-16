// Rails mode near a town: coasts facing another island across a narrow gap, then a bridge across one (the refusal).
// Usage: node tools/coast-shot.mjs save.json "Town Name" [outDir]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, town = 'Fernley Haven', out = 'shots/coasts'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 800 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
const info = await page.evaluate(name => {
  const r = window.railhaven, g = r.game, n = g.world.n, T = r.tools; if (g.s.ms) g.s.ms.actNew = false; r.openCard(null);
  const s = g.s.sites.find(x => x.name === name) ?? { x: -1, y: -1 }; if (s.x >= 0) Object.assign(g.s.camera, { x: (s.x + 0.5) * 32, y: (s.y + 0.5) * 32, z: 1.6 });
  T.mode = 'rail'; T.cancel?.();
  return { x: s.x, y: s.y, n };
}, town);
await page.waitForTimeout(600); await page.screenshot({ path: `${out}/1-rails-mode.png` });
// paint from the nearest track square straight across the nearest marked gap
const r2 = await page.evaluate(([sx, sy]) => {
  const r = window.railhaven, g = r.game, n = g.world.n, T = r.tools;
  const D = [1, n, -1, -n];
  let best = null;
  for (const t of g.track.keys()) {
    const x = t % n, y = (t / n) | 0; if (sx >= 0 && Math.abs(x - sx) + Math.abs(y - sy) > 12) continue;
    for (let d = 0; d < 4; d++) {
      let j = t, land = 0, water = 0, ok = false; const rev = i => (g.s.fog[i >> 3] >> (i & 7)) & 1;
      for (let k = 1; k < 14; k++) { j += D[d]; if (g.track.has(j) || !rev(j)) break; if (!g.world.terr[j]) { if (g.world.deep[j]) break; water++; } else if (water) { ok = g.world.islandOf[j] !== g.world.islandOf[t]; break; } else land++; }
      if (ok && water <= 3 && (!best || land + water < best.len)) best = { t, j, len: land + water };
    }
  }
  if (!best) return 'no gap found';
  const c = g.s.camera; c.x = (best.t % n + 0.5) * 32; c.y = ((best.t / n) | 0) * 32 + 16; c.z = 1.6;
  return best;
}, [info.x, info.y]);
await page.waitForTimeout(600); await page.screenshot({ path: `${out}/1b-rails-mode-gap.png` });
const r3 = await page.evaluate(best => {
  if (typeof best === 'string') return best;
  const r = window.railhaven, g = r.game, n = g.world.n, T = r.tools;
  T.tapSquare(best.t); T.tapSquare(best.j);
  const c = g.s.camera; c.x = ((best.t % n + best.j % n) / 2 + 0.5) * 32; c.y = (((best.t / n) | 0) + ((best.j / n) | 0)) / 2 * 32 + 16;
  return T.bar()?.text ?? '(no bar)';
}, r2);
await page.waitForTimeout(600); await page.screenshot({ path: `${out}/2-refusal.png` });
console.log(r3); console.log(errors.join('\n') || 'no page errors');
await browser.close();
