import type { Game } from '../state.ts';
import { inStorm, STORM_SLOW } from '../world/events.ts';
import { type Building, buildingSquares, type Good, yardSquares } from '../buildings/industries.ts';
import { dockRange, isDock, islandOfB, linkedDocks, seaDist } from './docks.ts';
import { lightMul, salvageAt } from '../world/explore.ts';

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
  const s: CargoShip = { id: g.s.nextId++, at: dock.id, pos: 0, hold: [], wait: 0 };
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
  s.to = to.id; s.path = seaPath(g, from, to); s.pos = 0;
  if (s.path.length < 2) { s.to = undefined; s.path = undefined; s.wait = SHIP_IDLE; }
}

/** Goods a ship unloads at a dock: landed for this island's trains, or queued for the next ship when they go one route further. */
function passOn(at: Building, q: SeaLoad) {
  if (q.then === undefined || q.then === at.id) { (at.landed ??= {})[q.good] = (at.landed[q.good] ?? 0) + q.n; return; }
  const w = (at.outq ??= []).find(x => x.to === q.then && x.good === q.good && x.then === undefined);
  if (w) w.n += q.n; else at.outq.push({ good: q.good, n: q.n, to: q.then });
}

/** Move the ships: unload and load at docks, sail the routes. */
export function tickShips(g: Game, dt: number) {
  const ships = g.s.ships; if (!ships?.length) return;
  let lanes: Lane[] | null = null;
  const L = () => (lanes ??= seaLanes(g));
  for (const s of ships) {
    if (s.to !== undefined) { // at sea
      const to = dockOf(g, s.to);
      if (!to || !s.path) { s.to = undefined; s.path = undefined; continue; }
      { const p = shipPlace(g, s); s.pos += shipSpeed(g) * lightMul(g, p.x, p.y) * (inStorm(g, p.x, p.y) ? STORM_SLOW : 1) * dt; salvageAt(g, Math.round(p.x), Math.round(p.y)); }
      if (s.pos >= s.path.length - 1) { s.at = s.to; s.to = undefined; s.path = undefined; s.pos = 0; s.wait = SHIP_LOAD; }
      continue;
    }
    const at = dockOf(g, s.at);
    if (!at) { // its dock was removed: go to any dock on the railway
      const d = linkedDocks(g)[0]; if (d) s.at = d.id; continue;
    }
    // unload what is for this dock
    const here = s.hold.filter(q => q.to === at.id);
    if (here.length) { for (const q of here) passOn(at, q); s.hold = s.hold.filter(q => q.to !== at.id); g.s.shipLoads = (g.s.shipLoads ?? 0) + 1; }
    if ((s.wait -= dt) > 0) continue;
    const routes = lanesFrom(g, at.id, L());
    // load for the route with the most goods waiting
    const wait = waitingAt(at); let best = -1, bn = 0;
    for (const r of routes) { const n = wait.get(r.id) ?? 0; if (n > bn) { bn = n; best = r.id; } }
    if (best >= 0 && bn < shipCap(g) / 2 && (s.held = (s.held ?? 0) + dt) < SHIP_HOLD) continue; // wait a little for a fuller load
    if (best >= 0) {
      s.held = 0;
      let room = shipCap(g) - s.hold.reduce((a, q) => a + q.n, 0);
      for (const q of at.outq ?? []) {
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
      const n = [...waitingAt(d).values()].reduce((a, b) => a + b, 0); if (n > fn) { fn = n; far = d; }
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

export function shipPlace(g: Game, s: CargoShip): { x: number; y: number; a: number } {
  const n = g.world.n;
  if (s.to !== undefined && s.path && s.path.length > 1) {
    const k = Math.min(s.path.length - 2, Math.floor(s.pos)), f = s.pos - k, p = s.path[k]!, q = s.path[k + 1]!;
    const x = (p % n) + ((q % n) - (p % n)) * f, y = ((p / n) | 0) + (((q / n) | 0) - ((p / n) | 0)) * f;
    return { x, y, a: Math.atan2(((q / n) | 0) - ((p / n) | 0), (q % n) - (p % n)) };
  }
  const d = dockOf(g, s.at); if (!d) return { x: 0, y: 0, a: 0 };
  const sea = pierSea(g, d), i = sea[Math.min(sea.length - 1, 1 + (g.s.ships!.filter(o => o.to === undefined && o.at === s.at).indexOf(s) % 3))] ?? buildingSquares(n, d)[1]!;
  const ang = d.horizontal ? 0 : Math.PI / 2;
  // alongside the pier, in the water: just past the deck edge on the side away from the loading track
  const ys = yardSquares(n, d), y0 = ys.find(q => q === i - 1 || q === i + 1 || q === i - n || q === i + n);
  const out = y0 !== undefined ? i + (i - y0) : -1, k = out >= 0 && out < n * n && !g.world.terr[out] ? BERTH_OUT : 0;
  const dx = y0 === undefined ? 0 : (i % n) - (y0 % n), dy = y0 === undefined ? 0 : ((i / n) | 0) - ((y0 / n) | 0);
  return { x: (i % n) + dx * k, y: ((i / n) | 0) + dy * k, a: ang };
}
