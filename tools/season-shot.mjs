// The four seasons on a save. Usage: node tools/season-shot.mjs save.json
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 560 }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
if (file) await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html') + (file ? '' : '?new&seed=4242'));
await page.waitForTimeout(1500);
for (let se = 0; se < 4; se++) {
  await page.evaluate(se => { const r = window.railhaven, g = r.game; r.openCard(null); g.s.t = Math.floor(g.s.t / 480) * 480 + se * 120 + 30; const a = g.s.sites[0]; g.s.camera.x = (a.x + 4) * 32; g.s.camera.y = (a.y - 3) * 32; g.s.camera.z = 1.4; }, se);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `shots/season-${se}.png` });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
