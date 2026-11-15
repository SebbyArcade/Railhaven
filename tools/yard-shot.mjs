// A yard growing its 3rd and 4th loading tracks (level 2 and 3), on a save. Usage: node tools/yard-shot.mjs [save]
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
await page.addStyleTag({ content: '#mission, #hint, #toast { display: none !important; }' });
const id = await page.evaluate(() => {
  const r = window.railhaven, g = r.game, n = g.world.n; g.s.money += 1e6; g.s.ms.actNew = false;
  const free = b => { const sq = [0, 1, 2, 3].map(k => b.horizontal ? (b.y - b.side) * n + b.x + k : (b.y + k) * n + b.x - b.side); return sq.every(i => !g.track.has(i) && g.world.terr[i] !== 0 && g.world.terr[i] !== 4 && !(g.s.buildings.some(o => o !== b && [0,1,2,3].some(k => { const ys = o.horizontal ? o.y * n + o.x + k : (o.y + k) * n + o.x; const bs = o.horizontal ? ys + o.side * n : ys + o.side; return ys === i || bs === i; })))); };
  const b = g.s.buildings.find(b => b.kind !== 'dock' && b.kind !== 'farm' && b.kind !== 'wool' && b.lvl === 1 && free(b) && g.s.trains.some(t => t.job?.src === b.id)) ?? g.s.buildings.find(b => b.kind !== 'dock' && b.kind !== 'farm' && b.kind !== 'wool' && b.lvl === 1 && free(b));
  const c = g.s.camera; c.x = (b.x + (b.horizontal ? 2 : 0.5)) * 32; c.y = (b.y + (b.horizontal ? 0.5 : 2)) * 32; c.z = 2.2;
  return b.id;
});
const shot = async name => { await page.evaluate(() => { window.railhaven.game.found = []; window.railhaven.openCard(null); }); await page.waitForTimeout(500); await page.screenshot({ path: `shots/${name}.png` }); };
await shot('yard-1');
for (const k of [2, 3]) {
  await page.evaluate(id => window.railhaven.openCard({ kind: 'bld', id }), id); await page.waitForTimeout(300);
  await page.click('[data-act=lvl]'); await page.waitForTimeout(300);
  await shot(`yard-${k}`);
}
await page.evaluate(() => { for (let k = 0; k < 600; k++) window.railhaven.step(0.1); }); await page.waitForTimeout(300);
await shot('yard-run');
const info = await page.evaluate(id => { const b = window.railhaven.game.s.buildings.find(x => x.id === id); return `${b.kind} lvl ${b.lvl} tracks ${b.tracks}`; }, id);
console.log(info, errors.join('\n') || 'no page errors');
await browser.close();
