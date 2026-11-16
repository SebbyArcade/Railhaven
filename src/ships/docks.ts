import type { Game } from '../state.ts';
import { type Building, buildingSquares, yardSquares } from '../buildings/industries.ts';
import { reveal } from '../world/fog.ts';
import { isleMembers, railIsle } from '../track/isles.ts';

/**
 * Docks and landings. A dock is a 2×4 building whose pier stands over the water and whose yard is on the shore.
 * A dock on Ashford's island joins the railway by track like any building. A dock on another island (a landing)
 * can only be built within sea reach of a dock that is already on the railway; it then starts that island's own
 * railway: its yard counts as joined, and new track there may start from it.
 */

/** How far a dock reaches by sea, by level (squares of water sailed). */
export const DOCK_RANGE = [40, 70, 110];
export const dockRange = (b: Building) => DOCK_RANGE[Math.min(b.lvl, DOCK_RANGE.length) - 1]!;
export const isDock = (b: Building) => b.kind === 'dock';

/** The island a building stands on (its yard's land mass). */
export const islandOfB = (g: Game, b: Building) => g.world.islandOf[yardSquares(g.world.n, b)[0]!]!;

/** An island's name in plain words (small islets have no name of their own). */
export const islandName = (g: Game, k: number) => k === g.world.home ? 'Ashford Isle' : g.world.islands[k]?.name ?? 'Small island';

/** The rail island a building stands on: its island, joined with any island a 🌉 bridge links to it by rail. */
export const railIsleOfB = (g: Game, b: Building) => railIsle(g, islandOfB(g, b));

/** A rail island's name: "Ashford Isle", or "Ashford Isle and Gull Rock" when a bridge joins them (small islets left out). */
export function railIsleName(g: Game, k: number): string {
  if (k < 0) return 'On bridges';
  const named = isleMembers(g, k).filter(i => i === g.world.home || g.world.islands[i]?.name).map(i => islandName(g, i));
  if (named.length <= 1) return named[0] ?? islandName(g, k);
  return named.length === 2 ? `${named[0]} and ${named[1]}` : `${named[0]} and ${named.length - 1} more islands`;
}

/** Squares of water sailed from this dock's pier to every water square (-1 = can't reach). Cached per dock and level. */
export function seaDist(g: Game, b: Building): Int32Array {
  const key = `${b.id}:${b.x},${b.y},${b.horizontal},${b.side}`;
  const cache = (g.seaCache ??= new Map());
  const hit = cache.get(key); if (hit) return hit;
  const n = g.world.n, t = g.world.terr, d = new Int32Array(n * n).fill(-1), q: number[] = [];
  for (const i of buildingSquares(n, b)) if (!t[i]) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!, x = i % n, y = (i / n) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
      const j = Y * n + X; if (t[j] || d[j]! >= 0) continue;
      d[j] = d[i]! + 1; q.push(j);
    }
  }
  cache.set(key, d);
  return d;
}

/** Sea squares from dock a to the nearest pier water square of placement p (-1 if out of its reach). */
function seaTo(g: Game, a: Building, p: Pick<Building, 'x' | 'y' | 'horizontal' | 'side'>): number {
  const d = seaDist(g, a), n = g.world.n; let best = -1;
  for (const i of buildingSquares(n, p)) { const v = d[i]!; if (v >= 0 && (best < 0 || v < best)) best = v; }
  return best;
}

/** Docks on the railway (joined to Ashford, or landings reached from one). */
export const linkedDocks = (g: Game) => (g.s.buildings ?? []).filter(b => isDock(b) && g.linked?.has(yardSquares(g.world.n, b)[0]!));

/**
 * The best dock on the railway that reaches a dock placed at p: { from, d } or null, plus the nearest one's
 * distance when none reaches (for the refusal text).
 */
export function reachFrom(g: Game, p: Pick<Building, 'x' | 'y' | 'horizontal' | 'side'>, docks = linkedDocks(g)): { from: Building | null; d: number; nearest: number; need: number } {
  let from: Building | null = null, bd = Infinity, nearest = Infinity, need = 0;
  for (const a of docks) {
    const d = seaTo(g, a, p); if (d < 0) continue;
    if (d <= dockRange(a) && d < bd) { bd = d; from = a; }
    if (d < nearest) { nearest = d; need = d; }
  }
  return { from, d: bd, nearest, need };
}

/** Why a dock can't go here (sea reach, for landings on other islands), or ''. */
export function dockReachError(g: Game, p: Pick<Building, 'x' | 'y' | 'horizontal' | 'side' | 'kind'>): string {
  const n = g.world.n, isl = g.world.islandOf[yardSquares(n, p)[0]!]!;
  if (!buildingSquares(n, p).some(i => g.world.ocean[i])) return 'This water is a lake: a dock needs the open sea';
  if (isl === g.world.home) return '';
  const r = reachFrom(g, p);
  if (r.from) return '';
  if (!linkedDocks(g).some(b => islandOfB(g, b) === g.world.home)) return 'This is another island: first build a Dock on Ashford Isle and join it to your railway, then land here';
  if (r.nearest === Infinity) return 'No dock of yours can sail here';
  const lvl = DOCK_RANGE.findIndex(x => x >= r.need);
  return `Too far by sea: your nearest dock is ${r.nearest} squares away and reaches ${Math.max(...linkedDocks(g).map(dockRange))}${lvl >= 0 ? `. A level ${lvl + 1} dock reaches it` : ''}`;
}

/** Landings joined to the railway: yards of docks on other islands within reach of a dock already joined. */
export function landingSeeds(g: Game, linked: Set<number>): number[] {
  const n = g.world.n, out: number[] = [];
  const docks = (g.s.buildings ?? []).filter(isDock);
  const on = docks.filter(b => linked.has(yardSquares(n, b)[0]!));
  for (const b of docks) {
    if (on.includes(b) || g.world.islandOf[yardSquares(n, b)[0]!] === g.world.home) continue;
    if (reachFrom(g, b, on).from) out.push(...yardSquares(n, b));
  }
  return out;
}

/**
 * A dock on the railway charts all the sea it can reach: water there, and the shore two squares in, come out of the
 * fog, so every island it can land on shows (Sébastien, 2026-11-16: landings looked in reach but sat in the fog).
 * The islands' inland stays for scouts, track and landings to find.
 */
export const CHART_SHORE = 2;

/** Chart a dock's sea reach. Docks charted before the whole reach was charted (no chartAll) chart the rest once. */
export function chartSea(g: Game, b: Building): number {
  const R = dockRange(b); if ((b.chart ?? 0) >= R && b.chartAll) return 0;
  const d = seaDist(g, b), n = g.world.n; let k = 0;
  for (let i = 0; i < n * n; i++) {
    const v = d[i]!; if (v < 0 || v > R) continue;
    // water by the shore: the shore two squares in; open water: just itself and its neighbours
    const x = i % n, y = (i / n) | 0, coast = [i + 1, i - 1, i + n, i - n].some(j => g.world.terr[j]);
    k += reveal(g, x, y, coast ? CHART_SHORE : 1);
  }
  for (const i of yardSquares(n, b)) k += reveal(g, i % n, (i / n) | 0, 4);
  b.chart = R; b.chartAll = true;
  return k;
}
