// Screenshot a save centred on a building at one zoom. Usage: node tools/stock-tag-shot.mjs save.json buildingId zoom out.png
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, id, z = 2, out = 'shots/stock.png'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 420, height: 620 }, deviceScaleFactor: 2 });
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(500);
await page.evaluate(([id, z]) => {
  const g = window.railhaven.game, b = g.s.buildings.find(b => b.id === id); g.s.tut = undefined; window.railhaven.openCard(null);
  g.s.camera.x = (b.x + 2) * 32; g.s.camera.y = (b.y + 1) * 32; g.s.camera.z = z;
}, [+id, +z]);
await page.waitForTimeout(500); await page.screenshot({ path: out });
await browser.close();
