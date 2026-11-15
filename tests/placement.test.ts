import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { badSquares, build, isLinked, placeError, yardSquares } from '../src/buildings/industries.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { reveal } from '../src/world/fog.ts';

/** A straight line out of Ashford, 12 squares, in the first direction that is clear. */
function line() {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
    g.s.money = 1e6; reveal(g, a.x, a.y, 16);
    const p = startPlan(g, a.y * n + a.x)!; for (let k = 1; k <= 12; k++) extendPlan(g, p, (a.y + dy * k) * n + a.x + dx * k);
    if (p.path.length < 13) continue;
    expect(buildPlan(g, p)).not.toBeTypeOf('string'); trackChanged(g);
    // a placement whose yard starts k squares out, shifted `off` squares sideways, lying along the line or across it
    const at = (k: number, off: number, along: boolean, side: 1 | -1) => {
      const x = a.x + dx * k + (dx ? 0 : off), y = a.y + dy * k + (dy ? 0 : off), horizontal = along ? dx !== 0 : dx === 0;
      return { kind: 'farm' as const, x: Math.min(x, x + (horizontal && dx ? 3 * dx : 0)), y: Math.min(y, y + (!horizontal && dy ? 3 * dy : 0)), horizontal, side };
    };
    return { g, n, a, at, dx };
  }
  throw new Error('no clear line');
}

describe('placing a building next to your line', () => {
  it('the loading track may sit on your own straight track running the same way: the yard joins the line', () => {
    const L = line(), { g, n } = L;
    let built = 0;
    for (const k of [4, 5, 6]) for (const side of [1, -1] as const) {
      if (built) break;
      const q = L.at(k, 0, true, side);
      const e = placeError(g, q);
      expect(e).not.toMatch(/track|built here/i);
      if (e) continue;
      const b = build(g, q); expect(b).not.toBeTypeOf('string'); if (typeof b === 'string') continue;
      trackChanged(g); expect(isLinked(g, b)).toBe(true);
      expect(yardSquares(n, b).every(i => g.track.has(i))).toBe(true);
      built++;
    }
    expect(built).toBe(1);
  });

  it('track under the green row, or crossing the loading track, is named and only those squares turn red', () => {
    const L = line(), { g, n } = L;
    // the building row on the line: yard one square to the side, building row back over the line
    let found = false;
    for (const k of [4, 5, 6]) for (const side of [1, -1] as const) for (const off of [1, -1]) {
      const q = L.at(k, off, true, side);
      if (!yardSquares(n, q).every(i => !g.track.has(i))) continue;
      const e = placeError(g, q); if (!/under the green/.test(e)) continue;
      expect(badSquares(g, q).length).toBe(4); found = true;
    }
    expect(found).toBe(true);
    // turned across the line: the loading track crosses it
    const across = L.at(4, 0, false, 1);
    expect(placeError(g, across)).toMatch(/crosses the blue loading track|under the green/);
    const bad = badSquares(g, across);
    expect(bad.length).toBeGreaterThan(0); expect(bad.length).toBeLessThan(8);
    expect(bad.every(i => g.track.has(i))).toBe(true);
  });
});
