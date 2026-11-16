// Remove many track squares at once, through real touches: taps pick, a drag along the track picks a run, one ✂ removes them all.
// Usage: node tools/remove-many-shot.mjs [seed]  → shots/remove-many-*.png
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + (process.argv[2] || 4242));
await page.waitForTimeout(400);
const st = () => page.evaluate(() => { const R = window.railhaven, T = R.tools, g = R.game; return { mode: T.mode, picked: T.rm.size, bar: T.bar(), cam: [g.s.camera.x, g.s.camera.y], track: g.track.size, money: g.s.money }; });
const at = (dx, dy) => page.evaluate(([dx, dy]) => { const g = window.railhaven.game, a = g.s.sites[0], c = g.s.camera, cv = document.querySelector('canvas').getBoundingClientRect(); return [cv.left + cv.width / 2 + ((a.x + dx + 0.5) * 32 - c.x) * c.z, cv.top + cv.height / 2 + ((a.y + dy + 0.5) * 32 - c.y) * c.z]; }, [dx, dy]);
const drag = async (pts) => { const [x0, y0] = await pts[0]; await page.mouse.move(x0, y0); await page.mouse.down(); for (const p of pts.slice(1)) { const [x, y] = await p; await page.mouse.move(x, y, { steps: 6 }); } await page.mouse.up(); };
const tap = async (p) => { const [x, y] = await p; await page.mouse.click(x, y); };
await page.evaluate(() => { const g = window.railhaven.game, a = g.s.sites[0]; g.s.money = 1e5; g.s.tut = 0; g.s.camera.x = (a.x + 3) * 32; g.s.camera.y = (a.y + 2) * 32; g.s.camera.z = 1.8; window.railhaven.openCard(null); });
// an L of track from Ashford: 5 east, then 4 south
await page.click('#bar [data-mode="rail"]');
await drag([at(0, 0), at(1, 0), at(2, 0), at(3, 0), at(4, 0), at(5, 0), at(5, 1), at(5, 2), at(5, 3), at(5, 4)]);
await page.click('#ok'); await page.waitForTimeout(300);
const s0 = await st(); console.log('built', JSON.stringify(s0));
await page.click('#bar [data-mode="remove"]'); await page.waitForTimeout(100);
await tap(at(5, 4)); await tap(at(5, 3)); // two taps
const s1 = await st(); console.log('two taps', JSON.stringify(s1));
await drag([at(5, 2), at(5, 0), at(3, 0)]); // a drag along the track
await page.waitForTimeout(200);
const s2 = await st(); console.log('drag', JSON.stringify(s2));
await page.screenshot({ path: 'shots/remove-many-1-picked.png' });
await tap(at(3, 0)); // drop one again
const s3 = await st(); console.log('tap to drop', JSON.stringify(s3));
await drag([at(1, 3), at(3, 5)]); // a drag off the track pans
const s4 = await st(); console.log('pan', JSON.stringify(s4));
await page.click('#ok'); await page.waitForTimeout(300);
const s5 = { ...(await st()), gone: await page.evaluate(() => { const g = window.railhaven.game, a = g.s.sites[0], n = g.world.n; return [[5, 4], [5, 3], [5, 2], [5, 1], [5, 0], [4, 0]].every(([x, y]) => !g.track.has((a.y + y) * n + a.x + x)) && g.track.has(a.y * n + a.x + 3); }) }; console.log('removed', JSON.stringify(s5));
await page.screenshot({ path: 'shots/remove-many-2-removed.png' });
const ok = s1.picked === 2 && s2.picked === 7 && s3.picked === 6 && s4.picked === 6 && s4.cam[0] !== s3.cam[0] && s5.picked === 0 && s5.mode === 'remove' && s5.money === s4.money && s5.track <= s0.track - 6 && s5.gone;
console.log(ok ? 'PASS' : 'FAIL');
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
if (!ok) process.exit(1);
