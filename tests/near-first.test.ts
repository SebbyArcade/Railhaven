import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import type { Game } from '../src/state.ts';

// His save (2026-11-15, 51 min, 8 trains, many open orders): trains ran far, empty, to wheat that paid a little more
// while wood and wheat that open orders also wanted stood right next to them.
const live = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-15f.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };

describe('trains take the nearest load an order waits for', () => {
  it('makes more deliveries in five minutes', () => {
    const g = live(), last = new Map<number, number>();
    let drops = 0;
    for (let s = 0; s < 300 * 20; s++) {
      const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
      for (const t of g.s.trains) if (t.lastPay && t.lastPay.at !== last.get(t.id)) { last.set(t.id, t.lastPay.at); drops++; }
    }
    expect(drops).toBeGreaterThanOrEqual(50); // 38 before (trains chased the best pay), 62 now
  });
});
