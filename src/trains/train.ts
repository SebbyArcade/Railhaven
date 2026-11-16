import { type Network, entryNode } from '../track/network.ts';
import { pointAt } from '../track/geometry.ts';
import { findRoute, isRev, type Move, REVERSE_COST, STAND_REVERSE_COST, type RouteRequest, sameStep } from '../track/route.ts';
import type { NodeKey, Step } from '../track/types.ts';

/** Rolling stock sizes in world px (old game: 18% smaller to fit tight curves). */
export const ENGINE_LEN = 15, CAR_LEN = 12, COUPLING = 2;
/** trains stop this far before a red signal, so they never touch */
export const SIGNAL_GAP = 8;
/** Double track is one-way per lane, like a road: the other lane costs this much, so trains take it only when there is no other way at all. */
export const WRONG_LANE = 50000;
/** seconds stuck before looking for another way, and seconds to wait aside before trying again */
export const UNSTICK_AFTER = 4, REFUGE_WAIT = 4;
/** A train held up takes a way round at once if it is at most this much longer than its own way (share, plus
 *  squares). A longer way round only once it has waited as long as running the extra distance would take. */
export const DETOUR_SHARE = 1.5, DETOUR_SQUARES = 8;
/** Gridlock: trains with a trip that have all stood this many seconds, each waiting on another that stands too. One
 *  of them backs off (with the trains behind it if need be) and the one it blocked goes first; checked every few s. */
export const TANGLE_AFTER = 40, TANGLE_EVERY = 5, TANGLE_KEEP = 90;
/** a train given the way through a gridlock that has still not moved after this many seconds gives the way back */
export const TANGLE_GIVE_BACK = 20;
/** A train with a trip that is held up waits this many seconds before taking a way round that turns it back, and this
 *  many before it steps aside out of the others' way (a short wait in line is better than turning round). */
