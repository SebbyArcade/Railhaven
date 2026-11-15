import { expect } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { build, isLinked, placeError, placementsAt, yardSquares, type Building } from '../src/buildings/industries.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { squareCost } from '../src/track/rules.ts';
import { reveal } from '../src/world/fog.ts';
import { dockRange, seaDist } from '../src/ships/docks.ts';
import type { Game } from '../src/state.ts';

/** Lay track from any joined square to a target (breadth-first, painted square by square). */
export function lay(g: Game, target: number): boolean {
  const n = g.world.n, from = new Map<number, number>(), q: number[] = [];
  for (const i of g.linked ?? []) { from.set(i, -1); q.push(i); }
  let hit = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const i = q[h]!;
    for (const d of [1, -1, n, -n]) {
      const j = i + d; if (from.has(j)) continue;
      if (j === target) { from.set(j, i); hit = j; break; }
      if (g.track.has(j) || typeof squareCost(g, j) === 'string') continue;
      from.set(j, i); q.push(j);
    }
  }
  if (hit < 0) return false;
  const path: number[] = []; for (let i = hit; i !== -1; i = from.get(i)!) path.unshift(i);
  const p = startPlan(g, path[0]!)!; for (const i of path.slice(1)) extendPlan(g, p, i);
  if (typeof buildPlan(g, p) === 'string') return false;
  trackChanged(g); return true;
}

export function linkB(g: Game, b: Building): boolean {
  const n = g.world.n, ys = yardSquares(n, b);
  for (const end of [ys[0]!, ys.at(-1)!]) {
    const step = b.horizontal ? (end === ys[0] ? -1 : 1) : (end === ys[0] ? -n : n);
    if (typeof squareCost(g, end + step) === 'string') continue;
    if (lay(g, end + step)) { const p = startPlan(g, end + step)!; extendPlan(g, p, end); if (typeof buildPlan(g, p) !== 'string') { trackChanged(g); if (isLinked(g, b)) return true; } }
  }
  return false;
}

/** A game with the whole map uncovered, a dock on Ashford Isle joined to the railway and a landing on another island. */
export function dockAndLanding(seed: number): { g: Game; dock: Building; landing: Building } {
    const g = newGame(seed), n = g.world.n, a = g.s.sites[0]!;
    g.s.money = 1e6; g.s.rlv = 1;
    reveal(g, n / 2, n / 2, n); // the whole map, so the test can pick spots
    // a line out of Ashford first
    const p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, a.y * n + a.x + 3); buildPlan(g, p); trackChanged(g);
    // the nearest home-island dock spot to Ashford that can be joined up
    const spots: { q: Parameters<typeof build>[1]; d: number }[] = [];
    for (let i = 0; i < n * n; i++) {
      if (g.world.terr[i] || !g.world.ocean[i]) continue;
      const x = i % n, y = (i / n) | 0, dd = Math.hypot(x - a.x, y - a.y); if (dd > 40) continue;
      for (const q of placementsAt('dock', x, y)) if (g.world.islandOf[yardSquares(n, q)[0]!] === g.world.home && !placeError(g, q)) spots.push({ q, d: dd });
    }
    spots.sort((p, q) => p.d - q.d);
    let dock: Building | null = null;
    for (const s of spots.slice(0, 60)) { const b = build(g, s.q); if (typeof b === 'string') continue; trackChanged(g); if (linkB(g, b)) { dock = b; break; } }
    expect(dock).not.toBeNull(); if (!dock) throw new Error('no dock');
    // a landing on another island within reach
    const d = seaDist(g, dock); let landing: Building | null = null;
    for (let i = 0; i < n * n && !landing; i++) {
      if (d[i]! < 0 || d[i]! > dockRange(dock)) continue;
      for (const q of placementsAt('dock', i % n, (i / n) | 0)) {
        const isl = g.world.islandOf[yardSquares(n, q)[0]!]!;
        if (isl < 0 || isl === g.world.home || placeError(g, q)) continue;
        const b = build(g, q); if (typeof b === 'string') continue;
        trackChanged(g); landing = b; break;
      }
    }
    expect(landing).not.toBeNull();
    if (!landing) throw new Error('no landing');
    return { g, dock, landing };
}
