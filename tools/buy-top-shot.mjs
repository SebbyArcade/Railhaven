// Buy and upgrade buttons sit at the top of the Ships, Trains and dock pages (no long scroll to reach them).
// Usage: node tools/buy-top-shot.mjs save.json outDir   (after npm run build)
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/buy-top'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const errors = [];
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
const cards = {
  ships: () => ({ kind: 'ships', id: 0 }),
  fleet: () => ({ kind: 'fleet', id: 0 }),
  ship: g => ({ kind: 'ship', id: g.s.ships[0].id }),
  docksea: g => ({ kind: 'bld', id: g.s.buildings.find(b => b.kind === 'dock').id, page: 'sea' }),
  docktrains: g => { const r = window.railhaven; const isl = b => g.world.islandOf[b.y * g.world.n + b.x]; return { kind: 'bld', id: g.s.buildings.find(b => b.kind === 'dock' && isl(b) !== g.world.home).id, page: 'trains' }; },
};
for (const [k, c] of Object.entries(cards)) {
  await page.evaluate(src => { const r = window.railhaven; r.openCard(eval(src)(r.game)); }, String(c)); await page.waitForTimeout(500);
  const first = await page.evaluate(() => { const card = document.getElementById('card'); card.scrollTop = 0; const b = [...card.querySelectorAll('button.act:not(.back), button[data-act="shipup"]')][0]; const r = b?.getBoundingClientRect(); return b ? { button: b.textContent.trim().slice(0, 40), onScreen: r.bottom <= innerHeight } : null; });
  console.log(k, JSON.stringify(first));
  await page.screenshot({ path: `${out}/${k}.png` });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
