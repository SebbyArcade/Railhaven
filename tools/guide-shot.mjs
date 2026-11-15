// The outline beside the end of a line: on the line (fits, joins it), across it (red squares named), then 📍 Fit. Usage: node tools/guide-shot.mjs [seed]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + (process.argv[2] || 4242));
await page.waitForTimeout(300);
// a line 8 squares west of Ashford, painted like a player
await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0];
  T.setMode('rail'); T.dragStart(a.y * n + a.x); for (let k = 1; k <= 8; k++) T.dragOver(a.y * n + a.x - k); T.confirm(); T.setMode('pan');
  g.s.camera.x = (a.x - 6) * 32; g.s.camera.y = a.y * 32; g.s.camera.z = 1.6;
});
await page.click('#buildBtn'); await page.waitForTimeout(200);
await page.click('#buildMenu button[data-k="farm"]'); await page.waitForTimeout(300);
const show = async (name, place) => {
  const r = await page.evaluate(p => { const R = window.railhaven, T = R.tools, a = R.game.s.sites[0]; if (p) T['setPreview']({ kind: 'farm', x: a.x + p[0], y: a.y + p[1], horizontal: p[2], side: p[3] }); return { err: T.previewErr, bad: T.previewBad.size, bar: document.getElementById('ctext').textContent }; }, place);
  await page.waitForTimeout(1200); await page.screenshot({ path: `shots/guide-${name}.png` });
  console.log(name, JSON.stringify(r), await page.evaluate(() => document.getElementById('ctext').textContent));
};
await show('along', [-7, 0, true, -1]);   // yard on the line's last 4 squares: fits
await show('across', [-6, -2, false, 1]); // turned across it
await page.click('#near'); await page.waitForTimeout(300);
await show('fit', null);
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
