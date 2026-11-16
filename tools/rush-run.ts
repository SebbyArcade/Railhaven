// Start up to three ⭐ rushes on a save (open town orders and factory inputs) and run it, printing how each rush goes.
// Usage: npx vite-node tools/rush-run.ts [save] [minutes]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { orderOf, townLinked, tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { tickBreaks } from '../src/track/breaks.ts';
import { tickEvents } from '../src/world/events.ts';
import { breaksChanged } from '../src/game.ts';
import { inputsOf, isFactory, isLinked } from '../src/buildings/industries.ts';
import { rushBySea, rushFee, startRush } from '../src/economy/upgrades.ts';
import { shipPlan } from '../src/economy/shipping.ts';
import { rushRoute } from '../src/ui/orders.ts';

const [file = 'tests/saves/save-seb-2026-11-16b.json', min = '10'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)!;
// candidates: a factory input made only on another island first (a ship rush), then the open town orders with most left
const cands: { to: { kind: 'town' | 'bld'; id: number }; k: string; left: number }[] = [];
for (const f of g.s.buildings ?? []) if (isFactory(f.kind) && isLinked(g, f) && !f.closed) for (const k of inputsOf(f.kind)) cands.push({ to: { kind: 'bld', id: f.id }, k, left: rushBySea(g, { kind: 'bld', id: f.id }, k) ? 1e4 : 0 });
for (const t of g.s.sites) if (t.kind === 'town' && townLinked(g, t)) { const o = orderOf(g, t); for (const k of Object.keys(o)) { const l = o[k as keyof typeof o]! - (t.got?.[k as keyof typeof o] ?? 0); if (l > 0) cands.push({ to: { kind: 'town', id: t.id }, k, left: l }); } }
cands.sort((a, b) => b.left - a.left);
const m0 = g.s.money;
for (const c of cands) { if ((g.s.rush ?? []).length >= 3) break; const fee = rushFee(g, c.to, c.k as never), why = startRush(g, c.to, c.k as never); if (!why) console.log(`start ${c.to.kind}${c.to.id} ${c.k} fee $${fee}${rushBySea(g, c.to, c.k as never) ? ' (by ship)' : ''}`); }
console.log(`paid $${Math.round(m0 - g.s.money)} for ${(g.s.rush ?? []).length} rushes`);
const e0 = g.s.earned ?? 0, done0 = g.s.rushDone ?? 0;
for (let s = 0; s < +min! * 60; s++) {
  for (let k = 0; k < 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); if (+tickBreaks(g) + +tickEvents(g, dt)) breaksChanged(g); }
  if (s % 5 === 0) checkStuck(g);
  if (s % 60 === 59) { const p = shipPlan(g); console.log(`${(s + 1) / 60} min: ` + (g.s.rush ?? []).map(r => `${r.to.kind}${r.to.id} ${r.good} ${r.left} left (${rushRoute(g, r, p).text})`).join(' | ')); }
}
console.log(`${file}: ${min} min · earned +$${Math.round((g.s.earned ?? 0) - e0)} · rushes done ${(g.s.rushDone ?? 0) - done0} · still running ${(g.s.rush ?? []).length}`);
