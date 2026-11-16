import { restoreShed, type Shed } from '../buildings/shed.ts';
import type { Game } from '../state.ts';
import { bridgeJoinsIslands, bridgeSpans, squareCost, STRAIT_COST } from './rules.ts';
import { layPath } from './edit.ts';
import { stationLinkError } from '../buildings/stations.ts';
import { INDUSTRIES, joinYardEnds, linkedSquares, parkName, yardSquares, yardLinkError, yardSet } from '../buildings/industries.ts';
import type { TrackMap, TrackSquare } from './types.ts';
import { reveal } from '../world/fog.ts';

/** The track as it would be with this stroke laid (copies only what it touches). */
export function withPath(g: Game, path: number[]): TrackMap {
  const t: TrackMap = new Map(g.track);
  for (const i of path) { const o = t.get(i); if (o) t.set(i, { ...o }); }
  layPath(t, g.world.n, path);
  return t;
}

/** A track stroke being painted: squares in order, starting on the network. */
export interface PaintPlan {
  path: number[];
  /** reason the last square could not be added (shown, then cleared) */
  refused?: { square: number; why: string };
}

/** Squares new track may start from: existing track, or Ashford for the very first track. */
export function isAnchor(g: Game, i: number): boolean {
  if (g.track.has(i)) return g.linked ? g.linked.has(i) : true; // a loose yard is not part of the railway yet
  const a = g.s.sites[0]!;
  return i === a.y * g.world.n + a.x;
}

/**
 * A building not yet on the railway can start a line too: from a square of its loading track, or from one of the two
 * squares just past its ends (the line then starts at that end). Such a line is built only once it reaches the network.
 * Returns the line's first squares, or null.
 */
export function yardStart(g: Game, i: number): number[] | null {
  const n = g.world.n;
  for (const b of g.s.buildings ?? []) {
    const sq = yardSquares(n, b);
    if (g.linked?.has(sq[0]!) ?? true) continue; // already on the railway: its track is an anchor
    if (sq.includes(i)) return [i];
    const st = b.horizontal ? 1 : n;
    if (i === sq[0]! - st && !g.track.has(i)) return [sq[0]!, i];
    if (i === sq.at(-1)! + st && !g.track.has(i)) return [sq.at(-1)!, i];
  }
  return null;
}

/** The building whose loading track a line starts from, when it isn't on the railway yet. */
function looseStart(g: Game, p: PaintPlan) {
  const i = p.path[0]!; if (isAnchor(g, i)) return null;
  return (g.s.buildings ?? []).find(b => yardSquares(g.world.n, b).includes(i)) ?? null;
}

export function startPlan(g: Game, i: number): PaintPlan | null {
  if (isAnchor(g, i)) return { path: [i] };
  const y = yardStart(g, i);
  return y ? { path: y } : null;
}

/**
 * Whether a line that starts at a loose building reaches the railway once laid: walks the track as it would be
 * (yard ends joined, flat crossings only straight over) from the line's start until it meets a square on the railway.
 */
