// Achievements on a phone: a save earns its medals, then the Achievements, a medal group and Looks pages, then a paint and theme on the map.
// Usage: node tools/medal-shot.mjs save.json [out folder]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(s => { if (!sessionStorage.getItem('put')) { sessionStorage.setItem('put', '1'); localStorage.clear(); localStorage.setItem('railhaven2', s); } }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html') + '?home'); await page.waitForTimeout(800);
const shot = async n => { await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${n}.png` }); };
const tap = async sel => { await page.click(sel); await page.waitForTimeout(250); };
await tap('#card [data-act="close"]'); await page.waitForTimeout(5600); // the next save checks the medals
await shot('m1-medal-toast');
await tap('#newGame'); await shot('m2-home');
await tap('[data-page="medals"]'); await shot('m3-medals');
await tap('[data-act="mgroup"][data-id="2"]'); await shot('m4-towns');
await tap('[data-act="page"][data-page="medals"]'); await tap('[data-page="looks"]'); await shot('m5-looks');
await tap('[data-act="look"][data-k="crimson"]'); await tap('[data-act="look"][data-k="seaside"]'); await shot('m6-looks-picked');
await tap('#card [data-act="close"]');
await page.evaluate(() => { const g = window.railhaven.game, t = g.s.trains[0], a = g.s.sites[0]; g.s.camera.x = (a.x + 0.5) * 32; g.s.camera.y = (a.y + 0.5) * 32; g.s.camera.z = 2.6; });
await shot('m7-map');
await page.evaluate(() => { const r = window.railhaven, g = r.game, c = g.s.camera; for (const t of g.s.trains) { const pt = r.trainAt(t.id); if (pt) { c.x = pt.x ?? pt[0]; c.y = pt.y ?? pt[1]; c.z = 3.2; break; } } });
await shot('m8-train');
const p = await page.evaluate(() => JSON.parse(localStorage.getItem('railhaven.profile')));
console.log(JSON.stringify({ medals: Object.keys(p.medals).length, paint: p.paint, theme: p.theme, orders: p.orders, errs }));
await browser.close();
