// The game pauses after 3 minutes without a touch, and carries on at the next one. Usage: node tools/idle-check.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 } });
await page.clock.install();
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242');
await page.clock.runFor(2000);
const t = () => page.evaluate(() => window.railhaven.game.s.t);
const t0 = await t(); await page.clock.runFor(10000); const t1 = await t();
await page.clock.runFor(180000); const t2 = await t(); await page.clock.runFor(10000); const t3 = await t();
const shown = await page.evaluate(() => getComputedStyle(document.getElementById('paused')).display);
await page.mouse.click(200, 400); await page.clock.runFor(5000); const t4 = await t();
const hidden = await page.evaluate(() => getComputedStyle(document.getElementById('paused')).display);
console.log(`runs ${(t1 - t0).toFixed(1)}s in 10s · after 3 min idle runs ${(t3 - t2).toFixed(1)}s in 10s · overlay ${shown} · after a tap runs ${(t4 - t3).toFixed(1)}s in 5s · overlay ${hidden}`);
await browser.close();
