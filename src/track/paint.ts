import type { Game } from '../state.ts';
import { bridgeJoinsIslands, squareCost } from './rules.ts';
import { layPath } from './edit.ts';
import { stationLinkError } from '../buildings/stations.ts';
import { yardLinkError } from '../buildings/industries.ts';
import type { TrackMap, TrackSquare } from './types.ts';
import { reveal } from '../world/fog.ts';

/** The track as it would be with this stroke laid (copies only what it touches). */
function withPath(g: Game, path: number[]): TrackMap {
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

export function startPlan(g: Game, i: number): PaintPlan | null {
  return isAnchor(g, i) ? { path: [i] } : null;
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
    const st = stationLinkError(withPath(g, p.path), n, g.s.sites, last, next) || yardLinkError(g, last, next);
    if (st) { p.refused = { square: next, why: st }; return; }
    p.path.push(next);
  }
}

/** Price of the new squares in a stroke (existing track is free to join). */
export function planCost(g: Game, p: PaintPlan): number {
  let c = 0;
  for (const i of p.path) if (!g.track.has(i)) { const k = squareCost(g, i); if (typeof k === 'number') c += k; }
  return c;
}

/** Why a stroke can't be built, or ''. */
export function planError(g: Game, p: PaintPlan): string {
  if (p.path.length < 2) return 'Drag or tap next to the track to add squares';
  const cost = planCost(g, p);
  for (let k = 1; k < p.path.length; k++) {
    const e = stationLinkError(withPath(g, p.path.slice(0, k)), g.world.n, g.s.sites, p.path[k - 1]!, p.path[k]!) || yardLinkError(g, p.path[k - 1]!, p.path[k]!);
    if (e) return e;
  }
  if (cost > g.s.money) return `Need $${(cost - g.s.money).toLocaleString('en-US')} more`;
  const water = p.path.filter(i => !g.world.terr[i]);
  if (water.length) {
    const set = new Set([...g.track.keys(), ...p.path]);
    const e = bridgeJoinsIslands(g, water, j => set.has(j));
    if (e) return e;
  }
  return '';
}

/** What one built stroke changed, so it can be undone. */
export interface BuiltStroke {
  /** track squares as they were before (undefined = no track there) */
  before: [number, TrackSquare | undefined][];
  cost: number;
  /** fog squares the new track uncovered: such a stroke can't be undone */
  revealed: number;
}

/** Track uncovers the land around it, this many squares out. */
export const TRACK_REVEAL = 3;

export function buildPlan(g: Game, p: PaintPlan): BuiltStroke | string {
  const e = planError(g, p);
  if (e) return e;
  const n = g.world.n, cost = planCost(g, p), fresh = p.path.filter(i => !g.track.has(i));
  const before: BuiltStroke['before'] = [...new Set(p.path)].map(i => { const o = g.track.get(i); return [i, o && { ...o }]; });
  g.s.money -= cost;
  layPath(g.track, n, p.path);
  let revealed = 0;
  for (const i of fresh) revealed += reveal(g, i % n, (i / n) | 0, TRACK_REVEAL);
  return { before, cost, revealed };
}

/** Put the track back as it was before a stroke and refund it. */
export function undoStroke(g: Game, b: BuiltStroke) {
  for (const [i, o] of b.before) { if (o) g.track.set(i, { ...o }); else g.track.delete(i); }
  g.s.money += b.cost;
}
