import type { Game } from '../state.ts';
import { TILE } from '../world/terrain.ts';
import { SIGNAL_GAP, trainLength } from '../trains/train.ts';

/** Squares a passing loop needs: the longest train plus a signal gap on its two tracks, and a square at each end where they fan out. */
export function loopLength(g: Game): number {
  const L = Math.max(trainLength({ cars: 3 } as never), ...g.s.trains.map(t => trainLength(t)));
  return Math.ceil((L + SIGNAL_GAP) / TILE) + 2;
}

/**
 * A passing loop through square i on single track: a straight stretch made double, long enough for the longest train
 * to wait on one track while another passes on the other. Returns its squares (centred on i where it fits) or why not.
 */
export function passingLoop(g: Game, i: number): number[] | string {
  const n = g.world.n, sq = g.track.get(i);
  if (!sq) return 'Tap your track to put a passing loop on it';
  if (sq.dbl) return 'This track is double already: trains pass each other here';
  const along = sq.links === 0b0101 ? 1 : sq.links === 0b1010 ? n : 0; // E+W or S+N
  if (!along) return 'A passing loop needs straight track: tap a straight stretch, away from corners and junctions';
  const inArea = new Set<number>();
  for (const id of g.sys.anyLane) for (const q of g.net.pieces[id]!.squares) inArea.add(q);
  const ok = (j: number) => { const t = g.track.get(j); return !!t && t.links === sq.links && !t.dbl && !t.cross && !inArea.has(j); };
  const need = loopLength(g), run = [i];
  let a = i, b = i;
  // grow both ways in turn so the loop sits around the tapped square
  for (let side = 0; run.length < need; side ^= 1) {
    const na = a - along, nb = b + along, canA = ok(na) && (along === 1 ? Math.floor(na / n) === Math.floor(i / n) : true), canB = ok(nb) && (along === 1 ? Math.floor(nb / n) === Math.floor(i / n) : true);
    if (!canA && !canB) break;
    if ((side === 0 && canA) || !canB) { a = na; run.unshift(na); } else { b = nb; run.push(nb); }
  }
  if (run.length < need) return `A passing loop needs ${need} straight single squares in a row (your longest train fits on it). Here there are only ${run.length}: try a longer straight`;
  return run;
}
