// Shed card and building card buttons. Usage: node tools/cards-shot.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0], A = a.y * n + a.x;
  g.s.money = 50000; T.mode = 'rail'; T.cancel(); T.tapSquare(A); T.tapSquare(A + 6); T.confirm(); T.mode = 'pan'; T.cancel();
  T.chooseBuild('wood'); T.confirm(); T.mode = 'pan'; T.cancel(); T.buildKind = null;
  g.s.buildings[0].stock = 60;
  R.openCard({ kind: 'shed', id: 0 });
});
await page.waitForTimeout(600); await page.screenshot({ path: 'shots/card-shed.png' });
await page.evaluate(() => { const R = window.railhaven; R.openCard({ kind: 'bld', id: R.game.s.buildings[0].id }); });
await page.waitForTimeout(600);
await page.click('#card button[data-act="remove"]'); await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/card-bld.png' });
await page.evaluate(() => { const R = window.railhaven; R.openCard({ kind: 'town', id: R.game.s.sites[0].id }); });
await page.waitForTimeout(600); await page.screenshot({ path: 'shots/card-town.png' });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
