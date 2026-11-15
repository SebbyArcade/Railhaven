import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, planError, startPlan } from '../src/track/paint.ts';
import { buyPark, buyProject, orderMul, parkSpot, parksOf, payMul, projectError } from '../src/buildings/parks.ts';
import { orderOf, orderOfFull } from '../src/economy/towns.ts';
import { placeError, placementsAt } from '../src/buildings/industries.ts';
import { cardHtml } from '../src/ui/cards.ts';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import type { Game } from '../src/state.ts';

/** Ashford on a short line, so it is on the railway. */
function linked(): Game {
  const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
  const q = startPlan(g, a.y * n + a.x)!; for (let k = 1; k <= 6; k++) extendPlan(g, q, a.y * n + a.x + k);
  if (typeof buildPlan(g, q) === 'string') throw new Error('no line'); trackChanged(g);
  return g;
}

describe('town parks and projects', () => {
  it('parks cost $5k/10k/20k, stand 2-4 squares out on free grass and make orders 5% smaller each', () => {
    const g = linked(), a = g.s.sites[0]!; g.s.money = 100000;
    const full = orderOfFull(g, a).farm!;
    for (const p of [5000, 10000, 20000]) { const m = g.s.money; expect(buyPark(g, a)).toBe(''); expect(m - g.s.money).toBe(p); }
    expect(buyPark(g, a)).toContain('already has 3 parks');
    expect(orderMul(g, a)).toBeCloseTo(0.85);
    expect(orderOf(g, a).farm).toBe(Math.round(full * 0.85 / 5) * 5);
    const n = g.world.n;
    for (const p of parksOf(g, a)) {
      const d = Math.hypot(p.x - a.x, p.y - a.y); expect(d).toBeGreaterThanOrEqual(2); expect(d).toBeLessThanOrEqual(4.3);
      expect(g.world.terr[p.y * n + p.x]).toBe(1); expect(g.track.has(p.y * n + p.x)).toBe(false);
    }
    expect(new Set(parksOf(g, a).map(p => p.x + ',' + p.y)).size).toBe(3);
  });

  it('projects need the town size, pay more, and the Tram Line makes orders smaller', () => {
    const g = linked(), a = g.s.sites[0]!; g.s.money = 300000;
    expect(projectError(g, a, 'clock')).toContain('must grow into a Town');
    a.lvl = 4;
    for (const k of ['clock', 'market', 'tram', 'theatre'] as const) expect(buyProject(g, a, k)).toBe('');
    expect(buyProject(g, a, 'clock')).toContain('already has');
    expect(payMul(g, a)).toBeCloseTo(1.45);
    expect(orderMul(g, a)).toBeCloseTo(0.95);
    expect(g.s.money).toBe(300000 - 175000);
  });

  it('track and buildings keep off a park, with the reason', () => {
    const g = linked(), a = g.s.sites[0]!, n = g.world.n; g.s.money = 100000;
    expect(buyPark(g, a)).toBe(''); const p = g.s.parks![0]!;
    // a stroke from the end of the line onto a park square beside it
    const e = a.y * n + a.x + 6, side = [e + n, e - n].find(j => g.world.terr[j] === 1)!;
    g.s.parks!.push({ town: a.id, x: side % n, y: (side / n) | 0, k: 'park' }); g.taken = undefined;
    const q = startPlan(g, e)!; extendPlan(g, q, side);
    expect(q.path.at(-1)).toBe(side);
    expect(planError(g, q)).toContain("Ashford's park is on this square");
    const bad = placementsAt('farm', p.x, p.y).map(b => placeError(g, b));
    expect(bad.every(e => e !== '')).toBe(true);
    expect(bad.some(e => e.includes("Ashford's park is in the way"))).toBe(true);
  });

  it('the town card shows Parks and Town projects tiles and pages', () => {
    const g = linked(), a = g.s.sites[0]!; g.s.money = 100000;
    expect(cardHtml(g, { kind: 'town', id: a.id })).toContain('data-page="parks"');
    expect(cardHtml(g, { kind: 'town', id: a.id, page: 'parks' })).toContain('data-act="park"');
    const pj = cardHtml(g, { kind: 'town', id: a.id, page: 'projects' })!;
    expect(pj).toContain('Clock Tower'); expect(pj).toContain('🔒');
    expect(parkSpot(g, a)).not.toBeNull();
  });

  it("his old save keeps Ashford's park", async () => {
    const { g, report } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const a = g.s.sites[0]!;
    expect(parksOf(g, a).length).toBe(1);
    expect(report.join('\n')).toContain('1 of 1 town parks');
  });
});
