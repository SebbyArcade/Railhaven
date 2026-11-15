import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, nearestSpot, outputOf, yardSquares } from '../src/buildings/industries.ts';
import { checkPois, fallsMul, HALT_PAY, poisOf } from '../src/world/explore.ts';

describe('more landmarks: old halt, Silver Falls, ranger hut, old windmill', () => {
  it('are placed on the map once, older games included, and keep their places', () => {
    const g = newGame(4242), ps = poisOf(g), kinds = new Set(ps.map(p => p.kind));
    for (const k of ['halt', 'ranger', 'mill'] as const) expect(kinds.has(k)).toBe(true);
    const n = ps.length; expect(poisOf(g).length).toBe(n); // not added twice
    // an older game: landmarks saved before, no version mark
    const old = newGame(4242); old.s.pois = poisOf(old).filter(p => ['ruins', 'lighthouse', 'lookout', 'wreck'].includes(p.kind)); delete old.s.poiV;
    const keep = JSON.stringify(old.s.pois);
    const after = poisOf(old);
    expect(JSON.stringify(after.slice(0, JSON.parse(keep).length))).toBe(keep);
    expect(after.some(p => p.kind === 'ranger')).toBe(true);
    expect(new Set(after.map(p => p.id)).size).toBe(after.length);
  });

  it('pay or boost once your track reaches them', () => {
    const g = newGame(4242), ps = poisOf(g), n = g.world.n;
    const take = (k: string) => { const p = ps.find(x => x.kind === k)!; p.seen = true; g.linked!.add(p.y * n + p.x); checkPois(g); return p; };
    const m0 = g.s.money; const h = take('halt'); expect(h.got).toBe(true); expect(g.s.money).toBe(m0 + HALT_PAY);
    checkPois(g); expect(g.s.money).toBe(m0 + HALT_PAY); // once
    // a lumber camp near a ranger hut makes 10% more
    const r = ps.find(x => x.kind === 'ranger')!, a = g.s.sites[0]!;
    const s = nearestSpot(g, 'wood', r.x, r.y) ?? nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    trackChanged(g); g.linked!.add(yardSquares(n, b)[0]!);
    const before = outputOf(g, b); take('ranger');
    if (Math.hypot(r.x - b.x, r.y - b.y) <= 8) expect(outputOf(g, b)).toBeCloseTo(before * 1.1, 5); else expect(outputOf(g, b)).toBe(before);
    // Silver Falls: towns within 12 squares get 10% bigger rewards
    const f = ps.find(x => x.kind === 'falls');
    if (f) { expect(fallsMul(g, f.x + 3, f.y)).toBe(1); f.got = true; expect(fallsMul(g, f.x + 3, f.y)).toBe(1.1); expect(fallsMul(g, f.x + 20, f.y)).toBe(1); }
  });
});
