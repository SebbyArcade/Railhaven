import { type Network, entryNode } from '../track/network.ts';
import { pointAt } from '../track/geometry.ts';
import { findRoute, isRev, type Move, type RouteRequest, sameStep } from '../track/route.ts';
import type { NodeKey, Step } from '../track/types.ts';

/** Rolling stock sizes in world px (old game: 18% smaller to fit tight curves). */
export const ENGINE_LEN = 15, CAR_LEN = 12, COUPLING = 2;
/** trains stop this far before a red signal, so they never touch */
export const SIGNAL_GAP = 8;
/** seconds stuck before looking for another way, and seconds to wait aside before trying again */
export const UNSTICK_AFTER = 4, REFUGE_WAIT = 4;
export const V_MAX = 70, ACCEL = 40, DECEL = 60, REVERSE_PAUSE = 0.45;

export interface Train {
  id: number;
  /** pieces under the train, tail first */
  trail: Step[];
  /** distance travelled along the head step / along the tail step */
  headS: number;
  tailS: number;
  v: number;
  /** what comes after the head step */
  plan: Move[];
  /** how many of the next plan steps this train holds (signals cleared) */
  held: number;
  cars: number;
  /** the engine is at the head end (false while it pushes after reversing) */
  engineAhead: boolean;
  /** seconds stopped waiting for the way to clear */
  wait: number;
  /** seconds left in a reversal pause */
  pause: number;
  /** destination: stop when the head is on this square */
  dest?: number;
  /** or: pull right through to the far end of these squares (a yard or a station hall); dest is one of them */
  area?: number[];
  /** what it carries and its job (goods trains) */
  cargo?: { good: string; n: number; d: number };
  job?: { src: number; to: { kind: 'town' | 'bld'; id: number }; good: string; phase: 'toLoad' | 'loading' | 'toDrop' | 'unloading'; timer: number; sea?: number };
  /** seconds until an idle train looks for a load again, and what its last delivery paid */
  idle?: number;
  lastPay?: { pay: number; at: number; n: number; good: string; to: { kind: 'town' | 'bld'; id: number } };
  /** seconds to wait in a refuge (out of another train's way) before trying again */
  refuge?: number;
  /** broken down: waits for the repair crew (see world/events.ts) */
  broke?: { crewAt: number; doneAt: number };
  /** head position when saved, to find the train again if the rails were rebuilt */
  at?: { x: number; y: number; tx: number; ty: number };
}

export const trainLength = (t: Train) => ENGINE_LEN + t.cars * (CAR_LEN + COUPLING);
const rev = (s: Step): Step => ({ piece: s.piece, dir: s.dir === 1 ? -1 : 1 });

/** Where a step's distance s lies on the map. */
export function stepPoint(net: Network, s: Step, d: number) {
  const p = net.pieces[s.piece]!, q = pointAt(p.pts, p.cum, s.dir === 1 ? d : p.len - d);
  return s.dir === 1 ? q : { x: q.x, y: q.y, tx: -q.tx, ty: -q.ty };
}

/** Point at distance `back` behind the head, walking down the trail. */
export function bodyPoint(net: Network, t: Train, back: number) {
  let k = t.trail.length - 1, d = t.headS - back;
  while (d < 0 && k > 0) { k--; d += net.pieces[t.trail[k]!.piece]!.len; }
  return stepPoint(net, t.trail[k]!, Math.max(0, d));
}

/** Runs every train: signals, speed, moving along rails, reversing. Pure logic, no drawing. */
export class TrainSystem {
  /** piece -> train holding it */
  holder = new Map<number, number>();
  constructor(public net: Network, public trains: Train[]) { this.rebuildHolds(); }

  /** top speed (Engine shed upgrades raise it) */
  vmax = V_MAX;
  /** share of top speed for a train right now (storms, breakdowns); 0 stops it where it is */
  speedOf?: (t: Train) => number;
  /** pieces trains may not enter (broken rails) */
  blocked = new Set<number>();
  /** platform and yard tracks: either lane is fine there (keep-left is for the open line) */
  anyLane = new Set<number>();

  setNetwork(net: Network) { this.net = net; }

