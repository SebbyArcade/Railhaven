// Cargo ships showing what they carry: deck loads by kind and (zoomed in) a tag naming the goods.
// Usage: npm run build && node tools/ship-cargo-shot.mjs [seed] [out-prefix]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const seed = Number(process.argv[2] ?? 4242), out = process.argv[3] ?? 'shots/ship-cargo';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 520, height: 900 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + seed);
await page.waitForTimeout(300);
console.log(await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0];
  g.s.money = 1e5; g.s.rlv = 1; g.s.fog.fill(255);
  let best = -1, bd = 1e9; for (let i = 0; i < n * n; i++) if (!g.world.terr[i] && g.world.ocean[i]) { const d = Math.hypot(i % n - a.x, (i / n | 0) - a.y); if (d < bd) { bd = d; best = i; } }
  g.s.camera.x = (best % n) * 32; g.s.camera.y = (best / n | 0) * 32;
  T.chooseBuild('dock'); const err = T.previewErr; T.confirm(); T.mode = 'pan'; T.cancel(); T.buildKind = null;
  const b = g.s.buildings.at(-1); if (!b || b.kind !== 'dock') return 'no dock ' + err;
  const holds = [[{ good: 'wood', n: 40 }, { good: 'coal', n: 35 }], [{ good: 'oil', n: 60 }], [{ good: 'steel', n: 30 }, { good: 'planks', n: 25 }, { good: 'wool', n: 15 }, { good: 'fish', n: 10 }], [{ good: 'farm', n: 80 }], [{ good: 'bricks', n: 20 }]];
  g.s.ships = holds.map((h, k) => ({ id: 900 + k, at: b.id, pos: 0, hold: h.map(q => ({ ...q, to: 99999 })), wait: 999, slot: k }));
  g.s.ferries = [{ id: 950, at: b.id, pos: 0, hold: [], wait: 999, slot: 5, train: 3, paid: 0, isl: 1 }];
  g.s.camera.x = (b.x + 2) * 32; g.s.camera.y = (b.y + 1) * 32; g.s.camera.z = 2.4;
  window.__b = b; return 'ok';
}));
await page.click('[data-skip]').catch(() => {}); await page.waitForTimeout(4500); await page.getByText("Let's go").click().catch(() => {}); await page.waitForTimeout(400); await page.screenshot({ path: `${out}-near.png` });
await page.evaluate(() => { const g = window.railhaven.game; g.s.camera.z = 3.4; g.s.camera.y += 3 * 32; }); await page.waitForTimeout(300); await page.locator('button.x[data-act=close]').click().catch(() => {}); await page.waitForTimeout(300); await page.screenshot({ path: `${out}-close.png` });
await page.evaluate(() => { const g = window.railhaven.game; g.s.camera.z = 1.2; g.s.camera.y -= 3 * 32; }); await page.waitForTimeout(300); await page.screenshot({ path: `${out}-mid.png` });
await page.evaluate(() => { window.railhaven.game.s.camera.z = 0.6; }); await page.waitForTimeout(300); await page.screenshot({ path: `${out}-far.png` });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
