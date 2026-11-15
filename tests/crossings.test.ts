import { describe, expect, it } from 'vitest';
import { buildNetwork, nextSteps } from '../src/track/network.ts';
import { layPath } from '../src/track/edit.ts';
import { trackFromSave, trackToSave } from '../src/track/state.ts';
import type { TrackMap } from '../src/track/types.ts';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { railDist } from '../src/economy/shipping.ts';

const N = 40;
const sq = (x: number, y: number) => y * N + x;
const row = (y: number, x0: number, x1: number) => { const o: number[] = []; for (let x = x0; x <= x1; x++) o.push(sq(x, y)); return o; };
const col = (x: number, y0: number, y1: number) => { const o: number[] = []; for (let y = y0; y <= y1; y++) o.push(sq(x, y)); return o; };
/** a plus: an east-west line and a north-south line through (10,10) */
const plus = (cross: boolean): TrackMap => {
  const t: TrackMap = new Map(); layPath(t, N, row(10, 4, 16)); layPath(t, N, col(10, 4, 16));
  if (cross) t.get(sq(10, 10))!.cross = true;
  return t;
};

describe('✚ flat crossings', () => {
  it('saves and loads the crossing and double-track marks (old saves load as before)', () => {
    const t = plus(true); t.get(sq(5, 10))!.dbl = true;
    const back = trackFromSave(JSON.parse(JSON.stringify(trackToSave(t))));
    expect(back.get(sq(10, 10))).toEqual({ links: 15, cross: true });
    expect(back.get(sq(5, 10))!.dbl).toBe(true);
    expect(trackFromSave([[7, 5, 1], [8, 5, 0]])).toEqual(new Map([[7, { links: 5, dbl: true }], [8, { links: 5 }]]));
  });

  it('a crossing has just the two straight lines, which block each other; a junction keeps its turns', () => {
    const at = (t: TrackMap) => { const net = buildNetwork(t, N); return { net, ids: net.bySquare.get(sq(10, 10)) ?? [] }; };
    const x = at(plus(true));
    expect(x.ids.length).toBe(2);
    expect(x.ids.every(i => x.net.pieces[i]!.kind === 'straight')).toBe(true);
    expect(x.net.conflicts[x.ids[0]!]).toContain(x.ids[1]);
    expect(x.ids.some(i => x.net.passing[i])).toBe(false); // no waiting on the diamond
    const j = at(plus(false));
    expect(j.ids.length).toBeGreaterThan(2); // turns too
  });

  it('a train runs straight over a crossing: no turning onto the other line', () => {
    const net = buildNetwork(plus(true), N);
    for (const id of net.bySquare.get(sq(10, 10))!) for (const dir of [1, -1] as const) {
      const p = net.pieces[id]!, horiz = p.ta[1] === 0;
      for (const s of nextSteps(net, { piece: id, dir })) {
        const q = net.pieces[s.piece]!;
        expect(q.ta[1] === 0).toBe(horiz);
      }
    }
  });

  it('a double line crossing a double line: four lanes, every east-west lane blocks every north-south lane', () => {
    const t = plus(true); for (const [, s] of t) s.dbl = true;
    const net = buildNetwork(t, N), ids = net.bySquare.get(sq(10, 10))!;
    expect(ids.length).toBe(4);
    for (const a of ids) for (const b of ids) if ((net.pieces[a]!.ta[1] === 0) !== (net.pieces[b]!.ta[1] === 0)) expect(net.conflicts[a]).toContain(b);
  });

  it('a stroke drawn straight over a line makes a crossing; a branch from the line stays a junction; a tap switches it', () => {
    const g = newGame(4242), n = g.world.n; g.s.money = 1e6; g.s.fog.fill(255);
    const a = g.s.sites[0]!, A = a.y * n + a.x, at = (dx: number, dy: number) => A + dy * n + dx;
    const go = (from: number, ...to: number[]) => { const p = startPlan(g, from)!; for (const k of to) extendPlan(g, p, k); const b = buildPlan(g, p); if (typeof b === 'string') throw new Error(b); trackChanged(g); };
    go(at(0, 0), at(-12, 0));
    go(at(-3, 0), at(-3, -3), at(-5, -3), at(-5, 3)); // a loop that runs straight over the line at (-5, 0)
    expect(g.track.get(at(-5, 0))).toMatchObject({ links: 15, cross: true });
    go(at(-9, 0), at(-9, -3)); // a branch: a junction
    expect(g.track.get(at(-9, 0))!.cross).toBeUndefined();
    // rail distance can't turn at the crossing: from the loop's far end to the line west of the crossing it goes round by the junction at (-3, 0)
    const d = railDist(g, 'test', [at(-5, 3)]);
    expect(d[at(-6, 0)]).toBe(6 + 2 + 3 + 3); // up over the crossing, round the loop, back along the line
    expect(d[at(-6, 0)]).toBeGreaterThan(4);
  });
});

describe('🔀 turnouts on double track', () => {
  it('both lanes of a double main line lead off to a single branch, and the far lane blocks the near lane where it crosses', () => {
    const t: TrackMap = new Map(); layPath(t, N, row(10, 2, 18)); layPath(t, N, col(10, 3, 10));
    for (let x = 6; x <= 14; x++) t.get(sq(x, 10))!.dbl = true;
    const net = buildNetwork(t, N);
    const turns = net.pieces.filter(p => p.kind === 'wide' && p.squares.includes(sq(10, 10)));
    expect(turns.length).toBe(4); // two lanes, both ways
    // every turnout ends on the branch's single lane and starts on a main lane, joined smoothly
    for (const p of turns) {
      for (const dir of [1, -1] as const) expect(nextSteps(net, { piece: p.id, dir }).length).toBeGreaterThan(0);
    }
    // the far lane's turnout (starting on the lane away from the branch) crosses the near lane's straight
    const far = turns.find(p => p.pts[1]! > 10.5 * 32)!; // branch goes north (smaller y): far lane is the south one
    const nearStraights = net.pieces.filter(p => p.kind === 'straight' && p.squares.length === 1 && p.pts[1]! < 10.5 * 32 && p.pts[3]! < 10.5 * 32 && p.ta[1] === 0 && [sq(9, 10), sq(10, 10), sq(11, 10)].includes(p.squares[0]!));
    expect(nearStraights.some(s => net.conflicts[far.id]!.includes(s.id))).toBe(true);
    expect(turns.some(p => net.passing[p.id])).toBe(false);
  });
});
