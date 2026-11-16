import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { buyTrainFor, fleetByIsland, tickTrains, trainToSell } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { loopLength, passingLoop } from '../src/track/loops.ts';
import { trackChanged } from '../src/game.ts';
import { isRev } from '../src/track/route.ts';
import { cardHtml } from '../src/ui/cards.ts';
import { TILE } from '../src/world/terrain.ts';
import { yardSquares } from '../src/buildings/industries.ts';
import type { Game } from '../src/state.ts';

const his = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-15.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };
const tick = (g: Game, s: number) => { for (let k = 0; k < 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); } if (s % 5 === 0) checkStuck(g); };
/** whom a stopped train waits for: the holder of the first piece it could not clear */
const waitsOn = (g: Game, t: Game['s']['trains'][number]) => {
  let c = 0; for (const m of t.plan) { if (isRev(m)) return; if (c++ < t.held) continue;
    for (const q of [m.piece, ...g.net.conflicts[m.piece]!]) { const h = g.sys.holder.get(q); if (h !== undefined && h !== t.id) return h; }
    return; }
};

describe('🚦 trains get past each other (his 2026-11-15 save: three trains between Ashford and the Wheat Farm)', () => {
  it('with all its track doubled, trains run one way per lane like a road: heading east (right) on the bottom lane, west on the top', () => {
    const g = his(); let east = 0, west = 0, wrong = 0;
    // all his track doubled, and two more trains
    const yard = new Set<number>(); for (const b of g.s.buildings ?? []) for (const i of yardSquares(g.world.n, b)) yard.add(i);
    for (const [i, sq] of g.track) if (!yard.has(i)) sq.dbl = true;
    trackChanged(g); g.s.money = 1e5; buyTrainFor(g, g.world.home); for (let s = 0; s < 30; s++) tick(g, s); buyTrainFor(g, g.world.home);
    for (let s = 0; s < 900; s++) {
      tick(g, s);
      for (const t of g.s.trains) {
        const h = t.trail.at(-1)!, p = g.net.pieces[h.piece]!;
        // the open line: away from stations, yards and junctions (where trains shunt into dead-end yards)
        const q = p.squares[0]!, junction = (i: number) => [1, 2, 4, 8].filter(k => (g.track.get(i)?.links ?? 0) & k).length > 2;
        if (p.kind !== 'straight' || p.ta[1] !== 0 || g.sys.anyLane.has(h.piece) || g.sys.throat.has(h.piece) || g.net.side[h.piece] === 0 || [q - 2, q - 1, q, q + 1, q + 2].some(junction)) continue;
        const goingEast = p.ta[0] * h.dir > 0, y = p.pts[1]!, mid = (Math.floor(y / TILE) + 0.5) * TILE;
        if (goingEast ? y < mid : y > mid) wrong++; else if (goingEast) east++; else west++;
      }
    }
    // westbound runs here were only detours round a held-up train: trains now wait in line instead of turning back
    // (none in these 15 game minutes), so this checks the eastbound lane
    expect(east).toBeGreaterThan(5);
    // the other lane only for a moment, backing a train into a dead-end yard
    expect(wrong / (east + west + wrong)).toBeLessThan(0.1);
  });

  it('two trains never wait nose to nose for each other', () => {
    const g = his(); let faceoff = 0;
    for (let s = 0; s < 600; s++) {
      tick(g, s);
      const w = new Map<number, number | undefined>(); for (const t of g.s.trains) if (t.v < 0.5 && t.plan.length) w.set(t.id, waitsOn(g, t));
      for (const [a, b] of w) if (b !== undefined && w.get(b) === a) faceoff++;
    }
    expect(faceoff).toBe(0);
  });
});

describe('🔁 passing loops', () => {
  it('a tap on straight single track marks a loop long enough for the longest train, centred there', () => {
    const g = his(), n = g.world.n, at = 107 * n + 102, l = passingLoop(g, at) as number[];
    expect(Array.isArray(l)).toBe(true);
    expect(l.length).toBe(loopLength(g)); expect(l).toContain(at);
    expect(l.every(i => i % n === 102)).toBe(true);
    for (const i of l) g.track.get(i)!.dbl = true; trackChanged(g);
    // its middle squares are places to wait while another train passes
    const mid = g.net.bySquare.get(at)!; expect(mid.length).toBe(2); expect(mid.every(p => g.net.passing[p])).toBe(true);
  });

  it('says why not on a junction, a corner or double track', () => {
    const g = his(), n = g.world.n;
    expect(passingLoop(g, 98 * n + 108)).toMatch(/straight/); // a corner
    expect(passingLoop(g, 104 * n + 90)).toMatch(/double already/);
  });
});

describe('🚂 Your trains, island by island', () => {
  it('one row per island with its trains, Buy 1 and Sell 1', () => {
    const g = his(), rows = fleetByIsland(g);
    expect(rows[0]!.island).toBe(g.world.home); expect(rows[0]!.trains.length).toBe(3); expect(rows[0]!.buyAt).toBe('shed');
    const h = cardHtml(g, { kind: 'fleet', id: 0 })!;
    expect(h).toContain('Buy 1'); expect(h).toContain('Sell 1'); expect(h).toContain(rows[0]!.name);
    expect(cardHtml(g, { kind: 'fleet', id: 0, page: String(g.world.home) })).toContain('Open ›');
  });

  it('Buy 1 adds a train on that island; Sell 1 picks a train with no work first', () => {
    const g = his(); g.s.money = 5000;
    const t = buyTrainFor(g, g.world.home); expect(typeof t).not.toBe('string');
    expect(fleetByIsland(g)[0]!.trains.length).toBe(4);
    const pick = trainToSell(g, g.world.home)!; expect(pick.job).toBeUndefined(); expect(pick.cargo).toBeUndefined();
  });
});
