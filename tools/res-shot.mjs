// The ⛏ Resources map view on a save, near and far. Usage: node tools/res-shot.mjs save.json x y [html] [prefix]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file, x, y, html = 'dist/index.html', pre = 'res'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve(html));
await page.waitForTimeout(1500);
await page.evaluate(() => window.railhaven.openCard(null));
await page.click('#mapBtn'); await page.waitForTimeout(400);
await page.click('#card button[data-v="res"]'); await page.waitForTimeout(400);
for (const z of [1.15, 0.6, 0.3]) {
  await page.evaluate(([x, y, z]) => { const c = window.railhaven.game.s.camera; c.x = (+x + 0.5) * 32; c.y = (+y + 0.5) * 32; c.z = z; }, [x, y, z]);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `shots/${pre}-z${z}.png` });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
