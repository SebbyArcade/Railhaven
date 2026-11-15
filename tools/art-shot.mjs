// Close-ups of the building art and town houses. Usage: node tools/art-shot.mjs [seed]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [seed = 4242] = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 520, height: 420 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + seed);
await page.waitForTimeout(300);
const built = await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools; g.s.money = 1e6; const out = [];
  for (const k of ['wood', 'stone', 'coal', 'wool']) {
    T.chooseBuild(k); const why = T.previewErr; if (T.preview && !why) { T.confirm(); out.push(k); } else out.push(k + ' ✗ ' + why);
    T.mode = 'pan'; T.cancel(); T.buildKind = null;
  }
  const a = g.s.sites[0]; a.pop = 400; a.lvl = 2;
  return out;
});
console.log(built.join('\n'));
const shoot = async (name, fn) => { await page.evaluate(fn); await page.waitForTimeout(500); await page.screenshot({ path: `shots/art-${name}.png` }); };
const kinds = await page.evaluate(() => window.railhaven.game.s.buildings.map(b => b.kind));
for (let i = 0; i < kinds.length; i++) await shoot(kinds[i], `(() => { const g = window.railhaven.game, b = g.s.buildings[${i}]; g.s.camera.x = (b.x + (b.horizontal ? 2 : 0.5)) * 32; g.s.camera.y = (b.y + (b.horizontal ? 0.5 : 2)) * 32; g.s.camera.z = 3.4; })()`);
await shoot('town', `(() => { const g = window.railhaven.game, a = g.s.sites[0]; g.s.camera.x = (a.x + 0.5) * 32; g.s.camera.y = (a.y + 0.5) * 32; g.s.camera.z = 2.4; })()`);
const ruin = await page.evaluate(() => { const g = window.railhaven.game, r = g.s.sites.find(s => s.kind === 'town' && !s.pop); if (!r) return 0; for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) g.s.fog && 0; g.s.camera.x = (r.x + 0.5) * 32; g.s.camera.y = (r.y + 0.5) * 32; g.s.camera.z = 2.4; return 1; });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