export function reachesNetwork(g: Game, path: number[]): boolean {
  const n = g.world.n, linked = g.linked ?? linkedSquares(g), t = withPath(g, path);
  const on = new Set(path), cross = new Set(crossedSquares(g, path));
  for (const b of g.s.buildings ?? []) { // a yard whose end the line touches joins it, as buildPlan does
    const sq = yardSquares(n, b), st = b.horizontal ? 1 : n;
    for (const [end, next, d] of [[sq[0]!, sq[0]! - st, b.horizontal ? 2 : 3], [sq.at(-1)!, sq.at(-1)! + st, b.horizontal ? 0 : 1]] as const) {
      if (!on.has(next) || !t.has(end) || !t.has(next)) continue;
      if (stationLinkError(t, n, g.s.sites, end, next, g.world.terr, yardSet(g)) || yardLinkError(g, end, next)) continue;
      t.set(end, { ...t.get(end)!, links: t.get(end)!.links | (1 << d) }); t.set(next, { ...t.get(next)!, links: t.get(next)!.links | (1 << ((d + 2) % 4)) });
    }
  }
  const a = g.s.sites[0]!, ash = a.y * n + a.x; // Ashford is where the railway starts, even before any track is down
  const step = [1, n, -1, -n], seen = new Set<number>(), q: [number, number][] = [[path[0]!, -1]];
  for (let h = 0; h < q.length; h++) {
    const [i, from] = q[h]!;
    if ((linked.has(i) || i === ash) && !cross.has(i)) return true;
    const sq = t.get(i); if (!sq) continue;
    for (let d = 0; d < 4; d++) {
      if (!(sq.links & (1 << d)) || (cross.has(i) && from >= 0 && d !== from)) continue; // over a crossing: straight on only
      const j = i + step[d]!, o = t.get(j); if (!o || !(o.links & (1 << ((d + 2) % 4)))) continue;
      const key = j * 4 + d; if (seen.has(key)) continue; seen.add(key); q.push([j, d]);
    }
  }
  return false;
}

/** Extend the stroke to square i (filling a diagonal jump; going back over the last square undoes it). */
export function extendPlan(g: Game, p: PaintPlan, i: number) {
  const n = g.world.n;
  for (let guard = 0; guard < 64; guard++) {
    const last = p.path.at(-1)!;
    if (last === i) return;
    if (p.path.at(-2) === i) { p.path.pop(); return; }
    const lx = last % n, ly = (last / n) | 0, tx = i % n, ty = (i / n) | 0;
    const next = lx !== tx ? ly * n + lx + Math.sign(tx - lx) : (ly + Math.sign(ty - ly)) * n + lx;
    if (next === p.path.at(-2)) { p.path.pop(); continue; }
    if (p.path.includes(next)) return; // no loops back onto the stroke itself
    const c = squareCost(g, next);
    if (typeof c === 'string' && !g.track.has(next)) { p.refused = { square: next, why: c }; return; }
    const st = stationLinkError(withPath(g, p.path), n, g.s.sites, last, next, g.world.terr, yardSet(g)) || yardLinkError(g, last, next);
    if (st) { p.refused = { square: next, why: st }; return; }
    p.path.push(next);
  }
}

/** Price of the new squares in a stroke (existing track is free to join). */
export function planCost(g: Game, p: PaintPlan): number {
  let c = 0;
  const strait = straitSquares(g, p);
  for (const i of p.path) if (!g.track.has(i)) { const k = strait.has(i) ? STRAIT_COST : squareCost(g, i); if (typeof k === 'number') c += k; }
  return c;
}

/** New water squares in this stroke that join two islands (a strait bridge, priced higher). */
export function straitSquares(g: Game, p: PaintPlan): Set<number> {
  const water = p.path.filter(i => !g.world.terr[i] && !g.track.has(i)), out = new Set<number>();
  if (!water.length) return out;
  const set = new Set([...g.track.keys(), ...p.path]);
  for (const s of bridgeSpans(g, water, j => set.has(j))) if (s.islands.size === 2) for (const i of s.squares) if (!g.track.has(i)) out.add(i);
  return out;
}

