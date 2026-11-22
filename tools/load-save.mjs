// Load a save file (old-game JSON or a RAILHAVEN3 code) into dist/index.html in headless Chromium.
import { chromium } from 'playwright';
import { resolve } from 'node:path';
export async function load(file, vp = { width: 412, height: 860 }, extra = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, hasTouch: true, ...extra });
  page.on('pageerror', e => console.log('ERR', String(e)));
  await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242');
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__g0 = window.railhaven.game; });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'loadfile'; document.getElementById('card').appendChild(b); b.click(); })]);
  await chooser.setFiles(resolve(file));
  await page.waitForFunction(() => window.railhaven.game !== window.__g0, null, { timeout: 60000 });
  await page.waitForTimeout(800); await page.evaluate(() => window.railhaven.openCard(null));
  return { browser, page };
}
