// 🏗 Build menu keeps the camera where the player is looking (bug report 17: Oil Well jumped to another island).
// Usage: node tools/build-here-check.mjs [save file]   (after npm run build)
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const file = resolve(process.argv[2] || 'tests/saves/save-seb-2026-11-16-report17.json');
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
let fails = 0; const check = (ok, what) => { console.log(ok ? '✅' : '❌', what); if (!ok) fails++; };
for (const vp of [{ width: 900, height: 1000 }, { width: 412, height: 860 }]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => { if (!sessionStorage.getItem('in')) { sessionStorage.setItem('in', '1'); localStorage.setItem('railhaven2', s); } }, readFileSync(file, 'utf8'));
  await page.goto('file://' + resolve('dist/index.html'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.railhaven.openCard(null)); await page.waitForTimeout(200);
  const look = (x, y, z = 1.04) => page.evaluate(([x, y, z]) => { const c = window.railhaven.game.s.camera; c.x = x * 32 + 16; c.y = y * 32 + 16; c.z = z; }, [x, y, z]);
  const pick = async k => { await page.click('#buildBtn'); await page.waitForTimeout(300); await page.click(`button[data-k="${k}"]`); await page.waitForTimeout(400); };
  const st = () => page.evaluate(() => { const r = window.railhaven, c = r.game.s.camera, p = r.tools.preview; return { cam: `${Math.round(c.x)},${Math.round(c.y)}`, at: p ? [p.x, p.y] : null, err: r.tools.previewErr, toast: document.getElementById('toast').textContent, shown: document.getElementById('toast').style.opacity }; });
  const tag = `${vp.width}px`;
  // 1. looking at Gullhaven Haven: its oil seep (195,81) is still in the fog; the nearest fit is on another island
  const town = await page.evaluate(() => window.railhaven.game.s.sites.find(s => s.name === 'Gullhaven Haven'));
  await look(town.x + 6, town.y + 2);
  const before = await st(); await pick('oil'); const s1 = await st();
  check(s1.cam === before.cam, `${tag} Oil Well near Gullhaven Haven: camera stays (${before.cam} → ${s1.cam})`);
  if (vp.width > 600) check(s1.at && Math.abs(s1.at[0] - 195) <= 3 && Math.abs(s1.at[1] - 81) <= 3, `${tag} outline sits on the oil seep in view (${s1.at})`);
  check(/fog/.test(s1.err), `${tag} the bar says why: ${s1.err}`);
  check(/Nearest spot that fits: near .*Go ›/.test(s1.toast), `${tag} the far fit is offered, not jumped to: ${s1.toast}`);
  await page.screenshot({ path: `shots/build-here-${vp.width}-seep.png` });
  // 2. Go › on the toast takes the player there (they asked)
  await page.click('#toast button'); await page.waitForTimeout(300); const s2 = await st();
  check(s2.cam !== s1.cam && !s2.err, `${tag} Go › moves to the fit (${s2.cam}, outline ${s2.at}, ${s2.err || 'fits'})`);
  await page.screenshot({ path: `shots/build-here-${vp.width}-go.png` });
  await page.evaluate(() => { const t = window.railhaven.tools; t.mode = 'pan'; t.cancel(); }); await page.waitForTimeout(200);
  // 3. a spot that fits in view: the outline goes there and nothing moves
  await look(150, 120); const b3 = await st(); await pick('oil'); const s3 = await st();
  check(s3.cam === b3.cam && !s3.err, `${tag} fit in view: outline ${s3.at}, camera stays (${s3.cam}), ${s3.err || 'fits'}`);
  await page.evaluate(() => { const t = window.railhaven.tools; t.mode = 'pan'; t.cancel(); }); await page.waitForTimeout(200);
  // 4. a farm on Ashford Isle: the outline lands in view, camera stays
  const a = await page.evaluate(() => window.railhaven.game.s.sites[0]); await look(a.x + 3, a.y + 3); const b4 = await st(); await pick('farm'); const s4 = await st();
  check(s4.cam === b4.cam && s4.at, `${tag} Wheat Farm near Ashford: outline ${s4.at}, camera stays, ${s4.err || 'fits'}`);
  console.log(errors.join('\n') || 'no page errors');
  if (errors.length) fails++;
  await page.close();
}
console.log(fails ? `${fails} failed` : 'all passed');
await browser.close();
