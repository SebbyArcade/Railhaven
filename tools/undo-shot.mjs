// Build mode on a new map: corner turn arrows, double-tap to build, Undo takes it back. Usage: node tools/undo-shot.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242');
await page.waitForTimeout(1500);
await page.evaluate(() => { window.railhaven.game.s.tut = undefined; window.railhaven.openCard(null); });
await page.click('#buildBtn'); await page.waitForTimeout(300);
await page.click('#buildMenu button[data-k="wood"]'); await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/undo-1-arrows.png' });
// screen point of a world square
const at = sq => page.evaluate(sq => { const g = window.railhaven.game, n = g.world.n, c = g.s.camera, v = { w: innerWidth, h: innerHeight };
  return [((sq % n + 0.5) * 32 - c.x) * c.z + v.w / 2, ((Math.floor(sq / n) + 0.5) * 32 - c.y) * c.z + v.h / 2]; }, sq);
const state = () => page.evaluate(() => { const t = window.railhaven.tools, p = t.preview; return p && { h: p.horizontal, side: p.side, x: p.x, y: p.y }; });
const before = await state();
const corner = await page.evaluate(() => { const t = window.railhaven.tools, p = t.preview, n = window.railhaven.game.world.n;
  const f = []; for (let i = 0; i < 4; i++) for (const r of [0, 1]) {} return null; });
// the top-left corner square: one up and one left of the footprint
const tl = await page.evaluate(() => { const t = window.railhaven.tools, p = t.preview, n = window.railhaven.game.world.n;
  const xs = [], ys = []; const h = p.horizontal; for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) { const x = p.x + (h ? a : (p.side > 0 ? b : -b)), y = p.y + (h ? (p.side > 0 ? b : -b) : a); xs.push(x); ys.push(y); }
  return (Math.min(...ys) - 1) * n + Math.min(...xs) - 1; });
const [tx, ty] = await at(tl); await page.mouse.click(tx, ty); await page.waitForTimeout(500);
const turned = await state();
await page.screenshot({ path: 'shots/undo-2-turned.png' });
// double-tap the middle of the outline to build
const mid = await page.evaluate(() => { const p = window.railhaven.tools.preview, n = window.railhaven.game.world.n; return (p.y + (p.horizontal ? 0 : 1)) * n + p.x + (p.horizontal ? 1 : 0); });
const m0 = await page.evaluate(() => window.railhaven.game.s.money);
const [mx, my] = await at(mid); await page.mouse.click(mx, my); await page.waitForTimeout(120); await page.mouse.click(mx, my); await page.waitForTimeout(600);
const built = await page.evaluate(() => ({ n: window.railhaven.game.s.buildings.length, money: window.railhaven.game.s.money, undo: getComputedStyle(document.querySelector('#undo')).display }));
await page.screenshot({ path: 'shots/undo-3-built.png' });
await page.click('#undo'); await page.waitForTimeout(600);
const undone = await page.evaluate(() => ({ n: window.railhaven.game.s.buildings.length, money: window.railhaven.game.s.money }));
console.log(JSON.stringify({ before, turned, m0, built, undone }), errors.join('\n') || 'no page errors');
await browser.close();
