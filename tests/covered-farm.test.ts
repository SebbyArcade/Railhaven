import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { stuckList } from '../src/ui/orders.ts';
import { shareAt } from '../src/buildings/industries.ts';
import type { Game } from '../src/state.ts';

// Playtest 2026-11-16 (bot, seed 4): a Lumber Camp built beside the first Wheat Farm covered all its fields. The farm
// made nothing for six hours, Ashford's first order waited for wheat, and Needs you only said "2 trains wait for a load".
const load = () => { const raw = fs.readFileSync('tests/saves/bot-seed4-covered-farm.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };

describe('a farm whose fields are all covered', () => {
  it('shows in Needs you, with what to do', () => {
    const g = load(), farm = g.s.buildings!.find(b => b.kind === 'farm')!;
    expect(shareAt(g, farm)).toBe(0);
    const line = stuckList(g).find(s => s.icon === '🌾');
    expect(line?.text).toMatch(/Wheat Farm.* makes nothing: track or buildings cover all its fields/);
  });
});

describe('a maker that makes nothing does not hold an order back', () => {
  // the same save: a second Wheat Farm stood full (80) beside the line, but the covered one took Ashford's order
  // (nearest first), so the full one was sent as 'extra', which no train takes for a short haul
  it('sends the working farm to the open order and the order fills', async () => {
    const { shipPlan } = await import('../src/economy/shipping.ts');
    const { tickTrains } = await import('../src/economy/dispatch.ts');
    const { orderDone } = await import('../src/economy/towns.ts');
    const g = load(), farms = g.s.buildings!.filter(b => b.kind === 'farm');
    const dead = farms.find(b => shareAt(g, b) === 0)!, live = farms.find(b => b !== dead)!;
    const plan = shipPlan(g);
    expect(plan.get(dead.id)?.why).not.toBe('order');
    expect(plan.get(live.id)?.why).toBe('order');
    for (let k = 0; k < 20 * 180; k++) { g.s.t += 0.05; g.sys.tick(0.05); tickTrains(g, 0.05); }
    expect(orderDone(g, g.s.sites[0]!)).toBe(true);
  });
});
