// A dock with a cargo ship moored at it (OUT=file.png), and its card. Usage: node tools/dock-shot.mjs [seed]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const [seed = 4242] = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 520, height: 900 }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + seed);
await page.waitForTimeout(300);
const out = await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0];
  g.s.money = 1e5; g.s.rlv = 1; g.s.fog.fill(255);
  // camera on the nearest sea square
  let best = -1, bd = 1e9; for (let i = 0; i < n * n; i++) if (!g.world.terr[i] && g.world.ocean[i]) { const d = Math.hypot(i % n - a.x, (i / n | 0) - a.y); if (d < bd) { bd = d; best = i; } }
  g.s.camera.x = (best % n) * 32; g.s.camera.y = (best / n | 0) * 32;
  T.chooseBuild('dock'); const err = T.previewErr; T.confirm(); T.mode = 'pan'; T.cancel(); T.buildKind = null;
  const b = g.s.buildings.at(-1);
  if (b) { g.s.camera.x = (b.x + 2) * 32; g.s.camera.y = (b.y + 1) * 32; g.s.camera.z = 2.6; (g.s.ships ??= []).push({ id: 900, at: b.id, pos: 0, hold: [{ good: 'wood', n: 20 }], timer: 99 }); }
  return 'sea at ' + bd + ' squares; dock: ' + (b ? b.kind : 'none ' + err);
});
console.log(out);
await page.waitForTimeout(500); await page.screenshot({ path: '' + (process.env.OUT || 'shots/dock-art.png') + '' });
await page.evaluate(() => { const R = window.railhaven, b = R.game.s.buildings.at(-1); if (b) { R.openCard({ kind: 'bld', id: b.id }); R.game.s.camera.z = 0.5; } });
await page.waitForTimeout(500); await page.screenshot({ path: 'shots/dock-card.png' });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
