import type { Game, Site } from '../state.ts';
import { hallOf } from '../buildings/stations.ts';
import { townLinked } from '../economy/towns.ts';
import { railNoGo } from '../buildings/nogo.ts';
import { isRevealed } from '../world/fog.ts';
import { layPath } from './edit.ts';
import { planCost, planError, withPath } from './paint.ts';
import type { TrackMap } from './types.ts';
import { yardSet } from '../buildings/industries.ts';

/** How many new squares a gap may hold and still be shown: a short branch, so it reads as "lay these". */
export const GAP_MAX = 12;

/** The missing squares, in the order they are laid, the railway square they start from, the station they make and what they cost. */
export interface JoinGap { from: number; squares: number[]; hall: number[]; cost: number }

const memo = new WeakMap<Set<number>, Map<number, JoinGap | null>>();

/**
 * The fewest empty squares of track that would put a town on the railway, when your track already comes within a
 * dozen squares of it (null: no such gap). The squares obey the same rules as painting track (station ends,
 * yards, parks, fog, no bridges), so laying exactly these squares, starting from `from`, links the town.
 * Worked out once per change of the network.
 */
export function joinGap(g: Game, t: Site): JoinGap | null {
  if (t.kind !== 'town' || !g.linked?.size) return null;
  const h0 = hallOf(g.track, g.world.n, t, g.world.terr, yardSet(g)); if (h0 && g.linked.has(h0.squares[1])) return null; // already on the railway
  let m = memo.get(g.linked); if (!m) { m = new Map(); memo.set(g.linked, m); }
  if (m.has(t.id)) return m.get(t.id)!;
  const v = find(g, t); m.set(t.id, v); return v;
}

function find(g: Game, t: Site): JoinGap | null {
  const n = g.world.n, linked = g.linked!, R = GAP_MAX + 2;
  const near = (i: number) => Math.abs(i % n - t.x) <= R && Math.abs(((i / n) | 0) - t.y) <= R;
  const free = (i: number) => near(i) && !g.track.has(i) && isRevealed(g, i) && g.world.terr[i] !== 0 && !railNoGo(g, i);
  // breadth-first from every railway square near the town: each step is one new square of track
  type Node = { sq: number; from: Node | null };
  let layer: Node[] = [];
  for (const i of linked) if (near(i)) layer.push({ sq: i, from: null });
  const seen = new Set<number>();
  for (let depth = 1; depth <= GAP_MAX && layer.length; depth++) {
    const next: Node[] = [];
    for (const a of layer) {
      const x = a.sq % n, y = (a.sq / n) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
        const j = Y * n + X; if (!free(j)) continue;
        if (!a.from) { const e = planError(g, { path: [a.sq, j] }); if (e && !e.startsWith('Need $')) continue; } // track can't leave the railway there (the middle of a yard, a station's side)
        let back = false; for (let k: Node | null = a; k && !back; k = k.from) back = k.sq === j; if (back) continue; // never over its own new track
        const node: Node = { sq: j, from: a }, path: number[] = [];
        for (let k: Node | null = node; k; k = k.from) path.unshift(k.sq);
        const hall = joins(g, t, path);
        if (hall) return { from: path[0]!, squares: path.slice(1), hall, cost: planCost(g, { path }) };
        const key = j * 4 + (dx ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3)); // a square reached from each side is its own state: the side decides where a station can go
        if (!seen.has(key)) { seen.add(key); next.push(node); }
      }
    }
    layer = next;
  }
  return null;
}

/** Would laying this stroke (railway square first) be allowed and link the town? The station's squares if so. */
function joins(g: Game, t: Site, path: number[]): number[] | null {
  const n = g.world.n;
  if (Math.abs(path.at(-1)! % n - t.x) + Math.abs(((path.at(-1)! / n) | 0) - t.y) > 3) return null; // too far yet to make a station
  const tr: TrackMap = new Map(g.track);
  for (const i of path) { const o = tr.get(i); if (o) tr.set(i, { ...o }); }
  layPath(tr, n, path);
  const h = hallOf(tr, n, t, g.world.terr, yardSet(g));
  if (!h || !(path.includes(h.squares[1]) || g.linked!.has(h.squares[1]))) return null;
  const e = planError(g, { path });
  return !e || e.startsWith('Need $') ? [...h.squares] : null;
}

