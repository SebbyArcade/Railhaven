// The 👁 Map views on a rebuild save. Usage: node tools/views-shot.mjs save.json
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
if (file) await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html') + (file ? '' : '?new&seed=4242'));
await page.waitForTimeout(1500);
await page.evaluate(() => { window.railhaven.openCard(null); window.railhaven.step(20); const c = window.railhaven.game.s.camera; c.z = 0.9; });
await page.click('#mapBtn'); await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/view-menu.png' });
await page.fill('#mapQ', 'steel'); await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/view-search.png' });
for (const v of ['prob', 'dem', 'res', 'exp']) {
  if (!(await page.isVisible('#card'))) await page.click('#mapBtn');
  await page.waitForTimeout(300);
  await page.click(`#card button[data-v="${v}"]`); await page.waitForTimeout(1300);
  await page.screenshot({ path: `shots/view-${v}.png` });
}
await page.click('#viewTag button'); await page.waitForTimeout(300);
console.log(await page.evaluate(() => String(window.railhaven.tools.view)), errors.join('\n') || 'no page errors');
await browser.close();
