import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { bestPlacement, build, footprint, nearestSpot } from '../src/buildings/industries.ts';
import { poisOf, poiTapAt } from '../src/world/explore.ts';

describe('a tap beside a landmark', () => {
  it('opens the building standing there, not the landmark (Lumber Camp built beside old ruins)', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
    const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    const sq = footprint(n, b);
    // old ruins right beside the camp, as in his game
    const r = poisOf(g)[0]!; r.kind = 'ruins'; r.seen = true; r.got = false; r.x = (sq[0]! % n) + 1; r.y = ((sq[0]! / n) | 0) + 1;
    for (const i of sq) expect(poiTapAt(g, i)).toBeUndefined();
    // the landmark is still tapped from the free squares around it
    const free = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => (r.y + dy) * n + r.x + dx)).filter(i => !sq.includes(i));
    expect(free.length).toBeGreaterThan(0);
    for (const i of free) expect(poiTapAt(g, i)?.id).toBe(r.id);
  });
});
