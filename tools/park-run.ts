// Run a save and watch the ships at docks: do any moored at one dock overlap, jump, or sit on land?
// Usage: npx vite-node tools/park-run.ts [save] [minutes]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { tickBreaks } from '../src/track/breaks.ts';
import { tickEvents } from '../src/world/events.ts';
import { breaksChanged } from '../src/game.ts';
import { shipPlace } from '../src/ships/ships.ts';

type P = { x: number; y: number; a: number };
/** hulls are about 1.4 squares long and 0.4 wide */
const overlap = (p: P, q: P) => {
  const dx = q.x - p.x, dy = q.y - p.y, ux = Math.cos(p.a), uy = Math.sin(p.a);
  return Math.abs(Math.sin(q.a - p.a)) < 0.2 ? Math.abs(dx * ux + dy * uy) < 1.38 && Math.abs(-dx * uy + dy * ux) < 0.4 : Math.hypot(dx, dy) < 0.9;
};
const [file = 'tests/saves/save-seb-2026-11-16e.json', min = '15'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)!;
const e0 = g.s.earned ?? 0, o0 = g.s.orders ?? 0, sl0 = g.s.shipLoads ?? 0, n = g.world.n;
let clash = 0, jump = 0, land = 0, most = 0; const prev = new Map<number, P>();
for (let s = 0; s < +min * 60; s++) {
  for (let k = 0; k < 20; k++) {
    const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); if (+tickBreaks(g) + +tickEvents(g, dt)) breaksChanged(g);
    const ships = g.s.ships ?? [], ms = ships.filter(x => x.to === undefined), per = new Map<number, number>();
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (ms[i]!.at === ms[j]!.at && overlap(shipPlace(g, ms[i]!), shipPlace(g, ms[j]!))) clash++;
    for (const m of ms) { per.set(m.at, (per.get(m.at) ?? 0) + 1); most = Math.max(most, per.get(m.at)!); }
    for (const x of ships) {
      const p = shipPlace(g, x), q = prev.get(x.id);
      if (q && Math.hypot(p.x - q.x, p.y - q.y) > 0.2) jump++;
      prev.set(x.id, p);
      if (x.to === undefined && g.world.terr[Math.round(p.y) * n + Math.round(p.x)]) land++;
    }
  }
  if (s % 5 === 0) checkStuck(g);
}
console.log(`${file.split('/').pop()}: ${g.s.ships?.length ?? 0} ships · most at one dock ${most} · overlap ticks ${clash} · jumps ${jump} · moored-on-land ticks ${land} · ship loads +${(g.s.shipLoads ?? 0) - sl0} · earned +$${Math.round((g.s.earned ?? 0) - e0)} · orders +${(g.s.orders ?? 0) - o0}`);
