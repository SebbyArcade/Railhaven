import type { Game } from '../state.ts';
import { isRevealed } from '../world/fog.ts';
import { T } from '../world/terrain.ts';

/** Track prices carried over from the old game: grass and forest $5, hills $15, tunnels $250 (after the Foundry). Bridges by distance from land. */
export const TRACK_COST = { flat: 5, hills: 15, tunnel: 250, bridge: [0, 500, 1500, 3500], double: 40 };
/** Bridges cost this much a minute for each square over water, to keep up (the old game's rule). */
export const BRIDGE_UPKEEP = 25;
const bridgeCache = new WeakMap<object, number>();
/** Track squares standing on water (bridges). Recounted whenever the rail network is rebuilt. */
export function bridgeSquares(g: Game): number {
  const c = bridgeCache.get(g.net); if (c !== undefined) return c;
  let n = 0; for (const i of g.track.keys()) if (g.world.terr[i] === T.Water) n++;
  bridgeCache.set(g.net, n); return n;
}
/** A bridge may reach at most this many squares out from land, and be at most this long. */
export const BRIDGE_MAX_FROM_LAND = 3;
export const BRIDGE_MAX_LEN = 8;
/** Bridge kinds by how far out from land they reach: wooden trestle, stone viaduct, steel truss. */
export const BRIDGE_NAMES = ['', 'Wooden trestle', 'Stone viaduct', 'Steel truss'];

/** Squares from the nearest land (0 on land). Computed lazily per world. */
const landDistCache = new WeakMap<object, Int16Array>();
export function landDistance(g: Game, i: number): number {
  let d = landDistCache.get(g.world.terr);
  if (!d) {
    const n = g.world.n, t = g.world.terr; d = new Int16Array(n * n).fill(-1); const q: number[] = [];
    for (let k = 0; k < n * n; k++) if (t[k]) { d[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) { const k = q[h]!, x = k % n, y = (k / n) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const X = x + a, Y = y + b; if (X < 0 || Y < 0 || X >= n || Y >= n) continue; const j = Y * n + X; if (d[j]! < 0) { d[j] = d[k]! + 1; q.push(j); } } }
    landDistCache.set(g.world.terr, d);
  }
  return d[i]!;
}

/** Can track go on this square at all, and what does it cost? A string is the reason it can't, in plain words. */
export function squareCost(g: Game, i: number): number | string {
  const n = g.world.n, x = i % n, y = (i / n) | 0;
  if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) return 'The edge of the map';
  if (!isRevealed(g, i)) return 'Unexplored fog: scout here first';
  const site = g.s.sites.find(s => s.x === x && s.y === y);
  if (site && site.kind !== 'town') return site.kind === 'plot' ? 'A settlement site: tap its 🚩 flag to found a town, then lay track onto it' : 'A deposit: build a mine on it instead';
  const t = g.world.terr[i]!;
  if (t === T.Mountain) return (g.s.parks ?? []).some(p => p.k === 'foundry') ? TRACK_COST.tunnel // ⛰ the Foundry digs tunnels
    : 'Mountains block track: build the ⛰ Foundry in Ashford (its card → Town projects) to dig tunnels';
  if (t === T.Water) {
    if (g.world.deep[i]) return 'Open sea: build a dock and use ships';
    const d = landDistance(g, i);
    if (d > BRIDGE_MAX_FROM_LAND) return `Too far from land for a bridge (max ${BRIDGE_MAX_FROM_LAND} squares out)`;
    return TRACK_COST.bridge[d]!;
  }
  return t === T.Hills ? TRACK_COST.hills : TRACK_COST.flat;
}

/** A strait bridge (after the 🌉 Bridge Works) may join two islands across at most this many squares of water, at this price a square. */
export const STRAIT_MAX = 3;
export const STRAIT_COST = 4000;
export const hasBridgeWorks = (g: Game) => (g.s.parks ?? []).some(p => p.k === 'bridgeworks');

