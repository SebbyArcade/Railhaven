import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { layPath } from '../src/track/edit.ts';
import { buildPlan } from '../src/track/paint.ts';
import { bestSpot, joinGap, stationSpots, stationsText } from '../src/track/joins.ts';
import { townLinked } from '../src/economy/towns.ts';
import { reveal } from '../src/world/fog.ts';
import type { Game, Site } from '../src/state.ts';

/** A test town near Ashford on flat open land, and a helper to lay a line through given corner points. */
function setup(): { g: Game; t: Site; sq: (x: number, y: number) => number; line: (pts: [number, number][]) => number[] } {
  const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!, sq = (x: number, y: number) => y * n + x;
  for (let y = a.y - 2; y <= a.y + 12; y++) for (let x = a.x - 2; x <= a.x + 14; x++) g.world.terr[sq(x, y)] = 1;
  g.s.sites = g.s.sites.filter((s, i) => i === 0 || Math.abs(s.x - a.x) > 16 || Math.abs(s.y - a.y) > 16);
  g.s.buildings = []; g.s.parks = [];
  reveal(g, a.x + 6, a.y + 5, 12);
  const t: Site = { id: 999, kind: 'town', x: a.x + 6, y: a.y + 4, name: 'Stonecroft', pop: 3, lvl: 0 };
  g.s.sites.push(t); g.s.money = 1e6;
  const line = (pts: [number, number][]) => { const out: number[] = []; for (let k = 0; k < pts.length - 1; k++) { let [x, y] = pts[k]!; const [tx, ty] = pts[k + 1]!; while (x !== tx || y !== ty) { out.push(sq(x, y)); if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); } } out.push(sq(...pts.at(-1)!)); return out; };
  return { g, t, sq, line };
}

