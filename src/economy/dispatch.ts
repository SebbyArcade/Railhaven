import type { Game, Site } from '../state.ts';
import type { Train } from '../trains/train.ts';
import { placeTrain } from '../trains/train.ts';
import { type Building, GOODS, type Good, INDUSTRIES, isLinked, yardSquares } from '../buildings/industries.ts';
import { hallOf } from '../buildings/stations.ts';
import { shedSiding } from '../buildings/shed.ts';
import { bldDist, bldOf, destName, destSquares, factoryRoom, MIN_LOAD, payFor, railDist, type Ship, shipPlan, siteOf, TRAIN_CAP } from './shipping.ts';
import { deliverToTown, orderDone, reward, sizeName, stepOf } from './towns.ts';

export const LOAD_TIME = 4;
/** upkeep per second while a train moves (parked trains cost nothing), +3% per train beyond six */
export const UPKEEP = 0.6;
export const fleetMul = (n: number) => 1 + 0.03 * Math.max(0, n - 6);
/** orders filled for each Railway level */
export const RLV = [0, 2, 6, 12, 20, 30, 42, 56, 72, 90];
export const railLevel = (orders: number) => { let L = 0; while (L + 1 < RLV.length && orders >= RLV[L + 1]!) L++; return L; };

/** Price of the next train: $1,000 for the first six, then $250 more each (at most $2,500 before Railway level 3). */
export function trainPrice(g: Game): number {
  const k = g.s.trains.length, p = 1000 + 250 * Math.max(0, k - 5);
  return (g.s.rlv ?? 0) < 3 ? Math.min(2500, p) : p;
}

const news = (g: Game, s: string) => (g.news ??= []).push(s);
const endJob = (t: Train) => { t.job = undefined; };

/** Buy a train: it rolls out of the engine shed onto the line. Returns the train or why not. */
export function buyTrain(g: Game): Train | string {
  const price = trainPrice(g);
  if (!g.s.shed) return 'Lay a straight bit of line near Ashford first: the engine shed goes beside it';
  if (price > g.s.money) return `Need $${(price - g.s.money).toLocaleString('en-US')} more for a train`;
  // the new train stands on the siding, engine toward the line, its last wagon inside the shed
  const sd = shedSiding(g)!;
  for (const id of g.net.bySquare.get(sd.mid) ?? []) for (const dir of [1, -1] as const) {
    const t = placeTrain(g.net, g.s.nextId, { piece: id, dir }, 3);
    const sq = t.trail.flatMap(s => g.net.pieces[s.piece]!.squares);
    if (!sq.includes(sd.shed) || sq.includes(sd.line)) continue; // facing the wrong way
    if (t.trail.some(s => g.sys.holder.has(s.piece) || g.sys.blocked.has(s.piece))) return 'A train is still on the shed siding: try again in a moment';
    g.s.nextId++; g.s.money -= price; g.s.trains.push(t); g.sys.rebuildHolds();
    return t;
  }
  return 'The shed siding is busy: try again in a moment';
}

/** Units of stock already promised to trains on their way to collect. */
const claimed = (g: Game, b: Building) => g.s.trains.reduce((a, t) => a + (t.job?.src === b.id && t.job.phase === 'toLoad' ? TRAIN_CAP : 0), 0);

/** Where the head of the train is (a track square). */
export const headSquare = (g: Game, t: Train) => g.net.pieces[t.trail.at(-1)!.piece]!.squares.at(-1)!;

const parked = (t: Train) => t.dest === undefined && t.plan.length === 0 && t.refuge === undefined && t.pause <= 0 && t.v === 0;