  /** findRoute that never drives over blocked pieces */
  private route(q: RouteRequest) {
    const extra = q.extra;
    return findRoute(this.net, { ...q, extra: s => this.blocked.has(s.piece) ? Infinity : extra?.(s) ?? 0 });
  }

  private stepsHeld(t: Train): number[] {
    const ids = t.trail.map(s => s.piece);
    for (let k = 0, c = 0; k < t.plan.length && c < t.held; k++) { const m = t.plan[k]!; if (isRev(m)) continue; ids.push(m.piece); c++; }
    return ids;
  }

  rebuildHolds() {
    this.holder.clear();
    for (const t of this.trains) for (const p of this.stepsHeld(t)) this.holder.set(p, t.id);
  }

  private free(t: Train, piece: number): boolean {
    const own = (p: number) => { const h = this.holder.get(p); return h === undefined || h === t.id; };
    return !this.blocked.has(piece) && own(piece) && this.net.conflicts[piece]!.every(own);
  }

  /**
   * Try to clear the next block of the plan for t: every piece up to a passing place long enough to hold the whole
   * train (double track or a junction), so two trains never meet head-on on a single line.
   */
  private tryHold(t: Train): boolean {
    const steps: Step[] = []; let k = 0, c = 0;
    for (; k < t.plan.length; k++) { const m = t.plan[k]!; if (isRev(m)) continue; if (c++ >= t.held) break; }
    const need = trainLength(t) + SIGNAL_GAP;
    let room = 0;
    for (let j = k; j < t.plan.length; j++) {
      const m = t.plan[j]!; if (isRev(m)) break;
      steps.push(m);
      room = this.net.passing[m.piece] ? room + this.net.pieces[m.piece]!.len : 0;
      if (room >= need) break;
    }
    if (!steps.length || !steps.every(s => this.free(t, s.piece))) return false;
    for (const s of steps) this.holder.set(s.piece, t.id);
    t.held += steps.length;
    return true;
  }

  /** Distance the head may still travel before it must stand still. */
  private authority(t: Train): number {
    const head = t.trail.at(-1)!;
    let d = this.net.pieces[head.piece]!.len - t.headS, c = 0, signal = false;
    for (const m of t.plan) {
      if (isRev(m)) break;
      if (c++ >= t.held) { signal = true; break; }
      d += this.net.pieces[m.piece]!.len;
    }
    if (signal) d -= SIGNAL_GAP; // stop short of a red signal
    const r = t.plan[0];
    if (isRev(r) && r.clear === null) return 0;
    if (isRev(r) && r.clear && r.clear !== 'end') d = Math.min(d, this.toClear(t, r.clear));
    return d;
  }

  /** How far the train must still go for its tail to pass node `x`. */
  private toClear(t: Train, x: NodeKey): number {
    const k = t.trail.findIndex(s => entryNode(this.net, s) === x);
    if (k < 0) return Infinity;
    let d = -t.tailS;
    for (let j = 0; j < k; j++) d += this.net.pieces[t.trail[j]!.piece]!.len;
    return Math.max(0, d);
  }

  private reverse(t: Train) {
    const old = t.trail, len = (s: Step) => this.net.pieces[s.piece]!.len;
    const headS = len(old[0]!) - t.tailS, tailS = len(old.at(-1)!) - t.headS;
    t.trail = old.slice().reverse().map(rev);
    t.headS = headS; t.tailS = tailS; t.engineAhead = !t.engineAhead; t.v = 0; t.pause = REVERSE_PAUSE;
    t.plan.shift(); // the reversal
    const head = t.trail.at(-1)!;
    const at = t.plan.findIndex(m => sameStep(m, head));
    if (at >= 0) t.plan.splice(0, at + 1);
    // the plan guessed which way the back of the train lay; if the rails behind went another way, plan again
    const nx = t.plan[0];
    if (nx && !isRev(nx) && !nextStepsOf(this.net, head).some(o => sameStep(o, nx))) {
      const last = t.plan.filter(m => !isRev(m)).at(-1) as Step;
      const again = this.route({ head, tail: t.trail[0]!, trail: t.trail, trainLen: trainLength(t), goal: s => sameStep(s, last), extra: s => this.laneCost(s) });
      t.plan = again ?? [];
      if (!again && t.dest !== undefined) t.refuge = REFUGE_WAIT; // no way right now: wait here and try again soon
    }
    t.held = 0;
    this.rebuildHolds();
  }

