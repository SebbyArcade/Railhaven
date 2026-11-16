import type { Game } from '../state.ts';
import { inStorm, STORM_SLOW } from '../world/events.ts';
import { type Building, buildingSquares, type Good, yardSquares } from '../buildings/industries.ts';
import { dockRange, isDock, islandOfB, linkedDocks, seaDist } from './docks.ts';
import { lightMul, salvageAt } from '../world/explore.ts';
import { destIsland } from '../economy/upgrades.ts';

/**
 * Cargo ships. Goods for another island go maker → dock (by train) → ship → far dock, where that island's trains
 * pick them up like any other load. Ships are bought at a dock and roam: from the dock they are at, they sail
 * where most goods wait, and an empty ship sails to the dock with the most goods waiting.
 */

export const SHIP_PRICE = 3000;
/** The next ship: $3,000 for the first two, then $500 more for each one you own (like trains). */
export const shipPrice = (g: Game) => SHIP_PRICE + 500 * Math.max(0, (g.s.ships?.length ?? 0) - 1);
/** squares sailed per second, and units one ship carries */
export const SHIP_SPEED = 0.9;
export const SHIP_CAP = 80;

/** 🚢 Ship upgrades for the whole fleet, with the old game's prices: faster ships and bigger holds. */
export type ShipUpKey = 'spd' | 'hold';
export const SHIP_UP: Record<ShipUpKey, { icon: string; name: string; lv: number[]; price: number[]; text: (l: number) => string }> = {
  spd: { icon: '⚡', name: 'Faster ships', lv: [1, 1.35, 1.7, 2.05], price: [6000, 12000, 24000], text: l => `×${[1, 1.35, 1.7, 2.05][l]} speed` },
  hold: { icon: '📦', name: 'Bigger holds', lv: [80, 120, 170, 240], price: [6000, 12000, 24000], text: l => `${[80, 120, 170, 240][l]} per ship` },
};
export const shipUpLvl = (g: Game, k: ShipUpKey) => g.s.shipU?.[k] ?? 0;
/** units one ship carries, and squares it sails per second (before storms and lighthouses) */
export const shipCap = (g: Game) => SHIP_UP.hold.lv[shipUpLvl(g, 'hold')] ?? SHIP_CAP;
export const shipSpeed = (g: Game) => SHIP_SPEED * (SHIP_UP.spd.lv[shipUpLvl(g, 'spd')] ?? 1);
/** Buy the next level of a ship upgrade. Returns why not, or '' when bought. */
export function buyShipUp(g: Game, k: ShipUpKey): string {
  const l = shipUpLvl(g, k), p = SHIP_UP[k].price[l];
  if (p === undefined) return 'Already at the top level';
  if (!g.s.ships?.length) return 'Buy a cargo ship first';
  if (g.s.money < p) return `Need $${(p - Math.floor(g.s.money)).toLocaleString('en-US')} more`;
  g.s.money -= p; (g.s.shipU ??= {})[k] = l + 1;
  return '';
}
/** seconds to load or unload at a dock, and how long an empty ship waits before it looks elsewhere */
export const SHIP_LOAD = 4;
export const SHIP_IDLE = 6;
/** a ship sets off once half its hold is waiting, or after this long with a smaller load */
export const SHIP_HOLD = 20;

/** Goods waiting at a dock for a ship to another dock. */
/** goods for dock `to`; `then`: that dock passes them on to this one by the next ship (two sea routes) */
export interface SeaLoad { good: Good; n: number; to: number; then?: number }

export interface CargoShip {
  id: number;
  /** the dock it is at, or sailed from */
  at: number;
  /** the dock it is sailing to (none while docked) */
  to?: number;
  /** water squares of the crossing, and how far along it is (in squares) */
  path?: number[];
  pos: number;
  hold: SeaLoad[];
  /** seconds left loading or unloading, or waiting before it looks elsewhere */
  wait: number;
  /** seconds it has waited at this dock for a fuller load */
  held?: number;
  /** which berth it lies at while moored, or left from while sailing (so it pulls away from where it lay).
   *  Each ship at a dock keeps its own berth: two lie end to end along the pier, more wait at anchor further out. */
  slot?: number;
  /** the berth it will tie up at, chosen as it comes in to its dock (so two ships never head for the same one) */
  dslot?: number;
  /** which way it lies at its berth (radians), so it doesn't spin round when it ties up */
  face?: number;
}

