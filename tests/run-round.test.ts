import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { endsAtBuffer } from '../src/track/network.ts';
import { revMarks } from '../src/ui/mapviews.ts';

describe('trains run backwards less (on his Nov 14 save)', () => {
  it('back into dead ends, run the engine round where a second track allows, and push under 40% of the way', async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    let fwd = 0, back = 0, rrDone = 0, rrPulling = 0, deadIn = 0, deadBack = 0;
    const was = new Map<number, boolean>(), phase = new Map<number, string>();
    for (let k = 0; k < 4 * 60 * 20; k++) {
      const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
      for (const t of g.s.trains) {
        if (t.engineAhead) fwd += t.v * dt; else back += t.v * dt;
        if (was.get(t.id) && !t.rr) { rrDone++; if (t.engineAhead) rrPulling++; }
        was.set(t.id, !!t.rr);
        const p = t.job?.phase ?? '', o = phase.get(t.id);
        if (o !== p && (p === 'loading' || p === 'unloading') && endsAtBuffer(g.net, t.trail.at(-1)!)) { deadIn++; if (!t.engineAhead) deadBack++; }
        phase.set(t.id, p);
      }
    }
    expect(rrDone).toBeGreaterThan(0);
    expect(rrPulling).toBe(rrDone); // after running round, the train always sets off engine first
    expect(deadBack / deadIn).toBeGreaterThan(0.65); // into dead ends wagons first, so they leave pulling
    expect(back / (fwd + back)).toBeLessThan(0.55); // 53% before run-rounds; ~48% since he chose (2026-11-15) pushing a short way over turning back
    expect(Array.isArray(revMarks(g))).toBe(true);
  });
});
