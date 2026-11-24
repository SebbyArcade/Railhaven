import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { nextSteps } from '../src/track/network.ts';
import { trainLength } from '../src/trains/train.ts';
import type { Step } from '../src/track/types.ts';

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

  // he asked (2026-11-24): trains stop in the middle of the platform or loading track, not at its far end
  it('a train that fits stops in the middle of its platform or loading track', () => {
    const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16.json', 'utf8');
    const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
    const last = new Map<number, number[]>(), off: number[] = [], seen = new Set<string>();
    for (let s = 0; s < 120 * 20; s++) {
      const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
      for (const t of g.s.trains) {
        if (t.area) last.set(t.id, t.area);
        const ph = t.job?.phase, A = last.get(t.id); if ((ph !== 'loading' && ph !== 'unloading') || !A || t.v > 0) continue;
        const key = `${t.id}/${A[0]}/${ph}`; if (seen.has(key)) continue; seen.add(key);
        const area = new Set(A), L = (st: Step) => g.net.pieces[st.piece]!.len;
        const plainIn = (st: Step) => { const p = g.net.pieces[st.piece]!; return p.kind !== 'fan' && p.squares.every(q => area.has(q)); };
        const rv = (st: Step): Step => ({ piece: st.piece, dir: st.dir === 1 ? -1 : 1 });
        const free = (from: Step, d: number) => { let c = from; for (let k = 0; k < 40; k++) { const nx = nextSteps(g.net, c).filter(plainIn); if (nx.length !== 1) break; c = nx[0]!; d += L(c); } return d; };
        const head = t.trail.at(-1)!, tail = t.trail[0]!;
        if (!plainIn(head) || !plainIn(tail)) continue;
        const ahead = free(head, L(head) - t.headS), behind = free(rv(tail), t.tailS);
        if (ahead + behind > 4 && trainLength(t) > 0) off.push(Math.abs(ahead - behind));
      }
    }
    expect(off.length).toBeGreaterThan(10);
    expect(off.filter(x => x <= 4).length / off.length).toBeGreaterThan(0.9);
  });
});