/** A sea route: two docks on the railway, on different islands, where one reaches the other by sea. */
export interface Lane { a: number; b: number; d: number }

const pierSea = (g: Game, b: Building) => buildingSquares(g.world.n, b).filter(i => !g.world.terr[i]);

/** Squares sailed from dock a to dock b's pier (-1 if no water joins them). */
export function seaBetween(g: Game, a: Building, b: Building): number {
  const d = seaDist(g, a); let best = -1;
  for (const i of pierSea(g, b)) { const v = d[i]!; if (v >= 0 && (best < 0 || v < best)) best = v; }
  return best;
}

/** Every sea route between docks on the railway. */
export function seaLanes(g: Game): Lane[] {
  const docks = linkedDocks(g), out: Lane[] = [];
  for (let i = 0; i < docks.length; i++) for (let j = i + 1; j < docks.length; j++) {
    const a = docks[i]!, b = docks[j]!; if (islandOfB(g, a) === islandOfB(g, b)) continue;
    const d = seaBetween(g, a, b);
    if (d >= 0 && (d <= dockRange(a) || d <= dockRange(b))) out.push({ a: a.id, b: b.id, d });
  }
  return out;
}

/** The docks a dock has a sea route to, with the distance. */
export function lanesFrom(g: Game, id: number, lanes = seaLanes(g)): { id: number; d: number }[] {
  return lanes.filter(l => l.a === id || l.b === id).map(l => ({ id: l.a === id ? l.b : l.a, d: l.d }));
}

/** The water squares a ship sails from dock a to dock b (follows the sea distances down to b's pier). */
export function seaPath(g: Game, a: Building, b: Building): number[] {
  const d = seaDist(g, b), n = g.world.n;
  let cur = -1;
  for (const i of pierSea(g, a)) if (d[i]! >= 0 && (cur < 0 || d[i]! < d[cur]!)) cur = i;
  if (cur < 0) return [];
  const out = [cur];
  while (d[cur]! > 0) {
    let nx = -1;
    for (const j of [cur + 1, cur - 1, cur + n, cur - n]) if (j >= 0 && j < n * n && d[j] === d[cur]! - 1) { nx = j; break; }
    if (nx < 0) break;
    out.push(nx); cur = nx;
  }
  return out;
}

const dockOf = (g: Game, id: number) => g.s.buildings?.find(b => b.id === id && isDock(b));

/** Units of a good on their way by sea to a dock: waiting at docks, aboard ships, and landed there but not yet collected. */
export function seaBound(g: Game, dock: number, k: Good): number {
  let n = 0;
  for (const b of g.s.buildings ?? []) for (const q of b.outq ?? []) if ((q.to === dock || q.then === dock) && q.good === k) n += q.n;
  for (const s of g.s.ships ?? []) for (const q of s.hold) if ((q.to === dock || q.then === dock) && q.good === k) n += q.n;
  return n + (dockOf(g, dock)?.landed?.[k] ?? 0);
}

/** Buy a cargo ship at a dock. */
export function buyShip(g: Game, dock: Building): CargoShip | string {
  if (!linkedDocks(g).includes(dock)) return 'Join this dock to your railway first';
  if (!lanesFrom(g, dock.id).length) return 'No sea route from here yet: build a landing on an island this dock reaches';
  const price = shipPrice(g);
  if (g.s.money < price) return `Need $${(price - Math.floor(g.s.money)).toLocaleString('en-US')} more for a ship`;
  g.s.money -= price;
  const s: CargoShip = { id: g.s.nextId++, at: dock.id, pos: 0, hold: [], wait: 0, slot: freeSlot(g, dock.id) };
  (g.s.ships ??= []).push(s);
  return s;
}

/** Waiting goods at a dock, per destination dock. */
export function waitingAt(b: Building): Map<number, number> {
  const m = new Map<number, number>();
  for (const q of b.outq ?? []) m.set(q.to, (m.get(q.to) ?? 0) + q.n);
  return m;
}

function sail(g: Game, s: CargoShip, from: Building, to: Building) {
  s.slot ??= freeSlot(g, s.at, s); s.face = shipPlace(g, s).a; s.dslot = undefined;
  s.to = to.id; s.path = seaPath(g, from, to); s.pos = 0;
  if (s.path.length < 2) { s.to = undefined; s.path = undefined; s.wait = SHIP_IDLE; }
}

