import { describe, expect, it } from 'vitest';
import { buildNetwork, type Network } from '../src/track/network.ts';
import { layPath } from '../src/track/edit.ts';
import type { TrackMap } from '../src/track/types.ts';
import { bodyPoint, placeTrain, type Train, TrainSystem, trainLength } from '../src/trains/train.ts';
import { Rng } from '../src/core/rng.ts';

const N = 60;
const sq = (x: number, y: number) => y * N + x;
function path(...pts: [number, number][]) {
  const out: number[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    let [x, y] = pts[k]!; const [tx, ty] = pts[k + 1]!;
    while (x !== tx || y !== ty) { out.push(sq(x, y)); if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); }
  }
  out.push(sq(...pts.at(-1)!));
  return out.filter((v, i) => v !== out[i - 1]);
}
const firstPiece = (net: Network, s: number) => net.bySquare.get(s)![0]!;
/** a step on square s heading east (dx=1), west (-1), south (dy=1) or north (-1) */
const heading = (net: Network, s: number, dx: number, dy = 0): { piece: number; dir: 1 | -1 } => {
  const p = net.pieces[firstPiece(net, s)]!; return { piece: p.id, dir: p.ta[0] * dx + p.ta[1] * dy > 0 ? 1 : -1 };
};

/** Run the system, checking the physical rules every tick. Returns ticks run. */
function run(sys: TrainSystem, seconds: number, until?: () => boolean) {
  const dt = 1 / 30, last = new Map<number, { x: number; y: number }>();
  for (let k = 0; k < seconds / dt; k++) {
    sys.tick(dt);
    for (const t of sys.trains) {
      const p = bodyPoint(sys.net, t, 0), q = last.get(t.id);
      if (q && t.pause <= 0) {
        // never jumps: moves at most its speed (plus a reversal, which keeps the train where it is)
        const moved = Math.hypot(p.x - q.x, p.y - q.y);
        expect(moved).toBeLessThan(80 * dt + 0.5 + (t.pause > 0 ? 0 : trainLength(t) * 0));
      }
      last.set(t.id, { x: p.x, y: p.y });
    }
    // trains never overlap: no piece under two trains
    const seen = new Map<number, number>();
    for (const t of sys.trains) for (const s of t.trail) { const o = seen.get(s.piece); if (o !== undefined && o !== t.id) throw new Error(`trains ${o} and ${t.id} share piece ${s.piece}`); seen.set(s.piece, t.id); }
    for (const a of sys.trains) for (const b of sys.trains) if (a.id < b.id) {
      for (let u = 0; u <= trainLength(a); u += 4) for (let v = 0; v <= trainLength(b); v += 4) {
        const p = bodyPoint(sys.net, a, u), q = bodyPoint(sys.net, b, v);
        if (Math.hypot(p.x - q.x, p.y - q.y) < 5) throw new Error(`trains ${a.id} and ${b.id} touch`);
      }
    }
    if (until?.()) return k;
  }
  return -1;
}

describe('trains on real rails', () => {
  it('drives along a line and stops at the destination', () => {
    const t: TrackMap = new Map(); layPath(t, N, path([5, 5], [20, 5]));
    const net = buildNetwork(t, N), tr = placeTrain(net, 1, heading(net, sq(8, 5), 1), 2);
    const sys = new TrainSystem(net, [tr]);
    expect(sys.sendTo(tr, sq(18, 5))).toBe(true);
    expect(run(sys, 30, () => !tr.plan.length && tr.v === 0)).toBeGreaterThan(0);
    expect(net.pieces[tr.trail.at(-1)!.piece]!.squares).toContain(sq(18, 5));
  });

  it('reverses at a dead end instead of turning on the spot', () => {
    const t: TrackMap = new Map(); layPath(t, N, path([5, 5], [20, 5]));
    const net = buildNetwork(t, N), tr = placeTrain(net, 1, heading(net, sq(12, 5), 1), 2);
    const sys = new TrainSystem(net, [tr]);
    expect(sys.sendTo(tr, sq(6, 5))).toBe(true); // behind it
    expect(run(sys, 30, () => !tr.plan.length && tr.v === 0)).toBeGreaterThan(0);
    expect(tr.engineAhead).toBe(false); // it backed up, engine pushing
  });

  it('takes a trailing branch by running past the junction and backing in', () => {
    const t: TrackMap = new Map(); layPath(t, N, path([5, 10], [30, 10])); layPath(t, N, path([15, 10], [15, 20]));
    const net = buildNetwork(t, N), tr = placeTrain(net, 1, heading(net, sq(20, 10), 1), 2);
    const sys = new TrainSystem(net, [tr]);
    expect(sys.sendTo(tr, sq(15, 18))).toBe(true);
    expect(run(sys, 60, () => !tr.plan.length && tr.v === 0)).toBeGreaterThan(0);
  });

  it('two trains meet at a passing loop and both get through', () => {
    const t: TrackMap = new Map(); layPath(t, N, path([5, 5], [40, 5]));
    for (let x = 20; x <= 25; x++) t.get(sq(x, 5))!.dbl = true;
    const net = buildNetwork(t, N);
    const a = placeTrain(net, 1, heading(net, sq(9, 5), 1), 3);
    const b = placeTrain(net, 2, heading(net, sq(36, 5), -1), 3);
    const sys = new TrainSystem(net, [a, b]);
    expect(sys.sendTo(a, sq(38, 5))).toBe(true);
    expect(sys.sendTo(b, sq(7, 5))).toBe(true);
    expect(run(sys, 120, () => !a.plan.length && !b.plan.length && a.v === 0 && b.v === 0)).toBeGreaterThan(0);
  });

  it('five trains on a looped network with passing loops never overlap, jump or lock up', () => {
    const rng = new Rng(3), t: TrackMap = new Map();
    layPath(t, N, path([5, 5], [45, 5], [45, 40], [5, 40], [5, 6]));
    layPath(t, N, path([25, 5], [25, 40]));
    layPath(t, N, path([45, 22], [55, 22]));
    for (const [i, s] of t) if ((i % N) > 10 && (i % N) < 18) s.dbl = true;
    const net = buildNetwork(t, N);
    const starts = [sq(10, 5), sq(45, 15), sq(30, 40), sq(5, 30), sq(25, 20)];
    const trains: Train[] = starts.map((s, k) => placeTrain(net, k + 1, { piece: firstPiece(net, s), dir: 1 }, 2));
    const sys = new TrainSystem(net, trains);
    // destinations like stations and yards: line ends and double track
    const stops = [sq(5, 5), sq(5, 6), sq(55, 22), sq(14, 5), sq(14, 40), sq(12, 5), sq(16, 40)];
    let arrivals = 0, maxStill = 0;
    const still = new Map<number, number>();
    for (let k = 0; k < 20; k++) {
      run(sys, 10, () => {
        for (const tr of trains) {
          if (!tr.plan.length && tr.v === 0) { arrivals++; sys.sendTo(tr, rng.pick(stops)); }
          const s = tr.v < 0.5 ? (still.get(tr.id) ?? 0) + 1 / 30 : 0; still.set(tr.id, s); maxStill = Math.max(maxStill, s);
        }
        return false;
      });
    }
    expect(arrivals).toBeGreaterThan(20);
    expect(maxStill).toBeLessThan(150);
  });
});
