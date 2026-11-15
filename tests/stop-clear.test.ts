import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { headSquare, tickTrains } from '../src/economy/dispatch.ts';
import type { Game } from '../src/state.ts';

// His save (2026-11-15): Ravensholm's hall and the Wheat Farm's yard end where the line turns a corner, so the switch
// where the two tracks meet sits on their own end square. Trains stopped on it and blocked the line.
const live = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-15c.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };

describe('trains stop clear of the switch at a hall or yard end', () => {
  it('loads and unloads on the plain track, never on the end-square switch', () => {
    const g = live(), n = g.world.n, stops: string[] = [];
    let last = '';
    for (let s = 0; s < 120 * 20; s++) {
      const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
      const t = g.s.trains[0]!, ph = t.job?.phase;
      if ((ph === 'loading' || ph === 'unloading') && ph !== last) { const h = headSquare(g, t); stops.push(`${h % n},${(h / n) | 0}`); }
      last = ph ?? '';
      for (const p of t.trail) if (ph === 'loading' || ph === 'unloading') expect(g.net.pieces[p.piece]!.kind, `${ph} at ${stops.at(-1)}`).not.toBe('fan');
    }
    expect(stops).toContain('109,104'); // the Wheat Farm (its switch is on 109,105)
    expect(stops).toContain('119,92'); // Ravensholm (its switch is on 119,91)
  });
});
