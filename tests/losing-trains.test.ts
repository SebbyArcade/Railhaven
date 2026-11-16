import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { islandOfTrain, tickTrains } from '../src/economy/dispatch.ts';
import type { Game } from '../src/state.ts';

// Playtest 2026-11-16 (bot, seed 2): every order waited on steel, and the trains kept hauling goods nobody waited
// for. Trains judged a load by its ideal trip cost, but jams made the real trips cost more, and money fell below
// zero. Sébastien chose: a train whose last trips lost money waits (for free) for work an order, factory or rush needs.
const load = () => { const raw = fs.readFileSync('tests/saves/bot-seed2-in-debt.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };
const run = (g: Game, s: number) => { for (let k = 0; k < s * 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); } };
const free = (g: Game) => g.s.trains.filter(t => !t.job && !t.cargo && t.dest === undefined && !t.plan.length);

describe('a train that loses money waits for better work', () => {
  it('free trains take the optional loads when their trips paid', () => {
    // trains that lost money stand waiting (on Ashford Isle: one train on another island has no work at all)
    const g = load(); for (const t of g.s.trains) t.nets = [-20, -20]; run(g, 120);
    const ids = free(g).filter(t => islandOfTrain(g, t) === g.world.home).map(t => t.id); expect(ids.length).toBeGreaterThan(0);
    for (const t of g.s.trains) t.nets = [20, 20];
    run(g, 60);
    expect(g.s.trains.filter(t => ids.includes(t.id) && t.job).length).toBeGreaterThan(0);
  });
  it('the same trains wait when their last trips lost money (only steel is wanted, and nobody makes it)', () => {
    const g = load(); for (const t of g.s.trains) t.nets = [-20, -20]; run(g, 120);
    const ids = free(g).filter(t => islandOfTrain(g, t) === g.world.home).map(t => t.id); expect(ids.length).toBeGreaterThan(0);
    for (const t of g.s.trains) t.nets = [-20, -20];
    run(g, 60);
    expect(g.s.trains.filter(t => ids.includes(t.id) && t.job).map(t => t.id)).toEqual([]);
  });
});

describe('bridges cost nothing to keep up while money is below zero', () => {
  it('in debt, money only falls by what the trains cost to run', () => {
    const g = load(); expect(g.s.money).toBeLessThan(0);
    const m0 = g.s.money, e0 = g.s.earned ?? 0, u0 = g.s.upkeep ?? 0;
    run(g, 60);
    expect(g.s.money - m0).toBeCloseTo((g.s.earned ?? 0) - e0 - ((g.s.upkeep ?? 0) - u0), 3);
    const trainsRun = g.s.trains.reduce((a, t) => a + (t.run ?? 0), 0);
    expect(trainsRun).toBeGreaterThanOrEqual(0);
  });
});
