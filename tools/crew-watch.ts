// Runs a save with frequent fires and broken rails and watches the work crews against the trains: does a crew car on
// the rails ever share a piece with a train, how long crews are held up, and do trains stall behind them.
// Usage: npx vite-node tools/crew-watch.ts save.json [minutes]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { breakRail, tickBreaks } from '../src/track/breaks.ts';
import { tickEvents } from '../src/world/events.ts';
import { breaksChanged } from '../src/game.ts';
import { type CrewRun, runDist } from '../src/world/crews.ts';

const [file = '', min = '15'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)!;
const e0 = g.s.earned ?? 0, o0 = g.s.orders ?? 0;
let why = '', overlap = 0, onRails = 0, maxSlip = 0, fires = 0, breaks = 0, stood = 0, maxStop = 0;
const stop = new Map<number, number>(), offSeen = new Set<CrewRun>();
const runsNow = () => [
  ...(g.s.buildings ?? []).filter(b => b.fire?.run && g.s.t < b.fire.doneAt).map(b => b.fire!.run!),
  ...(g.s.breaks ?? []).filter(b => b.run).map(b => b.run!), ...(g.s.crews ?? [])];
for (let s = 0; s < +min! * 60; s++) {
  if (s % 45 === 0) g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: g.s.t };
  if (s % 60 === 30 && breakRail(g)) { breaks++; breaksChanged(g); }
  for (let k = 0; k < 20; k++) {
    const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
    const f0 = (g.s.buildings ?? []).filter(b => b.fire).length;
    if (+tickBreaks(g) + +tickEvents(g, dt)) breaksChanged(g);
    if ((g.s.buildings ?? []).filter(b => b.fire).length > f0) fires++;
    // a crew car on the rails (moving, not off) must never share a piece with a train body
    const bodies = new Set<number>(); for (const t of g.s.trains) for (const st of t.trail) bodies.add(st.piece);
    for (const r of runsNow()) {
      maxSlip = Math.max(maxSlip, r.slip ?? 0); if (r.off !== undefined && !offSeen.has(r)) { offSeen.add(r); stood++; }
      if (r.off !== undefined || g.s.t < r.t0) continue;
      const d = runDist(r, g.s.t); let acc = 0;
      for (const k of r.path) {
        const p = g.net.pieces[k >> 1]; if (!p) break;
        if (acc + p.len >= d - 5 && acc <= d + 5) { onRails++; if (bodies.has(p.id)) overlap++; }
        if (acc > d + 5) break; acc += p.len;
      }
    }
    for (const t of g.s.trains) {
      const nx = t.plan.filter(m => !('rev' in m))[t.held] as { piece: number } | undefined;
      if (t.job && Math.abs(t.v) < 0.5 && nx && g.sys.crew.has(nx.piece)) { stop.set(t.id, (stop.get(t.id) ?? 0) + dt); if (stop.get(t.id)! > maxStop) { maxStop = stop.get(t.id)!; why = `train ${t.id} at t=${g.s.t.toFixed(0)}: ${runsNow().map(r => `${r.kind}${r.off !== undefined ? ' off' : ''} ${runDist(r, g.s.t) >= r.len - 0.01 ? 'at job' : 'riding'}`).join(', ')}`; } } else stop.delete(t.id);
    }
  }
  if (s % 5 === 0) checkStuck(g);
}
console.log(`${file.split('/').pop()}: ${min} min · earned +$${Math.round((g.s.earned ?? 0) - e0)} · orders +${(g.s.orders ?? 0) - o0} · fires ${fires} · breaks ${breaks} · crew-train overlaps ${overlap}/${onRails} · crews stood aside ${stood} · longest crew delay ${maxSlip.toFixed(1)} s · longest train wait on a crew ${maxStop.toFixed(1)} s (${why})`);
