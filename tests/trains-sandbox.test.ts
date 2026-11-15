import { expect, it } from 'vitest';
import { buildNetwork } from '../src/track/network.ts';
import { layPath } from '../src/track/edit.ts';
import type { TrackMap } from '../src/track/types.ts';
import { placeTrain, TrainSystem } from '../src/trains/train.ts';
const N = 60, sq = (x: number, y: number) => (y + 10) * N + x + 10;
function path(...pts: [number, number][]) { const out: number[] = []; for (let k = 0; k < pts.length - 1; k++) { let [x, y] = pts[k]!; const [tx, ty] = pts[k + 1]!; while (x !== tx || y !== ty) { out.push(sq(x, y)); if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); } } out.push(sq(...pts.at(-1)!)); return out.filter((v, i) => v !== out[i - 1]); }
it('a train parked on a short branch moves aside so another can pass', () => {
  const t: TrackMap = new Map();
  layPath(t, N, path([0, 0], [6, 0], [6, 4])); layPath(t, N, path([6, 4], [0, 4], [0, 2])); layPath(t, N, path([3, 0], [3, 2]));
  for (let x = 1; x <= 5; x++) t.get(sq(x, 4))!.dbl = true;
  const net = buildNetwork(t, N);
  const a = placeTrain(net, 1, { piece: net.bySquare.get(sq(2, 0))![0]!, dir: 1 }, 3);
  const sys = new TrainSystem(net, [a]); sys.rebuildHolds();
  const b = placeTrain(net, 2, { piece: net.bySquare.get(sq(4, 4))![0]!, dir: 1 }, 3); sys.trains.push(b); sys.rebuildHolds();
  expect(sys.sendTo(a, sq(0, 2)) && sys.sendTo(b, sq(3, 2))).toBe(true);
  const done = { a: false, b: false };
  for (let k = 0; k < 30 * 40; k++) { sys.tick(1 / 30); if (a.dest === undefined && net.pieces[a.trail.at(-1)!.piece]!.squares.includes(sq(0, 2))) done.a = true; if (b.dest === undefined && b.plan.length === 0 && k > 30) done.b = true; }
  expect(done.a).toBe(true); expect(done.b).toBe(true);
});
