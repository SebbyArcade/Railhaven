// Pictures of crossings and double-track junctions built in a new game. Usage: node tools/junction-shot.mjs outDir [seed]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [out = 'shots/junctions', seed = 4242] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '?new&seed=' + seed);
await page.waitForTimeout(500);
await page.addStyleTag({ content: '#hud, #bar, #toast, #mission, #card, #hint, #near, #viewTag, #tutPtr, #paused, #confirm, #lesson { display: none !important; }' });
const spots = await page.evaluate(() => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0], A = a.y * n + a.x, log = [];
  g.s.money = 1e7; g.s.tut = undefined; g.s.fog.fill(255); // all revealed: track can't go into fog
  const lay = (from, ...to) => { T.mode = 'rail'; T.cancel(); T.tapSquare(from); for (const k of to) T.tapSquare(k); const b = T.bar(); const L = T.plan?.path.length; T.confirm(); log.push(`${from}->${to}: ${b?.text ?? 'no bar'} plan ${L} toast ${document.querySelector('#toast')?.textContent}`); };
  const dbl = (sqs) => { T.mode = 'double'; T.cancel(); for (const i of sqs) T.tapSquare(i); const b = T.bar(); T.confirm(); log.push(`double ${sqs.length}: ${b?.text ?? 'no bar'}`); };
  // a long line east of Ashford, a line crossing it north-south (a crossing), and a branch off it (a junction)
  // west of Ashford (open ground): a crossing 3 squares out, a T-junction 7 out on double track
  const W = -1; lay(A, A + 12 * W);
  const C = A + 5 * W, J = A + 9 * W;
  lay(A - 3, A - 3 - 3 * n, C - 3 * n, C + 3 * n); // a loop that runs straight over the line: a crossing
  log.push('crossing flag ' + JSON.stringify(g.track.get(C)));
  lay(J, J - 4 * n); // T-junction
  const line = []; for (let k = 7; k <= 11; k++) line.push(A + k * W); dbl(line); // double track through the T-junction
  return { log, spots: [['crossing', C], ['double-junction', J]].map(([k, i]) => ({ k, x: i % n, y: Math.floor(i / n) })) };
});
console.log(spots.log.join('\n'));
for (const s of spots.spots) {
  await page.evaluate(s => { const g = window.railhaven.game; g.s.camera.x = (s.x + 0.5) * 32; g.s.camera.y = (s.y + 0.5) * 32; g.s.camera.z = 2.6; }, s);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${s.k}.png`, clip: { x: 56, y: 280, width: 300, height: 300 } });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
