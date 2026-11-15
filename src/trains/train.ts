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
/** the engine running round its train: speed (px/s), seconds to uncouple or couple, and the longest way round (px) */
/** extra route cost per px run with the engine at the back */
export const PUSH_COST = 3;
export const RR_SPEED = 32, RR_COUPLE = 0.8, RR_MAX = 12 * 32;

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
  job?: { src: number; to: { kind: 'town' | 'bld'; id: number }; good: string; phase: 'toLoad' | 'loading' | 'toDrop' | 'unloading'; timer: number; sea?: number; then?: number };
  /** seconds until an idle train looks for a load again, and what its last delivery paid */
  idle?: number;
  lastPay?: { pay: number; at: number; n: number; good: string; to: { kind: 'town' | 'bld'; id: number } };
  /** seconds to wait in a refuge (out of another train's way) before trying again */
  refuge?: number;
  /** seconds a goods train with a job has stood still on its way (held up by other trains); 0 once it moves */
  stopT?: number;
  /** broken down: waits for the repair crew (see world/events.ts) */
  broke?: { crewAt: number; doneAt: number };
  /** head position when saved, to find the train again if the rails were rebuilt */
  at?: { x: number; y: number; tx: number; ty: number };
  /**
   * The engine is running round its train (it uncoupled at the front, drives along the other track of the yard or
   * station and couples on at the back), so the train leaves pulling instead of pushing. `moves` is the engine's way,
   * `s` how far along it is, `wait` the uncoupling or coupling time left.
   */
  rr?: { moves: Move[]; s: number; len: number; wait: number };
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
  /** told when a train reverses partway along a trip (not at its stops): the square where its tail turned */
  onMidReverse?: (t: Train, square: number) => void;

  setNetwork(net: Network) { this.net = net; }

  /** findRoute that never drives over blocked pieces */
  private route(q: RouteRequest) {
    const extra = q.extra;
    return findRoute(this.net, { ...q, extra: s => this.blocked.has(s.piece) ? Infinity : extra?.(s) ?? 0 });
  }

  private stepsHeld(t: Train): number[] {
    const ids = t.trail.map(s => s.piece);
    if (t.rr) for (const m of t.rr.moves) if (!isRev(m)) ids.push(m.piece);
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
      // on the wrong lane (after turning back) the train can't wait where oncoming trains run: it clears the whole way back to its own lane
      room = this.net.passing[m.piece] && !this.laneCost(m) ? room + this.net.pieces[m.piece]!.len : 0;
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
    // partway: not setting off from a stop, and not the short back-in at the end of the trip
    if (this.onMidReverse && t.plan[0] && isRev(t.plan[0]) && t.plan[0].clear !== null) {
      let left = 0; for (const m of t.plan) if (!isRev(m)) left += len(m);
      if (left > trainLength(t) * 2 + 4 * 32) this.onMidReverse(t, this.net.pieces[old.at(-1)!.piece]!.squares[0]!);
    }
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

  /**
   * Find the engine's way round its train: off the front, back along a free parallel track (the yard's or the
   * station's other track, or a passing loop), and onto the back of the train, never over the train itself.
   */
  private startRunRound(t: Train): boolean {
    const trail = new Set(t.trail.map(s => s.piece)), head = t.trail.at(-1)!, tail = t.trail[0]!;
    // the engine's place to couple on: the piece behind the tail, heading toward the train
    const behind = nextStepsOf(this.net, rev(tail)).map(rev);
    if (!behind.length) return false;
    const goal = (s: Step) => behind.some(b => sameStep(s, b));
    let used = 0;
    const moves = this.route({
      head, tail: head, trainLen: ENGINE_LEN, canReverseNow: false, goal,
      extra: s => {
        if (trail.has(s.piece) || this.net.conflicts[s.piece]!.some(c => trail.has(c) && c !== head.piece)) return Infinity;
        if (!this.free(t, s.piece)) return Infinity;
        return 0;
      },
      accept: ms => { used = 0; for (const m of ms) if (!isRev(m)) used += this.net.pieces[m.piece]!.len; return used <= RR_MAX + trainLength(t); },
    });
    if (!moves || !moves.length || moves.filter(isRev).length > 2) return false;
    t.rr = { moves, s: 0, len: used + this.net.pieces[head.piece]!.len - t.headS, wait: RR_COUPLE };
    this.rebuildHolds();
    return true;
  }

  /** The engine drives its way round; when it couples on at the back, the train sets off pulling. */
  private runRound(t: Train, dt: number) {
    const r = t.rr!;
    if (r.wait > 0) { r.wait -= dt; return; }
    r.s += RR_SPEED * dt;
    if (r.s < r.len) return;
    if (r.s < r.len + RR_COUPLE * RR_SPEED) return; // coupling on
    delete t.rr;
    t.engineAhead = false; // the engine is now at the back: the reversal that follows puts it in front
    this.rebuildHolds();
    this.reverse(t);
    // the engine coupled on just past the old tail: the train now reaches an engine length further that way
    const len = (x: Step) => this.net.pieces[x.piece]!.len, head = t.trail.at(-1)!, room = len(head) - t.headS;
    let gap = ENGINE_LEN + COUPLING;
    if (gap <= room) t.headS += gap;
    else {
      const nx = t.plan[0];
      if (nx && !isRev(nx)) { t.plan.shift(); t.trail.push(nx); t.headS = Math.min(len(nx), gap - room); } else t.headS = len(head);
      gap = 0;
    }
    this.trimTail(t);
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

  /**
   * Into a dead-end yard or station, back in: the train runs past the turnout, then pushes its wagons in, so the
   * engine stands at the open end and pulls out afterwards (real goods trains work dead-end sidings this way).
   */
  private backIn(t: Train): RouteRequest['revParity'] {
    return { want: t.engineAhead ? 1 : 0, when: s => endsAtBuffer(this.net, s) };
  }

  /** Pushing a train costs as much again as pulling it, so trips turn the train where they can. */
  private pushOf(t: Train): RouteRequest['push'] { return { engineAhead: t.engineAhead, perPx: PUSH_COST }; }

  /** Plan a trip to a square (or the far end of an area). Returns false when there is no way. */
  sendTo(t: Train, dest: number, area?: number[]): boolean {
    const goal = this.goalFor(dest, area);
    const req: RouteRequest = {
      head: t.trail.at(-1)!, tail: t.trail[0]!, trail: t.trail, trainLen: trainLength(t), canReverseNow: true,
      goal,
      extra: s => this.laneCost(s) + (() => { const h = this.holder.get(s.piece); return h !== undefined && h !== t.id ? 200 : 0; })(),
    };
    // the only way is over a broken rail: take it anyway and wait there for the repair crew
    const route = this.route({ ...req, push: this.pushOf(t), ...(area ? { revParity: this.backIn(t) } : {}) }) ?? this.route({ ...req, push: this.pushOf(t) }) ?? (this.blocked.size ? findRoute(this.net, { ...req, extra: s => req.extra!(s) + (this.blocked.has(s.piece) ? 20000 : 0) }) : null);
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
    if (t.rr) { this.runRound(t, dt); return; }
    if (t.refuge !== undefined && !t.plan.length && t.v === 0) { // standing aside: try the real trip again soon
      t.refuge -= dt;
      if (t.refuge <= 0) { t.refuge = undefined; if (t.dest !== undefined) this.sendTo(t, t.dest, t.area); }
      return;
    }
    if (isRev(t.plan[0]) && t.v < 0.5 && this.authority(t) <= 0.5) {
      // about to set off backwards with the engine in front: if there is a free track beside the train, the engine
      // runs round it first, so the train leaves pulling
      if (t.engineAhead && t.plan[0].clear === null && this.startRunRound(t)) return;
      this.reverse(t); return;
    }
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
    if (t.wait < UNSTICK_AFTER) return;
    // moving aside with no trip of its own, and that way is blocked too: give it up and stand, so a waiting train can
    // ask it to move somewhere else (otherwise both wait for each other for ever)
    if (t.dest === undefined) { if (t.plan.length) { t.plan = []; t.held = 0; t.wait = 0; this.rebuildHolds(); } return; }
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
    const route = this.route({ ...base, goal, extra: cost, push: this.pushOf(t), ...(t.area ? { revParity: this.backIn(t) } : {}) }) ?? this.route({ ...base, goal, extra: cost });
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
    return this.aside(t, inWay, false) || this.aside(t, inWay, true);
  }

  /** `anywhere`: no siding or passing track is free, so any stretch of line clear of the others' way will do. */
  private aside(t: Train, inWay: Set<number>, anywhere: boolean): boolean {
    const L = trainLength(t);
    const bodies = new Set<number>();
    for (const o of this.trains) if (o !== t) for (const s of o.trail) { bodies.add(s.piece); for (const c of this.net.conflicts[s.piece]!) bodies.add(c); }
    const refuge = this.route({
      head: t.trail.at(-1)!, tail: t.trail[0]!, trail: t.trail, trainLen: L, canReverseNow: true,
      extra: s => bodies.has(s.piece) ? Infinity : this.laneCost(s) + (() => { const h = this.holder.get(s.piece); return h !== undefined && h !== t.id ? 4000 : 0; })(),
      goal: s => !inWay.has(s.piece) && (anywhere || this.net.passing[s.piece]! || (s.dir === 1 && !!this.net.pieces[s.piece]!.endB)),
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
import { endsAtBuffer, nextSteps as nextStepsOf } from '../track/network.ts';
