// Screenshot the built game (dist/index.html) at phone sizes. Usage: node tools/shots.mjs [outDir] [query]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] || 'shots'), query = process.argv[3] || '?new&seed=4242';
mkdirSync(out, { recursive: true });
const url = 'file://' + resolve('dist/index.html') + query;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
const sizes = { phone: [412, 915], unfolded: [884, 1104] };
const errors = [];
for (const [name, [w, h]] of Object.entries(sizes)) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url); await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${name}-near.png` });
  await page.evaluate(() => { window.railhaven.game.s.camera.z = 0.35; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-far.png` });
  await page.close();
}
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('shots in', out);
