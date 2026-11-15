// Red ❗ over stuck buildings, and a tap on a map view's edge arrow. Usage: node tools/alerts-shot.mjs save.json
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
const at = await page.evaluate(() => {
  const r = window.railhaven; r.openCard(null); r.step(5);
  const b = r.game.s.buildings.find(b => b.kind === 'mill') ?? r.game.s.buildings[0];
  const c = r.game.s.camera; c.x = (b.x + 1) * 32; c.y = (b.y + 1) * 32; c.z = 1.4; return b.kind;
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/alerts.png' });
await page.evaluate(() => { const c = window.railhaven.game.s.camera; c.z = 1.6; });
await page.click('#mapBtn'); await page.waitForTimeout(300); await page.click('#card button[data-v="prob"]'); await page.waitForTimeout(1300);
const before = await page.evaluate(() => [window.railhaven.game.s.camera.x, window.railhaven.renderer?.arrows?.length]);
const arr = await page.evaluate(() => window.railhaven.renderer?.arrows?.[0]);
if (arr) await page.touchscreen.tap(arr.sx, arr.sy);
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/arrow-tap.png' });
console.log(at, JSON.stringify(before), JSON.stringify(await page.evaluate(() => window.railhaven.game.s.camera.x)), errors.join('\n') || 'no page errors');
await browser.close();
