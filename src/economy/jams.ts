import type { Game, Site } from '../state.ts';
import type { Train } from '../trains/train.ts';
import { isRev } from '../track/route.ts';
import { isLinked, yardSquares, yardSet } from '../buildings/industries.ts';
import { hallsOf } from '../buildings/stations.ts';
import { isDock, railIsleName, railIsleOfB } from '../ships/docks.ts';
import { headSquare, islandOfTrain } from './dispatch.ts';
import { passingLoop } from '../track/loops.ts';

/** A train held up this long (seconds) counts as stuck in a jam. */
export const JAM_AFTER = 45;

export interface Jam {
  /** trains held up there */
  trains: Train[];
  /** single-track squares just ahead of them: doubling these lets trains pass */
  squares: number[];
  /** a passing loop on that stretch, when there is a straight long enough for one */
  loop?: number[];
  /** where to look, and the nearest town's name */
  x: number; y: number; near: string; island: number;
  /** the island has more trains waiting for work than its track can hold: ship some away from this dock */
  crowded?: { idle: number; dock?: number; island: string };
}

const nearestTown = (g: Game, x: number, y: number): Site | undefined => {
  let best: Site | undefined, bd = Infinity;
  for (const t of g.s.sites) if (t.kind === 'town' && (t.pop ?? 0) > 0) { const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = t; } }
  return best;
};

/**
 * Where trains are held up for a long time, one entry per island: the single-track stretch ahead of them (to double),
 * and whether the island simply holds more trains than work and track (then spare trains should be shipped away).
 */
export function jams(g: Game): Jam[] {
  const n = g.world.n, held = g.s.trains.filter(t => (t.stopT ?? 0) >= JAM_AFTER);
  if (!held.length) return [];
  // stations and yards are already double where it matters: don't offer to double them
  const fixed = new Set<number>();
  for (const h of hallsOf(g.track, n, g.s.sites, g.world.terr, yardSet(g))) for (const i of h.squares) fixed.add(i);
  for (const b of g.s.buildings ?? []) for (const i of yardSquares(n, b)) fixed.add(i);
  const by = new Map<number, Train[]>();
  for (const t of held) { const k = islandOfTrain(g, t); by.set(k, [...(by.get(k) ?? []), t]); }
  const out: Jam[] = [];
  for (const [isl, trains] of by) {
    const sq = new Set<number>();
    for (const t of trains) {
      let c = 0;
      for (const m of t.plan) {
        if (isRev(m)) continue;
        for (const i of g.net.pieces[m.piece]!.squares) if (!fixed.has(i) && g.track.has(i) && !g.track.get(i)!.dbl) sq.add(i);
        if (++c >= 6) break;
      }
    }
    const h = headSquare(g, trains[0]!), x = h % n, y = Math.floor(h / n);
    const idle = g.s.trains.filter(t => !t.job && islandOfTrain(g, t) === isl).length;
    const work = (g.s.buildings ?? []).filter(b => !isDock(b) && isLinked(g, b) && railIsleOfB(g, b) === isl).length;
    const jam: Jam = { trains, squares: [...sq], x, y, island: isl, near: nearestTown(g, x, y)?.name ?? 'your line' };
    for (const i of [...sq].sort((a, b) => Math.hypot(a % n - x, Math.floor(a / n) - y) - Math.hypot(b % n - x, Math.floor(b / n) - y)).reverse()) {
      const l = passingLoop(g, i); if (typeof l !== 'string') { jam.loop = l; break; }
    }
    if (idle >= 3 && idle > work) {
      const dock = (g.s.buildings ?? []).find(b => isDock(b) && isLinked(g, b) && railIsleOfB(g, b) === isl);
      jam.crowded = { idle, island: railIsleName(g, isl), ...(dock ? { dock: dock.id } : {}) };
    }
    out.push(jam);
  }
  return out;
}
