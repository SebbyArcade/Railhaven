// Storm, fire and breakdown on a save, with screenshots. Usage: node tools/events-shot.mjs [save]
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
// a fire at a working building, with the crew at work
const fire = await page.evaluate(() => {
  const r = window.railhaven, g = r.game; r.openCard(null);
  g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: 1e9 };
  const b = g.s.buildings.find(b => b.kind === 'sawmill') ?? g.s.buildings.find(b => b.kind !== 'dock');
  b.fire = { crewAt: g.s.t + 3, doneAt: g.s.t + 40 };
  const c = g.s.camera; c.x = (b.x + 2) * 32; c.y = (b.y + 1) * 32; c.z = 2.2;
  return b.kind;
});
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/event-fire-1.png' });
await page.evaluate(() => window.railhaven.step(5));
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/event-fire-2.png' });
// a breakdown: the first moving train
const tr = await page.evaluate(() => {
  const r = window.railhaven, g = r.game, t = g.s.trains.find(t => Math.abs(t.v) > 20) ?? g.s.trains[0];
  t.broke = { crewAt: g.s.t + 2, doneAt: g.s.t + 40 }; r.step(4);
  const p = r.trainAt(t.id), c = g.s.camera; c.x = p.x; c.y = p.y + 60; c.z = 2.4;
  return t.id;
});
await page.waitForTimeout(1500); // the camera follows the open train
await page.screenshot({ path: 'shots/event-breakdown.png' });
// a storm over Ashford
await page.evaluate(() => {
  const r = window.railhaven, g = r.game, a = g.s.sites[0]; r.openCard(null);
  g.s.storm = { x: a.x, y: a.y, vx: 0.05, vy: 0, r: 7, t0: g.s.t - 30, until: g.s.t + 120 };
  const c = g.s.camera; c.x = (a.x + 0.5) * 32; c.y = (a.y + 0.5) * 32; c.z = 1.2;
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/event-storm.png' });
console.log(fire, 'train', tr, errors.join('\n') || 'no page errors');
await browser.close();
