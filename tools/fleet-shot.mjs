// Pictures of the 🚂 Your trains card (island rows, Buy 1 / Sell 1, a list page) and a 🔁 passing loop in Double mode.
// Usage: node tools/fleet-shot.mjs save.json outDir [loopX,loopY]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/fleet', loop = ''] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
await page.evaluate(() => { const R = window.railhaven; R.openCard(null); R.game.s.tipsOff = true; R.game.s.money = Math.max(R.game.s.money, 3000); R.step(20); });
await page.click('#bar [data-mode="train"]'); await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/fleet.png` });
await page.click('#card [data-act="sellon"]'); await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/fleet-sell-armed.png` });
await page.click('#card [data-act="buyon"]'); await page.waitForTimeout(700);
console.log('trains after buy:', await page.evaluate(() => window.railhaven.game.s.trains.length));
await page.click('#card [data-page]:not([data-kind="bld"])'); await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/fleet-list.png` });
if (loop) {
  const [x, y] = loop.split(',').map(Number);
  await page.evaluate(() => window.railhaven.openCard(null));
  await page.click('#bar [data-mode="double"]'); await page.waitForTimeout(300);
  await page.evaluate(([x, y]) => { const R = window.railhaven, g = R.game, n = g.world.n; g.s.camera.x = (x + 0.5) * 32; g.s.camera.y = (y + 0.5) * 32; g.s.camera.z = 1.6; R.tools.tapSquare(y * n + x); }, [x, y]);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/loop-marked.png` });
  await page.click('#ok'); await page.waitForTimeout(400);
  await page.evaluate(() => window.railhaven.step(30)); await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/loop-built.png` });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
