import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, isLinked, yardSquares } from '../src/buildings/industries.ts';
import { buildPlan, extendPlan, planError, startPlan } from '../src/track/paint.ts';
import type { Game } from '../src/state.ts';

/** a loose farm near Ashford, after a short line out of Ashford is down */
function setup() {
  const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
  const line = startPlan(g, a.y * n + a.x)!; extendPlan(g, line, a.y * n + a.x + 4);
  if (typeof buildPlan(g, line) === 'string') throw new Error('no line'); trackChanged(g);
  let place = null;
  for (let r = 3; r < 9 && !place; r++) for (let dy = -r; dy <= r && !place; dy++) for (let dx = -r; dx <= r && !place; dx++) {
    const p = bestPlacement(g, 'farm', a.x + dx, a.y + dy); if (p.place) place = p.place;
  }
  const b = build(g, place!); if (typeof b === 'string') throw new Error(b);
  trackChanged(g);
  const ys = yardSquares(n, b), st = b.horizontal ? 1 : n;
  const ends = [ys[0]! - st, ys.at(-1)! + st];
  const dist = (i: number) => Math.abs(i % n - a.x) + Math.abs(((i / n) | 0) - a.y);
  const out = ends.sort((p, q) => dist(p) - dist(q))[0]!; // the gold square nearer Ashford
  return { g, n, a, b, ys, out };
}

/** run a line from the plan's end to square i: one square on out of the yard, then across the yard's way first, then along */
function runTo(g: Game, p: { path: number[] }, i: number, horizontal: boolean) {
  const n = g.world.n, l = p.path.at(-1)!, lx = l % n, ly = (l / n) | 0, tx = i % n, ty = (i / n) | 0;
  extendPlan(g, p as never, horizontal ? ty * n + lx : ly * n + tx); extendPlan(g, p as never, i);
}

describe('a line may start at a new building', () => {
  it('starting on a gold end square begins at the yard end; it builds only once it reaches the railway', () => {
    const { g, n, a, b, ys, out } = setup();
    expect(isLinked(g, b)).toBe(false);
    const p = startPlan(g, out)!;
    expect(p).not.toBeNull();
    expect(ys).toContain(p.path[0]);
    expect(p.path[1]).toBe(out);
    expect(planError(g, p)).toMatch(/Not joined yet/);
    expect(typeof buildPlan(g, p)).toBe('string'); // never builds loose track
    const tip = a.y * n + a.x + 4; // the end of the line out of Ashford
    runTo(g, p, tip, b.horizontal);
    expect(p.path.at(-1)).toBe(tip);
    expect(planError(g, p)).toBe('');
    const r = buildPlan(g, p); if (typeof r === 'string') throw new Error(r);
    trackChanged(g);
    expect(isLinked(g, b)).toBe(true);
  });

  it('squares away from a loose yard still cannot start a line', () => {
    const { g, n, out } = setup();
    expect(startPlan(g, out + 2 * n + 2)).toBeNull();
  });
});
