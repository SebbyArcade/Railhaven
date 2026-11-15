import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { checkPois, poisOf, POI_RARITY } from '../src/world/explore.ts';
import { recommendedBuild } from '../src/progress/missions.ts';
import { lockedText } from '../src/buildings/industries.ts';

describe('discovery cards and the recommended build', () => {
  it('queues a landmark for its card the moment it comes out of the fog, once', () => {
    const g = newGame(4242), n = g.world.n, p = poisOf(g).find(x => !x.seen)!;
    g.found = [];
    const i = p.y * n + p.x; g.s.fog[i >> 3]! |= 1 << (i & 7);
    checkPois(g); expect(g.found).toContain(p.id);
    g.found = []; checkPois(g); expect(g.found).not.toContain(p.id);
    expect(POI_RARITY.falls).toBe(2); expect(POI_RARITY.ruins).toBe(0);
  });

  it('recommends something buildable in a new game', () => {
    const g = newGame(4242), r = recommendedBuild(g);
    expect(r).not.toBe(null); expect(lockedText(g, r!.k)).toBe(''); expect(r!.why.length).toBeGreaterThan(0);
  });
});
