// The Foundry in Ashford and a tunnel through mountains, on a save. Usage: node tools/tunnel-shot.mjs [save]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2] ?? 'shots/s14.json';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('railhaven2', s), readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
// before the Foundry: Rails mode, mountains are red
const spot = await page.evaluate(() => {
  const r = window.railhaven, g = r.game, n = g.world.n; g.found = []; g.s.ms.actNew = false; r.openCard(null);
  g.s.money = 60000; g.s.rlv = Math.max(2, g.s.rlv ?? 0);
  const rev = j => (g.s.fog[j >> 3] >> (j & 7)) & 1;
  // a straight run from linked track through 2+ mountain squares, ending on track (a through tunnel) or else on open land
  const cands = [];
  for (const i of g.track.keys()) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let m = 0, k = 1;
    for (; k < 14; k++) { const j = i + dx * k + dy * k * n; if (g.track.has(j) || g.world.terr[j] !== 4 || !rev(j)) break; m++; }
    const end = i + dx * k + dy * k * n;
    if (m < 2 || m > 7 || g.world.terr[end] === 0 || g.world.terr[end] === 4 || !rev(end)) continue;
    cands.push({ sc: m + (g.track.has(end) ? 20 : 0), from: i, to: end, through: g.track.has(end), m });
  }
  cands.sort((a, b) => b.sc - a.sc);
  // the Foundry is needed for the plan to pass: test with a stand-in park, then take it away again
  g.s.parks = g.s.parks ?? []; g.s.parks.push({ town: 0, x: -5, y: -5, k: 'foundry' });
  r.tools.mode = 'rail';
  const best = cands.find(c => { r.tools.cancel(); r.tools.dragStart(c.from); r.tools.dragOver(c.to); const p = r.tools.plan; return p && p.path.at(-1) === c.to && !r.tools.previewErr; });
  g.s.parks.pop(); r.tools.cancel(); r.tools.mode = 'pan';
  const x = ((best.from % n) + (best.to % n)) / 2, y = (((best.from / n) | 0) + ((best.to / n) | 0)) / 2;
  g.s.camera.x = (x + 0.5) * 32; g.s.camera.y = (y + 0.5) * 32; g.s.camera.z = 2;
  r.tools.mode = 'rail'; r.tools.cancel(); return best;
});
await page.waitForTimeout(1300); await page.screenshot({ path: 'shots/tunnel-before.png' });
// buy the Foundry from Ashford's card
await page.evaluate(() => { const r = window.railhaven; r.tools.mode = 'pan'; r.openCard({ kind: 'town', id: r.game.s.sites[0].id, page: 'projects' }); });
await page.waitForTimeout(600); await page.screenshot({ path: 'shots/tunnel-card.png' });
await page.click('[data-act="project"][data-k="foundry"]');
await page.waitForTimeout(600);
const foundry = await page.evaluate(() => { const r = window.railhaven, g = r.game, p = g.s.parks.find(q => q.k === 'foundry'); r.openCard(null); g.s.camera.x = (p.x + 0.5) * 32; g.s.camera.y = (p.y + 2) * 32; g.s.camera.z = 3.2; return p; });
await page.waitForTimeout(1300); await page.screenshot({ path: 'shots/tunnel-foundry.png' });
// lay the tunnel
const laid = await page.evaluate(s => {
  const r = window.railhaven, g = r.game, n = g.world.n;
  g.s.camera.x = (((s.from % n) + (s.to % n)) / 2 + 0.5) * 32; g.s.camera.y = ((((s.from / n) | 0) + ((s.to / n) | 0)) / 2 + 0.5) * 32; g.s.camera.z = 2;
  r.tools.mode = 'rail'; r.tools.cancel(); r.tools.dragStart(s.from); r.tools.dragOver(s.to);
  return { err: r.tools.previewErr ?? '', money: g.s.money };
}, spot);
await page.waitForTimeout(800); await page.screenshot({ path: 'shots/tunnel-plan.png' });
const built = await page.evaluate(s => { const r = window.railhaven, g = r.game; r.tools.confirm(); r.tools.mode = 'pan'; r.tools.cancel(); return { track: g.track.has(s.to), money: g.s.money }; }, spot);
await page.evaluate(s => { const r = window.railhaven, g = r.game, n = g.world.n; for (let k = 0; k < 600; k++) r.step(1 / 30); g.found = []; r.openCard(null);
  g.s.camera.x = (((s.from % n) + (s.to % n)) / 2 + 0.5) * 32; g.s.camera.y = ((((s.from / n) | 0) + ((s.to / n) | 0)) / 2 + 0.5) * 32; g.s.camera.z = 1.6; }, spot);
await page.waitForTimeout(1300); await page.screenshot({ path: 'shots/tunnel-after.png' });
console.log(JSON.stringify({ spot, foundry, laid, built }), errors.join('\n') || 'no page errors');
await browser.close();
