import type { Game } from '../state.ts';
import { bridgeJoinsIslands, squareCost } from './rules.ts';
import { layPath } from './edit.ts';

/** A track stroke being painted: squares in order, starting on the network. */
export interface PaintPlan {
  path: number[];
  /** reason the last square could not be added (shown, then cleared) */
  refused?: { square: number; why: string };
}

/** Squares new track may start from: existing track, or Ashford for the very first track. */
export function isAnchor(g: Game, i: number): boolean {
  if (g.track.has(i)) return true;
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
  if (cost > g.s.money) return `Need $${(cost - g.s.money).toLocaleString('en-US')} more`;
  const water = p.path.filter(i => !g.world.terr[i]);
  if (water.length) {
    const set = new Set([...g.track.keys(), ...p.path]);
    const e = bridgeJoinsIslands(g, water, j => set.has(j));
    if (e) return e;
  }
  return '';
}

export function buildPlan(g: Game, p: PaintPlan): string {
  const e = planError(g, p);
  if (e) return e;
  g.s.money -= planCost(g, p);
  layPath(g.track, g.world.n, p.path);
  return '';
}