/** Why a stroke can't be built, or ''. */
export function planError(g: Game, p: PaintPlan): string {
  if (p.path.length < 2) return 'Drag or tap next to the track to add squares';
  for (const i of p.path) { const pk = !g.track.has(i) && (g.s.parks ?? []).find(q => q.y * g.world.n + q.x === i); if (pk) return `${parkName(g, pk)} is on this square: lay the track around it`; }
  const cost = planCost(g, p);
  for (let k = 1; k < p.path.length; k++) {
    const e = stationLinkError(withPath(g, p.path.slice(0, k)), g.world.n, g.s.sites, p.path[k - 1]!, p.path[k]!, g.world.terr, yardSet(g)) || yardLinkError(g, p.path[k - 1]!, p.path[k]!);
    if (e) return e;
  }
  // the island rule comes before the price: a crossing that can never be built must not read as "save up for it"
  const water = p.path.filter(i => !g.world.terr[i]);
  if (water.length) {
    const set = new Set([...g.track.keys(), ...p.path]), land = p.path.filter(i => g.world.terr[i]);
    const e = bridgeJoinsIslands(g, water, j => set.has(j), land.length ? g.world.islandOf[land.at(-1)!] : undefined);
    if (e) return e;
  }
  const loose = looseStart(g, p);
  if (loose && !reachesNetwork(g, p.path)) return `🔌 Not joined yet: run the line from the ${INDUSTRIES[loose.kind].name} on to your track to build it`;
  if (cost > g.s.money) return `Need $${Math.ceil(cost - g.s.money).toLocaleString('en-US')} more`;
  return '';
}

/** What one built stroke changed, so it can be undone. */
export interface BuiltStroke {
  /** track squares as they were before (undefined = no track there) */
  before: [number, TrackSquare | undefined][];
  cost: number;
  /** fog squares the new track uncovered: such a stroke can't be undone */
  revealed: number;
  /** where the engine shed stood before (null: no shed), so Undo puts it back if the new track moved it */
  shed?: Shed | null;
}

/** Track uncovers the land around it, this many squares out. */
export const TRACK_REVEAL = 3;

export function buildPlan(g: Game, p: PaintPlan): BuiltStroke | string {
  const e = planError(g, p);
  if (e) return e;
  const n = g.world.n, cost = planCost(g, p), fresh = p.path.filter(i => !g.track.has(i));
  const before: BuiltStroke['before'] = [...new Set(p.path)].map(i => { const o = g.track.get(i); return [i, o && { ...o }]; });
  const shed = g.s.shed ? { ...g.s.shed } : null;
  g.s.money -= cost;
  const over = crossedSquares(g, p.path);
  layPath(g.track, n, p.path);
  for (const i of over) g.track.get(i)!.cross = true;
  // a yard whose end touches the new track joins it there, as if the track were laid into it
  const on = new Set(p.path);
  for (const b of g.s.buildings ?? []) {
    const sq = yardSquares(n, b), st = b.horizontal ? 1 : n;
    if (!on.has(sq[0]! - st) && !on.has(sq.at(-1)! + st)) continue;
    for (const e of [sq[0]!, sq.at(-1)!, sq[0]! - st, sq.at(-1)! + st]) if (!before.some(([i]) => i === e)) { const o = g.track.get(e); before.push([e, o && { ...o }]); } // so Undo puts the yard back too
    joinYardEnds(g, b);
  }
  let revealed = 0;
  for (const i of fresh) revealed += reveal(g, i % n, (i / n) | 0, TRACK_REVEAL);
  return { before, cost, revealed, shed };
}

/** Squares where a stroke runs straight over a plain straight line at right angles: these become flat crossings. */
export function crossedSquares(g: Game, path: number[]): number[] {
  const out: number[] = [];
  for (let k = 1; k + 1 < path.length; k++) {
    const i = path[k]!, a = path[k - 1]!, b = path[k + 1]!, sq = g.track.get(i);
    if (!sq || b - i !== i - a) continue; // the stroke must go straight through
    const across = Math.abs(i - a) === 1 ? 0b1010 : 0b0101; // the old line runs at right angles: down-up for a stroke going sideways
    if (sq.links === across) out.push(i);
  }
  return out;
}

/** Put the track back as it was before a stroke and refund it. */
export function undoStroke(g: Game, b: BuiltStroke) {
  const moved = b.shed !== undefined && JSON.stringify(b.shed) !== JSON.stringify(g.s.shed ?? null);
  if (moved) restoreShed(g, b.shed); // take up the siding the shed got when it moved, before the old track comes back
  for (const [i, o] of b.before) { if (o) g.track.set(i, { ...o }); else g.track.delete(i); }
  g.s.money += b.cost;
}
