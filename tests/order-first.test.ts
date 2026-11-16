import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { shipPlan } from '../src/economy/shipping.ts';
import type { Game } from '../src/state.ts';

// His save (2026-11-15, 29 min, 4 trains): open orders wait for stone (Brinemoor, Marrow Cove) and bricks (Ashford,
// Ravensholm), but the trains kept hauling wood to the Sawmill (planks orders already full) and wheat to towns
// whose wheat orders were full, so the stone and bricks never moved.
const live = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-15e.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };
const run = (g: Game, secs: number) => { for (let s = 0; s < secs * 20; s++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); } };
const town = (g: Game, name: string) => g.s.sites.find(t => t.name === name)!;

describe('trains fill open orders first', () => {
  it('a factory whose product no order wants is not urgent', () => {
    const g = live(), saw = g.s.buildings!.find(b => b.kind === 'sawmill')!, plan = shipPlan(g);
    for (const s of plan.values()) if (s.to.kind === 'bld' && s.to.id === saw.id) expect(s.feeds).toBeFalsy();
  });
  it('stone and bricks reach the towns waiting for them', () => {
    const g = live();
    run(g, 360);
    expect((town(g, 'Brinemoor').got?.stone ?? 0) + (town(g, 'Marrow Cove').got?.stone ?? 0)).toBeGreaterThan(0);
    expect((town(g, 'Ashford').got?.bricks ?? 0) + (town(g, 'Ravensholm').got?.bricks ?? 0)).toBeGreaterThan(20);
  });
});
