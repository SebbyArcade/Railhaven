import { type Network, endsAtBuffer, exitHeading, exitNode, nextSteps } from './network.ts';
import type { NodeKey, Step } from './types.ts';

/**
 * A route is a list of moves: drive onto a step, or reverse. A reversal waits until the train's tail has passed
 * `clear` (the junction it must clear); 'end' = at the buffer stop; null = right away (the train is standing).
 */
export interface Rev { rev: true; clear: NodeKey | 'end' | null }
export type Move = Step | Rev;
export const isRev = (m: Move | undefined): m is Rev => !!m && 'rev' in m;

const key = (s: Step) => s.piece * 2 + (s.dir === 1 ? 0 : 1);
const rev = (s: Step): Step => ({ piece: s.piece, dir: s.dir === 1 ? -1 : 1 });
export const sameStep = (a: Move | undefined, b: Step) => !!a && !isRev(a) && a.piece === b.piece && a.dir === b.dir;

/** Reversing costs this much extra, so trains only do it when it really is the way. */
export const REVERSE_COST = 6 * 32;

/**
 * Steps a train runs onto past the end of `s` before it can reverse there: straight on, until the whole train
 * fits past the end of `s`. Empty when `s` ends at a buffer stop. Null when there is no room to reverse.
 */
export function reverseRunOn(net: Network, s: Step, trainLen: number): Step[] | null {
  if (endsAtBuffer(net, s)) return [];
  const out: Step[] = []; let cur = s, got = 0;
  while (got < trainLen) {
    const [hx, hy] = exitHeading(net, cur), opts = nextSteps(net, cur);
    if (!opts.length) return null;
    let best = opts[0]!, bd = -2;
    for (const o of opts) { const p = net.pieces[o.piece]!, t = o.dir === 1 ? p.ta : [-p.tb[0], -p.tb[1]]; const d = t[0]! * hx + t[1]! * hy; if (d > bd) { bd = d; best = o; } }
    out.push(best); got += net.pieces[best.piece]!.len; cur = best;
    if (out.length > 40) return null;
  }
  return out;
}

export interface RouteRequest {
  /** the train's head step and its tail step (tail step is listed with the train's direction) */
  head: Step;
  tail: Step;
  /** the whole train, back to front (better than just head and tail for reversing at buffer stops) */
  trail?: Step[];
  trainLen: number;
  /** is this step a place to stop? */
  goal: (s: Step) => boolean;
  /** extra cost of driving onto a step (e.g. other trains in the way); Infinity = never */
  extra?: (s: Step) => number;
  /** may the train reverse at the start */
  canReverseNow?: boolean;
  /** last check on a whole route that reached a goal; false keeps searching */
  accept?: (moves: Move[]) => boolean;
}

/**
 * Shortest way to a goal for a train, never turning on the spot. Reversing is allowed where the train fits past the
 * last junction (or at buffer stops), at a cost. Returns the moves after the current head step, or null.
 */
export function findRoute(net: Network, q: RouteRequest): Move[] | null {
  const dist = new Map<number, number>(), prev = new Map<number, { from: number; moves: Move[] }>();
  const heap: [number, number, Step][] = [];
  const pushH = (d: number, s: Step) => { heap.push([d, key(s), s]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p]![0] <= heap[i]![0]) break; [heap[p], heap[i]] = [heap[i]!, heap[p]!]; i = p; } };
  const popH = () => { const top = heap[0]!, last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l; if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i]!, heap[m]!]; i = m; } } return top; };
  const relax = (d: number, s: Step, from: number, moves: Move[]) => {
    const k = key(s); if ((dist.get(k) ?? Infinity) <= d) return;
    dist.set(k, d); prev.set(k, { from, moves }); pushH(d, s);
  };
  const START = -1;
  const len = (x: Step) => net.pieces[x.piece]!.len;
  /** the step under the back of the train when its front has just driven onto s (state k), from the way it came */
  const bodyBack = (k: number, s: Step): Step | null => {
    let covered = len(s), cur = k, last = s;
    while (covered < q.trainLen) {
      const p = prev.get(cur)!;
      if (p.from === START) { // back onto the train's starting place
        if (p.moves.some(isRev)) return null;
        const tr = q.trail; if (!tr) return q.tail;
        for (let j = tr.length - 2; j >= 0; j--) { covered += len(tr[j]!); if (covered >= q.trainLen) return tr[j]!; }
        return tr[0]!;
      }
      const prevStep = stepOf(p.from);
      if (p.moves.some(isRev)) return null; // the body folds back over a reversal: too short to tell
      last = prevStep; covered += len(prevStep); cur = p.from;
    }
    return last;
  };
  const stepOf = (k: number): Step => ({ piece: k >> 1, dir: k & 1 ? -1 : 1 });
  relax(0, q.head, START, []);
  if (q.canReverseNow) relax(REVERSE_COST, rev(q.tail), START, [{ rev: true, clear: null }]);
  while (heap.length) {
    const [d, k, s] = popH();
    if (d > (dist.get(k) ?? Infinity)) continue;
    if (q.goal(s)) {
      // rebuild the moves
      const out: Move[] = []; let cur = k;
      for (;;) { const p = prev.get(cur)!; out.unshift(...p.moves); if (p.from === START) break; cur = p.from; }
      if (!q.accept || q.accept(out)) return out;
    }
    for (const nx of nextSteps(net, s)) {
      const e = q.extra?.(nx) ?? 0; if (e === Infinity) continue;
      relax(d + net.pieces[nx.piece]!.len + e, nx, k, [nx]);
    }
    const run = reverseRunOn(net, s, q.trainLen);
    if (run && !run.length) {
      // at a buffer stop: after reversing, the front of the train is where its back was, a train length back
      const back = bodyBack(k, s);
      if (back) relax(d + REVERSE_COST, rev(back), k, [{ rev: true, clear: 'end' }]);
    } else if (run) {
      // drive on past the end, reverse, and come back over the same pieces onto s the other way
      let e = 0; for (const r of run) e += (q.extra?.(r) ?? 0) + net.pieces[r.piece]!.len * 2;
      if (e !== Infinity) relax(d + REVERSE_COST + e, rev(s), k, [...run, { rev: true, clear: run.length ? exitNode(net, s) : 'end' }, ...run.slice().reverse().map(rev), rev(s)]);
    }
  }
  return null;
}
