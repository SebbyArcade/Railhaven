// Buildings past level 3 (Railway level 4 and 6), on a save. Usage: node tools/levels-shot.mjs [save]
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
  const r = window.railhaven, g = r.game; g.found = []; g.s.ms.actNew = false; r.openCard(null); g.s.money = 5e5;
  const pick = k => g.s.buildings.filter(b => b.kind === k).sort((a, b) => b.lvl - a.lvl)[0];
  const bs = ['sawmill', 'farm', 'lumber', 'quarry'].map(pick).filter(Boolean);
  return { rlv: g.s.rlv, bs: bs.map(b => ({ id: b.id, kind: b.kind, lvl: b.lvl, x: b.x, y: b.y })) };
});
const shots = [];
for (const b of info.bs.slice(0, 2)) {
  await page.evaluate(id => window.railhaven.openCard({ kind: 'bld', id }), b.id);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/levels-card-${b.kind}-before.png` });
  for (let k = 0; k < 4; k++) { const ok = await page.evaluate(() => { const el = document.querySelector('[data-act="lvl"]:not([disabled])'); el?.click(); return !!el; }); if (!ok) break; await page.waitForTimeout(300); }
  await page.screenshot({ path: `shots/levels-card-${b.kind}.png` });
  await page.evaluate(b => { const r = window.railhaven, g = r.game; r.openCard(null); g.s.camera.x = (b.x + 1) * 32; g.s.camera.y = (b.y + 1) * 32; g.s.camera.z = 2.6; }, b);
  await page.waitForTimeout(1200); await page.screenshot({ path: `shots/levels-${b.kind}.png` }); shots.push(b.kind);
}
const after = await page.evaluate(ids => ids.map(id => window.railhaven.game.s.buildings.find(b => b.id === id).lvl), info.bs.map(b => b.id));
console.log(JSON.stringify({ info, after, shots }), errors.join('\n') || 'no page errors');
await browser.close();
