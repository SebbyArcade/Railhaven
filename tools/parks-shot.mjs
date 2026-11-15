// Town parks and projects drawn beside a town, and the town card pages, on a save. Usage: node tools/parks-shot.mjs [save]
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
const info = await page.evaluate(() => {
  const r = window.railhaven, g = r.game; g.found = []; g.s.ms.actNew = false; r.openCard(null);
  const t = g.s.sites.filter(s => s.kind === 'town' && (s.lvl ?? 0) >= 4)[1] ?? g.s.sites[0];
  g.s.money = 500000; g.s.parks = (g.s.parks ?? []).filter(p => p.town !== t.id);
  return { id: t.id, name: t.name, lvl: t.lvl };
});
// buy two parks and every project by tapping the card buttons
await page.evaluate(id => window.railhaven.openCard({ kind: 'town', id, page: 'parks' }), info.id); await page.waitForTimeout(300);
for (let k = 0; k < 2; k++) { await page.click('#card [data-act="park"]'); await page.waitForTimeout(250); }
await page.screenshot({ path: 'shots/parks-page.png' });
await page.evaluate(id => window.railhaven.openCard({ kind: 'town', id, page: 'projects' }), info.id); await page.waitForTimeout(300);
for (let k = 0; k < 4; k++) { if (!(await page.$('#card [data-act="project"]:not([disabled])'))) break; await page.click('#card [data-act="project"]:not([disabled])'); await page.waitForTimeout(250); }
await page.screenshot({ path: 'shots/projects-page.png' });
const n = await page.evaluate(id => { const r = window.railhaven, g = r.game, t = g.s.sites.find(s => s.id === id); r.openCard(null); g.s.camera.x = (t.x + 0.5) * 32; g.s.camera.y = (t.y + 0.5) * 32; g.s.camera.z = 2.6; return g.s.parks.filter(p => p.town === id).map(p => p.k).join(','); }, info.id);
await page.waitForTimeout(700); await page.screenshot({ path: 'shots/parks-map.png' });
await page.evaluate(id => window.railhaven.openCard({ kind: 'town', id }), info.id); await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#card .tiles')?.scrollIntoView());
await page.screenshot({ path: 'shots/parks-card.png' });
console.log(info, n, errors.join('\n') || 'no page errors');
await browser.close();
