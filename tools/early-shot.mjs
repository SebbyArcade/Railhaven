// Pictures of the early-money help on a save: the 💡 tip, a train card with 💰 Sell, a settlement site card and its flag.
// Usage: node tools/early-shot.mjs save.json outDir
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/early'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
await page.evaluate(() => { const R = window.railhaven; R.openCard(null); R.step(240); });
await page.waitForTimeout(1500);
console.log('tip:', await page.evaluate(() => document.querySelector('#tip')?.textContent));
await page.screenshot({ path: `${out}/tip.png` });
await page.evaluate(() => { document.querySelector('#tip [data-tipx]')?.click(); });
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/tip-off.png`, clip: { x: 0, y: 640, width: 412, height: 220 } });
await page.evaluate(() => { document.querySelector('#tip [data-tipone]')?.click(); });
const t = await page.evaluate(() => window.railhaven.game.s.trains[0].id);
await page.evaluate(id => window.railhaven.openCard({ kind: 'train', id }), t);
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/train-card.png` });
const plot = await page.evaluate(() => { const g = window.railhaven.game, a = g.s.sites[0], p = g.s.sites.filter(s => s.kind === 'plot').sort((u, v) => Math.hypot(u.x - a.x, u.y - a.y) - Math.hypot(v.x - a.x, v.y - a.y))[0]; return p && { id: p.id, x: p.x, y: p.y }; });
if (plot) {
  await page.evaluate(id => window.railhaven.openCard({ kind: 'plot', id }), plot.id);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/plot-card.png` });
  await page.evaluate(p => { const r = window.railhaven, g = r.game; r.openCard(null); g.s.camera.x = (p.x + 0.5) * 32; g.s.camera.y = (p.y + 0.5) * 32; g.s.camera.z = 2.2; }, plot);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/plot-map.png`, clip: { x: 81, y: 280, width: 250, height: 250 } });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
