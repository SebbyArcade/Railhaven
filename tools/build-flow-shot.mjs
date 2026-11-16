// Rails and Build through real touches: a line stays put while you scroll; the tool closes after ✓ Build with 🛤 Keep building.
// Usage: node tools/build-flow-shot.mjs [seed]  → shots/flow-*.png
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + (process.argv[2] || 4242));
await page.waitForTimeout(400);
const st = () => page.evaluate(() => { const R = window.railhaven, T = R.tools, g = R.game; return { card: T.card?.kind, mode: T.mode, plan: T.plan?.path ?? null, bar: T.bar(), cam: [g.s.camera.x, g.s.camera.y], track: g.track.size }; });
// screen point of square (x, y) of Ashford + (dx, dy)
const at = (dx, dy) => page.evaluate(([dx, dy]) => { const g = window.railhaven.game, a = g.s.sites[0], c = g.s.camera, cv = document.querySelector('canvas').getBoundingClientRect(); return [cv.left + cv.width / 2 + ((a.x + dx + 0.5) * 32 - c.x) * c.z, cv.top + cv.height / 2 + ((a.y + dy + 0.5) * 32 - c.y) * c.z]; }, [dx, dy]);
const drag = async (pts) => { const [x0, y0] = await pts[0]; await page.mouse.move(x0, y0); await page.mouse.down(); for (const p of pts.slice(1)) { const [x, y] = await p; await page.mouse.move(x, y, { steps: 6 }); } await page.mouse.up(); };
await page.evaluate(() => { const g = window.railhaven.game, a = g.s.sites[0]; g.s.money = 1e5; g.s.tut = 0; g.s.camera.x = (a.x + 3) * 32; g.s.camera.y = (a.y + 2) * 32; g.s.camera.z = 1.8; window.railhaven.openCard(null); });
await page.click('#bar [data-mode="rail"]');
await drag([at(0, 0), at(1, 0), at(2, 0), at(3, 0), at(4, 0)]);
console.log('drawn', JSON.stringify(await st()));
await page.click('#ok'); await page.waitForTimeout(300);
const s1 = await st(); console.log('after build', JSON.stringify(s1));
await page.screenshot({ path: 'shots/flow-1-keep-building.png' });
await page.click('#ok'); await page.waitForTimeout(200); // 🛤 Keep building
await drag([at(4, 0), at(4, 1), at(4, 2), at(4, 3)]);
const s2 = await st(); console.log('second line', JSON.stringify(s2));
await drag([at(2, 0), at(3, -1), at(4, -2)]); // a scroll that starts on built track
const s3 = await st(); console.log('after scroll on track', JSON.stringify(s3));
await page.waitForTimeout(200); await page.screenshot({ path: 'shots/flow-2-line-kept.png' });
const [tx, ty] = await at(1, 1); await page.mouse.click(tx, ty); // a tap just beside built track
const s4 = await st(); console.log('after tap beside track', JSON.stringify(s4));
await page.click('#ok'); await page.waitForTimeout(200); console.log('built 2', JSON.stringify(await st()));
await page.waitForTimeout(9000); console.log('offer gone', JSON.stringify(await st()));
await page.screenshot({ path: 'shots/flow-3-closed.png' });
await page.click('#cancel').catch(() => {}); await page.evaluate(() => window.railhaven.openCard(null));
await page.click('#buildBtn'); await page.click('#buildMenu [data-k="wood"]'); await page.waitForTimeout(200);
await page.click('#ok'); await page.waitForTimeout(300);
const s5 = await st(); console.log('after lumber camp', JSON.stringify(s5));
await page.screenshot({ path: 'shots/flow-4-building.png' });
await page.click('#ok'); await page.waitForTimeout(200); const s6 = await st(); console.log('lay its track', JSON.stringify(s6));
const ok = s5.mode === 'pan' && /Lay its track|Build more/.test(s5.bar?.ok) && (s6.mode === 'rail' || s6.card === undefined) && s1.mode === 'pan' && s1.bar?.ok === '🛤 Keep building' && JSON.stringify(s3.plan) === JSON.stringify(s2.plan) && s3.cam[0] !== s2.cam[0] && s4.plan[0] === s2.plan[0];
console.log(ok ? 'PASS' : 'FAIL');
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
if (!ok) process.exit(1);