/** Each run of bridge squares (water with track) through these water squares, and the islands its ends touch. */
export function bridgeSpans(g: Game, water: Iterable<number>, isTrack: (i: number) => boolean): { squares: number[]; islands: Set<number> }[] {
  const n = g.world.n, seen = new Set<number>(), out: { squares: number[]; islands: Set<number> }[] = [];
  for (const start of water) {
    if (seen.has(start)) continue;
    const q = [start], islands = new Set<number>(); seen.add(start);
    for (let h = 0; h < q.length; h++) {
      const k = q[h]!, x = k % n, y = (k / n) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const j = (y + b) * n + x + a; if (!isTrack(j)) continue;
        if (g.world.terr[j]) islands.add(g.world.islandOf[j]!);
        else if (!seen.has(j)) { seen.add(j); q.push(j); }
      }
    }
    out.push({ squares: q, islands });
  }
  return out;
}

/** A coast square facing another island across a shallow gap a bridge could seem to span. */
export interface StraitCoast { i: number; d: number; isl: number; other: number }
const straitCache = new WeakMap<object, StraitCoast[]>();
/**
 * Every coast edge (square i, side d: 0 E, 1 S, 2 W, 3 N) that looks across at most BRIDGE_MAX_LEN - 1 squares of
 * shallow water straight at a different island. Rails mode marks them, so a gap that looks like the same coast
 * shows it is another island before the player paints a bridge there. No drawing here.
 */
export function straitCoasts(g: Game): StraitCoast[] {
  const w = g.world, c = straitCache.get(w.islandOf); if (c) return c;
  const n = w.n, out: StraitCoast[] = [], D = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
  for (let i = 0; i < n * n; i++) {
    const a = w.islandOf[i]!; if (a < 0 || !w.terr[i]) continue;
    const x = i % n, y = (i / n) | 0;
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = D[d]!;
      for (let s = 1; s < BRIDGE_MAX_LEN; s++) {
        const X = x + dx * s, Y = y + dy * s; if (X < 0 || Y < 0 || X >= n || Y >= n) break;
        const j = Y * n + X;
        if (w.terr[j]) { if (s > 1 && w.islandOf[j]! >= 0 && w.islandOf[j] !== a) out.push({ i, d, isl: a, other: w.islandOf[j]! }); break; }
        if (w.deep[j]) break;
      }
    }
  }
  straitCache.set(w.islandOf, out); return out;
}

/** The name of the island a bridge would reach: the one the drag ends on, else the one in the set that none of the built track stands on yet. */
export function otherIslandName(g: Game, islands: Set<number>, across?: number): string {
  if (across !== undefined && islands.has(across) && g.world.islands[across]) return g.world.islands[across]!.name ?? 'a small island';
  const on = new Set<number>();
  for (const i of g.track.keys()) { const k = g.world.islandOf[i]!; if (islands.has(k)) on.add(k); if (on.size === islands.size) break; }
  const ks = [...islands], k = ks.find(k => !on.has(k)) ?? ks.find(k => k !== g.world.home) ?? ks[0]!;
  return g.world.islands[k]?.name ?? 'a small island';
}

/**
 * Bridges may cross rivers, lakes and inlets. Joining two islands takes the 🌉 Bridge Works and a short strait
 * (at most STRAIT_MAX squares of water); anything wider needs a dock and ships. Returns the reason if this layout breaks a rule.
 */
export function bridgeJoinsIslands(g: Game, water: Iterable<number>, isTrack: (i: number) => boolean, across?: number): string {
  for (const { squares, islands } of bridgeSpans(g, water, isTrack)) {
    if (islands.size > 2) return 'A bridge can join at most two islands';
    if (islands.size === 2) {
      if (!hasBridgeWorks(g)) return `The land across is ${otherIslandName(g, islands, across)}, another island: joining islands needs the 🌉 Bridge Works (Ashford, Railway level 6), or a dock and ships`;
      if (squares.length > STRAIT_MAX) return `A strait bridge between islands can cross at most ${STRAIT_MAX} squares of water (this one is ${squares.length}): for wider seas use a dock and ships`;
    }
    if (squares.length > BRIDGE_MAX_LEN) return `A bridge can be at most ${BRIDGE_MAX_LEN} squares long (this one is ${squares.length})`;
  }
  return '';
}
