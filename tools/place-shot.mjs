// Pick the Coal Mine in the Build menu, check the outline appears, drag it by touch, turn it. Usage: node tools/place-shot.mjs [seed]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + (process.argv[2] || 4242));
await page.waitForTimeout(300);
await page.click('#buildBtn'); await page.waitForTimeout(200);
await page.click('#buildMenu button[data-k="coal"]'); await page.waitForTimeout(500);
const info = () => page.evaluate(() => { const T = window.railhaven.tools; return { p: T.preview, err: T.previewErr, bar: document.getElementById('ctext').textContent, toast: document.getElementById('toast').textContent }; });
console.log('after choosing:', JSON.stringify(await info()));
await page.screenshot({ path: 'shots/place-1.png' });
// drag the outline 3 squares left with the mouse (same pointer events as a finger)
const toScreen = (x, y) => page.evaluate(([x, y]) => { const c = window.railhaven.game.s.camera; return [(x * 32 - c.x) * c.z + innerWidth / 2, (y * 32 - c.y) * c.z + innerHeight / 2]; }, [x, y]);
const p = (await info()).p, bx = p.horizontal ? p.x + 1.5 : p.x + p.side + 0.5, by = p.horizontal ? p.y + p.side + 0.5 : p.y + 1.5;
const [sx, sy] = await toScreen(bx, by), [ex, ey] = await toScreen(bx - 3, by);
await page.mouse.move(sx, sy); await page.mouse.down(); for (let k = 1; k <= 10; k++) await page.mouse.move(sx + (ex - sx) * k / 10, sy + (ey - sy) * k / 10); await page.mouse.up();
await page.waitForTimeout(300);
console.log('after drag:', JSON.stringify(await info()));
await page.screenshot({ path: 'shots/place-2.png' });
await page.click('#turn'); await page.waitForTimeout(300);
console.log('after turn:', JSON.stringify(await info()));
await page.screenshot({ path: 'shots/place-3.png' });
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
