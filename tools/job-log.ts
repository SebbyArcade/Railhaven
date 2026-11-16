// Logs every job a train takes on a save: where the train was, how far it ran empty to the load, how far it hauls it,
// and the nearest other load that was also urgent. Usage: npx vite-node tools/job-log.ts save.json seconds
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { headSquare, tickTrains } from '../src/economy/dispatch.ts';
import { bldDist, shipPlan } from '../src/economy/shipping.ts';

const [file = '', secs = '300'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const name = (to: { kind: string; id: number }) => to.kind === 'town' ? g.s.sites.find(t => t.id === to.id)?.name : `${g.s.buildings!.find(b => b.id === to.id)?.kind}#${to.id}`;
const had = new Map<number, string>();
let empty = 0, full = 0, jobs = 0;
const e0 = g.s.earned ?? 0;
const got0 = g.s.sites.reduce((a, t) => a + (Object.values(t.got ?? {}) as number[]).reduce((x, y) => x + y, 0), 0);
const drop = new Map<number, unknown>();
let hauled = 0, runAll = 0, planned = 0;
const ran = new Map<number, number>();
for (let s = 0; s < +secs * 20; s++) {
  const before = new Map(g.s.trains.map(t => [t.id, t.job ? `${t.job.src}` : '']));
  const at = new Map(g.s.trains.map(t => [t.id, headSquare(g, t)]));
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  for (const t of g.s.trains) {
    const j = t.job; if (!j || j.phase !== 'toLoad' || before.get(t.id) === `${j.src}`) continue;
    const b = g.s.buildings!.find(x => x.id === j.src)!, reach = bldDist(g, b)[at.get(t.id)!]!;
    const plan = shipPlan(g), ship = plan.get(b.id);
    let near = '';
    for (const [id, sp] of plan) { if (sp.why !== 'order' && !sp.feeds) continue; const o = g.s.buildings!.find(x => x.id === id)!; const r = bldDist(g, o)[at.get(t.id)!]!; if (r >= 0 && r < reach && o.stock >= 10) near += ` ${o.kind}#${id}@${r}`; }
    jobs++; empty += reach; full += ship?.d ?? 0;
    console.log(`${(g.s.t).toFixed(0)} train ${t.id}: empty ${reach} sq to ${b.kind}#${b.id} (stock ${Math.round(b.stock)}), then ${ship?.d} sq to ${name(j.to)} (${ship?.why}${ship?.feeds ? '+' : ''})${near ? ' · nearer urgent:' + near : ''}`);
    had.set(t.id, `${j.src}`);
  }
  for (const t of g.s.trains) { // squares really run with the load, against the shortest rail way
    const j = t.job;
    if (j?.phase === 'toDrop') ran.set(t.id, (ran.get(t.id) ?? 0) + Math.abs(t.v) * dt / 32);
    else if (ran.has(t.id)) { const r = ran.get(t.id)!, c = drop.get(t.id) as { d: number } | undefined; ran.delete(t.id); if (c && r > c.d * 1.4 + 3) console.log(`${(g.s.t).toFixed(0)} train ${t.id} ran ${r.toFixed(0)} sq loaded for a ${c.d}-sq trip`); runAll += r; }
  }
  for (const t of g.s.trains) { // loaded: where the load really goes, and how far
    const j = t.job; if (!j || j.phase !== 'toDrop' || !t.cargo || drop.get(t.id) === t.cargo) continue;
    drop.set(t.id, t.cargo); hauled += t.cargo.d;
    let pl = 0; for (const m of t.plan) if (!('rev' in m) && (m as { piece?: number }).piece !== undefined) pl += g.net.pieces[(m as { piece: number }).piece]!.len / 32;
    planned += pl;
    if (process.env.DROPS && pl > t.cargo.d * 1.4 + 3) console.log(`   planned ${pl.toFixed(0)} sq for a ${t.cargo.d}-sq trip`);
    if (process.env.DROPS) console.log(`${(g.s.t).toFixed(0)} train ${t.id} loaded ${t.cargo.good} at #${j.src} for ${name(j.to)}, ${t.cargo.d} sq`);
  }
}
console.log(`real loaded squares ${hauled} · planned at loading ${planned.toFixed(0)} · squares run loaded ${runAll.toFixed(0)}`);
console.log('turn-backs partway (square: times):', [...(g.revs ?? [])].sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([q, r]) => `${q % g.world.n},${(q / g.world.n) | 0}: ${r.n}`).join(' · '));
const got = () => g.s.sites.reduce((a, t) => a + (Object.values(t.got ?? {}) as number[]).reduce((x, y) => x + y, 0), 0);
console.log(`jobs ${jobs} · empty squares ${empty} · loaded squares ${full} · earned $${Math.round((g.s.earned ?? 0) - e0)} · order units now ${got()} (was ${got0})`);
