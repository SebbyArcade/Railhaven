import { describe, expect, it } from 'vitest';
import { tickProduction } from '../src/economy/production.ts';
import { shipPlan } from '../src/economy/shipping.ts';
import { buyFishing, FISHING } from '../src/economy/upgrades.ts';
import { isCoastal, steadyGoods } from '../src/economy/towns.ts';
import { dockAndLanding } from './sea.ts';

describe('fishing', () => {
  it('fishing boats land a catch at the dock, which trains take to a town', () => {
    const { g, dock } = dockAndLanding(4242);
    expect(buyFishing(g, dock)).toBe('');
    expect(dock.fish).toBe(1);
    for (let k = 0; k < 20 * 60; k++) tickProduction(g, 0.05);
    expect(Math.round(dock.landed?.fish ?? 0)).toBe(30);
    expect(dock.landed?.shellfish ?? 0).toBe(0);
    expect(shipPlan(g).docks.get(`${dock.id}/fish`)?.to.kind).toBe('town');
    // shellfish traps at the top level
    expect(buyFishing(g, dock)).toBe(''); expect(buyFishing(g, dock)).toBe('');
    for (let k = 0; k < 20 * 10; k++) tickProduction(g, 0.05);
    expect(dock.landed?.shellfish).toBeGreaterThan(2);
    expect(buyFishing(g, dock)).toMatch(/top level/);
    expect(FISHING.length).toBe(3);
  });

  it('towns by the sea buy fish, and shellfish from Town size', () => {
    const { g } = dockAndLanding(4242);
    const coast = g.s.sites.find(t => t.kind === 'town' && isCoastal(g, t))!;
    expect(coast).toBeDefined();
    expect(steadyGoods(coast, g)).toContain('fish');
    expect(steadyGoods(coast, g)).not.toContain('shellfish');
    coast.lvl = 2;
    expect(steadyGoods(coast, g)).toContain('shellfish');
    expect(isCoastal(g, g.s.sites[0]!)).toBe(false); // Ashford has no sea within 8 squares
  });
});
