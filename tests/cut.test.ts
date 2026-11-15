import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { isFactory, isLinked, yardSquares } from '../src/buildings/industries.ts';
import { cutText } from '../src/ui/tools.ts';
import { inStorm } from '../src/world/events.ts';
import { seaLanes, seaPath, shipPlace, tickShips } from '../src/ships/ships.ts';

describe('route-cut warning and ships in storms', () => {
  it('warns when removing a square cuts a building off, and not on a loop', async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const n = g.world.n;
    // the square just past a linked camp's yard end, on a spur only it uses
    let found = false;
    for (const b of g.s.buildings ?? []) {
      if (b.kind === 'dock' || isFactory(b.kind) || !isLinked(g, b)) continue;
      const ys = yardSquares(n, b), st = b.horizontal ? 1 : n;
      for (const e of [ys[0]! - st, ys.at(-1)! + st]) {
        if (!g.track.has(e)) continue;
        const t = cutText(g, e);
        if (t.includes('the ')) { found = true; expect(t).not.toContain('<'); break; }
      }
      if (found) break;
    }
    expect(found).toBe(true);
    expect(g.track.size).toBeGreaterThan(0); // the check never changes the real track
    const before = JSON.stringify([...g.track.values()].slice(0, 50));
    cutText(g, [...g.track.keys()][10]!);
    expect(JSON.stringify([...g.track.values()].slice(0, 50))).toBe(before);
  });

  it('a ship in a storm sails at half speed', async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const lanes = seaLanes(g), ln = lanes[0]!; expect(ln).toBeTruthy();
    const s = g.s.ships![0]!, A = g.s.buildings!.find(b => b.id === ln.a)!, B = g.s.buildings!.find(b => b.id === ln.b)!;
    s.at = A.id; s.to = B.id; s.path = seaPath(g, A, B); s.pos = 1; s.wait = 0;
    expect(s).toBeTruthy(); if (!s) return;
    const p = shipPlace(g, s), pos0 = s.pos;
    tickShips(g, 1); const free = s.pos - pos0;
    g.s.storm = { x: p.x, y: p.y, vx: 0, vy: 0, r: 7, t0: g.s.t, until: g.s.t + 100 };
    expect(inStorm(g, p.x, p.y)).toBe(true);
    const pos1 = s.pos; tickShips(g, 1);
    expect(s.pos - pos1).toBeCloseTo(free * 0.5, 2);
  });
});
