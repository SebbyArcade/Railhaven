// 🗺 In Map mode, a tap on a town opens its card (not the map purchase); a tap on open land still moves the circle.
// Usage: node tools/map-tap-check.mjs [old save file]   (imports it through the Game card, as a player would)
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const file = resolve(process.argv[2] || 'tests/saves/save-seb-2026-11-14-live.json');
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242');
await page.waitForTimeout(800);
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'loadfile'; document.getElementById('card').appendChild(b); b.click(); })]);
await chooser.setFiles(file);
await page.waitForSelector('#card h2:text("Your game is here")', { timeout: 60000 });
await page.click('#card button[data-act="close"]'); await page.waitForTimeout(400);
const towns = await page.evaluate(() => { const g = window.railhaven.game; g.s.money = Math.max(g.s.money, 20000); return g.s.sites.filter(s => s.kind === 'town' && (s.pop ?? 0) > 0).map(s => ({ id: s.id, x: s.x, y: s.y, name: s.name })); });
const screenOf = (x, y) => page.evaluate(([x, y]) => { const c = window.railhaven.game.s.camera; return [(x * 32 + 16 - c.x) * c.z + innerWidth / 2, (y * 32 + 16 - c.y) * c.z + innerHeight / 2]; }, [x, y]);
const state = () => page.evaluate(() => { const t = window.railhaven.tools; return { mode: t.mode, circle: t.mapPv ? `${t.mapPv.x},${t.mapPv.y}` : null, card: t.card ? `${t.card.kind} ${t.card.id}` : null }; });
let fails = 0; const check = (ok, what) => { console.log(ok ? '✅' : '❌', what); if (!ok) fails++; };
for (const [a, b] of [[towns[0], towns[1]], [towns[1], towns[2] ?? towns[0]]]) {
  // open the town card, press 🗺 Map of the area, then tap the other town on screen
  await page.evaluate(id => window.railhaven.openCard({ kind: 'town', id }), a.id); await page.waitForTimeout(300);
  await page.click('[data-act=areamap]'); await page.waitForTimeout(400);
  await page.evaluate(([x, y]) => { const c = window.railhaven.game.s.camera; c.x = x * 32 + 16; c.y = y * 32 + 16; c.z = 1.2; }, [b.x, b.y]); await page.waitForTimeout(300);
  const s0 = await state(); check(s0.mode === 'map' && s0.circle, `map circle open from ${a.name} (${JSON.stringify(s0)})`);
  // open land first: the circle moves
  const land = await page.evaluate(([x, y]) => { const g = window.railhaven.game, n = g.world.n; for (let r = 3; r < 9; r++) for (let dx = -r; dx <= r; dx++) { const i = (y + r) * n + x + dx; if (!g.track.has(i) && !g.s.sites.some(s => Math.abs(s.x - (x + dx)) <= 1 && Math.abs(s.y - (y + r)) <= 1) && !g.s.buildings?.some(b => Math.abs(b.x - (x + dx)) <= 4 && Math.abs(b.y - (y + r)) <= 4)) return [x + dx, y + r]; } return null; }, [b.x, b.y]);
  if (land) { const [sx, sy] = await screenOf(...land); await page.touchscreen.tap(sx, sy); await page.waitForTimeout(300); const s1 = await state(); check(s1.mode === 'map' && s1.circle !== s0.circle && !s1.card, `tap on open land near ${b.name} moves the circle (${JSON.stringify(s1)})`); }
  const [sx, sy] = await screenOf(b.x, b.y); await page.touchscreen.tap(sx, sy); await page.waitForTimeout(400);
  const s2 = await state(); check(s2.mode === 'pan' && !s2.circle && s2.card === `town ${b.id}`, `tap on ${b.name} opens its card (${JSON.stringify(s2)})`);
  await page.screenshot({ path: `shots/map-tap-${b.id}.png` });
  await page.evaluate(() => window.railhaven.openCard(null));
}
console.log(errors.join('\n') || 'no page errors', '·', fails ? `${fails} failed` : 'all passed');
await browser.close();
