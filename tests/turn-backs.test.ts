import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import type { Game } from '../src/state.ts';

// Playtests 2026-11-16 (6-h and 10-h bot games): trains turned back partway along their trips hundreds of times an
// hour. Most were trains giving up on a short queue: after 4 s they took a way round that turned them back, or stepped
// aside into a siding and came back. Now a train waits in line behind trains going its way, turns back only after a
// fair wait, and steps aside only when it has waited a long while.
const his = (f: string) => { const raw = fs.readFileSync(`tests/saves/${f}`, 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };
const run = (g: Game, s: number) => { for (let k = 0; k < s * 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); } };
const turns = (g: Game) => [...(g.revs?.values() ?? [])].reduce((a, r) => a + r.n, 0);

describe('trains wait in line rather than turn back mid-trip', () => {
  it('his 13-train save: few turn-backs in 10 game minutes, and the trains keep delivering', () => {
    const g = his('save-seb-2026-11-16f.json'), l0 = g.s.loads ?? 0;
    run(g, 600);
    // before: 22 turn-backs and 265 loads delivered; now about 5 and much the same deliveries
    expect(turns(g)).toBeLessThan(12);
    expect((g.s.loads ?? 0) - l0).toBeGreaterThan(220);
  });
});