/** Goods a ship unloads at a dock: landed for this island's trains, or queued for the next ship when they go one route further. */
function passOn(at: Building, q: SeaLoad) {
  if (q.then === undefined || q.then === at.id) { (at.landed ??= {})[q.good] = (at.landed[q.good] ?? 0) + q.n; return; }
  const w = (at.outq ??= []).find(x => x.to === q.then && x.good === q.good && x.then === undefined);
  if (w) w.n += q.n; else at.outq.push({ good: q.good, n: q.n, to: q.then });
}

/** Is a load at a dock rushed (⭐ a rush for that good waits on the island it is going to)? */
function rushedFor(g: Game): (q: SeaLoad) => boolean {
  const R = g.s.rush ?? []; if (!R.length) return () => false;
  const isl = R.map(r => ({ k: r.good, i: destIsland(g, r.to) }));
  return q => { const d = dockOf(g, q.then ?? q.to); if (!d) return false; const i = islandOfB(g, d); return isl.some(x => x.k === q.good && x.i === i); };
}

/** Move the ships: unload and load at docks, sail the routes. */
export function tickShips(g: Game, dt: number) {
  const ships = g.s.ships; if (!ships?.length) return;
  let lanes: Lane[] | null = null;
  const L = () => (lanes ??= seaLanes(g));
  tidySlots(g);
  for (const s of ships) {
    if (s.to !== undefined) { // at sea
      const to = dockOf(g, s.to);
      if (!to || !s.path) { s.to = undefined; s.path = undefined; s.dslot = undefined; continue; }
      // coming in: pick a free berth before it starts the curve in to the pier
      if (s.dslot === undefined && s.pos >= s.path.length - 1 - Math.min(BERTH_TURN, (s.path.length - 1) / 2) - 0.5) s.dslot = freeSlot(g, s.to, s);
      { const p = shipPlace(g, s); s.pos += shipSpeed(g) * lightMul(g, p.x, p.y) * (inStorm(g, p.x, p.y) ? STORM_SLOW : 1) * dt; salvageAt(g, Math.round(p.x), Math.round(p.y)); }
      if (s.pos >= s.path.length - 1) { s.pos = s.path.length - 1; s.face = shipPlace(g, s).a; s.slot = s.dslot ?? freeSlot(g, s.to, s); s.dslot = undefined; s.at = s.to; s.to = undefined; s.path = undefined; s.pos = 0; s.wait = SHIP_LOAD; }
      continue;
    }
    const at = dockOf(g, s.at);
    if (!at) { // its dock was removed: go to any dock on the railway
      const d = linkedDocks(g)[0]; if (d) { s.at = d.id; s.slot = freeSlot(g, d.id, s); } continue;
    }
    // unload what is for this dock
    const here = s.hold.filter(q => q.to === at.id);
    if (here.length) { for (const q of here) passOn(at, q); s.hold = s.hold.filter(q => q.to !== at.id); g.s.shipLoads = (g.s.shipLoads ?? 0) + 1; }
    if ((s.wait -= dt) > 0) continue;
    const routes = lanesFrom(g, at.id, L());
    // load for the route with the most goods waiting
    // ⭐ a route carrying rushed goods goes first, and sails at once
    const wait = waitingAt(at), hot = rushedFor(g); let best = -1, bn = 0, hb = false;
    for (const r of routes) {
      const n = wait.get(r.id) ?? 0, h = n > 0 && (at.outq ?? []).some(q => q.to === r.id && hot(q));
      if ((h && !hb) || (h === hb && n > bn)) { bn = n; best = r.id; hb = h; }
    }
    if (best >= 0 && !hb && bn < shipCap(g) / 2 && (s.held = (s.held ?? 0) + dt) < SHIP_HOLD) continue; // wait a little for a fuller load
    if (best >= 0) {
      s.held = 0;
      let room = shipCap(g) - s.hold.reduce((a, q) => a + q.n, 0);
      for (const q of [...(at.outq ?? [])].sort((p, q) => +hot(q) - +hot(p))) {
        if (q.to !== best || room <= 0) continue;
        const n = Math.min(q.n, room); q.n -= n; room -= n;
        const h = s.hold.find(x => x.to === best && x.good === q.good && x.then === q.then); if (h) h.n += n; else s.hold.push({ good: q.good, n, to: best, ...(q.then !== undefined ? { then: q.then } : {}) });
      }
      at.outq = (at.outq ?? []).filter(q => q.n > 0);
      sail(g, s, at, dockOf(g, best)!); s.wait = 0;
      continue;
    }
    if (s.hold.length) { const to = dockOf(g, s.hold[0]!.to); if (to && routes.some(r => r.id === to.id)) { sail(g, s, at, to); continue; } }
    // nothing here: sail empty to the dock on a route from here with the most goods waiting that no other ship is heading to
    let far: Building | null = null, fn = 0;
    for (const r of routes) {
      const d = dockOf(g, r.id)!; if (ships.some(o => o !== s && (o.to === d.id || (o.to === undefined && o.at === d.id)))) continue;
      const n = [...waitingAt(d).values()].reduce((a, b) => a + b, 0) + ((d.outq ?? []).some(hot) ? 1e4 : 0); if (n > fn) { fn = n; far = d; }
    }
    far ??= farther(g, ships, s, at, L()); // none next door: head toward the nearest dock further along the routes with goods waiting
    if (far) sail(g, s, at, far); else s.wait = SHIP_IDLE;
  }
}

