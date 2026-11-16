// Lightning on his report-8 save: a strike looking at the storm, the same moment in his own view (storm off screen).
// Usage: node tools/lightning-shot.mjs [save]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2] ?? 'tests/saves/save-seb-2026-11-16c.json';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => {
  localStorage.setItem('railhaven2', s);
  const raf = window.requestAnimationFrame.bind(window); // a frame clock the script can hold still
  window.requestAnimationFrame = cb => raf(t => cb(window.__fixT ?? t));
}, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
const { strike, calm, cam } = await page.evaluate(() => {
  const r = window.railhaven, g = r.game; r.openCard(null);
  const cam = { ...g.s.camera };
  return { strike: 107.4, calm: 105.4, cam };
});
const shot = async (tm, look, path) => {
  await page.evaluate(([tm, look]) => { const c = window.railhaven.game.s.camera; Object.assign(c, look); window.__fixT = tm * 1000; }, [tm, look]);
  await page.waitForTimeout(400); await page.screenshot({ path });
};
const st = await page.evaluate(() => window.railhaven.game.s.storm);
const atStorm = { x: st.x * 32, y: st.y * 32, z: 1.3 };
await shot(calm, atStorm, 'shots/lightning-calm.png');
await shot(strike, atStorm, 'shots/lightning-strike.png');
await shot(strike, cam, 'shots/lightning-his-view.png');
console.log('strike at', strike, errors.join('\n') || 'no page errors');
await browser.close();
