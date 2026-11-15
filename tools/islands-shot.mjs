// Zoomed-out island labels, and the route-cut warning in Remove mode, on a save. Usage: node tools/islands-shot.mjs [save]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2] ?? 'shots/s14.json';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('railhaven2', s), readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
await page.evaluate(() => { const r = window.railhaven, g = r.game; r.openCard(null); document.querySelectorAll('#card .x, #card [data-act=close]').forEach(b => b.click()); const c = g.s.camera, a = g.s.sites[0]; c.x = a.x * 32; c.y = a.y * 32; c.z = 0.22; });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/islands-out.png' });
// Remove mode: tap the square past a camp's yard end
const cut = await page.evaluate(() => {
  const r = window.railhaven, g = r.game, n = g.world.n;
  for (const b of g.s.buildings) {
    if (b.kind === 'dock') continue;
    const st = b.horizontal ? 1 : n, y0 = b.y * n + b.x, ends = [y0 - st, y0 + 4 * st];
    for (const e of ends) if (g.track.has(e)) { const c = g.s.camera; c.x = (e % n + 0.5) * 32; c.y = (Math.floor(e / n) + 0.5) * 32; c.z = 1.6; return e; }
  }
});
await page.click('#bar [data-mode="remove"]'); await page.waitForTimeout(300);
await page.mouse.click(206, 430); await page.waitForTimeout(600);
const text = await page.textContent('#ctext');
await page.screenshot({ path: 'shots/remove-cut.png' });
console.log('cut square', cut, '·', text, '·', errors.join('\n') || 'no page errors');
await browser.close();