  /** Trains keep to the left lane on double track (the right lane only when there is no other way). */
  private laneCost(s: Step): number {
    return !this.anyLane.has(s.piece) && this.net.side[s.piece]! * s.dir > 0 ? 5000 : 0;
  }

  /** is this step a place where t's trip ends? */
  private goalFor(dest: number, area?: number[]): (s: Step) => boolean {
    if (!area) return s => this.net.pieces[s.piece]!.squares.includes(dest);
    const set = new Set(area), inside = (s: Step) => this.net.pieces[s.piece]!.squares.every(q => set.has(q));
    // inside the area, at its far end: going on would leave it
    return s => inside(s) && !nextStepsOf(this.net, s).some(inside);
  }

  /** Send a train to the far end of a yard or station hall (whichever end it comes in from). */
  sendToArea(t: Train, area: number[]): boolean {
    return this.sendTo(t, area[0]!, area);
  }

  /** Plan a trip to a square (or the far end of an area). Returns false when there is no way. */
  sendTo(t: Train, dest: number, area?: number[]): boolean {
    const goal = this.goalFor(dest, area);
    const req: RouteRequest = {
      head: t.trail.at(-1)!, tail: t.trail[0]!, trail: t.trail, trainLen: trainLength(t), canReverseNow: true,
      goal,
      extra: s => this.laneCost(s) + (() => { const h = this.holder.get(s.piece); return h !== undefined && h !== t.id ? 200 : 0; })(),
    };
    // the only way is over a broken rail: take it anyway and wait there for the repair crew
    const route = this.route(req) ?? (this.blocked.size ? findRoute(this.net, { ...req, extra: s => req.extra!(s) + (this.blocked.has(s.piece) ? 20000 : 0) }) : null);
    if (!route) return false;
    t.plan = route; t.dest = dest; t.held = 0; t.wait = 0; t.refuge = undefined;
    if (area) t.area = area; else delete t.area;
    this.rebuildHolds();
    return true;
  }

  tick(dt: number) {
    for (const t of this.trains) this.move(t, dt);
  }

  private move(t: Train, dt: number) {
    if (t.pause > 0) { t.pause -= dt; return; }
    if (t.refuge !== undefined && !t.plan.length && t.v === 0) { // standing aside: try the real trip again soon
      t.refuge -= dt;
      if (t.refuge <= 0) { t.refuge = undefined; if (t.dest !== undefined) this.sendTo(t, t.dest, t.area); }
      return;
    }
    if (isRev(t.plan[0]) && t.v < 0.5 && this.authority(t) <= 0.5) { this.reverse(t); return; }
    // clear signals ahead while within braking distance plus a piece
    for (let tries = 0; tries < 4; tries++) {
      const brake = (t.v * t.v) / (2 * DECEL) + 40;
      if (this.authority(t) > brake) break;
      if (!this.tryHold(t)) break;
    }
    const mul = this.speedOf ? this.speedOf(t) : 1;
    if (mul <= 0 && t.v < 0.5) { t.v = 0; t.wait = 0; return; } // broken down: stand still, keep its place on the line
    const auth = this.authority(t);
    const target = Math.min(this.vmax * mul, Math.sqrt(2 * DECEL * Math.max(0, auth - 0.5)));
    t.v = t.v < target ? Math.min(target, t.v + ACCEL * dt) : Math.max(target, t.v - DECEL * dt);
    let go = Math.min(t.v * dt, auth);
    if (go <= 0.001) {
      t.v = Math.min(t.v, 0);
      if (!t.plan.length) { t.v = 0; t.wait = 0; if (t.refuge === undefined) { t.dest = undefined; delete t.area; } return; } // arrived
      if (!isRev(t.plan[0])) t.wait += dt; else t.wait = 0;
      this.unstick(t); return;
    }
    t.wait = 0;
    while (go > 0) {
      const head = t.trail.at(-1)!, room = this.net.pieces[head.piece]!.len - t.headS;
      if (go <= room) { t.headS += go; go = 0; break; }
      t.headS += room; go -= room;
      const nx = t.plan[0];
      if (!nx || isRev(nx) || t.held <= 0) { go = 0; break; }
      t.plan.shift(); t.held--; t.trail.push(nx); t.headS = 0;
    }
    this.trimTail(t);
    if (!t.plan.length && t.v < 1 && this.authority(t) < 1) {
      t.v = 0;
      if (t.refuge === undefined) { t.dest = undefined; delete t.area; }
    }
  }

