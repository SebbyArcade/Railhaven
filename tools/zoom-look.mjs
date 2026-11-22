// Screenshots of a save at a few zooms (to compare drawing before/after). Usage: node tools/zoom-look.mjs out-prefix [save]
import { load } from './load-save.mjs';
const { browser, page } = await load(process.argv[3] || 'tests/saves/save-seb-2026-11-21-report20.txt');
for (const z of [0.55, 0.3, 0.1]) {
  await page.evaluate(z => { const g = window.railhaven.game, a = g.s.sites[0]; g.s.camera.z = z; g.s.camera.x = a.x * 32 + 16; g.s.camera.y = a.y * 32 + 16; }, z);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${process.argv[2]}-${z}.png` });
}
await browser.close();
