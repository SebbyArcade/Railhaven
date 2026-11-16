// ⛴ A new train shipped to a landing: the landing card, the train on its way to the dock, and the boat at sea.
// Usage: node tools/ferry-shot.mjs save.json
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file = 'tests/saves/save-seb-2026-11-16g.json'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e.stack)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
const id = await page.evaluate(() => {
  const r = window.railhaven, g = r.game; g.s.money += 20000;
  const home = g.world.home, n = g.world.n;
  const l = g.s.buildings.find(b => b.kind === 'dock' && g.world.islandOf[(b.y) * n + b.x] !== home && g.linked.has(0) === false && true);
  const lands = g.s.buildings.filter(b => b.kind === 'dock'); const land = lands.find(b => g.world.islands[g.world.islandOf[b.y * n + b.x]]?.name === 'Gull Rock') ?? lands.at(-1);
  r.openCard({ kind: 'bld', id: land.id, page: 'trains' }); const c = g.s.camera; c.x = land.x * 32; c.y = land.y * 32; c.z = 1; void l;
  return land.id;
});
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/ferry-card.png' });
await page.click('#card button[data-act="trainat"]');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/ferry-bought.png' });
// on its way to the dock
const st = await page.evaluate(() => { const r = window.railhaven, g = r.game; r.openCard(null); r.step(8); const t = g.s.trains.find(t => t.ferry); const p = t && r.trainAt(t.id); if (p) { g.s.camera.x = p.x; g.s.camera.y = p.y; g.s.camera.z = 1.8; } return t ? 'driving ' + t.id : 'none'; });
await page.waitForTimeout(800); await page.screenshot({ path: 'shots/ferry-driving.png' });
const sea = await page.evaluate(() => { const r = window.railhaven, g = r.game; for (let k = 0; k < 400 && !(g.s.ferries?.length && g.s.ferries[0].pos > 6); k++) r.step(0.5); const f = g.s.ferries?.[0]; if (!f) return 'no ferry'; const n = g.world.n, i = f.path[Math.floor(f.pos)]; g.s.camera.x = (i % n + 0.5) * 32; g.s.camera.y = ((i / n | 0) + 0.5) * 32; g.s.camera.z = 2.6; return 'at sea ' + f.train + ' pos ' + f.pos.toFixed(1) + '/' + f.path.length; });
await page.waitForTimeout(800); await page.screenshot({ path: 'shots/ferry-sea.png' });
console.log(id, st, sea, errors.join('\n') || 'no page errors');
await browser.close();
