import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, isLinked, placeError, priceOf, yardSquares } from '../src/buildings/industries.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { tickProduction } from '../src/economy/production.ts';

const g0 = () => newGame(4242);

describe('industries and yards', () => {
  it('a lumber camp needs forest; the refusal says why', () => {
    const g = g0(), n = g.world.n, a = g.s.sites[0]!;
    // right next to Ashford there is open grass, no forest
    expect(placeError(g, { kind: 'wood', x: a.x + 2, y: a.y + 3, horizontal: true, side: 1 })).toMatch(/forest|built/);
    // somewhere revealed with forest around works
    let ok = null;
    for (let r = 2; r < 9 && !ok; r++) for (let dy = -r; dy <= r && !ok; dy++) for (let dx = -r; dx <= r && !ok; dx++) {
      const p = bestPlacement(g, 'wood', a.x + dx, a.y + dy); if (p.place) ok = p.place;
    }
    expect(ok).not.toBeNull();
    const before = g.s.money, b = build(g, ok!);
    if (typeof b === 'string') throw new Error(b);
    expect(g.s.money).toBe(before - 600);
    expect(priceOf(g, 'wood')).toBe(750); // +25% for the next one
    for (const i of yardSquares(n, b)) expect(g.track.has(i)).toBe(true);
  });

  it('a yard is not part of the railway until track reaches it, then it produces', () => {
    const g = g0(), n = g.world.n, a = g.s.sites[0]!;
    let place = null;
    for (let r = 2; r < 9 && !place; r++) for (let dy = -r; dy <= r && !place; dy++) for (let dx = -r; dx <= r && !place; dx++) {
      const p = bestPlacement(g, 'farm', a.x + dx, a.y + dy); if (p.place) place = p.place;
    }
    const b = build(g, place!); if (typeof b === 'string') throw new Error(b);
    trackChanged(g);
    expect(isLinked(g, b)).toBe(false);
    expect(startPlan(g, yardSquares(n, b)[0]!)).toBeNull(); // can't start track from a loose yard
    tickProduction(g, 10); expect(b.stock).toBe(0);
    // lay track from Ashford to the yard's nearer end
    const ys = yardSquares(n, b), end = [ys[0]!, ys.at(-1)!].sort((p, q) => Math.hypot(p % n - a.x, (p / n | 0) - a.y) - Math.hypot(q % n - a.x, (q / n | 0) - a.y))[0]!;
    const step = b.horizontal ? (end === ys[0] ? -1 : 1) : (end === ys[0] ? -n : n);
    const p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, end + step); extendPlan(g, p, end);
    const r = buildPlan(g, p);
    if (typeof r === 'string') throw new Error(r + ' path ' + p.path.length + ' ' + JSON.stringify(p.refused));
    trackChanged(g);
    expect(isLinked(g, b)).toBe(true);
    tickProduction(g, 10); expect(b.stock).toBeGreaterThan(0);
  });
});
