import type { Game } from '../state.ts';
import { isRevealed } from '../world/fog.ts';
import { T } from '../world/terrain.ts';

/** Track prices carried over from the old game: grass and forest $5, hills $15. Bridges by distance from land. */
export const TRACK_COST = { flat: 5, hills: 15, bridge: [0, 500, 1500, 3500], double: 10 };
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
  if (site && site.kind !== 'town') return site.kind === 'plot' ? 'A settlement site: found a town here first' : 'A deposit: build a mine on it instead';
  const t = g.world.terr[i]!;
  if (t === T.Mountain) return 'Mountains block track (tunnels come later)';
  if (t === T.Water) {
    if (g.world.deep[i]) return 'Open sea: build a dock and use ships';
    const d = landDistance(g, i);
    if (d > BRIDGE_MAX_FROM_LAND) return `Too far from land for a bridge (max ${BRIDGE_MAX_FROM_LAND} squares out)`;
    return TRACK_COST.bridge[d]!;
  }
  return t === T.Hills ? TRACK_COST.hills : TRACK_COST.flat;
}

/** Bridges may cross rivers, lakes and inlets, never join two islands. Returns the reason if this layout does. */
export function bridgeJoinsIslands(g: Game, water: Iterable<number>, isTrack: (i: number) => boolean): string {
  const n = g.world.n, seen = new Set<number>();
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
    if (islands.size > 1) return 'A bridge can\'t join two islands: build a dock and ship goods across';
    if (q.length > BRIDGE_MAX_LEN) return `A bridge can be at most ${BRIDGE_MAX_LEN} squares long (this one is ${q.length})`;
  }
  return '';
}
