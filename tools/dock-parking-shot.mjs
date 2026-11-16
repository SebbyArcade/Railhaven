// Several cargo ships moored at one dock (he saw two lying on top of each other). Usage: OUT=file.png DIST=dist/index.html node tools/dock-parking-shot.mjs [seed] [ships]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const [seed = 4242, count = 2] = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve(process.env.DIST || 'dist/index.html') + '?new&seed=' + seed);
await page.waitForTimeout(300);
const out = await page.evaluate((count) => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0];
  g.s.money = 1e5; g.s.rlv = 1; g.s.fog.fill(255);
  let best = -1, bd = 1e9; for (let i = 0; i < n * n; i++) if (!g.world.terr[i] && g.world.ocean[i]) { const d = Math.hypot(i % n - a.x, (i / n | 0) - a.y); if (d < bd) { bd = d; best = i; } }
  g.s.camera.x = (best % n) * 32; g.s.camera.y = (best / n | 0) * 32;
  T.chooseBuild('dock'); const err = T.previewErr; T.confirm(); T.mode = 'pan'; T.cancel(); T.buildKind = null;
  const b = g.s.buildings.at(-1);
  if (b) {
    g.s.camera.x = (b.x + (b.horizontal ? 1.5 : 1)) * 32; g.s.camera.y = (b.y + (b.horizontal ? 1 : 1.5)) * 32; g.s.camera.z = 2.2;
    for (let k = 0; k < count; k++) (g.s.ships ??= []).push({ id: 900 + k, at: b.id, pos: 0, hold: [{ good: ['wood', 'fish', 'stone', 'coal'][k % 4], n: 40 }], wait: 1e9 });
  }
  return 'dock: ' + (b ? `${b.x},${b.y} h=${b.horizontal} side=${b.side}` : 'none ' + err);
}, count);
console.log(out);
await page.waitForTimeout(800); await page.screenshot({ path: process.env.OUT || 'shots/dock-parking.png' });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