/** Pick the best waiting load for an idle train: needed goods first, then by pay per square of travel. */
function bestJob(g: Game, t: Train, plan: Map<number, Ship>): { b: Building; ship: Ship } | null {
  const at = headSquare(g, t);
  let best: { b: Building; ship: Ship } | null = null, bs = -Infinity;
  for (const b of g.s.buildings ?? []) {
    const ship = plan.get(b.id); if (!ship || !isLinked(g, b)) continue;
    const avail = b.stock - claimed(g, b); if (avail < MIN_LOAD) continue;
    const reach = bldDist(g, b)[at]!; if (reach < 0) continue;
    const s = payFor(INDUSTRIES[b.kind].makes, Math.min(TRAIN_CAP, avail), ship.d, ship.why) / (reach + ship.d + 8) + (ship.why === 'order' ? 1e3 : 0);
    if (s > bs) { bs = s; best = { b, ship }; }
  }
  return best;
}

/** Send a loaded train to where it unloads; if that place fell off the railway, to the nearest town that is still on it. */
function sendLoaded(g: Game, t: Train) {
  const j = t.job!, sq = destSquares(g, j.to);
  if (sq.length && g.sys.sendToArea(t, sq)) return;
  const to = nearestTown(g, t);
  if (to && g.sys.sendToArea(t, destSquares(g, to))) j.to = to;
  else j.timer = 5; // no way anywhere yet: wait and try again
}

/** Railway level unlocks, in plain words (index = level). */
export const UNLOCKS = ['', '🏭 Sawmill, Brickworks and Flour Mill', '🏭 Steel Mill and Refinery', '🏭 Textile Mill', '', '', '', '', '', ''];

const pay = (g: Game, v: number) => { g.s.money += v; g.s.earned = (g.s.earned ?? 0) + v; };

/**
 * Unload: at a factory, as many as it has room for (paid half); at a town, fill the order first, then steady
 * demand, then extra. Anything a factory has no room for stays on the train and goes on to the nearest town.
 */
function unload(g: Game, t: Train) {
  const j = t.job!, c = t.cargo!, k = c.good as Good;
  if (j.to.kind === 'bld') {
    const f = bldOf(g, j.to.id)!, n = Math.min(c.n, Math.floor(factoryRoom(f, k)));
    (f.inbuf ??= {})[k] = (f.inbuf[k] ?? 0) + n;
    const v = payFor(k, n, c.d, 'factory'); pay(g, v);
    t.lastPay = { pay: Math.round(v), at: g.s.t, n, good: k, to: j.to };
    c.n -= n;
    if (c.n > 0) { j.to = nearestTown(g, t) ?? j.to; j.phase = 'toDrop'; sendLoaded(g, t); return; }
    t.cargo = undefined; endJob(t); return;
  }
  const town = siteOf(g, j.to.id)!;
  const p = deliverToTown(g, town, k, c.n);
  const v = payFor(k, p.order, c.d, 'order') + payFor(k, p.steady, c.d, 'steady') + payFor(k, p.surplus, c.d, 'extra');
  pay(g, v);
  t.lastPay = { pay: Math.round(v), at: g.s.t, n: c.n, good: k, to: j.to };
  if (!town.filled && orderDone(g, town)) {
    town.filled = true;
    const r = reward(stepOf(town)); pay(g, r);
    g.s.orders = (g.s.orders ?? 0) + 1;
    news(g, `✅ ${town.name}'s order is filled! +$${r.toLocaleString('en-US')} · tap ⬆ to grow it into a ${sizeName(stepOf(town) + 1)}`);
    const L = railLevel(g.s.orders);
    if (L > (g.s.rlv ?? 0)) {
      for (let l = (g.s.rlv ?? 0) + 1; l <= L; l++) { const b = 500 * l; pay(g, b); news(g, `⭐ Railway level ${l}! +$${b.toLocaleString('en-US')}${UNLOCKS[l] ? ' · new: ' + UNLOCKS[l] : ''}`); }
      g.s.rlv = L;
    }
  }
  t.cargo = undefined; endJob(t);
}

