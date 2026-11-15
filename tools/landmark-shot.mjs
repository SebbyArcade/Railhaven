// Builds the Grand Ashford landmarks on a save and takes pictures: the projects page, then each landmark close up.
// Usage: node tools/landmark-shot.mjs save.json outDir
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/landmarks'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
await page.evaluate(() => { const r = window.railhaven, g = r.game; if (g.s.ms) g.s.ms.actNew = false; g.s.money = Math.max(g.s.money, 400000); g.s.rlv = Math.max(g.s.rlv ?? 0, 8); r.openCard({ kind: 'town', id: g.s.sites[0].id, page: 'projects' }); });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/projects-before.png` });
for (const k of ['grandstation', 'cathedral', 'exhibition']) {
  const b = page.locator(`button[data-act="project"][data-k="${k}"]`);
  if (await b.count()) { await b.click(); await page.waitForTimeout(400); } else console.log('no button for', k);
}
await page.screenshot({ path: `${out}/projects-after.png` });
const spots = await page.evaluate(() => (window.railhaven.game.s.parks ?? []).filter(p => ['grandstation', 'cathedral', 'exhibition'].includes(p.k)).map(p => ({ k: p.k, x: p.x, y: p.y })));
console.log(JSON.stringify(spots));
for (const s of spots) {
  await page.evaluate(s => { const r = window.railhaven; r.openCard(null); Object.assign(r.game.s.camera, { x: (s.x + 0.5) * 32, y: (s.y + 0.5) * 32, z: 3.2 }); }, s);
  await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${s.k}.png`, clip: { x: 56, y: 230, width: 300, height: 300 } });
}
if (spots[0]) {
  await page.evaluate(s => { const r = window.railhaven; Object.assign(r.game.s.camera, { x: (s.x + 0.5) * 32, y: (s.y + 0.5) * 32, z: 1.6 }); }, spots[0]);
  await page.waitForTimeout(900); await page.screenshot({ path: `${out}/ashford.png` });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
