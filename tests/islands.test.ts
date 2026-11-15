import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { islandSpec, specMul } from '../src/world/specialty.ts';
import { isCoastal, orderOf, upgradeTown } from '../src/economy/towns.ts';
import { buyFishing } from '../src/economy/upgrades.ts';
import { islandOfB } from '../src/ships/docks.ts';
import { dockAndLanding } from './sea.ts';

describe('island resources and specialties', () => {
  it('iron and oil lie only on outer islands, and every named outer island has a specialty, and they differ', () => {
    for (const seed of [4242, 7, 99]) {
      const g = newGame(seed), n = g.world.n;
      for (const s of g.s.sites) if (s.kind === 'dep' && (s.res === 'iron' || s.res === 'oil')) expect(g.world.islandOf[s.y * n + s.x]).not.toBe(g.world.home);
      expect(islandSpec(g, g.world.home)).toBeNull();
      g.world.islands.forEach((isl, k) => { if (k !== g.world.home && isl.name) expect(islandSpec(g, k)).not.toBeNull(); });
      // islands differ
      const kinds = new Set(g.world.islands.map((_, k) => islandSpec(g, k)).filter(Boolean));
      expect(kinds.size).toBeGreaterThanOrEqual(3);
      const k = g.world.islands.findIndex((o, i) => i !== g.world.home && o.name);
      const sp = islandSpec(g, k)!;
      expect(specMul(g, k, sp)).toBe(1.5);
      expect(specMul(g, g.world.home, sp)).toBe(1);
    }
  });

  it("a landing's crew surveys its island: hidden iron there comes into view", () => {
    const { g, landing } = dockAndLanding(4242), n = g.world.n, k = islandOfB(g, landing);
    let sq = -1; for (let i = 0; i < n * n && sq < 0; i++) if (g.world.islandOf[i] === k && g.world.terr[i] && !g.s.sites.some(s => s.y * n + s.x === i)) sq = i;
    const dep = { id: g.s.nextId++, kind: 'dep' as const, x: sq % n, y: (sq / n) | 0, res: 'iron' as const, hidden: true };
    g.s.sites.push(dep); trackChanged(g);
    expect(dep.hidden).toBe(false);
    expect((g.news ?? []).some(m => m.includes('iron found'))).toBe(true);
  });

  it('a town by the sea with a fishing dock on its island orders seafood from its next step', () => {
    const { g, dock } = dockAndLanding(4242);
    const t = g.s.sites.find(s => s.kind === 'town' && isCoastal(g, s) && g.world.islandOf[s.y * g.world.n + s.x] === islandOfB(g, dock))!;
    expect(t).toBeDefined();
    expect(orderOf(g, t).fish).toBeUndefined();
    buyFishing(g, dock);
    t.got = { ...orderOf(g, t) };
    expect(upgradeTown(g, t)).toBe('');
    expect(orderOf(g, t).fish).toBe(35);
  });
});
