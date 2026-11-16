// The normal map zoomed out: what each building makes. Usage: node tools/make-shot.mjs save.json x y [html] [prefix]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file, x, y, html = 'dist/index.html', pre = 'make'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve(html));
await page.waitForTimeout(1500);
await page.evaluate(() => window.railhaven.openCard(null));
for (const z of [0.8, 0.55, 0.35, 0.22]) {
  await page.evaluate(([x, y, z]) => { const c = window.railhaven.game.s.camera; c.x = (+x + 0.5) * 32; c.y = (+y + 0.5) * 32; c.z = z; }, [x, y, z]);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `shots/${pre}-z${z}.png` });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
