// 🗺 Map mode zooms far out: a tap on a town's square, its ⬆ / order badge above it or its name opens the town card
// (never moves the map circle), a tap on open land still moves the circle, and ✓ Buy needs a second tap.
// Usage: node tools/town-tap-check.mjs [save file: an old-game save or a RAILHAVEN3 code]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const file = resolve(process.argv[2] || 'tests/saves/save-seb-2026-11-16-report15.txt');
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242');
await page.waitForTimeout(800);
await page.evaluate(() => { window.__g0 = window.railhaven.game; });
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'loadfile'; document.getElementById('card').appendChild(b); b.click(); })]);
await chooser.setFiles(file);
await page.waitForFunction(() => window.railhaven.game !== window.__g0, null, { timeout: 60000 });
await page.waitForTimeout(800); await page.evaluate(() => window.railhaven.openCard(null));
// towns on the railway, upgradable (⬆) ones first
const towns = await page.evaluate(() => { const R = window.railhaven, g = R.game; g.s.money = Math.max(g.s.money, 30000); return g.s.sites.filter(s => s.kind === 'town' && (s.pop ?? 0) > 0 && g.linked).map(s => ({ id: s.id, x: s.x, y: s.y, name: s.name })); });
const state = () => page.evaluate(() => { const t = window.railhaven.tools; return { mode: t.mode, circle: t.mapPv ? `${t.mapPv.x},${t.mapPv.y}` : null, card: t.card ? `${t.card.kind} ${t.card.id}` : null, z: +window.railhaven.game.s.camera.z.toFixed(2) }; });
const scr = (wx, wy) => page.evaluate(([wx, wy]) => { const c = window.railhaven.game.s.camera; return [(wx - c.x) * c.z + innerWidth / 2, (wy - c.y) * c.z + innerHeight / 2]; }, [wx, wy]);
let fails = 0; const check = (ok, what) => { console.log(ok ? '✅' : '❌', what); if (!ok) fails++; };
const openMapFrom = async t => {
  await page.evaluate(id => window.railhaven.openCard({ kind: 'town', id }), t.id); await page.waitForTimeout(250);
  await page.click('[data-act=areamap]'); await page.waitForTimeout(300); // zooms out to fit the circle, as in the game
  await page.evaluate(([x, y]) => { const c = window.railhaven.game.s.camera; c.x = x * 32 + 16; c.y = y * 32 + 16 + 150; }, [t.x, t.y]); await page.waitForTimeout(200);
};
for (const t of towns.slice(0, 6)) {
  for (const [label, dx, dy] of [['its square', 0.5, 0.5], ['its ⬆ / order badge', 0.5, -1.1], ['its name', 0.5, 1.9]]) {
    await openMapFrom(t);
    const [sx, sy] = await scr((t.x + dx) * 32, (t.y + dy) * 32);
    await page.touchscreen.tap(sx, sy); await page.waitForTimeout(300);
    const s = await state(); check(s.mode === 'pan' && !s.circle && s.card === `town ${t.id}`, `map mode at zoom ${s.z}: tap on ${t.name}'s ${label.replace('its ', '')} opens its card (${JSON.stringify(s)})`);
    if (label.includes('badge') && t === towns[0]) await page.screenshot({ path: 'shots/town-tap-badge.png' });
    await page.evaluate(() => { const T = window.railhaven.tools; T.mapPv = null; T.mode = 'pan'; window.railhaven.openCard(null); });
  }
}
// open land still moves the circle; ✓ Buy needs two taps
const a = towns[0]; await openMapFrom(a);
const land = await page.evaluate(([x, y]) => { const g = window.railhaven.game, n = g.world.n; for (let r = 8; r < 16; r++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + r, i = Y * n + X; if (!g.track.has(i) && !g.s.sites.some(s => Math.abs(s.x - X) <= 4 && Math.abs(s.y - Y) <= 4) && !g.s.buildings?.some(b => Math.abs(b.x - X) <= 5 && Math.abs(b.y - Y) <= 5)) return [X, Y]; } return null; }, [a.x, a.y]);
const s0 = await state();
if (land) { const [sx, sy] = await scr((land[0] + 0.5) * 32, (land[1] + 0.5) * 32); await page.touchscreen.tap(sx, sy); await page.waitForTimeout(300); const s1 = await state(); check(s1.mode === 'map' && s1.circle && s1.circle !== s0.circle && !s1.card, `tap on open land moves the circle (${JSON.stringify(s1)})`); }
const m0 = await page.evaluate(() => window.railhaven.game.s.maps?.length ?? 0);
await page.click('#ok'); await page.waitForTimeout(300);
const t1 = await page.textContent('#ok'), m1 = await page.evaluate(() => window.railhaven.game.s.maps?.length ?? 0);
check(m1 === m0 && /Tap again/.test(t1), `first ✓ Buy tap buys nothing and asks again ("${t1}")`);
await page.screenshot({ path: 'shots/town-tap-buy-armed.png' });
await page.waitForTimeout(4300);
const t2 = await page.textContent('#ok'); check(/^✓ Buy/.test(t2), `after 4 s the button goes back to "${t2}"`);
await page.click('#ok'); await page.waitForTimeout(200); await page.click('#ok'); await page.waitForTimeout(300);
const m2 = await page.evaluate(() => window.railhaven.game.s.maps?.length ?? 0), s2 = await state();
check(m2 === m0 + 1 && s2.mode === 'pan', `two taps buy the map (${m0} → ${m2} maps, mode ${s2.mode})`);
// pan mode, zoomed out: a ⬆ / order badge opens the town too
await page.evaluate(([x, y]) => { const c = window.railhaven.game.s.camera; c.x = x * 32 + 16; c.y = y * 32 + 16; c.z = 0.3; }, [a.x, a.y]); await page.waitForTimeout(200);
{ const [sx, sy] = await scr((a.x + 0.5) * 32, (a.y - 1.1) * 32); await page.touchscreen.tap(sx, sy); await page.waitForTimeout(300); const s = await state(); check(s.card === `town ${a.id}`, `zoomed out, tap on ${a.name}'s badge opens its card (${JSON.stringify(s)})`); }
console.log(errors.join('\n') || 'no page errors', '·', fails ? `${fails} failed` : 'all passed');
await browser.close();
process.exit(fails ? 1 : 0);
