// The ⭐ recommended build in the Build menu, and a landmark's discovery card, on a save. Usage: node tools/find-shot.mjs [save]
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
await page.evaluate(() => { const r = window.railhaven; r.openCard(null); r.game.s.ms.actNew = false; });
await page.click('#buildBtn'); await page.waitForTimeout(400);
const rec = await page.evaluate(() => document.querySelector('#buildMenu .rec')?.textContent ?? 'none');
await page.screenshot({ path: 'shots/rec-build.png' });
await page.click('#buildBtn'); await page.waitForTimeout(300);
// spot a landmark: hide one back in the fog's memory and let the game find it
const kind = await page.evaluate(() => { const g = window.railhaven.game, p = g.s.pois.find(p => p.kind === 'falls') ?? g.s.pois[0]; g.found = [p.id, g.s.pois[1].id]; return p.kind; });
await page.waitForTimeout(1600);
const card = await page.evaluate(() => document.querySelector('#card')?.textContent?.slice(0, 200));
await page.screenshot({ path: 'shots/find-card.png' });
await page.click('[data-act=lookpoi]'); await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/find-look.png' });
console.log('rec:', rec, '\nfind', kind, ':', card, '\n', errors.join('\n') || 'no page errors');
await browser.close();
