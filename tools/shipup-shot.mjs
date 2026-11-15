// A cargo ship's card and a dock's sea page with the ship upgrades, on a save. Usage: node tools/shipup-shot.mjs [save]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2] ?? 'shots/s14.json';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('railhaven2', s), readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const r = window.railhaven, g = r.game; g.found = []; g.s.ms.actNew = false;
  g.s.shipU = { spd: 1, hold: 2 }; g.s.money = Math.max(g.s.money, 30000);
  const s = g.s.ships[0]; r.openCard({ kind: 'ship', id: s.id });
  return `${g.s.ships.length} ships`;
});
await page.waitForTimeout(600); await page.screenshot({ path: 'shots/ship-card.png' });
// buy the next Faster ships level by tapping it
await page.evaluate(() => { const g = window.railhaven.game, d = g.s.buildings.find(b => b.kind === 'dock'); window.railhaven.openCard({ kind: 'bld', id: d.id, page: 'sea' }); });
await page.waitForTimeout(600);
await page.evaluate(() => document.querySelector('#card [data-act="shipup"]')?.scrollIntoView());
await page.screenshot({ path: 'shots/ship-ups.png' });
await page.click('#card [data-act="shipup"][data-k="spd"]'); await page.waitForTimeout(500);
const after = await page.evaluate(() => JSON.stringify(window.railhaven.game.s.shipU));
await page.screenshot({ path: 'shots/ship-ups-bought.png' });
console.log(info, 'after tap', after, errors.join('\n') || 'no page errors');
await browser.close();