/** A place a town's station could stand: its three platform squares and the ends where track comes in. */
export interface StationSpot { squares: number[]; ends: [number, number][] }

/**
 * Where a town's station can go before any track comes near: straight across the town square either way, or along
 * any side of it (a line running past). Only spots whose platforms stand on open land you can lay track on, with at
 * least one end track can reach. Each end is [the square past the platforms, the end platform square].
 */
export function stationSpots(g: Game, t: Site): StationSpot[] {
  const n = g.world.n, yards = yardSet(g), out: StationSpot[] = [];
  const ok = (i: number) => isRevealed(g, i) && g.world.terr[i] !== 0 && !yards.has(i) && (g.track.has(i) || !railNoGo(g, i));
  const spot = (cx: number, cy: number, horizontal: boolean) => {
    const [dx, dy] = horizontal ? [1, 0] : [0, 1], at = (k: number) => (cy + dy * k) * n + cx + dx * k;
    const along = horizontal ? 5 : 10, squares = [at(-1), at(0), at(1)];
    // platforms go on open land, or on track you already have that runs straight the same way (never on a bend)
    if (!squares.every(i => ok(i) && (!g.track.has(i) || (g.track.get(i)!.links | along) === along))) return;
    const ends = ([[at(-2), at(-1)], [at(2), at(1)]] as [number, number][]).filter(([e]) => ok(e));
    if (ends.length) out.push({ squares, ends });
  };
  spot(t.x, t.y, true); spot(t.x, t.y, false); // across the town square
  spot(t.x, t.y - 1, true); spot(t.x, t.y + 1, true); spot(t.x - 1, t.y, false); spot(t.x + 1, t.y, false); // past it, beside it
  return out;
}

export interface SpotPick { spot: StationSpot; end: [number, number]; from: number; d: number }
const spotMemo = new WeakMap<Set<number>, Map<number, SpotPick | null>>();

/**
 * The station spot to aim for when the railway is still far off: the one whose way in faces your nearest track,
 * with that end and the railway square closest to it (d: squares apart, as the crow flies along the grid).
 */
export function bestSpot(g: Game, t: Site): SpotPick | null {
  if (t.kind !== 'town' || !g.linked?.size) return null;
  let m = spotMemo.get(g.linked); if (!m) { m = new Map(); spotMemo.set(g.linked, m); }
  if (m.has(t.id)) return m.get(t.id)!;
  const n = g.world.n; let best: SpotPick | null = null;
  const spots = stationSpots(g, t), was = lastSpot.get(t.id);
  // keep showing the spot it showed before while it still fits, so the guide doesn't turn while you build toward it
  const kept = was && spots.find(sp => sp.squares.join() === was);
  for (const spot of kept ? [kept] : spots) for (const end of spot.ends) {
    const ex = end[0] % n, ey = (end[0] / n) | 0;
    for (const i of g.linked) {
      const d = Math.abs(i % n - ex) + Math.abs(((i / n) | 0) - ey);
      if (!best || d < best.d) best = { spot, end, from: i, d };
    }
  }
  if (best) lastSpot.set(t.id, best.spot.squares.join());
  m.set(t.id, best); return best;
}
/** the spot last shown for each town (not saved: a fresh session may pick again) */
const lastSpot = new Map<number, string>();

/**
 * What a planned stroke does to stations, for the confirm bar: towns it puts on the railway (🚉) and towns whose
 * station it would take away (⚠), in words. '' when it changes none.
 */
export function stationsText(g: Game, path: number[]): string {
  const n = g.world.n, tr = withPath(g, path), yards = yardSet(g), on = new Set(path), gain: string[] = [], lose: string[] = [];
  for (const t of g.s.sites) {
    if (t.kind !== 'town' || !path.some(i => Math.abs(i % n - t.x) <= 3 && Math.abs(((i / n) | 0) - t.y) <= 3)) continue;
    const was = townLinked(g, t), h = hallOf(tr, n, t, g.world.terr, yards);
    const now = !!h && h.squares.some(i => on.has(i) || !!g.linked?.has(i));
    if (now && !was) gain.push(t.name ?? 'a town'); else if (was && !now) lose.push(t.name ?? 'a town');
  }
  return (gain.length ? ` · 🚉 links ${gain.join(', ')}` : '') + (lose.length ? ` · ⚠ ${lose.join(', ')} loses its station: run the line straight past it` : '');
}
