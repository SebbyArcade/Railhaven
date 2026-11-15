import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import type { Game } from '../src/state.ts';

// His save (2026-11-15, 7 min): one train, Ashford's wheat order full, Ravensholm wants wheat, Ashford wants wood.
// The train kept fetching wheat for Ravensholm, then counted its own load against that order while loading,
// so it took the wheat to Ashford for $15 instead, again and again, and the wood never moved.
const live = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-15c.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };
const run = (g: Game, secs: number, each: () => void) => { for (let s = 0; s < secs * 20; s++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); each(); } };

describe('a train takes its load where it set out to take it', () => {
  it('wheat fetched for Ravensholm goes to Ravensholm, and Ashford then gets its wood', () => {
    const g = live(), t = g.s.trains[0]!, drops: string[] = [];
    let last = -1;
    run(g, 180, () => { if (t.lastPay && t.lastPay.at !== last) { last = t.lastPay.at; drops.push(`${t.lastPay.good}>${t.lastPay.to.id}`); } });
    drops.shift(); // the delivery already in the save
    expect(drops[0]).toBe('farm>10'); // Ravensholm
    // the open orders are served before any wheat goes to Ashford, whose wheat order is full
    const wood = drops.indexOf('wood>0'), wheat = drops.indexOf('farm>0');
    expect(wood).toBeGreaterThan(0);
    expect(wheat === -1 || wheat > wood).toBe(true);
  });
});
