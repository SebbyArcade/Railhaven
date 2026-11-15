// Close, centred pictures of chosen building kinds and Ashford's landmarks on a save, with the map's own labels kept
// clear. Usage: node tools/showcase-shot.mjs save.json outDir [kind,kind,...]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/showcase', list = ''] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const W = 412, H = 860;
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
// hide the HUD, toolbar and toasts so only the map shows; mark every building as on the railway (no red "not linked" signs)
await page.addStyleTag({ content: '#hud, #bar, #toast, #mission, #card, #hint, #near, #viewTag, #tutPtr, #paused, #confirm { display: none !important; }' });
const targets = await page.evaluate(kinds => {
  const r = window.railhaven, g = r.game, n = g.world.n; if (g.s.ms) g.s.ms.actNew = false; r.openCard(null);
  const outs = [];
  for (const b of g.s.buildings ?? []) {
    if (!kinds.includes(b.kind) || outs.some(o => o.k === b.kind)) continue;
    // the middle of yard and building together
    const x = b.horizontal ? (b.x + 2) * 32 : (b.x + 0.5 + b.side / 2) * 32, y = b.horizontal ? (b.y + 0.5 + b.side / 2) * 32 : (b.y + 2) * 32;
    outs.push({ k: b.kind, id: b.id, x, y, z: b.horizontal ? 2.7 : 2.2, w: 360, h: 300 });
  }
  for (const p of g.s.parks ?? []) if (['grandstation', 'cathedral', 'exhibition'].includes(p.k)) outs.push({ k: p.k, x: (p.x + 0.5) * 32, y: (p.y + 0.5) * 32 - 3, z: 4.2, w: 300, h: 300 });
  // every building counts as on the railway, so no red "not linked" signs cover the pictures
  if (g.linked) g.linked.has = () => true;
  window.__all = g.s.buildings;
  return outs;
}, list.split(','));
for (const t of targets) {
  // show only the building being pictured (its neighbours' name boards would cover it)
  await page.evaluate(t => { const g = window.railhaven.game, c = g.s.camera; g.s.buildings = t.id === undefined ? [] : window.__all.filter(b => b.id === t.id); if (g.linked) g.linked.has = () => true; c.x = t.x; c.y = t.y; c.z = t.z; }, t);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${t.k}.png`, clip: { x: (W - t.w) / 2, y: (H - t.h) / 2, width: t.w, height: t.h } });
}
console.log(targets.map(t => t.k).join(' '), '|', errors.join('\n') || 'no page errors');
await browser.close();
