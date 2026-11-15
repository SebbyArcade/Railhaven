// Pictures of a capital's town card, the Orders board and a capital on the map. Usage: node tools/trade-shot.mjs save.json outDir
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/trade'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(8000); // a few game seconds: capitals and trade orders start
const caps = await page.evaluate(() => { const g = window.railhaven.game; if (g.s.ms) g.s.ms.actNew = false; return Object.keys(g.s.trade ?? {}).map(k => ({ k: +k, id: k == g.world.home ? g.s.sites[0].id : g.s.caps[k] })); });
console.log('trade orders', JSON.stringify(caps));
const outer = caps.find(c => c.id !== caps[0]?.id && c.id !== undefined) ?? caps[0];
for (const [name, id] of [['ashford-card', caps.find(c => c.id === 0)?.id ?? caps[0].id], ['capital-card', outer.id]]) {
  await page.evaluate(id => window.railhaven.openCard({ kind: 'town', id }), id);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const c = document.querySelector('#card'); const t = [...c.querySelectorAll('h3')].find(h => h.textContent.includes('Trade order')); if (t) t.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}.png` });
}
await page.evaluate(() => window.railhaven.openCard({ kind: 'orders' }));
await page.waitForTimeout(600);
await page.evaluate(() => { const c = document.querySelector('#card'); const t = [...c.querySelectorAll('h3')].find(h => h.textContent.includes('Trade between')); if (t) t.scrollIntoView({ block: 'start' }); });
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/orders-board.png` });
// the capital on the map, close enough for its name board and trade line
await page.evaluate(id => { const r = window.railhaven, g = r.game, t = g.s.sites.find(s => s.id === id); r.openCard(null); g.s.camera.x = (t.x + 0.5) * 32; g.s.camera.y = (t.y + 1.5) * 32; g.s.camera.z = 1.6; }, outer.id);
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/capital-map.png`, clip: { x: 31, y: 230, width: 350, height: 400 } });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
