import { describe, expect, it } from 'vitest';
import { newGame, START_REVEAL, trackChanged } from '../src/game.ts';
import { isRevealed, reveal } from '../src/world/fog.ts';
import { bestPlacement, build, isLinked, noSpotText, placeError, priceOf, yardSquares } from '../src/buildings/industries.ts';
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

  it('deposits in the fog stay hidden at the start, but a quarry and a coal mine fit somewhere on the home island', () => {
    for (const seed of [4242, 1, 77, 123456, 999]) {
      const g = newGame(seed), a = g.s.sites[0]!, n = g.world.n, home = g.world.islandOf[a.y * n + a.x];
      // only the land around Ashford is uncovered: no far-off patch revealed for a deposit
      for (let i = 0; i < n * n; i++) if (isRevealed(g, i)) expect(Math.hypot(i % n - a.x, ((i / n) | 0) - a.y), `seed ${seed}`).toBeLessThanOrEqual(START_REVEAL + 1);
      for (const k of ['stone', 'coal'] as const) {
        const deps = g.s.sites.filter(s => s.kind === 'dep' && s.res === k && !s.hidden && g.world.islandOf[s.y * n + s.x] === home);
        const fits = deps.some(d => { const fog = g.s.fog.slice(); reveal(g, d.x, d.y, 4); const ok = !!bestPlacement(g, k, d.x, d.y).place; g.s.fog = fog; return ok; });
        expect(fits, `${k} on seed ${seed}`).toBe(true);
      }
    }
    expect(noSpotText('stone')).toMatch(/must be found/);
  });

  it('a yard placed with its end against existing track joins it', () => {
    let tried = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const g = g0(), n = g.world.n, a = g.s.sites[0]!, at = (k: number) => (a.y + dy * k) * n + a.x + dx * k;
      // a straight line out of Ashford; then a yard (a sawmill: it fits on any flat land) continuing it
      const p = startPlan(g, at(0))!; for (let k = 1; k <= 4; k++) extendPlan(g, p, at(k));
      if (typeof buildPlan(g, p) === 'string') continue;
      trackChanged(g); g.s.rlv = 1;
      const horizontal = dx !== 0, x = dx < 0 ? a.x - 8 : dx > 0 ? a.x + 5 : a.x, y = dy < 0 ? a.y - 8 : dy > 0 ? a.y + 5 : a.y;
      for (const side of [1, -1] as const) {
        const q = { kind: 'sawmill' as const, x, y, horizontal, side };
        if (placeError(g, q)) continue;
        const b = build(g, q); if (typeof b === 'string') continue;
        trackChanged(g); tried++;
        expect(g.track.get(at(4))!.links & (1 << (dx > 0 ? 0 : dx < 0 ? 2 : dy > 0 ? 1 : 3))).toBeTruthy();
        expect(isLinked(g, b)).toBe(true);
        break;
      }
    }
    expect(tried).toBeGreaterThan(0);
  });
});
