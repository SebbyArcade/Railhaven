// Playtest pictures of a save at folded and unfolded phone sizes. Usage: node tools/playtest-shot.mjs save.json outDir
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/pt'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const errors = [];
for (const [name, w, h] of [['fold', 412, 915], ['open', 884, 1104]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
  await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
  const shot = async (tag, fn, arg) => { await page.evaluate(fn, arg); await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${name}-${tag}.png` }); };
  await page.screenshot({ path: `${out}/${name}-0start.png` });
  const ids = await page.evaluate(() => { const g = window.railhaven.game; const bs = g.s.buildings; return { ash: g.s.sites[0].id, ref: bs.find(b => b.kind === 'refinery')?.id, quarry: bs.find(b => b.kind === 'quarry' || b.kind === 'stone')?.id ?? bs[14]?.id, train: g.s.trains[0].id, emb: g.s.sites.find(s => s.name === 'Seacombe')?.id }; });
  await shot('1ashford', id => { const r = window.railhaven, t = r.game.s.sites.find(s => s.id === id); r.openCard(null); Object.assign(r.game.s.camera, { x: t.x * 32, y: t.y * 32, z: 2 }); }, ids.ash);
  await shot('2towncard', id => window.railhaven.openCard({ kind: 'town', id }), ids.ash);
  await shot('3refinery', id => { const r = window.railhaven, b = r.game.s.buildings.find(b => b.id === id); Object.assign(r.game.s.camera, { x: b.x * 32, y: b.y * 32, z: 2.2 }); r.openCard({ kind: 'bld', id }); }, ids.ref);
  await shot('4orders', () => window.railhaven.openCard({ kind: 'orders', id: 0 }));
  await shot('5shed', () => window.railhaven.openCard({ kind: 'shed', id: 0 }));
  await shot('6seacombe', id => { const r = window.railhaven, t = r.game.s.sites.find(s => s.id === id); r.openCard(null); Object.assign(r.game.s.camera, { x: t.x * 32, y: t.y * 32, z: 1.4 }); }, ids.emb);
  await shot('7far', () => { const r = window.railhaven; r.openCard(null); r.game.s.camera.z = 0.3; });
  await shot('8story', () => window.railhaven.openCard({ kind: 'story', id: 0 }));
  await page.close();
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
