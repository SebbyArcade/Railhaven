// Close pictures of towns by name on a save, with the HUD hidden. Usage: node tools/town-shot.mjs save.json outDir Name,Name
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/towns', list = 'Ashford'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
await page.addStyleTag({ content: '#hud, #bar, #toast, #mission, #card, #hint, #near, #viewTag, #tutPtr, #paused, #confirm { display: none !important; }' });
for (const name of list.split(',')) {
  const ok = await page.evaluate(name => { const r = window.railhaven, g = r.game, t = g.s.sites.find(s => s.name === name); if (!t) return false; if (g.s.ms) g.s.ms.actNew = false; r.openCard(null); g.s.camera.x = (t.x + 0.5) * 32; g.s.camera.y = (t.y + 1) * 32; g.s.camera.z = 1.6; return true; }, name);
  if (!ok) { console.log('no town', name); continue; }
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name.replace(/\W+/g, '-')}.png`, clip: { x: 31, y: 230, width: 350, height: 400 } });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