/**
 * The first dock on the way to the nearest dock (by sea, over the routes) with goods waiting that no ship is at or
 * heading to: so ships at one end of the sea routes come to collect goods piling up two or more routes away.
 */
function farther(g: Game, ships: CargoShip[], s: CargoShip, at: Building, lanes: Lane[]): Building | null {
  const dist = new Map<number, number>([[at.id, 0]]), first = new Map<number, number>(), done = new Set<number>();
  for (;;) {
    let cur = -1, cd = Infinity;
    for (const [id, d] of dist) if (!done.has(id) && d < cd) { cd = d; cur = id; }
    if (cur < 0) return null;
    done.add(cur);
    if (cur !== at.id) {
      const d = dockOf(g, cur);
      if (d && [...waitingAt(d).values()].some(n => n > 0) && !ships.some(o => o !== s && (o.to === cur || (o.to === undefined && o.at === cur)))) return dockOf(g, first.get(cur)!) ?? null;
    }
    for (const r of lanesFrom(g, cur, lanes)) {
      const nd = cd + r.d; if (nd >= (dist.get(r.id) ?? Infinity)) continue;
      dist.set(r.id, nd); first.set(r.id, cur === at.id ? r.id : first.get(cur)!);
    }
  }
}

/** Where a ship is drawn: square position and heading (radians). */
/** How far out from the middle of the pier deck a moored ship lies, in squares: just past its edge, in the water. */
export const BERTH_OUT = 0.62;

/**
 * Berths at a dock (he asked, 2026-11-16: ships moored at one dock lay on top of each other). Two ships lie end to end
 * along the pier, each in its own berth; any more wait at anchor in rows further out in open water. A ship keeps the
 * berth it tied up at until it sails, so nobody shuffles along when another leaves.
 */
/** Squares between the middles of two ships lying end to end (a ship is about 1.4 squares long). */
export const BERTH_GAP = 1.5;
/** How far out each row of ships at anchor lies beyond the pier berths, in squares. */
export const ANCHOR_OUT = [1, 1.55, 2.1, 2.65];

/** The berths a ship is in or about to be in at a dock (moored there, pulling away from it, or coming in to it). */
function takenSlots(g: Game, dock: number, except?: CargoShip): Set<number> {
  const out = new Set<number>();
  for (const o of g.s.ships ?? []) {
    if (o === except) continue;
    if (o.to === undefined && o.at === dock && o.slot !== undefined) out.add(o.slot);
    else if (o.to !== undefined && o.at === dock && o.slot !== undefined && o.pos < BERTH_TURN + 1) out.add(o.slot); // still pulling away
    if (o.to === dock && o.dslot !== undefined) out.add(o.dslot);
  }
  return out;
}

/** The first free berth at a dock (pier berths first, then anchor spots). */
function freeSlot(g: Game, dock: number, except?: CargoShip): number {
  const t = takenSlots(g, dock, except); let k = 0;
  while (t.has(k)) k++;
  return k;
}

