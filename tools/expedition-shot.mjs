// Sends an expedition on a save in the browser and takes pictures: the dock's Islands page, the result, and the far view.
// Usage: node tools/expedition-shot.mjs save.json outDir
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/expedition'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
const id = await page.evaluate(() => {
  const r = window.railhaven, g = r.game; if (g.s.ms) g.s.ms.actNew = false; g.s.money = Math.max(g.s.money, 150000);
  const d = (g.s.buildings ?? []).find(b => b.kind === 'dock' && g.linked?.has(b.y * g.world.n + b.x)) ?? (g.s.buildings ?? []).find(b => b.kind === 'dock');
  d.lvl = 3; r.openCard({ kind: 'bld', id: d.id, page: 'exp' }); return d.id;
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/dock-islands.png` });
const btn = page.locator('button[data-act="expedition"]');
await page.evaluate(() => document.querySelector('button[data-act="expedition"]').click()); await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/dock-confirm.png` });
await page.evaluate(() => document.querySelector('button[data-act="expedition"]').click()); await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/after.png` });
await page.evaluate(() => { const g = window.railhaven.game; Object.assign(g.s.camera, { x: g.world.n * 16, y: g.world.n * 16, z: 0.1 }); });
await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/whole-map.png` });
console.log('dock', id, 'n', await page.evaluate(() => window.railhaven.game.world.n));
console.log(errors.join('\n') || 'no page errors');
await browser.close();
