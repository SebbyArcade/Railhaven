import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';

// he reported (2026-11-16, Tidewick): a train stopped at a dead-end station with its last wagons on the switch.
// The buffer-stop end of the platform was only half a square, so the train didn't fit clear of the switch.
describe('stopping at stations and yards', () => {
  it('every loading or unloading stop on his save has the whole train on plain track inside the hall or yard', () => {
    const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16.json', 'utf8');
    const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
    const last = new Map<number, number[]>(); let stops = 0; const bad: string[] = [];
    for (let s = 0; s < 120 * 20; s++) {
      const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
      for (const t of g.s.trains) {
        if (t.area) last.set(t.id, t.area);
        const ph = t.job?.phase, A = last.get(t.id); if ((ph !== 'loading' && ph !== 'unloading') || !A || t.v > 0) continue;
        stops++;
        const area = new Set(A), pcs = t.trail.map(st => g.net.pieces[st.piece]!);
        if (pcs.some(p => p.kind === 'fan' || !p.squares.every(q => area.has(q)))) bad.push(`train ${t.id} at ${A[0]}`);
      }
    }
    expect(stops).toBeGreaterThan(100);
    expect([...new Set(bad)]).toEqual([]);
  });
});
