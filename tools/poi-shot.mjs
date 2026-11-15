// Close-ups of each landmark kind on a new map (uncovered for the picture). Usage: node tools/poi-shot.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 220, height: 220 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242');
await page.waitForTimeout(1200);
await page.addStyleTag({ content: 'body > *:not(canvas) { display: none !important; }' });
const kinds = await page.evaluate(() => { const g = window.railhaven.game; g.s.tut = undefined; window.railhaven.openCard(null); return [...new Set(g.s.pois.map(p => p.kind))]; });
for (const k of ['halt', 'falls', 'ranger', 'mill', 'ruins', 'lighthouse']) {
  const ok = await page.evaluate(k => {
    const g = window.railhaven.game, n = g.world.n, p = g.s.pois.find(p => p.kind === k); if (!p) return false; p.seen = true;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const i = (p.y + dy) * n + p.x + dx; g.s.fog[i >> 3] |= 1 << (i & 7); }
    window.railhaven.renderer.terrain?.invalidate?.();
    const c = g.s.camera; c.x = (p.x + 0.5) * 32; c.y = (p.y + 0.3) * 32; c.z = 3; return true;
  }, k);
  if (!ok) continue;
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/poi-${k}.png` });
}
console.log(kinds.join(' '), errors.join('\n') || 'no page errors');
await browser.close();
