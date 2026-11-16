// Every station hall of a save, close up (one picture per town, by size). Usage: node tools/station-shot.mjs save.json [outDir] [zoom]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/stations', z = '2.6'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 520 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
const halls = await page.evaluate(() => { const r = window.railhaven; if (r.game.s.ms) r.game.s.ms.actNew = false; r.openCard(null); return r.renderer.halls.map(h => ({ name: h.town.name, pop: h.town.pop ?? 0, cx: h.cx, cy: h.cy })); });
// the whole map's halls are found only once the camera has seen them: look at each town first
const towns = await page.evaluate(() => window.railhaven.game.s.sites.filter(s => s.kind === 'town' || s.kind === undefined).map(s => ({ name: s.name, x: s.x, y: s.y })));
const seen = new Map(halls.map(h => [h.name, h]));
for (const t of towns) {
  if (!seen.has(t.name)) { await page.evaluate(([x, y]) => Object.assign(window.railhaven.game.s.camera, { x: (x + 0.5) * 32, y: (y + 0.5) * 32 }), [t.x, t.y]); await page.waitForTimeout(150); for (const h of await page.evaluate(() => window.railhaven.renderer.halls.map(h => ({ name: h.town.name, pop: h.town.pop ?? 0, cx: h.cx, cy: h.cy })))) seen.set(h.name, h); }
}
for (const h of seen.values()) {
  await page.evaluate(([x, y, zz]) => Object.assign(window.railhaven.game.s.camera, { x: (x + 0.5) * 32, y: (y + 0.5) * 32, z: zz }), [h.cx, h.cy, +z]);
  await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${h.pop}-${h.name.replace(/\s+/g, '-').toLowerCase()}.png` });
}
console.log([...seen.values()].map(h => `${h.name} ${h.pop}`).join(', '));
console.log(errors.join('\n') || 'no page errors');
await browser.close();
