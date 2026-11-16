// Opens the 🚢 Ships card on a save (its sea routes drawn on the map) and screenshots it. Usage: node tools/ships-card-shot.mjs save.json [out.png]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file, out = 'shots/ships-card.png'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
await page.evaluate(() => { const r = window.railhaven; r.openCard(null); r.step(30); });
const shown = await page.evaluate(() => getComputedStyle(document.getElementById('shipsBtn')).display + ' docks ' + window.railhaven.game.s.buildings.filter(b => b.kind === 'dock').length + ' ships ' + (window.railhaven.game.s.ships ?? []).length); 
await page.click('#shipsBtn', { timeout: 3000 }).catch(e => console.log('click failed'));
await page.waitForTimeout(800);
await page.screenshot({ path: out });
console.log('ships button', shown, JSON.stringify(await page.evaluate(() => window.railhaven.tools.card)), errors.join('\n') || 'no page errors');
await browser.close();
