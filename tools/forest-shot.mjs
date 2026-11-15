// Stumps and saplings around a lumber camp on a save. Usage: node tools/forest-shot.mjs save.json
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 700 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
await page.evaluate(() => { const r = window.railhaven, g = r.game, b = g.s.buildings.find(x => x.kind === 'wood'); const c = g.s.camera; c.x = (b.x + 2) * 32; c.y = (b.y + 1) * 32; c.z = 1.6; r.step(400); r.openCard({ kind: 'bld', id: b.id }); });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/forest.png' });
console.log(await page.evaluate(() => Object.keys(window.railhaven.game.s.stumps ?? {}).length), errors.join('\n') || 'no page errors');
await browser.close();
