// Open a building card page in a save. Usage: node tools/card-page-shot.mjs save.json buildingId page out.png
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, id, pg, out = 'shots/page.png'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(400);
await page.evaluate(([id]) => window.railhaven.openCard({ kind: 'bld', id: +id }), [id]);
await page.waitForTimeout(200);
if (pg) await page.click(`#card [data-page="${pg}"]`);
await page.waitForTimeout(300); await page.screenshot({ path: out });
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
