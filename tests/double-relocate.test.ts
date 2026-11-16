import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { trackChanged } from '../src/game.ts';
import type { Game } from '../src/state.ts';

// Playtest 2026-11-16 (bot, seed 1, 191 min): doubling one held-up square near Ashford put two trains on the same
// rail piece. After the rails were rebuilt, each train's body was laid back along the first track behind its head,
// which at a turnout could be the other lane, under another train.
const load = () => { const raw = fs.readFileSync('tests/saves/bot-seed1-191min.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };
const overlap = (g: Game) => {
  const at = new Map<number, number>();
  for (const t of g.s.trains) for (const s of t.trail) { const o = at.get(s.piece); if (o !== undefined && o !== t.id) return `trains ${o} and ${t.id}`; at.set(s.piece, t.id); }
  return '';
};

describe('rebuilding the rails keeps every train on its own lane', () => {
  it('doubling a square under waiting trains never makes two trains overlap', () => {
    const g = load();
    expect(overlap(g)).toBe('');
    for (const i of [21949]) g.track.get(i)!.dbl = true;
    trackChanged(g);
    expect(overlap(g)).toBe('');
  });
  it('every square doubled one by one: still no overlap', () => {
    const g = load(), n = g.world.n;
    const near = [...g.track.keys()].filter(i => Math.abs(i % n - 109) <= 4 && Math.abs(Math.floor(i / n) - 106) <= 4 && !g.track.get(i)!.dbl);
    for (const i of near) { g.track.get(i)!.dbl = true; trackChanged(g); expect(overlap(g), `after doubling ${i}`).toBe(''); }
  });
});
