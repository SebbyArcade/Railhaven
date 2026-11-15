// Towns of a save at each size, close up. Usage: node tools/city-shot.mjs save.json outDir [name,name,...]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/city', names = 'Ashford,Brinemoor Crossing,Brinemoor,Seacombe,Kettle Rock'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 520 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
for (const name of names.split(',')) {
  const ok = await page.evaluate(nm => { const r = window.railhaven, t = r.game.s.sites.find(s => s.name === nm); if (!t) return false; if (r.game.s.ms) r.game.s.ms.actNew = false; r.openCard(null); Object.assign(r.game.s.camera, { x: (t.x + 0.5) * 32, y: (t.y + 0.5) * 32, z: nm === "Ashford" ? 1.15 : 1.7 }); return true; }, name);
  if (!ok) continue;
  await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${name.replace(/\s+/g, '-').toLowerCase()}.png` });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