  private trimTail(t: Train) {
    const L = trainLength(t), len = (s: Step) => this.net.pieces[s.piece]!.len;
    // length currently covered from tail to head
    let covered = t.headS;
    for (let k = t.trail.length - 2; k >= 0; k--) covered += len(t.trail[k]!) - (k === 0 ? t.tailS : 0);
    if (t.trail.length === 1) covered = t.headS - t.tailS;
    let extra = covered - L;
    while (extra > 0 && t.trail.length > 1) {
      const room = len(t.trail[0]!) - t.tailS;
      if (extra < room) { t.tailS += extra; extra = 0; break; }
      extra -= room; const gone = t.trail.shift()!; t.tailS = 0;
      if (!t.trail.some(s => s.piece === gone.piece) && this.holder.get(gone.piece) === t.id) this.holder.delete(gone.piece);
    }
    if (t.trail.length === 1 && extra > 0) t.tailS += extra;
  }

  /**
   * Waiting too long (a train in the way): look for another way round, reversing if needed. If there is none,
   * step aside into a siding or passing track that no waiting train needs, and try again a little later.
   */
  private unstick(t: Train) {
    if (t.wait < UNSTICK_AFTER || t.dest === undefined) return;
    t.wait = 0;
    // waiting for a broken rail to be fixed: nothing else to do
    const nextFree = t.plan.filter(m => !isRev(m))[t.held] as Step | undefined;
    if (nextFree && this.blocked.has(nextFree.piece)) return;
    const dest = t.dest, L = trainLength(t), goal = this.goalFor(dest, t.area);
    // pieces under other trains can't be passed; pieces they have only signalled ahead are just costly
    const bodies = new Set<number>();
    for (const o of this.trains) if (o !== t) for (const s of o.trail) { bodies.add(s.piece); for (const c of this.net.conflicts[s.piece]!) bodies.add(c); }
    const base = { head: t.trail.at(-1)!, tail: t.trail[0]!, trail: t.trail, trainLen: L, canReverseNow: true };
    const cost = (s: Step) => bodies.has(s.piece) ? Infinity : this.laneCost(s) + (() => { const h = this.holder.get(s.piece); return h !== undefined && h !== t.id ? 4000 : 0; })();
    const route = this.route({ ...base, goal, extra: cost });
    if (route) { t.plan = route; t.held = 0; this.rebuildHolds(); return; }
    // a parked train (no trip) is in the way: ask it to move aside, then wait for the way to clear
    const parked = new Set<number>();
    for (const o of this.trains) if (o !== t && !o.plan.length && o.dest === undefined) for (const st of o.trail) { parked.add(st.piece); for (const c of this.net.conflicts[st.piece]!) parked.add(c); }
    const moving = new Set<number>();
    for (const o of this.trains) if (o !== t && (o.plan.length || o.dest !== undefined)) for (const st of o.trail) { moving.add(st.piece); for (const c of this.net.conflicts[st.piece]!) moving.add(c); }
    if (parked.size) {
      const via = this.route({ ...base, goal, extra: s => moving.has(s.piece) ? Infinity : this.laneCost(s) + (parked.has(s.piece) ? 500 : 0) });
      if (via) {
        const way = new Set<number>();
        for (const m of via) if (!isRev(m)) { way.add(m.piece); for (const c of this.net.conflicts[m.piece]!) way.add(c); }
        for (const st of t.trail) { way.add(st.piece); for (const c of this.net.conflicts[st.piece]!) way.add(c); }
        let asked = false;
        for (const o of this.trains) if (o !== t && !o.plan.length && o.dest === undefined && o.trail.some(st => way.has(st.piece))) asked = this.stepAside(o, way) || asked;
        if (asked) { t.plan = via; t.held = 0; this.rebuildHolds(); return; }
      }
    }
    // no way round: get out of the way of every train that is waiting
    const inWay = new Set<number>();
    for (const o of this.trains) if (o !== t) {
      let c = 0; for (const m of o.plan) { if (isRev(m)) continue; inWay.add(m.piece); for (const x of this.net.conflicts[m.piece]!) inWay.add(x); if (++c > 60) break; }
      // never stand aside on the destination of a train that is itself standing aside (it has no plan right now);
      // a train with a plan only needs the pieces of that plan, so a station's other platform stays usable
      if (o.dest !== undefined && !o.plan.length) for (const q of o.area ?? [o.dest]) for (const p of this.net.bySquare.get(q) ?? []) { inWay.add(p); for (const x of this.net.conflicts[p]!) inWay.add(x); }
    }
    // stagger retries so two trains standing aside don't come back at the same moment
    if (this.stepAside(t, inWay)) t.refuge = REFUGE_WAIT + (t.id % 3) * 1.5;
  }