/** The nearest town on the railway from where the train stands. */
function nearestTown(g: Game, t: Train): { kind: 'town'; id: number } | null {
  const at = headSquare(g, t);
  let to: Site | undefined, bd = Infinity;
  for (const s of g.s.sites) {
    if (s.kind !== 'town') continue; const h = hallOf(g.track, g.world.n, s); if (!h) continue;
    const d = railDist(g, 't' + s.id, h.squares)[at]!; if (d >= 0 && d < bd) { bd = d; to = s; }
  }
  return to ? { kind: 'town', id: to.id } : null;
}

/** Goods trains run themselves: each idle train collects the best waiting load and takes it where the plan says. */
export function tickTrains(g: Game, dt: number) {
  let plan: Map<number, Ship> | null = null;
  const P = () => (plan ??= shipPlan(g));
  const fm = fleetMul(g.s.trains.length);
  for (const t of g.s.trains) {
    if (t.v > 0) { const c = UPKEEP * fm * dt; g.s.money -= c; g.s.upkeep = (g.s.upkeep ?? 0) + c; }
    const j = t.job;
    if (!j) {
      if (!parked(t)) continue;
      if ((t.idle = (t.idle ?? 0) - dt) > 0) continue;
      t.idle = 2; // look again every 2 s
      const best = bestJob(g, t, P()); if (!best) continue;
      t.job = { src: best.b.id, to: best.ship.to, good: INDUSTRIES[best.b.kind].makes, phase: 'toLoad', timer: 0 };
      if (!g.sys.sendToArea(t, yardSquares(g.world.n, best.b))) endJob(t);
      continue;
    }
    if (j.timer > 0) { j.timer -= dt; if (j.timer > 0) continue; }
    const src = (g.s.buildings ?? []).find(b => b.id === j.src);
    if (j.phase === 'toLoad') {
      if (!src) { endJob(t); continue; }
      if (!parked(t)) continue;
      if (!yardSquares(g.world.n, src).includes(headSquare(g, t))) { if (!g.sys.sendToArea(t, yardSquares(g.world.n, src))) endJob(t); continue; }
      j.phase = 'loading'; j.timer = LOAD_TIME;
    } else if (j.phase === 'loading') {
      if (!src) { endJob(t); continue; }
      const n = Math.min(TRAIN_CAP, Math.floor(src.stock));
      if (n <= 0) { endJob(t); continue; }
      src.stock -= n;
      const ship = P().get(src.id); if (ship) j.to = ship.to;
      t.cargo = { good: j.good, n, d: ship?.d ?? 8 };
      j.phase = 'toDrop'; sendLoaded(g, t);
    } else if (j.phase === 'toDrop') {
      if (!parked(t)) continue;
      if (destSquares(g, j.to).includes(headSquare(g, t))) { j.phase = 'unloading'; j.timer = LOAD_TIME; }
      else sendLoaded(g, t);
    } else if (j.phase === 'unloading') {
      if (j.to.kind === 'bld' ? bldOf(g, j.to.id) : siteOf(g, j.to.id)) unload(g, t); else { j.phase = 'toDrop'; sendLoaded(g, t); }
    }
  }
}

/** What a train is doing, in plain words. */
export function trainStatus(g: Game, t: Train): string {
  const j = t.job;
  if (!j) return t.v > 0 ? '🚂 On its way' : `💤 Waiting for a load (a building needs ${MIN_LOAD} ready)`;
  const src = (g.s.buildings ?? []).find(b => b.id === j.src), where = destName(g, j.to), icon = GOODS[j.good as Good]?.icon ?? '';
  const name = src ? INDUSTRIES[src.kind].name : 'the yard';
  if (j.phase === 'toLoad') return `🚂 Going to the ${name} for ${icon}`;
  if (j.phase === 'loading') return `${icon} Loading at the ${name}`;
  if (j.phase === 'toDrop') return `🚂 Taking ${t.cargo?.n ?? ''} ${icon} to ${where}`;
  return `${icon} Unloading at ${where}`;
}