/** Ships from older saves (or two that ended up at the same berth) get a berth of their own. */
function tidySlots(g: Game) {
  const used = new Map<number, Set<number>>();
  for (const s of g.s.ships ?? []) {
    if (s.to !== undefined) continue;
    const u = used.get(s.at) ?? new Set<number>(); used.set(s.at, u);
    if (s.slot === undefined || u.has(s.slot)) { let k = 0; while (u.has(k) || takenSlots(g, s.at, s).has(k)) k++; s.slot = k; }
    u.add(s.slot);
  }
}

/** Which berth a ship lies at (or will) at a dock. */
function berthSlot(g: Game, s: CargoShip, dock: number): number {
  if (s.to === undefined && s.at === dock && s.slot !== undefined) return s.slot;
  if (s.to === dock && s.dslot !== undefined) return s.dslot;
  return freeSlot(g, dock, s);
}

type Berth = { x: number; y: number; a: number; ox: number; oy: number };
const berthCache = new WeakMap<Building, { key: string; spots: Berth[] }>();

/** Every berth at a dock in order: the pier berths (alongside, just past the deck edge away from the loading track),
 *  then the anchor spots further out. Only spots where the whole ship floats on open water. */
function berths(g: Game, d: Building): Berth[] {
  const key = `${d.x},${d.y},${d.horizontal},${d.side},${d.len ?? ''}`, hit = berthCache.get(d);
  if (hit && hit.key === key) return hit.spots;
  const n = g.world.n, t = g.world.terr, sea = pierSea(g, d), ang = d.horizontal ? 0 : Math.PI / 2;
  const ys = yardSquares(n, d), bs = buildingSquares(n, d);
  // out from the pier, away from the yard
  const ox = d.horizontal ? 0 : Math.sign(bs[0]! % n - ys[0]! % n), oy = d.horizontal ? Math.sign(((bs[0]! / n) | 0) - ((ys[0]! / n) | 0)) : 0;
  const ax = d.horizontal ? 1 : 0, ay = d.horizontal ? 0 : 1; // along the pier
  const row = sea.length ? sea : bs, mx = row.reduce((a, i) => a + (i % n), 0) / row.length, my = row.reduce((a, i) => a + ((i / n) | 0), 0) / row.length;
  const wet = (x: number, y: number) => { const X = Math.round(x), Y = Math.round(y); return X >= 0 && Y >= 0 && X < n && Y < n && !t[Y * n + X]; };
  const floats = (x: number, y: number) => wet(x, y) && wet(x + ax * 0.65, y + ay * 0.65) && wet(x - ax * 0.65, y - ay * 0.65);
  const spots: Berth[] = [];
  for (const out of [BERTH_OUT, ...ANCHOR_OUT.map(o => BERTH_OUT + o)]) for (const u of [-BERTH_GAP / 2, BERTH_GAP / 2]) {
    const x = mx + ox * out + ax * u, y = my + oy * out + ay * u;
    if (floats(x, y)) spots.push({ x, y, a: ang, ox, oy });
  }
  if (!spots.length) { // a cramped inlet: the old single berth beside the pier
    const i = sea[Math.min(sea.length - 1, 1)] ?? bs[1]!, k = wet((i % n) + ox, ((i / n) | 0) + oy) ? BERTH_OUT : 0;
    spots.push({ x: (i % n) + ox * k, y: ((i / n) | 0) + oy * k, a: ang, ox, oy });
  }
  berthCache.set(d, { key, spots });
  return spots;
}

/** Where berth number `slot` is at a dock (past the last spot, ships share the outermost one). */
function berthAt(g: Game, d: Building, slot: number): Berth {
  const b = berths(g, d); return b[Math.min(slot, b.length - 1)]!;
}

/** Squares at each end of a crossing where the ship curves between the open-water path and its berth. */
export const BERTH_TURN = 3;