  /** Drive a train to a siding or passing track clear of the given pieces (and of other trains). */
  private stepAside(t: Train, inWay: Set<number>): boolean {
    const L = trainLength(t);
    const bodies = new Set<number>();
    for (const o of this.trains) if (o !== t) for (const s of o.trail) { bodies.add(s.piece); for (const c of this.net.conflicts[s.piece]!) bodies.add(c); }
    const refuge = this.route({
      head: t.trail.at(-1)!, tail: t.trail[0]!, trail: t.trail, trainLen: L, canReverseNow: true,
      extra: s => bodies.has(s.piece) ? Infinity : this.laneCost(s) + (() => { const h = this.holder.get(s.piece); return h !== undefined && h !== t.id ? 4000 : 0; })(),
      goal: s => !inWay.has(s.piece) && (this.net.passing[s.piece]! || (s.dir === 1 && !!this.net.pieces[s.piece]!.endB)),
      accept: moves => { // the whole train must stand clear of the others' way, its tail included
        let got = 0;
        const revs = moves.filter(isRev).length;
        // where the rest of the body lies once the moves are done: on its old trail, from the tail end after a
        // reversal at the start, from the head end with no reversal (other shapes: only the moves are checked)
        const behind = revs === 0 ? [...t.trail].reverse() : revs === 1 && isRev(moves[0]!) ? t.trail : [];
        for (let k = moves.length - 1; k >= 0 && got < L; k--) { const m = moves[k]!; if (isRev(m)) break; if (inWay.has(m.piece)) return false; got += this.net.pieces[m.piece]!.len; }
        for (const st of behind) { if (got >= L) break; if (inWay.has(st.piece)) return false; got += this.net.pieces[st.piece]!.len; }
        return got >= L || (behind.length === 0 && moves.length > 0);
      },
    });
    if (!refuge || !refuge.length) return false;
    t.plan = refuge; t.held = 0; t.wait = 0; this.rebuildHolds();
    return true;
  }
}

/** Put a new train on a piece, head at its far end (the piece must be long enough or have track behind). */
export function placeTrain(net: Network, id: number, at: Step, cars: number): Train {
  const t: Train = { id, trail: [at], headS: net.pieces[at.piece]!.len, tailS: 0, v: 0, plan: [], held: 0, cars, engineAhead: true, wait: 0, pause: 0 };
  // extend the tail backwards along the track until the whole train fits
  const L = trainLength(t); let covered = t.headS;
  while (covered < L) {
    const back = rev(t.trail[0]!);
    const prevSteps = nextStepsOf(net, back);
    if (!prevSteps.length) break;
    const p = rev(prevSteps[0]!); t.trail.unshift(p); covered += net.pieces[p.piece]!.len;
  }
  t.tailS = Math.max(0, covered - L);
  if (t.trail.length === 1) t.tailS = Math.max(0, t.headS - L);
  return t;
}
import { nextSteps as nextStepsOf } from '../track/network.ts';
