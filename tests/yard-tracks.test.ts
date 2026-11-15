import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, footprint, nearestSpot, stripSquares, tracksOf, yardSquares } from '../src/buildings/industries.ts';
import { upgradeBuilding } from '../src/economy/upgrades.ts';

describe('more loading tracks as a building levels up', () => {
  it('adds a 3rd track at level 2 and a 4th at level 3, out on the strip beside the yard', () => {
    const g = newGame(4242), a = g.s.sites[0]!, n = g.world.n; g.s.money = 1e6;
    const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    trackChanged(g);
    const mid = yardSquares(n, b)[1]!, lanes = () => g.net.bySquare.get(mid)!.length;
    expect(lanes()).toBe(2); expect(tracksOf(b)).toBe(2);
    const strip = stripSquares(n, b);
    expect(strip.some(i => g.track.has(i))).toBe(false);
    expect(upgradeBuilding(g, b)).toBe(''); trackChanged(g);
    expect(tracksOf(b)).toBe(3); expect(lanes()).toBe(3);
    expect(footprint(n, b)).toEqual(expect.arrayContaining(strip)); // the strip is now the building's
    expect(upgradeBuilding(g, b)).toBe(''); trackChanged(g);
    expect(tracksOf(b)).toBe(4); expect(lanes()).toBe(4);
    // the extra lanes lie on the strip side, away from the building
    const ys = g.net.bySquare.get(mid)!.map(id => { const p = g.net.pieces[id]!; return b.horizontal ? p.pts[1]! : p.pts[0]!; });
    const centre = ((b.horizontal ? b.y : b.x) + 0.5) * 32, far = ys.map(v => (v - centre) * -b.side).sort((p, q) => q - p);
    expect(far[0]).toBeCloseTo(40); expect(far[1]).toBeCloseTo(24);
  });

  it('refuses the upgrade with the reason when the strip is taken', () => {
    const g = newGame(4242), a = g.s.sites[0]!, n = g.world.n; g.s.money = 1e6;
    const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    const st = stripSquares(n, b)[1]!; g.track.set(st, { links: 0 });
    const m0 = g.s.money, why = upgradeBuilding(g, b);
    expect(why).toContain('No room for another loading track'); expect(b.lvl).toBe(1); expect(g.s.money).toBe(m0);
  });
});
