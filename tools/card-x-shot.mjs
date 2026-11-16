// Card ✕ check: scroll long cards to the bottom and make sure the ✕ is still on screen and tappable.
// Usage: node tools/card-x-shot.mjs [outdir]   (after npm run build)
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const out = process.argv[2] ?? 'shots';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const errors = [];
const cards = [['town', g => ({ kind: 'town', id: g.s.sites.find(s => s.kind === 'town').id })], ['settings', () => ({ kind: 'game', id: 0, page: 'settings' })], ['story', () => ({ kind: 'story', id: 0 })]];
for (const [w, h, name] of [[412, 860, 'folded'], [412, 560, 'folded-short'], [860, 950, 'unfolded'], [860, 520, 'unfolded-short']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + resolve('dist/index.html') + '?new'); await page.waitForTimeout(1200);
  for (const [k, c] of cards) {
    await page.evaluate(src => { const r = window.railhaven; r.openCard(eval(src)(r.game)); }, String(c)); await page.waitForTimeout(300);
    const res = await page.evaluate(() => {
      const card = document.getElementById('card'); card.scrollTop = card.scrollHeight;
      const x = card.querySelector('.x'), r = x.getBoundingClientRect(), cr = card.getBoundingClientRect();
      return { scrolls: card.scrollHeight > card.clientHeight, scrolled: card.scrollTop, inside: r.top >= cr.top - 1 && r.bottom <= cr.bottom, tappable: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('#card .x') === x };
    });
    console.log(name, k, JSON.stringify(res));
    await page.screenshot({ path: `${out}/cardx-${name}-${k}.png` });
  }
  await page.close();
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
