import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { placeError, placementsAt } from '../src/buildings/industries.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { FOUND_PRICE, foundTown, townLinked } from '../src/economy/towns.ts';
import { reveal } from '../src/world/fog.ts';
import { T } from '../src/world/terrain.ts';

describe('play notes', () => {
  it('a straight line running right beside a town serves it as a station', () => {
    let tried = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!, at = (k: number) => (a.y + dy * k) * n + a.x + dx * k;
      // another town moved so the line out of Ashford passes on the square right beside it
      const t = g.s.sites.find(s => s.kind === 'town' && s !== a)!;
      t.x = a.x + dx * 5 + dy; t.y = a.y + dy * 5 + dx; reveal(g, t.x, t.y, 3);
      const p = startPlan(g, at(0))!; for (let k = 1; k <= 8; k++) extendPlan(g, p, at(k));
      if (p.path.length < 9) continue;
      expect(buildPlan(g, p)).not.toBeTypeOf('string');
      trackChanged(g); tried++;
      expect(townLinked(g, t)).toBe(true);
    }
    expect(tried).toBeGreaterThan(0);
  });

  it('a settlement site becomes a town for the founding price', () => {
    const g = newGame(4242), p = g.s.sites.find(s => s.kind === 'plot')!;
    g.s.money = FOUND_PRICE - 1;
    expect(foundTown(g, p)).toMatch(/more/);
    g.s.money = FOUND_PRICE + 10;
    expect(foundTown(g, p)).toBe('');
    expect(p.kind).toBe('town'); expect(p.pop).toBeGreaterThan(0); expect(g.s.money).toBe(10);
  });

  it('a sheep farm only stands on grassland', () => {
    const g = newGame(4242), n = g.world.n, t = g.world.terr;
    let hills = 0;
    for (let i = 0; i < n * n && hills < 30; i++) {
      if (t[i] !== T.Hills) continue;
      reveal(g, i % n, (i / n) | 0, 3);
      for (const q of placementsAt('wool', i % n, (i / n) | 0)) { hills++; expect(placeError(g, q)).not.toBe(''); }
    }
    expect(hills).toBeGreaterThan(0);
  });
});
