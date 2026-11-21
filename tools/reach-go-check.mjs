// "Reach <island>" Go › must never move the map onto an island still in the fog (bug report 20: it showed Duskwater).
// Usage: node tools/reach-go-check.mjs [save]
import { load } from './load-save.mjs';
const { browser, page } = await load(process.argv[2] || 'tests/saves/save-seb-2026-11-21-report20.txt');
const m = await page.evaluate(() => document.getElementById('mission').innerText);
console.log('mission:', m.replace(/\n/g, ' '));
await page.click('#mission button[data-go]'); await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  const g = window.railhaven.game, n = g.world.n, c = g.s.camera, x = Math.floor(c.x / 32), y = Math.floor(c.y / 32), i = y * n + x;
  return { at: [x, y], revealed: !!((g.s.fog[i >> 3] >> (i & 7)) & 1), card: window.railhaven.tools.card, toast: document.getElementById('toast')?.innerText };
});
console.log(r);
console.log(r.revealed ? '✅ the map shows uncovered land, not the fog' : '❌ the map moved into the fog');
await page.screenshot({ path: 'shots/reach-go.png' });
await browser.close();
process.exit(r.revealed ? 0 : 1);
