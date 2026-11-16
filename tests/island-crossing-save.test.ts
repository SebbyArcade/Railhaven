import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadFrom } from '../src/save/save.ts';
import { planError } from '../src/track/paint.ts';

// Sébastien's save (bug report 12, seed 939049): Gull Rock (Fernley Haven, Oakhurst Haven) sits between
// Cobble Key to the west and Ashford Isle to the north. Both crossings join two islands.
const load = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16g.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)!; };
const sq = (n: number, pts: [number, number][]) => pts.map(([x, y]) => y * n + x);

describe('🌉 crossings off Gull Rock in his save', () => {
  it('the north crossing to Ashford Isle is refused for the island rule, not shown as "need more money"', () => {
    const g = load(), n = g.world.n;
    const path = sq(n, [[70, 134], [71, 134], [72, 134], [73, 134], [74, 134], [74, 133], [74, 132], [74, 131], [74, 130]]);
    expect(g.track.has(path[0]!)).toBe(true);
    g.s.money = 100; // he could not afford it: the island rule still comes first
    const e = planError(g, { path } as never);
    expect(e).toMatch(/Ashford Isle, another island/);
    expect(e).not.toMatch(/Need \$/);
  });

  it('the west crossing names Cobble Key, the island the drag ends on', () => {
    const g = load(), n = g.world.n;
    const path = sq(n, [[60, 141], [59, 141], [58, 141], [57, 141], [56, 141], [55, 141], [54, 141], [53, 141], [52, 141]]);
    expect(g.track.has(path[0]!)).toBe(true);
    expect(planError(g, { path } as never)).toMatch(/Cobble Key, another island/);
  });
});
