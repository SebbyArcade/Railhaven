// Missions: the Act 1 card on a new game, the mission bar, the story card, and Go ›. Usage: node tools/story-shot.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242');
await page.evaluate(() => { window.railhaven.game.s.tut = 99; }); // skip the lessons
await page.waitForTimeout(2500);
await page.screenshot({ path: 'shots/story-act.png' });
await page.click('#card button[data-act="close"]'); await page.waitForTimeout(1200);
console.log('pill:', await page.textContent('#mission'));
await page.click('#mission .mtext'); await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/story-card.png' });
await page.click('#card button[data-go="0"]'); await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/story-go.png' });
console.log('after Go: mode', await page.evaluate(() => window.railhaven.tools.mode), 'kind', await page.evaluate(() => window.railhaven.tools.buildKind));
// a later game: Railway level 1, a few missions done
await page.evaluate(() => { const R = window.railhaven, g = R.game; g.s.orders = 2; g.s.rlv = 1; g.s.money = 9000; R.tools.mode = 'pan'; R.tools.cancel(); R.step(3); R.openCard(null); });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/story-act2.png' });
await page.evaluate(() => window.railhaven.openCard({ kind: 'story', id: 0, page: 'isl' }));
await page.waitForTimeout(600); await page.screenshot({ path: 'shots/story-isl.png' });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
