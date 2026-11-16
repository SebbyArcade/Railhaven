import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { overseas, steadyFull, steadyGoods, waitsAbroad } from '../src/economy/towns.ts';
import { shipPlan } from '../src/economy/shipping.ts';
import type { Game } from '../src/state.ts';

// Playtests 2026-11-16: once every town on Ashford Isle orders steel (iron only comes from the outer islands), deliveries
// paid only the steady share and income went flat while the player still had to save up to sail. Now a town whose order
// waits on goods from the outer islands pays full price for the other goods of that order (still only for deliveries).
const his = (f: string) => { const raw = fs.readFileSync(`tests/saves/${f}`, 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };

describe('a town waiting on the outer islands keeps paying for its order goods', () => {
  it('his save: Ashford waits on steel (no iron mine yet), so planks, bricks, wheat and flour pay in full', () => {
    const g = his('save-seb-2026-11-16d.json'), ash = g.s.sites[0]!;
    expect(overseas(g, 'steel')).toBe(true);
    expect(overseas(g, 'planks')).toBe(false);
    expect(waitsAbroad(g, ash)).toEqual(['steel']);
    expect(steadyGoods(ash, g)).toContain('flour'); // an order good from this step only: bought steadily too
    for (const k of ['planks', 'bricks', 'farm', 'flour'] as const) expect(steadyFull(g, ash, k)).toBe(true);
    expect(steadyFull(g, ash, 'wood')).toBe(false); // not in this order: the usual share
    expect(steadyFull(g, ash, 'steel')).toBe(false);
    // the Sawmill's planks go to Ashford on that full pay
    const s = shipPlan(g).get(10)!;
    expect(s.why).toBe('steady'); expect(s.full).toBe(true);
  });
  it('a town whose order needs only home goods pays the usual steady share', () => {
    const g = his('save-seb-2026-11-16d.json'), t = g.s.sites.find(s => s.name === 'Marrow Cove')!;
    expect(waitsAbroad(g, t)).toEqual([]);
    expect(steadyFull(g, t, 'farm')).toBe(false);
  });
  it('once an iron mine is on the railway, steel is no longer from overseas', () => {
    const g = his('save-seb-2026-11-16d.json');
    const linked = g.linked!; const b = (g.s.buildings ?? []).find(x => x.kind === 'stone')!;
    b.kind = 'iron'; // stands in for an iron mine joined up on an outer island
    expect(linked.size).toBeGreaterThan(0);
    expect(overseas(g, 'steel')).toBe(false);
    expect(waitsAbroad(g, g.s.sites[0]!)).toEqual([]);
  });
});