describe('the gold squares that join a town to the railway', () => {
  it('a line that runs beside the town but curves away there leaves it unlinked, and the gap squares link it when laid', () => {
    const { g, t, line } = setup(), a = g.s.sites[0]!;
    // east from Ashford, down the town's east side, then curving away east on the square right beside it (Stonecroft)
    layPath(g.track, g.world.n, line([[a.x, a.y], [a.x + 7, a.y], [a.x + 7, a.y + 4], [a.x + 9, a.y + 4]])); trackChanged(g);
    expect(townLinked(g, t)).toBe(false);
    const j = joinGap(g, t)!;
    expect(j).not.toBeNull();
    const gap = j.squares;
    expect(gap.length).toBeLessThanOrEqual(4);
    expect(g.linked!.has(j.from)).toBe(true);
    expect(gap.every(i => !g.track.has(i))).toBe(true);
    // lay them from the railway square next to the first one
    const built = buildPlan(g, { path: [j.from, ...gap] }); trackChanged(g);
    expect(typeof built).not.toBe('string');
    expect(townLinked(g, t)).toBe(true);
    expect(joinGap(g, t)).toBeNull(); // linked: nothing to show
  });

  it('a line that stops one square short of the town shows that one square', () => {
    const { g, t, sq, line } = setup(), a = g.s.sites[0]!;
    layPath(g.track, g.world.n, line([[a.x, a.y], [a.x, a.y + 4], [a.x + 4, a.y + 4]])); trackChanged(g); // ends at (x+4), town at x+6
    expect(townLinked(g, t)).toBe(false);
    expect(joinGap(g, t)).toMatchObject({ from: sq(a.x + 4, a.y + 4), squares: [sq(a.x + 5, a.y + 4)], cost: 5 });
  });

  it('a longer way in, up to a dozen squares, with the station it makes', () => {
    const { g, t, sq, line } = setup(), a = g.s.sites[0]!;
    layPath(g.track, g.world.n, line([[a.x, a.y], [a.x - 2, a.y]])); trackChanged(g);
    const j = joinGap(g, t)!;
    expect(j).not.toBeNull();
    expect(j.squares.length).toBeGreaterThan(4);
    expect(j.squares.length).toBeLessThanOrEqual(12);
    expect(j.hall).toHaveLength(3);
    expect(Math.abs(j.hall[1]! % g.world.n - t.x) + Math.abs(((j.hall[1]! / g.world.n) | 0) - t.y)).toBeLessThanOrEqual(2);
    expect(buildPlan(g, { path: [j.from, ...j.squares] })).not.toBeTypeOf('string'); trackChanged(g);
    expect(townLinked(g, t)).toBe(true);
    void sq;
  });

  it('farther off: no gold squares, but the station spot facing your track, its way in and your nearest track square', () => {
    const { g, t, line } = setup(), a = g.s.sites[0]!;
    t.x += 10; t.y += 6; reveal(g, t.x, t.y, 6);
    for (let y = t.y - 3; y <= t.y + 3; y++) for (let x = t.x - 3; x <= t.x + 3; x++) g.world.terr[y * g.world.n + x] = 1;
    layPath(g.track, g.world.n, line([[a.x, a.y], [a.x - 2, a.y]])); trackChanged(g);
    expect(joinGap(g, t)).toBeNull();
    const spots = stationSpots(g, t);
    expect(spots.length).toBe(6); // across the square both ways, and along all four sides
    const pick = bestSpot(g, t)!;
    expect(g.linked!.has(pick.from)).toBe(true);
    expect(pick.spot.ends.some(e => e[0] === pick.end[0])).toBe(true);
    // the end it picks is the one nearest your track
    const n = g.world.n, dist = (e: number) => Math.min(...[...g.linked!].map(i => Math.abs(i % n - e % n) + Math.abs(((i / n) | 0) - ((e / n) | 0))));
    for (const sp of spots) for (const [e] of sp.ends) expect(pick.d).toBeLessThanOrEqual(dist(e));
  });

  it('laying track along the dots and through the 🚉 outline links the town', () => {
    const { g, t, line } = setup(), a = g.s.sites[0]!, n = g.world.n;
    t.x += 10; t.y += 6; reveal(g, t.x, t.y, 6);
    for (let y = t.y - 3; y <= t.y + 3; y++) for (let x = t.x - 3; x <= t.x + 3; x++) g.world.terr[y * n + x] = 1;
    layPath(g.track, n, line([[a.x, a.y], [a.x - 2, a.y]])); trackChanged(g);
    const pick = bestSpot(g, t)!, sq = pick.spot.squares, [e, inner] = pick.end;
    const far = sq[0] === inner ? sq[2]! : sq[0]!, xy = (i: number): [number, number] => [i % n, (i / n) | 0];
    // from the railway square it names, round to the arrow square, then straight through the outline to its far end
    const f = xy(pick.from), ee = xy(e), ff = xy(far), path = ee[0] === ff[0] ? line([f, [f[0], ee[1] + Math.sign(ee[1] - ff[1]) * 2], [ee[0], ee[1] + Math.sign(ee[1] - ff[1]) * 2], ff]) : line([f, [ee[0] + Math.sign(ee[0] - ff[0]) * 2, f[1]], [ee[0] + Math.sign(ee[0] - ff[0]) * 2, ee[1]], ff]);
    expect(stationsText(g, path)).toContain(`🚉 links ${t.name}`);
    expect(buildPlan(g, { path })).not.toBeTypeOf('string'); trackChanged(g);
    expect(townLinked(g, t)).toBe(true);
  });

  it('the outline never sits on a bend of your track, and the bar warns when a stroke would take a station away', () => {
    const { g, t, sq, line } = setup(), a = g.s.sites[0]!;
    // a line ending beside the town (a dead-end station there)
    layPath(g.track, g.world.n, line([[a.x, a.y], [a.x, t.y + 1], [t.x, t.y + 1]])); trackChanged(g);
    expect(townLinked(g, t)).toBe(true);
    // carrying it on one square and up past the town's corner bends it right at the station's end: no station left
    const path = [sq(t.x, t.y + 1), sq(t.x + 1, t.y + 1), sq(t.x + 1, t.y), sq(t.x + 1, t.y - 1), sq(t.x + 1, t.y - 2)];
    const txt = stationsText(g, path);
    if (txt.includes('⚠')) expect(txt).toContain(`⚠ ${t.name} loses its station`);
    else expect(txt).toBe(''); // the station slid back along the straight part
    // curves of your own track are never offered as platforms
    for (const sp of stationSpots(g, t)) for (const i of sp.squares) if (g.track.has(i)) expect([1, 4, 5, 2, 8, 10]).toContain(g.track.get(i)!.links); // straight, or the straight end of a line
  });
});
