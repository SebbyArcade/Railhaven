// Opens the Build menu in a new game on a phone-size screen and screenshots the factory tiles. Usage: node tools/menu-shot.mjs [out.png]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const out = process.argv[2] || 'shots/menu.png';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=4242');
await page.waitForTimeout(400);
await page.evaluate(() => { const g = window.railhaven.game; g.s.money = 9000; });
await page.locator('#bar button', { hasText: 'Build' }).first().click();
await page.waitForTimeout(400);
await page.evaluate(() => { const m = document.getElementById('buildMenu'), h = [...m.querySelectorAll('.mhead')][0]; m.scrollTop = h.offsetTop - 80; });
await page.waitForTimeout(200);
await page.screenshot({ path: out });
console.log(await page.evaluate(() => [...document.querySelectorAll('#buildMenu .rcp')].map(e => e.closest('button').dataset.k + ': ' + e.textContent).join('\n')));
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
