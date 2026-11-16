import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { isRev } from '../src/track/route.ts';
import type { Game } from '../src/state.ts';

// His bug report 11 (2026-11-16, map with the route in red): a train loaded wood at the Lumber Camp near Ashford facing
// away from the Sawmill 6 squares up the line, and ran a 20-square loop round by Ashford station to face it, rather than
// back out. Changing ends at a stop is only a short pause, so it backs out the short way now.
const live = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16f.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };

describe('a train leaving a stop backs out the short way rather than run round a loop', () => {
  it('wood from the Lumber Camp to the Sawmill next door takes the short way', () => {
    const g = live(), trips: number[] = [], seen = new Set<string>();
    for (let s = 0; s < 120 * 20; s++) {
      const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
      for (const t of g.s.trains) {
        const j = t.job; if (!j || j.phase !== 'toDrop' || j.src !== 1 || j.to.kind !== 'bld' || j.to.id !== 10 || !t.plan.length) continue;
        const key = `${t.id}/${t.lastPay?.at ?? 0}`; if (seen.has(key)) continue; seen.add(key);
        let len = 0; for (const m of t.plan) if (!isRev(m)) len += g.net.pieces[m.piece]!.len;
        trips.push(len / 32);
      }
    }
    expect(trips.length).toBeGreaterThan(0);
    // the short way is 6 squares; the loop was 20 (when another train stands on the short way, the little 10-square
    // loop past the Sawmill is fine: it doesn't wait or run round by Ashford)
    for (const sq of trips) expect(sq).toBeLessThan(11);
    expect(trips.filter(sq => sq < 7).length).toBeGreaterThan(trips.length / 2);
  });
});