export function shipPlace(g: Game, s: CargoShip): { x: number; y: number; a: number } {
  const n = g.world.n;
  if (s.to !== undefined && s.path && s.path.length > 1) {
    const path = s.path, L = path.length - 1;
    const raw = (pos: number) => {
      pos = Math.max(0, Math.min(L, pos));
      const k = Math.min(L - 1, Math.floor(pos)), f = pos - k, p = path[k]!, q = path[k + 1]!;
      return [(p % n) + ((q % n) - (p % n)) * f, ((p / n) | 0) + (((q / n) | 0) - ((p / n) | 0)) * f] as const;
    };
    // the path is square by square: the ship follows a rounded line through it (an average over one square each way),
    // so it sweeps round corners instead of turning on the spot
    const W = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
    const smooth = (pos: number) => { let x = 0, y = 0; for (const o of W) { const r = raw(pos + o); x += r[0]; y += r[1]; } return [x / W.length, y / W.length] as const; };
    const at = (pos: number) => {
      const [x, y] = smooth(pos), a0 = smooth(pos - 0.3), a1 = smooth(pos + 0.3);
      return { x, y, a: Math.atan2(a1[1] - a0[1], a1[0] - a0[0]) };
    };
    // he asked (2026-11-16): ships glide in and out alongside the pier, not drive into the dock and jump to the berth.
    // Near each end the ship follows a smooth curve between the sea path and the berth, ending parallel to the pier.
    const m = Math.min(BERTH_TURN, L / 2), from = dockOf(g, s.at), to = dockOf(g, s.to);
    type Pt = { x: number; y: number; a: number };
    /** Hermite curve from p (heading pa) to q (heading qa): position and heading at t in 0..1. */
    const herm = (p: Pt, q: Pt, t: number, k = 1): Pt => {
      const c = Math.hypot(q.x - p.x, q.y - p.y) * k, t2 = t * t, t3 = t2 * t;
      const tx0 = Math.cos(p.a) * c, ty0 = Math.sin(p.a) * c, tx1 = Math.cos(q.a) * c, ty1 = Math.sin(q.a) * c;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      const d00 = 6 * t2 - 6 * t, d10 = 3 * t2 - 4 * t + 1, d01 = -6 * t2 + 6 * t, d11 = 3 * t2 - 2 * t;
      return { x: h00 * p.x + h10 * tx0 + h01 * q.x + h11 * tx1, y: h00 * p.y + h10 * ty0 + h01 * q.y + h11 * ty1,
        a: Math.atan2(d00 * p.y + d10 * ty0 + d01 * q.y + d11 * ty1, d00 * p.x + d10 * tx0 + d01 * q.x + d11 * tx1) };
    };
    /** Between the berth and the point `m` squares into the crossing: berth heading along the pier, whichever way faces
     *  onward (pulling away: the way it lay; if that faces away from its way out it swings round through open water). */
    const ease = (berth: ReturnType<typeof berthAt>, mid: Pt, t: number, arriving: boolean): Pt => {
      const vx = arriving ? berth.x - mid.x : mid.x - berth.x, vy = arriving ? berth.y - mid.y : mid.y - berth.y;
      let a = berth.a; if (Math.cos(a) * vx + Math.sin(a) * vy < 0) a += Math.PI;
      if (arriving) return herm(mid, { x: berth.x, y: berth.y, a }, t);
      const face = s.face ?? a, start = { x: berth.x, y: berth.y, a: face };
      if (Math.cos(face) * vx + Math.sin(face) * vy >= 0) return herm(start, mid, t);
      // swing round: out into the water beside the pier first, turned side on, then on to the crossing
      const w = { x: berth.x + berth.ox * 1.1 + Math.cos(face) * 0.6, y: berth.y + berth.oy * 1.1 + Math.sin(face) * 0.6, a: Math.atan2(berth.oy, berth.ox) };
      const l1 = Math.hypot(w.x - start.x, w.y - start.y) * 1.3, l2 = Math.hypot(mid.x - w.x, mid.y - w.y), f = l1 / (l1 + l2);
      return t < f ? herm(start, w, t / f, 1.3) : herm(w, mid, (t - f) / (1 - f));
    };
    if (to && m > 0 && s.pos > L - m) return ease(berthAt(g, to, berthSlot(g, s, to.id)), at(L - m), (s.pos - (L - m)) / m, true);
    if (from && m > 0 && s.pos < m) return ease(berthAt(g, from, s.slot ?? 0), at(m), s.pos / m, false);
    return at(s.pos);
  }
  const d = dockOf(g, s.at); if (!d) return { x: 0, y: 0, a: 0 };
  const b = berthAt(g, d, berthSlot(g, s, s.at));
  return s.face !== undefined && Math.abs(Math.sin(s.face - b.a)) < 0.1 ? { ...b, a: s.face } : b;
}
