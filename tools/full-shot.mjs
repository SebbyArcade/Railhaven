// Full-screen button check: ⛶ on the map toggles in and out, sits clear of the HUD and side cards,
// and inside a frame that blocks full screen (the Claude app) it dims and explains instead.
// Usage: node tools/full-shot.mjs [outdir]   (after npm run build)
import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = process.argv[2] ?? 'shots';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const url = 'file://' + resolve('dist/index.html');
const errors = [];
const rect = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const hit = (a, b) => a.w && b.w && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
for (const [w, h, name] of [[412, 860, 'folded'], [740, 840, 'unfolded']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url + '?new'); await page.waitForTimeout(1200);
  await page.evaluate(() => window.railhaven.openCard(null)); await page.waitForTimeout(300);
  const full = await rect(page, '#full');
  const others = { hud: await rect(page, '#hud'), mute: await rect(page, '#mute'), mission: await rect(page, '#mission') };
  console.log(name, 'button', JSON.stringify(full), 'overlaps:', Object.entries(others).filter(([, r]) => hit(full, r)).map(([k]) => k).join(', ') || 'nothing');
  await page.screenshot({ path: `${out}/full-${name}.png` });
  await page.tap('#full'); await page.waitForTimeout(500);
  console.log(name, 'after tap: full screen =', await page.evaluate(() => !!document.fullscreenElement), 'button says', await page.getAttribute('#full', 'title'));
  await page.tap('#full'); await page.waitForTimeout(500);
  console.log(name, 'second tap: full screen =', await page.evaluate(() => !!document.fullscreenElement), 'button says', await page.getAttribute('#full', 'title'));
  await page.evaluate(() => { const r = window.railhaven; r.openCard({ kind: 'town', id: r.game.s.sites.find(s => s.kind === 'town').id }); }); await page.waitForTimeout(300);
  console.log(name, 'with a card open, overlaps card:', hit(await rect(page, '#full'), await rect(page, '#card')));
  await page.screenshot({ path: `${out}/full-${name}-card.png` });
  await page.close();
}
// the Claude app shows the game in a frame without full-screen permission (allow="fullscreen 'none'" stands in for it)
writeFileSync(resolve(out, 'frame.html'), `<!doctype html><body style="margin:0"><iframe allow="fullscreen 'none'" src="${url}?new" style="border:0;width:412px;height:860px"></iframe>`);
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true, deviceScaleFactor: 2 });
await page.goto('file://' + resolve(out, 'frame.html')); await page.waitForTimeout(1500);
const f = page.frames()[1];
await f.evaluate(() => window.railhaven.openCard(null)); await page.waitForTimeout(300);
await f.tap('#full'); await page.waitForTimeout(400);
console.log('in a frame: full screen =', await f.evaluate(() => !!document.fullscreenElement), '· dimmed =', await f.$eval('#full', e => e.classList.contains('blocked')), '· message:', await f.$eval('#toast', e => e.textContent));
await page.screenshot({ path: `${out}/full-blocked.png` });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