export const TURN_BACK_AFTER = 20, STEP_ASIDE_AFTER = 30;
/** how many trains deep a train in the way may ask the trains behind it to back off too */
export const TANGLE_DEPTH = 4;
export const V_MAX = 70, ACCEL = 40, DECEL = 60, REVERSE_PAUSE = 0.45;
/** the engine running round its train: speed (px/s), seconds to uncouple or couple, and the longest way round (px) */
/** extra route cost per px run with the engine at the back: low enough that a train pushes its wagons a short way rather than running past a junction to turn round */
export const PUSH_COST = 0.6;
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
  /** the trip (by destination) for which it already looked for a free platform on arrival */
  platTry?: number;
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
  /** 💰 sold: it goes as soon as its load is delivered */
  sellAfter?: boolean;
  /** ⛴ booked to go over to this landing (dock id) by boat once it has delivered its load; the crossing is paid */
  moveTo?: number;
  /** seconds since it last had a job (no paying load anywhere) */
  noWork?: number;
  /** running costs since its last delivery, and what its last few trips earned after running costs */
  run?: number;
  nets?: number[];
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
  /** pieces a work crew's car stands on or is about to ride onto (see world/crews.ts): trains wait or go round */
  crew = new Set<number>();
  /** platform and yard tracks: either lane is fine there (keep-left is for the open line) */
  anyLane = new Set<number>();
  /** the short stretches just outside stations and yards (their throats): a train that turned back on a platform may
   *  run on the other lane there to reach its own (it clears the whole way first, so it never meets one nose to nose) */
  throat = new Set<number>();
  /** told when a train reverses partway along a trip (not at its stops): the square where its tail turned */
  onMidReverse?: (t: Train, square: number) => void;

  /** seconds each train has been held up on its current trip (not saved: it only shapes when to take a way round) */
  private heldUp = new Map<number, number>();
  /** seconds each train with a trip has stood still (not saved) */
  private still = new Map<number, number>();
  /** when each train last ended a trip (clock) */
  private arrived = new Map<number, number>();
  /** untangling a gridlock: pieces kept for the train that goes first, and trains that must not change their plan */
  private keep = new Map<number, { id: number; until: number }>();
  private calm = new Map<number, number>();
  /** trains given the way through a gridlock, until when */
  private prio = new Map<number, number>();
  /** trains backing off to untangle a gridlock, by the plan they were given: they may cross the kept pieces */
  private backing = new Map<number, Move[]>();
  private clock = 0;
  private tangleT = 0;
  /** gridlocks untangled so far (not saved) */
  untangled = 0;

  setNetwork(net: Network) { this.net = net; this.keep.clear(); this.prio.clear(); this.backing.clear(); this.calm.clear(); } // piece ids change with the rails

  /** length of a plan's remaining moves, in px */
  private planLen(plan: Move[]): number { let d = 0; for (const m of plan) if (!isRev(m)) d += this.net.pieces[m.piece]!.len; return d; }

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
    const own = (p: number) => { const h = this.holder.get(p); if (h !== undefined && h !== t.id) return false; const k = this.keep.get(p); return !k || k.id === t.id || k.until < this.clock || this.backing.get(t.id) === t.plan; };
    return !this.blocked.has(piece) && !this.crew.has(piece) && own(piece) && this.net.conflicts[piece]!.every(own);
  }

  /** the next block of t's plan: every piece up to a passing place long enough to hold the whole train */
  private blockOf(t: Train): Step[] {
    const steps: Step[] = []; let k = 0, c = 0;
    for (; k < t.plan.length; k++) { const m = t.plan[k]!; if (isRev(m)) continue; if (c++ >= t.held) break; }
    const need = trainLength(t) + SIGNAL_GAP;
    let room = 0;
    for (let j = k; j < t.plan.length; j++) {
      const m = t.plan[j]!; if (isRev(m)) break;
      steps.push(m);
      // on the wrong lane (after turning back) the train can't wait where oncoming trains run: it clears the whole way back to its own lane
      const own = this.anyLane.has(m.piece) || this.net.side[m.piece]! * m.dir >= 0;
      // nobody waits in a station's or yard's throat: trains coming out need it to reach their own lane
      room = this.net.passing[m.piece] && own && !this.throat.has(m.piece) ? room + this.net.pieces[m.piece]!.len : 0;
      // never wait on a platform or loading track behind another train: it may turn back into this one
      if (room >= need && this.anyLane.has(m.piece) && this.trackAheadTaken(t, j)) room = 0;
      if (room >= need) break;
    }
    return steps;
  }

  /**
   * Try to clear the next block of the plan for t: every piece up to a passing place long enough to hold the whole
   * train (double track or a junction), so two trains never meet head-on on a single line.
   */
  private tryHold(t: Train): boolean {
    const steps = this.blockOf(t);
    if (!steps.length) return false;
    if (!steps.every(s => this.free(t, s.piece))) {
      // about to run into a station or yard whose track it planned is taken: take a free platform or loading track instead
      if (t.area && t.dest !== undefined && t.platTry !== t.dest && steps.some(s => this.anyLane.has(s.piece) && !this.free(t, s.piece))) {
        t.platTry = t.dest;
        const taken = (p: number) => !this.free(t, p);
        const way = this.route({ head: t.trail.at(-1)!, tail: t.trail[0]!, trail: t.trail, trainLen: trainLength(t), canReverseNow: false, goal: this.goalFor(t.dest, t.area, trainLength(t)),
          extra: s => this.anyLane.has(s.piece) && taken(s.piece) ? Infinity : this.laneCost(s) });
        if (way && way.length && !way.some(isRev)) { t.plan = way; t.held = 0; this.rebuildHolds(); }
      }
      return false;
    }
    for (const s of steps) this.holder.set(s.piece, t.id);
    t.held += steps.length;
    return true;
  }

  /** another train stands on (or holds) the rest of this platform or loading track, past plan step j */
  private trackAheadTaken(t: Train, j: number): boolean {
    for (let k = j + 1; k < t.plan.length; k++) {
      const m = t.plan[k]!; if (isRev(m) || !this.anyLane.has(m.piece)) return false;
      const h = this.holder.get(m.piece); if (h !== undefined && h !== t.id) return true;
    }
    return false;
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

  /** Trains keep to the right on double track, like cars on a road: heading right (east) they run on the bottom lane, heading left on the top one. The other lane only when there is no other way at all. */
  private laneCost(s: Step): number {
    return !this.anyLane.has(s.piece) && !this.throat.has(s.piece) && this.net.side[s.piece]! * s.dir < 0 ? WRONG_LANE : 0;
  }

  /** is this step a place where t's trip ends? */
  private goalFor(dest: number, area?: number[], len = 0): (s: Step) => boolean {
    if (!area) return s => this.net.pieces[s.piece]!.squares.includes(dest);
    const set = new Set(area), inside = (s: Step) => this.net.pieces[s.piece]!.squares.every(q => set.has(q));
    // where the line beyond turns a corner, the switch (the lanes' fan) sits on the area's own end square: stop short
    // of it, on the plain loading or platform track, so the switch stays clear (when the train fits there)
    const fan = (s: Step) => this.net.pieces[s.piece]!.kind === 'fan';
    // plain track length along the area, as built (a dead end's buffer stub may be shorter than a square)
    const plain = area.reduce((a, q) => { const ps = (this.net.bySquare.get(q) ?? []).map(id => this.net.pieces[id]!); return ps.every(p => p.kind !== 'fan') ? a + Math.max(0, ...ps.filter(p => p.squares.length === 1).map(p => p.len)) : a; }, 0);
    const ok = plain >= len && area.some(q => (this.net.bySquare.get(q) ?? []).some(id => this.net.pieces[id]!.kind === 'fan'))
      ? (s: Step) => inside(s) && !fan(s) : inside;
    // inside the area, at its far end: going on would leave it
    return s => ok(s) && !nextStepsOf(this.net, s).some(ok);
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
    const goal = this.goalFor(dest, area, trainLength(t));
    const req: RouteRequest = {
      head: t.trail.at(-1)!, tail: t.trail[0]!, trail: t.trail, trainLen: trainLength(t), canReverseNow: true,
      // setting off from a stop (standing, no trip yet): changing ends there is only a short pause, so a train backs
      // out the short way rather than run round a long loop to face the other way (his bug report 11)
      startRevCost: t.v < 0.5 && t.dest === undefined ? STAND_REVERSE_COST : REVERSE_COST,
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
    this.clock += dt;
    for (const t of this.trains) {
      if (t.v < 0.01 && t.pause <= 0 && !t.rr && t.dest !== undefined) this.still.set(t.id, (this.still.get(t.id) ?? 0) + dt);
      else this.still.delete(t.id);
      if (t.dest === undefined || !this.arrived.has(t.id)) this.arrived.set(t.id, this.clock);
    }
    this.tangleT += dt;
    if (this.tangleT >= TANGLE_EVERY) { this.tangleT = 0; this.untangle(); }
  }

  /** pieces under a train and those that cross them */
  private bodyOf(t: Train): Set<number> {
    const out = new Set<number>();
    for (const s of t.trail) { out.add(s.piece); for (const c of this.net.conflicts[s.piece]!) out.add(c); }
    return out;
  }

  /** the way train o needs clear to get past the body `body`: its plan up to a passing place beyond it */
  private wayPast(o: Train, body: Set<number>): Set<number> {
    const out = new Set<number>(), need = trainLength(o) + SIGNAL_GAP;
    let past = false, room = 0, n = 0;
    for (const m of o.plan) {
      if (isRev(m) || ++n > 120) break;
      out.add(m.piece); for (const c of this.net.conflicts[m.piece]!) out.add(c);
      const on = body.has(m.piece);
      if (on) { past = true; room = 0; continue; }
      if (!past) continue;
      // a passing place on its own lane of the open line (a platform or loading track may be wanted by others)
      const own = !this.anyLane.has(m.piece) && this.net.side[m.piece]! * m.dir >= 0;
      room = this.net.passing[m.piece] && own ? room + this.net.pieces[m.piece]!.len : 0;
      if (room >= need) break;
    }
    return out;
  }

  /**
   * Gridlock: trains that have stood a long while, each waiting on another that stands too (e.g. trains heading into
   * a full dead-end station fill both tracks of its approach, so the trains inside can't come out). Find one train
   * in the way that can back off to a place clear of the waiting train's way (asking trains behind it to back off
   * first if needed), and keep that way for the waiting train so it goes first. Real rails: trains only drive.
   */
  private untangle() {
    // a train given the way that still can't go (the trains that backed off didn't clear it): give the way back
    for (const [id, u] of this.prio) {
      if (u - TANGLE_KEEP + TANGLE_GIVE_BACK < this.clock && (this.still.get(id) ?? 0) >= TANGLE_GIVE_BACK) {
        this.prio.delete(id); for (const [p, k] of this.keep) if (k.id === id) this.keep.delete(p);
      }
    }
    for (const [id, u] of this.calm) if (u < this.clock) this.calm.delete(id);
    for (const [id, u] of this.prio) if (u < this.clock || !this.trains.some(t => t.id === id && t.dest !== undefined)) this.prio.delete(id);
    // the way is kept only while its train still has the way (it may have arrived, or given it back)
    for (const [p, k] of this.keep) if (k.until < this.clock || !this.prio.has(k.id)) this.keep.delete(p);
    for (const [id, plan] of this.backing) { const t = this.trains.find(x => x.id === id); if (!t || t.plan !== plan || !plan.length) this.backing.delete(id); }
    // a train given the way goes on being helped sooner; trains backing off are left to it
    const long = (t: Train) => (this.still.get(t.id) ?? 0) >= (this.prio.has(t.id) ? TANGLE_EVERY * 2 : TANGLE_AFTER);
    const stuck = this.trains.filter(t => long(t) && t.plan.length && !this.backing.has(t.id) && !(this.speedOf && this.speedOf(t) <= 0));
    // who waits on whom: the trains holding (or keeping for themselves) the pieces of each one's next block
    const waits = new Map<number, Train[]>();
    for (const o of stuck) {
      const block = this.blockOf(o).map(m => m.piece); if (!block.length || block.some(p => this.blocked.has(p) || this.crew.has(p))) continue;
      const ids = new Set<number>();
      for (const p of block) for (const q of [p, ...this.net.conflicts[p]!]) {
        const h = this.holder.get(q); if (h !== undefined && h !== o.id) ids.add(h);
        const k = this.keep.get(q); if (k && k.id !== o.id && k.until >= this.clock) ids.add(k.id);
      }
      const blockers = this.trains.filter(b => ids.has(b.id));
      // only when everything in the way stands too (a moving train will clear by itself); a train going to and fro
      // between a refuge and the same jam, or that has not finished a trip for minutes, counts as standing
      const going = (b: Train) => this.clock - (this.arrived.get(b.id) ?? this.clock) < TANGLE_AFTER * 2;
      if (!blockers.length || blockers.some(b => going(b) && (b.v >= 0.01 || ((this.still.get(b.id) ?? 0) < TANGLE_EVERY && b.refuge === undefined && b.plan.length > 0)))) continue;
      waits.set(o.id, blockers);
    }
    // start where trains wait on each other in a ring (the shortest ring first): a train only queued behind another
    // is no gridlock, it goes once the one ahead does
    const ring = (o: Train) => { // steps until the waiting leads back to o (Infinity: never)
      let front = [o.id]; const seen = new Set<number>();
      for (let d = 1; d <= 8 && front.length; d++) {
        const next: number[] = [];
        for (const id of front) for (const b of waits.get(id) ?? []) { if (b.id === o.id) return d; if (!seen.has(b.id)) { seen.add(b.id); next.push(b.id); } }
        front = next;
      }
      return Infinity;
    };
    // or a train stands aside (in a refuge, or parked) in the way and keeps coming back to the same place
    const dormant = (b: Train) => (!b.plan.length || b.refuge !== undefined) && this.clock - (this.arrived.get(b.id) ?? this.clock) >= TANGLE_AFTER * 2;
    const order = stuck.filter(o => waits.has(o.id)).map(o => ({ o, d: waits.get(o.id)!.some(dormant) ? 9 : ring(o), p: this.prio.has(o.id) ? 0 : 1 }))
      .filter(x => x.d < Infinity).sort((a, b) => a.p - b.p || a.d - b.d || (this.still.get(b.o.id) ?? 0) - (this.still.get(a.o.id) ?? 0));
    for (const { o } of order) {
      const blockers = waits.get(o.id)!;
      // a train already given the way is in the way here: let it go first
      if (blockers.some(b => this.prio.has(b.id))) continue;
      const way = new Set<number>();
      for (const b of blockers) for (const p of this.wayPast(o, this.bodyOf(b))) way.add(p);
      const moves: [Train, Move[]][] = [];
      let ok = true;
      for (const b of blockers) {
        const r = this.backOff(b, way, TANGLE_DEPTH, new Set([o.id, ...this.prio.keys()]));
        if (!r) { ok = false; break; }
        moves.push(...r);
      }
      if (!ok || !moves.length) continue;
      const until = this.clock + TANGLE_KEEP;
      for (const [t, plan] of moves) {
        t.plan = plan; t.held = 0; t.wait = 0; this.heldUp.delete(t.id);
        t.refuge = t.dest !== undefined ? REFUGE_WAIT * 3 : 0;
        this.calm.set(t.id, until); this.backing.set(t.id, plan); this.prio.delete(t.id);
      }
      for (const p of way) this.keep.set(p, { id: o.id, until });
      this.prio.set(o.id, until); o.wait = 0;
      this.still.delete(o.id);
      this.rebuildHolds();
      this.untangled++; return; // one at a time
    }
  }

  /**
   * Plans that take train t (and, if `depth` allows, trains standing behind it) to places clear of `avoid`.
   * Trains that are moving, and those in `frozen`, can't be asked to move.
   */
  private backOff(t: Train, avoid: Set<number>, depth: number, frozen: Set<number>): [Train, Move[]][] | null {
    const others = this.trains.filter(o => o !== t);
    const hard = new Set<number>();
    for (const o of others) for (const p of this.bodyOf(o)) hard.add(p);
    for (const anywhere of [false, true]) {
      const r = this.refugeRoute(t, avoid, anywhere, p => hard.has(p) ? Infinity : 0, true);
      if (r) return [[t, r]];
    }
    if (depth <= 0) return null;
    const movable = (o: Train) => !frozen.has(o.id) && (this.still.has(o.id) || (o.dest === undefined && o.v < 0.01 && !o.rr)) && !(this.speedOf && this.speedOf(o) <= 0);
    const fixed = new Set<number>(), soft = new Set<number>();
    for (const o of others) for (const p of this.bodyOf(o)) (movable(o) ? soft : fixed).add(p);
    for (const anywhere of [false, true]) {
      const r = this.refugeRoute(t, avoid, anywhere, p => fixed.has(p) ? Infinity : soft.has(p) ? 3000 : 0, true);
      if (!r) continue;
      const path = new Set<number>();
      for (const m of r) if (!isRev(m)) { path.add(m.piece); for (const c of this.net.conflicts[m.piece]!) path.add(c); }
      const avoid2 = new Set([...avoid, ...path]), frozen2 = new Set([...frozen, t.id]);
      const out: [Train, Move[]][] = [];
      let ok = true;
      for (const o of others) {
        if (!movable(o) || !o.trail.some(s => path.has(s.piece))) continue;
        const sub = this.backOff(o, avoid2, depth - 1, frozen2);
        if (!sub) { ok = false; break; }
        out.push(...sub);
      }
      if (ok) return [...out, [t, r]];
    }
    return null;
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
    t.wait = 0; this.heldUp.delete(t.id);
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
    if (this.calm.has(t.id) || this.prio.has(t.id)) return; // untangling a gridlock: keep to the plan given
    const waited = (this.heldUp.get(t.id) ?? 0) + t.wait; this.heldUp.set(t.id, waited);
    // moving aside with no trip of its own, and that way is blocked too: give it up and stand, so a waiting train can
    // ask it to move somewhere else (otherwise both wait for each other for ever)
    if (t.dest === undefined) { if (t.plan.length) { t.plan = []; t.held = 0; t.wait = 0; this.rebuildHolds(); } return; }
    t.wait = 0;
    // waiting for a broken rail to be fixed: nothing else to do
    const nextFree = t.plan.filter(m => !isRev(m))[t.held] as Step | undefined;
    if (nextFree && this.blocked.has(nextFree.piece)) return;
    // queued behind trains going the same way (or loading on the way): wait in line, like real trains, rather than
    // turn back; if the queue never moves, the gridlock check sorts it out
    if (this.queued(t)) return;
    const dest = t.dest, L = trainLength(t), goal = this.goalFor(dest, t.area, L);
    // pieces under other trains can't be passed; pieces they have only signalled ahead are just costly
    const bodies = new Set<number>();
    for (const o of this.trains) if (o !== t) for (const s of o.trail) { bodies.add(s.piece); for (const c of this.net.conflicts[s.piece]!) bodies.add(c); }
    const base = { head: t.trail.at(-1)!, tail: t.trail[0]!, trail: t.trail, trainLen: L, canReverseNow: true };
    const cost = (s: Step) => bodies.has(s.piece) ? Infinity : this.laneCost(s) + (this.crew.has(s.piece) ? 4000 : 0) + (() => { const h = this.holder.get(s.piece); return h !== undefined && h !== t.id ? 4000 : 0; })();
    const route = this.route({ ...base, goal, extra: cost, push: this.pushOf(t), ...(t.area ? { revParity: this.backIn(t) } : {}) }) ?? this.route({ ...base, goal, extra: cost });
    // a long way round to dodge a train that will move on in a moment costs more than waiting for it: wait a while first
    // turning back costs the time to stop and change ends: only after a fair wait, and only when worth it
    const revs = route ? route.filter(isRev).length - t.plan.filter(isRev).length : 0;
    const own = this.planLen(t.plan), extra = route ? this.planLen(route) - own + Math.max(0, revs) * REVERSE_COST : 0;
    if (route && revs > 0 && waited < TURN_BACK_AFTER) return;
    if (route && own > 0 && own + extra > own * DETOUR_SHARE + DETOUR_SQUARES * 32 && waited < extra / this.vmax) return;
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
    if (waited < STEP_ASIDE_AFTER) return;
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

  /**
   * Is t only queued: every train holding its next block is ahead of it along its way, heading the same way, or
   * standing at a stop of its own (loading or unloading) there? Then the way clears by itself.
   */
  private queued(t: Train): boolean {
    const block = this.blockOf(t).map(m => m.piece); if (!block.length) return false;
    const ids = new Set<number>();
    for (const p of block) for (const q of [p, ...this.net.conflicts[p]!]) { const h = this.holder.get(q); if (h !== undefined && h !== t.id) ids.add(h); }
    if (!ids.size) return false;
    const ahead = new Set<number>(); // piece*2+dir of each step of its way
    for (const m of t.plan) if (!isRev(m)) ahead.add(m.piece * 2 + (m.dir === 1 ? 0 : 1));
    for (const id of ids) {
      const b = this.trains.find(o => o.id === id); if (!b) return false;
      const same = b.trail.some(s => ahead.has(s.piece * 2 + (s.dir === 1 ? 0 : 1)));
      if (!same) return false;
      // stopped for good on our way (parked with no work, or broken down): not a queue
      if (b.dest === undefined && !b.plan.length && b.v < 0.01 && !b.job) return false;
      if (this.speedOf && this.speedOf(b) <= 0) return false;
    }
    return true;
  }

  /** Drive a train to a siding or passing track clear of the given pieces (and of other trains). */
  private stepAside(t: Train, inWay: Set<number>): boolean {
    return this.aside(t, inWay, false) || this.aside(t, inWay, true);
  }

  /** `anywhere`: no siding or passing track is free, so any stretch of line clear of the others' way will do. */
  private aside(t: Train, inWay: Set<number>, anywhere: boolean): boolean {
    const bodies = new Set<number>();
    for (const o of this.trains) if (o !== t) for (const s of o.trail) { bodies.add(s.piece); for (const c of this.net.conflicts[s.piece]!) bodies.add(c); }
    const refuge = this.refugeRoute(t, inWay, anywhere, p => bodies.has(p) ? Infinity : 0);
    if (!refuge) return false;
    t.plan = refuge; t.held = 0; t.wait = 0; this.rebuildHolds();
    return true;
  }

  /** a way for t to a siding or passing track (or, `anywhere`, any track) where its whole body stands clear of inWay */
  private refugeRoute(t: Train, inWay: Set<number>, anywhere: boolean, body: (piece: number) => number, strict = false): Move[] | null {
    const L = trainLength(t);
    const refuge = this.route({
      head: t.trail.at(-1)!, tail: t.trail[0]!, trail: t.trail, trainLen: L, canReverseNow: true,
      extra: s => { const b = body(s.piece); return b === Infinity ? b : b + this.laneCost(s) + (() => { const h = this.holder.get(s.piece); return h !== undefined && h !== t.id ? 4000 : 0; })(); },
      goal: s => !inWay.has(s.piece) && (anywhere || this.net.passing[s.piece]! || (s.dir === 1 && !!this.net.pieces[s.piece]!.endB)),
      accept: moves => { // the whole train must stand clear of the others' way, its tail included
        // untangling: staying put (maybe turned round) leaves the body where it stands now, partly on its pieces
        if (strict && !moves.some(m => !isRev(m))) return !t.trail.some(st => inWay.has(st.piece));
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
    return refuge && (strict ? refuge.some(m => !isRev(m)) : refuge.length) ? refuge : null;
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
