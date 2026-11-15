import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { bestPlacement, build, nearestSpot, yardSquares } from '../src/buildings/industries.ts';
import { buildPlan, undoStroke } from '../src/track/paint.ts';

describe('a yard end touching new track joins it', () => {
  it('links the yard to a line laid past its end, and Undo takes the link back', () => {
    const g = newGame(4242), a = g.s.sites[0]!, n = g.world.n; g.s.money = 1e6;
    const s = nearestSpot(g, 'farm', a.x, a.y)!, b = build(g, bestPlacement(g, 'farm', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    const ys = yardSquares(n, b), st = b.horizontal ? 1 : n, end = ys.at(-1)!, next = end + st;
    const side = b.horizontal ? n : 1; // a line crossing past the end, square by square
    expect(g.track.has(next)).toBe(false);
    const yard0 = JSON.stringify(ys.map(i => g.track.get(i)));
    // lay a short line through `next`, running across the yard's direction; it must start on the network, so fake that check by building directly
    const path = [next - side, next, next + side];
    for (const i of path) g.s.fog[i >> 3]! |= 1 << (i & 7);
    const r = buildPlan(g, { path, start: true } as never);
    if (typeof r === 'string') { expect(r).toBe(''); return; }
    const dir = b.horizontal ? 0 : 1; // out of the last end
    expect(g.track.get(end)!.links & (1 << dir)).toBeTruthy();
    expect(g.track.get(next)!.links & (1 << ((dir + 2) % 4))).toBeTruthy();
    undoStroke(g, r);
    expect(g.track.has(next)).toBe(false);
    expect(JSON.stringify(ys.map(i => g.track.get(i)))).toBe(yard0);
  });
});
