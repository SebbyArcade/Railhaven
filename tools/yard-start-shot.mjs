// Rails from the end of a building not yet on the railway: the line starts at a gold end square, says "not joined yet"
// until it reaches your track, then builds and the building joins the railway.
// Usage: npm run build && node tools/yard-start-shot.mjs [seed]  → shots/yard-start-*.png
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + (process.argv[2] || 4242));
await page.waitForTimeout(400);
const st = () => page.evaluate(() => { const R = window.railhaven, T = R.tools, g = R.game; return { mode: T.mode, plan: T.plan?.path ?? null, bar: T.bar(), track: g.track.size }; });
const sq = i => page.evaluate(i => { const g = window.railhaven.game, n = g.world.n, c = g.s.camera, cv = document.querySelector('canvas').getBoundingClientRect(); return [cv.left + cv.width / 2 + ((i % n + 0.5) * 32 - c.x) * c.z, cv.top + cv.height / 2 + (((i / n) | 0) + 0.5) * 32 * c.z - c.y * c.z]; }, i);
const drag = async (ids) => { const [x0, y0] = await sq(ids[0]); await page.mouse.move(x0, y0); await page.mouse.down(); for (const i of ids.slice(1)) { const [x, y] = await sq(i); await page.mouse.move(x, y, { steps: 5 }); } await page.mouse.up(); };
await page.evaluate(() => { const g = window.railhaven.game, a = g.s.sites[0]; g.s.money = 1e5; g.s.tut = 0; g.s.camera.x = (a.x + 2) * 32; g.s.camera.y = (a.y + 1) * 32; g.s.camera.z = 1.4; window.railhaven.openCard(null); });
const A = await page.evaluate(() => { const g = window.railhaven.game, a = g.s.sites[0]; return a.y * g.world.n + a.x; }), n = await page.evaluate(() => window.railhaven.game.world.n);
await page.click('#bar [data-mode="rail"]');
await drag([A, A + 1, A + 2, A + 3, A + 4]); await page.click('#ok'); await page.waitForTimeout(300);
await page.click('#cancel').catch(() => {}); await page.evaluate(() => window.railhaven.openCard(null));
await page.click('#buildBtn'); await page.click('#buildMenu [data-k="wood"]'); await page.waitForTimeout(200);
await page.click('#ok'); await page.waitForTimeout(300); await page.click('#cancel').catch(() => {});
const b = await page.evaluate(() => { const g = window.railhaven.game, b = g.s.buildings.at(-1); return { x: b.x, y: b.y, horizontal: b.horizontal, len: b.len ?? 4 }; });
const ys = []; for (let k = 0; k < b.len; k++) ys.push(b.horizontal ? b.y * n + b.x + k : (b.y + k) * n + b.x);
const st1 = b.horizontal ? 1 : n, golds = [ys[0] - st1, ys.at(-1) + st1];
const tip = A + 4, d = i => Math.abs(i % n - tip % n) + Math.abs(((i / n) | 0) - ((tip / n) | 0));
const gold = golds.sort((p, q) => d(p) - d(q))[0];
console.log('building', JSON.stringify(b), 'gold', gold % n - A % n, ((gold / n) | 0) - ((A / n) | 0));
await page.evaluate(([x, y]) => { const c = window.railhaven.game.s.camera; c.x = x * 32; c.y = y * 32; }, [(gold % n + tip % n) / 2, (((gold / n) | 0) + ((tip / n) | 0)) / 2]);
await page.click('#bar [data-mode="rail"]'); await page.waitForTimeout(200);
await page.screenshot({ path: 'shots/yard-start-1-gold.png' });
// the route: on out of the yard one square, across the yard's way, then along to the tip
const out = gold + (gold === golds[0] ? -st1 : st1) * 0;
const path = [out]; let cur = out;
const step = (to) => { while (cur !== to) { const cx = cur % n, cy = (cur / n) | 0, tx = to % n, ty = (to / n) | 0; cur = b.horizontal ? (cy !== ty ? cur + Math.sign(ty - cy) * n : cur + Math.sign(tx - cx)) : (cx !== tx ? cur + Math.sign(tx - cx) : cur + Math.sign(ty - cy) * n); path.push(cur); } };
step(tip);
await drag(path.slice(0, 2));
const s1 = await st(); console.log('half way', JSON.stringify(s1.bar), 'plan', s1.plan?.length);
await page.screenshot({ path: 'shots/yard-start-2-not-joined.png' });
const [x, y] = await sq(tip); await page.mouse.click(x, y);
const s2 = await st(); console.log('reached', JSON.stringify(s2.bar));
await page.screenshot({ path: 'shots/yard-start-3-joined.png' });
await page.evaluate(() => window.railhaven.openCard(null)); await page.click('#ok'); await page.waitForTimeout(400);
const linked = await page.evaluate(() => { const g = window.railhaven.game, b = g.s.buildings.at(-1), n = g.world.n; return g.linked.has(b.horizontal ? b.y * n + b.x : b.y * n + b.x); });
await page.click('#cancel').catch(() => {}); await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/yard-start-4-built.png' });
const ok = /Not joined yet/.test(s1.bar?.text) && s1.bar?.can === false && s2.bar?.can === true && linked;
console.log('linked', linked, ok ? 'PASS' : 'FAIL');
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
if (!ok) process.exit(1);
