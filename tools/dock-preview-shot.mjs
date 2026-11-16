// The dock's placement preview at all four turns: its picture should cover exactly the outlined squares.
// Usage: node tools/dock-preview-shot.mjs [seed] [out-prefix]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const seed = Number(process.argv[2] ?? 4242), out = process.argv[3] ?? 'shots/dock-preview';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 520, height: 900 }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + seed);
await page.waitForTimeout(300);
for (let turn = 0; turn < 4; turn++) {
  const info = await page.evaluate(turn => {
    const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0];
    g.s.money = 1e5; g.s.rlv = 1; g.s.fog.fill(255);
    let best = -1, bd = 1e9; for (let i = 0; i < n * n; i++) if (!g.world.terr[i] && g.world.ocean[i]) { const d = Math.hypot(i % n - a.x, (i / n | 0) - a.y); if (d < bd) { bd = d; best = i; } }
    g.s.camera.x = (best % n) * 32; g.s.camera.y = (best / n | 0) * 32;
    T.chooseBuild('dock');
    const p0 = T.preview, all = [true, false].flatMap(h => [1, -1].map(side => ({ ...p0, horizontal: h, side })));
    const p = all[turn]; T.setPreview(p);
    const c = T.preview; g.s.camera.x = (c.x + (c.horizontal ? 1.5 : 1)) * 32; g.s.camera.y = (c.y + (c.horizontal ? 1 : 1.5)) * 32; g.s.camera.z = 2.4;
    return JSON.stringify({ h: c.horizontal, side: c.side, len: c.len, bar: T.bar()?.text ?? '' });
  }, turn);
  console.log(turn, info);
  await page.waitForTimeout(400); await page.screenshot({ path: `${out}-${turn}.png` });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
