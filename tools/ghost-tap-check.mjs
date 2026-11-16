// A finger tap on a town opens its card, and nothing on that new card gets pressed by the same tap.
// The browser follows a tap with its own click at the same spot; when the card's 🗺 Map of the area or ⬆ Grow button
// opened right under the finger, that click pressed it (bug reports 15 and 17).
// Usage: node tools/ghost-tap-check.mjs [save file] [town name]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const file = resolve(process.argv[2] || 'tests/saves/save-seb-2026-11-16-report17.txt'), name = process.argv[3] || 'Rookwell Haven';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
let fails = 0; const check = (ok, what) => { console.log(ok ? '✅' : '❌', what); if (!ok) fails++; };
for (const vp of [{ width: 412, height: 860 }, { width: 820, height: 900 }]) { // Razr folded and unfolded (side sheet)
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  // counts every click the page sees, before the game's own handlers
  await page.addInitScript(() => { window.__clicks = []; addEventListener('click', e => window.__clicks.push((e.target.closest?.('button')?.dataset.act) ?? e.target.tagName), true); });
  await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242'); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__g0 = window.railhaven.game; });
  const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'loadfile'; document.getElementById('card').appendChild(b); b.click(); })]);
  await ch.setFiles(file);
  await page.waitForFunction(() => window.railhaven.game !== window.__g0, null, { timeout: 60000 }); await page.waitForTimeout(800);
  // where the card's buttons sit, so the town can be put right under them
  const spots = await page.evaluate(name => { const R = window.railhaven, g = R.game, t = g.s.sites.find(s => s.name === name); g.s.money = Math.max(g.s.money, 50000); R.openCard({ kind: 'town', id: t.id });
    const out = {}; for (const a of ['areamap', 'upgrade']) { const e = document.querySelector(`#card [data-act=${a}]`); if (e) { const r = e.getBoundingClientRect(); out[a] = [r.left + r.width / 2, r.top + r.height / 2]; } } R.openCard(null); return out; }, name);
  for (const [act, [sx, sy]] of Object.entries(spots)) {
    const before = await page.evaluate(([name, sx, sy]) => { const R = window.railhaven, g = R.game, t = g.s.sites.find(s => s.name === name); R.openCard(null); R.tools.mode = 'pan'; R.tools.mapPv = null; const c = g.s.camera; c.z = 1.8; c.x = (t.x + 0.5) * 32 - (sx - innerWidth / 2) / c.z; c.y = (t.y + 0.5) * 32 - (sy - innerHeight / 2) / c.z; window.__clicks.length = 0; return { lvl: t.lvl ?? 0, maps: g.s.maps?.length ?? 0, money: g.s.money }; }, [name, sx, sy]);
    await page.waitForTimeout(300);
    const off = await page.evaluate(([name, sx, sy]) => { const g = window.railhaven.game, c = g.s.camera, t = g.s.sites.find(s => s.name === name); return Math.hypot(((t.x + 0.5) * 32 - c.x) * c.z + innerWidth / 2 - sx, ((t.y + 0.5) * 32 - c.y) * c.z + innerHeight / 2 - sy); }, [name, sx, sy]);
    const onMap = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', [sx, sy]);
    if (!onMap) { console.log(`➖ ${vp.width}px: ${name}'s card puts its ${act} button over the toolbar, where the map can't be tapped: skipped`); continue; }
    if (off > 20) { console.log(`➖ ${vp.width}px: the map can't scroll ${name} under its card's ${act} button (edge of the map): skipped`); continue; }
    await page.touchscreen.tap(sx, sy); await page.waitForTimeout(500);
    const s = await page.evaluate(name => { const R = window.railhaven, g = R.game, T = R.tools, t = g.s.sites.find(s => s.name === name); return { mode: T.mode, circle: !!T.mapPv, card: T.card ? `${T.card.kind} ${T.card.id}` : null, town: t.id, lvl: t.lvl ?? 0, maps: g.s.maps?.length ?? 0, money: g.s.money, clicks: window.__clicks.slice() }; }, name);
    check(s.mode === 'pan' && !s.circle && s.card === `town ${s.town}` && s.lvl === before.lvl && s.maps === before.maps,
      `${vp.width}px: tap on ${name} where its card's ${act === 'upgrade' ? '⬆ Grow' : '🗺 Map of the area'} button opens → only the card opens (mode ${s.mode}, map circle ${s.circle}, card ${s.card}, level ${before.lvl}→${s.lvl}, clicks seen: ${s.clicks.join(',') || 'none'})`);
    await page.screenshot({ path: `shots/ghost-tap-${vp.width}-${act}.png` });
  }
  if (spots.upgrade) { // a real tap on the open card's ⬆ Grow still works
    const [sx, sy] = spots.upgrade, l0 = await page.evaluate(name => window.railhaven.game.s.sites.find(s => s.name === name).lvl ?? 0, name);
    const [ux, uy] = await page.evaluate(() => { const r = document.querySelector('#card [data-act=upgrade]')?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : [0, 0]; });
    if (ux) { await page.touchscreen.tap(ux, uy); await page.waitForTimeout(400); }
    const l1 = await page.evaluate(name => window.railhaven.game.s.sites.find(s => s.name === name).lvl ?? 0, name);
    check(ux && l1 === l0 + 1, `${vp.width}px: a real tap on the card's ⬆ Grow still grows ${name} (level ${l0}→${l1})`);
  }
  if (errors.length) { console.log(errors.join('\n')); fails++; }
  await page.close();
}
console.log(fails ? `${fails} failed` : 'all passed');
await browser.close();
process.exit(fails ? 1 : 0);
