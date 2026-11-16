// ⭐ Rushes on a save: a town card's Rush buttons, the Rushes box on the Orders board, the gold tags on the map,
// and the dock goods tags. Usage: node tools/rush-shot.mjs save.json [townId]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file, townId = '2'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
const look = (x, y, z) => page.evaluate(([x, y, z]) => { const c = window.railhaven.game.s.camera; c.x = (x + 0.5) * 32; c.y = (y + 0.5) * 32; c.z = z; }, [x, y, z]);
const t = await page.evaluate(id => { const S = window.railhaven.game.s.sites; const t = S.find(s => s.id === id) ?? S[0]; return { x: t.x, y: t.y, id: t.id }; }, +townId);
await look(t.x, t.y, 1.4);
await page.evaluate(id => window.railhaven.openCard({ kind: 'town', id }), t.id); await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/rush-town.png' });
// rush the first good on the card
await page.click('#card button[data-act="rush"]'); await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/rush-town-on.png' });
// and a factory input
const f = await page.evaluate(() => { const g = window.railhaven.game; const f = g.s.buildings.find(b => ['sawmill', 'mill', 'brickworks', 'steelmill', 'bakery'].includes(b.kind)); return f ? { id: f.id, x: f.x, y: f.y } : null; });
if (f) { await page.evaluate(id => window.railhaven.openCard({ kind: 'bld', id }), f.id); await page.waitForTimeout(400); await page.click('#card button[data-act="rush"]:not([disabled])', { timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300); await page.screenshot({ path: 'shots/rush-factory.png' }); }
await page.evaluate(() => { window.railhaven.openCard(null); window.railhaven.step(30); });
await page.click('#hud [data-orders]'); await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/rush-orders.png' });
await page.evaluate(() => document.querySelector('#card').scrollTop = 600); await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/rush-orders-2.png' });
await page.evaluate(() => window.railhaven.openCard(null));
await look(t.x, t.y, 1.2); await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/rush-map.png' });
// docks with goods, close up and zoomed out
await page.evaluate(() => window.railhaven.step(90));
const d = await page.evaluate(() => { const g = window.railhaven.game, tot = b => (b.outq ?? []).reduce((a, q) => a + q.n, 0) + Object.values(b.landed ?? {}).reduce((a, v) => a + v, 0); const d = g.s.buildings.filter(b => b.kind === 'dock').sort((a, b) => tot(b) - tot(a))[0]; return d ? { x: d.x, y: d.y } : null; });
if (d) { await look(d.x, d.y, 1.6); await page.waitForTimeout(400); await page.screenshot({ path: 'shots/dock-tags-near.png' }); await look(d.x, d.y, 0.55); await page.waitForTimeout(400); await page.screenshot({ path: 'shots/dock-tags-far.png' }); }
console.log(errors.join('\n') || 'no page errors');
await browser.close();
