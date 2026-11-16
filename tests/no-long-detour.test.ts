import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { bodyPoint } from '../src/trains/train.ts';
import type { Game } from '../src/state.ts';

// His bug report 7 (2026-11-16, map with the route in red): a train with bricks from the Brickworks near Driftmere
// to Ashford (17 squares) was held up behind trains at the Sawmill yard, and after a short wait took a 111-square
// way round by Driftmere and Brinemoor. Waiting would have been far quicker.
const live = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16b.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };

describe('a held-up train waits rather than take a much longer way round', () => {
  it('loaded trains run less far for the same trips', () => {
    const g = live(), at = new Map<number, { x: number; y: number }>();
    let run = 0, planned = 0;
    for (let s = 0; s < 600 * 20; s++) {
      const was = new Map(g.s.trains.map(t => [t.id, t.job?.phase]));
      const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
      for (const t of g.s.trains) {
        const p = bodyPoint(g.net, t, 0), q = at.get(t.id); at.set(t.id, { x: p.x, y: p.y });
        if (t.cargo && q) run += Math.hypot(p.x - q.x, p.y - q.y) / 32;
        if (t.job?.phase === 'toDrop' && was.get(t.id) === 'loading' && t.cargo) { planned += t.cargo.d }
      }
    }
    // squares run loaded (head moves, turn-backs included) per square of shortest trip: 2.93 before, 2.40 now
    expect(run / planned).toBeLessThan(2.65);
  });
});
