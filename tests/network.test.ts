import { describe, expect, it } from 'vitest';
import { buildNetwork, nextSteps, type Network } from '../src/track/network.ts';
import { layPath, linkByAdjacency } from '../src/track/edit.ts';
import { pointAt } from '../src/track/geometry.ts';
import type { Step, TrackMap } from '../src/track/types.ts';
import { TILE } from '../src/world/terrain.ts';
import { Rng } from '../src/core/rng.ts';

const N = 40;
const sq = (x: number, y: number) => y * N + x;
const line = (pts: [number, number][]) => { const out: number[] = []; for (let k = 0; k < pts.length - 1; k++) { let [x, y] = pts[k]!; const [tx, ty] = pts[k + 1]!; while (x !== tx || y !== ty) { out.push(sq(x, y)); x += Math.sign(tx - x); if (x === tx) y += Math.sign(ty - y); } } out.push(sq(...pts.at(-1)!)); return [...new Set(out)]; };
// note: line() walks x first then y between corners, enough for L and U shapes

function endPoint(net: Network, s: Step, atStart: boolean) {
  const p = net.pieces[s.piece]!, fwd = s.dir === 1;
  const q = pointAt(p.pts, p.cum, (atStart === fwd) ? 0 : p.len);
  return { x: q.x, y: q.y, tx: fwd ? q.tx : -q.tx, ty: fwd ? q.ty : -q.ty };
}

/** The rules every network must keep: rails join without gaps or kinks, and pieces stay on their squares. */
function checkNetwork(track: TrackMap, net: Network) {
  for (const p of net.pieces) {
    for (const dir of [1, -1] as const) {
      const s = { piece: p.id, dir };
      const e = endPoint(net, s, false);
      for (const nx of nextSteps(net, s)) {
        const b = endPoint(net, nx, true);
        expect(Math.hypot(e.x - b.x, e.y - b.y)).toBeLessThan(0.01);           // no gap
        expect(e.tx * b.tx + e.ty * b.ty).toBeGreaterThan(Math.cos(0.45));    // no kink (< ~26 degrees)
      }
    }
    for (let k = 0; k < p.pts.length; k += 2) { // inside its squares (1 px slack)
      const x = p.pts[k]!, y = p.pts[k + 1]!;
      expect(p.squares.some(s => x >= (s % N) * TILE - 1 && x <= ((s % N) + 1) * TILE + 1 && y >= ((s / N) | 0) * TILE - 1 && y <= (((s / N) | 0) + 1) * TILE + 1)).toBe(true);
    }
  }
  // every joined pair of squares meets with rails on both sides of the shared edge
  for (const [i, s] of track) for (const d of [0, 1] as const) {
    if (!(s.links & (1 << d))) continue;
    const j = d === 0 ? i + 1 : i + N;
    if (!track.get(j)) continue;
    const onI = net.bySquare.get(i) ?? [], onJ = net.bySquare.get(j) ?? [];
    const ends = (ids: number[]) => new Set(ids.flatMap(id => [net.pieces[id]!.a, net.pieces[id]!.b]));
    const ei = ends(onI), shared = [...ends(onJ)].filter(k => ei.has(k));
    expect(shared.length).toBeGreaterThan(0);
  }
}

describe('rail network', () => {
  it('a straight line is one piece per square, joined end to end', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[5, 5], [12, 5]]));
    const net = buildNetwork(t, N); checkNetwork(t, net);
    expect(net.pieces.filter(p => p.kind === 'straight').length).toBe(8);
  });

  it('a clean corner becomes one wide arc over three squares', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[5, 5], [10, 5], [10, 10]]));
    const net = buildNetwork(t, N); checkNetwork(t, net);
    expect(net.pieces.filter(p => p.kind === 'wide').length).toBe(1);
  });

  it('a tight S-bend keeps short curves, still smooth', () => {
    const t: TrackMap = new Map(); layPath(t, N, [sq(5, 5), sq(6, 5), sq(6, 6), sq(7, 6), sq(7, 7), sq(8, 7)]);
    const net = buildNetwork(t, N); checkNetwork(t, net);
  });

  it('a junction offers the straight and the branch, never a U-turn', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[5, 5], [15, 5]])); layPath(t, N, line([[10, 5], [10, 12]]));
    const net = buildNetwork(t, N); checkNetwork(t, net);
    // a train heading east on (8,5) can go on east or take the gentle turnout south, not west
    const east = net.pieces.find(p => p.squares.length === 1 && p.squares[0] === sq(8, 5))!;
    const opts = nextSteps(net, { piece: east.id, dir: east.ta[0] > 0 ? 1 : -1 });
    expect(opts.length).toBe(2);
    // the turnout starts a square before the junction and ends a square after it: a smooth radius-1.5 arc
    const turnouts = net.pieces.filter(p => p.kind === 'wide' && p.squares.includes(sq(10, 5)));
    expect(turnouts.length).toBe(2);
    for (const p of turnouts) expect(p.squares).toContain(sq(10, 6));
  });

  it('double track runs as two lanes, with turnouts where it meets single track', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[5, 5], [15, 5]]));
    for (let x = 8; x <= 12; x++) t.get(sq(x, 5))!.dbl = true;
    const net = buildNetwork(t, N); checkNetwork(t, net);
    expect(net.pieces.filter(p => p.kind === 'fan').length).toBe(4); // 2 at each end
  });

  it('double track goes round wide corners as two concentric arcs', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[5, 5], [10, 5], [10, 10]]));
    for (const s of t.values()) s.dbl = true;
    const net = buildNetwork(t, N); checkNetwork(t, net);
    expect(net.pieces.filter(p => p.kind === 'wide').length).toBe(2);
  });

  it('random networks always join smoothly', () => {
    const rng = new Rng(7);
    for (let trial = 0; trial < 60; trial++) {
      const t: TrackMap = new Map();
      let x = 20, y = 20; const path = [sq(x, y)];
      for (let k = 0; k < 60; k++) { const d = rng.int(4); x = Math.max(2, Math.min(N - 3, x + [1, 0, -1, 0][d]!)); y = Math.max(2, Math.min(N - 3, y + [0, 1, 0, -1][d]!)); path.push(sq(x, y)); }
      layPath(t, N, path.filter((v, k) => v !== path[k - 1]));
      for (const [i, s] of t) if (rng.next() < 0.3) { s.dbl = true; void i; }
      checkNetwork(t, buildNetwork(t, N));
    }
  });

  it('old saves link neighbouring squares', () => {
    const t = linkByAdjacency([sq(1, 1), sq(2, 1), sq(2, 2)], N);
    expect(t.get(sq(2, 1))!.links).toBe(0b0110); // south and west
  });
});
