import type { Game, Site } from '../state.ts';
import { fallsMul } from '../world/explore.ts';
import type { Train } from '../trains/train.ts';
import { placeTrain } from '../trains/train.ts';
import { type Building, GOODS, type Good, INDUSTRIES, isLinked, yardSquares } from '../buildings/industries.ts';
import { hallOf } from '../buildings/stations.ts';
import { shedSiding } from '../buildings/shed.ts';
import { bldDist, bldOf, destName, destSquares, dockKey, factoryRoom, payFor, type Plan, railDist, type Ship, shipPlan, siteOf } from './shipping.ts';
import { isDock, islandName, islandOfB } from '../ships/docks.ts';
import { tickShips } from '../ships/ships.ts';
import { tickScouts } from '../world/explore.ts';
import { reachedIslands, tickMissions } from '../progress/missions.ts';
import { expressMul, fleetMulOf, minLoad, rushDelivered, trainCap } from './upgrades.ts';
import { V_MAX } from '../trains/train.ts';
import { isRev } from '../track/route.ts';
import { GRAND_LOAD, hasGrandStation, payMul, rewardMul } from '../buildings/parks.ts';
import { BRIDGE_UPKEEP, bridgeSquares } from '../track/rules.ts';
import { tickTrade, tradeDelivered, tradeRoom } from './trade.ts';
import { deliverToTown, orderDone, reward, sizeName, stepOf } from './towns.ts';

export const LOAD_TIME = 4;
/** Loading or unloading time for this train: 🚉 the Grand Station makes it 25% shorter on Ashford Isle. */
export function loadTime(g: Game, t: Train): number {
  if (!hasGrandStation(g)) return LOAD_TIME;
  const a = g.s.sites[0]; return a && islandOfTrain(g, t) === g.world.islandOf[a.y * g.world.n + a.x] ? LOAD_TIME * GRAND_LOAD : LOAD_TIME;
}
/** upkeep per second while a train moves (parked trains cost nothing), +3% per train beyond six */
export const UPKEEP = 0.6;
export const fleetMul = (n: number) => 1 + 0.03 * Math.max(0, n - 6);
/** orders filled for each Railway level */
export const RLV = [0, 2, 6, 12, 20, 30, 42, 56, 72, 90];
export const railLevel = (orders: number) => { let L = 0; while (L + 1 < RLV.length && orders >= RLV[L + 1]!) L++; return L; };
/** Railway levels that also need islands reached (Ashford Isle counts as one), as in the old game. */
export const LEVEL_ISLANDS: Record<number, number> = { 5: 2, 7: 3, 9: 4 };
/** The level orders would give, held back at the first level that needs more islands than you have reached. */
export function levelNow(g: Game): { L: number; blocked?: { level: number; need: number; have: number } } {
  const L = railLevel(g.s.orders ?? 0), have = reachedIslands(g).size;
  for (let l = (g.s.rlv ?? 0) + 1; l <= L; l++) { const need = LEVEL_ISLANDS[l] ?? 0; if (need > have) return { L: l - 1, blocked: { level: l, need, have } }; }
  return { L: Math.max(L, g.s.rlv ?? 0) };
}
/** Raise the Railway level when orders (and islands) allow it. It never goes down, so saves already past a level keep it. */
export function checkLevel(g: Game) {
  const { L, blocked } = levelNow(g);
  if (L > (g.s.rlv ?? 0)) {
    for (let l = (g.s.rlv ?? 0) + 1; l <= L; l++) { const b = 500 * l; pay(g, b); news(g, `⭐ Railway level ${l}! +$${b.toLocaleString('en-US')}${UNLOCKS[l] ? ' · new: ' + UNLOCKS[l] : ''}`); }
    g.s.rlv = L;
  }
  if (blocked && g.s.sailNag !== blocked.level) { g.s.sailNag = blocked.level; news(g, `⛵ Time to sail: Railway level ${blocked.level} needs ${blocked.need} islands reached (you have ${blocked.have}). Build a ⚓ Dock and land on another island`); }
}

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

/** What selling a train pays back: half of what the last train bought cost. */
export function trainRefund(g: Game): number {
  const k = Math.max(0, g.s.trains.length - 1), p = 1000 + 250 * Math.max(0, k - 5);
  return Math.round(((g.s.rlv ?? 0) < 3 ? Math.min(2500, p) : p) / 2);
}

/**
 * 💰 Sell a train for half its price. One carrying goods delivers them first (it is marked and sold when empty).
 * Returns why not, 'later' when it will go after its delivery, or '' when sold.
 */
export function sellTrain(g: Game, t: Train): string {
  if (t.broke) return 'It is broken down: sell it once the repair crew has fixed it';
  if (t.cargo || t.job?.phase === 'loading') { t.sellAfter = true; return 'later'; }
  const v = trainRefund(g), k = g.s.trains.indexOf(t); if (k < 0) return 'That train is gone';
  g.s.trains.splice(k, 1); g.s.money += v; g.sys.rebuildHolds();
  return '';
}

/** Shipping a train over to another island costs this much on top of its price. */
export const FERRY_FEE = 500;

/** Set a train down on a landing's yard (the whole train on the yard), or null if the yard is busy. */
function onYard(g: Game, dock: Building, id: number): Train | null {
  const yard = yardSquares(g.world.n, dock);
  for (const sq of yard) for (const pid of g.net.bySquare.get(sq) ?? []) for (const dir of [1, -1] as const) {
    const t = placeTrain(g.net, id, { piece: pid, dir }, 3);
    const all = t.trail.flatMap(s => g.net.pieces[s.piece]!.squares);
    if (!all.every(q => yard.includes(q))) continue;
    if (t.trail.some(s => g.sys.holder.has(s.piece) || g.sys.blocked.has(s.piece))) continue;
    return t;
  }
  return null;
}

/** Buy a train for a landing's island: it comes over by boat and is set down on the landing's yard. */
export function buyTrainAt(g: Game, dock: Building): Train | string {
  const price = trainPrice(g) + FERRY_FEE;
  if (!isLinked(g, dock)) return 'This landing is not reached by your docks yet';
  if (price > g.s.money) return `Need $${(price - g.s.money).toLocaleString('en-US')} more for a train and its crossing`;
  const t = onYard(g, dock, g.s.nextId); if (!t) return "The landing's yard is busy: try again in a moment";
  g.s.nextId++; g.s.money -= price; g.s.trains.push(t); g.sys.rebuildHolds();
  return t;
}

/** The island a train is on. */
export const islandOfTrain = (g: Game, t: Train) => g.world.islandOf[headSquare(g, t)]!;

/**
 * Trains with nothing to do on other islands that have a dock on the railway, the island with the most of them
 * first: they can be shipped over to a landing (trains can't cross the sea by themselves).
 */
export function spareTrains(g: Game, dock: Building): Train[] {
  const here = islandOfB(g, dock), ports = new Set((g.s.buildings ?? []).filter(b => isDock(b) && isLinked(g, b)).map(b => islandOfB(g, b)));
  const idle = g.s.trains.filter(t => !t.job && !t.cargo && !t.broke && parked(t) && islandOfTrain(g, t) !== here && ports.has(islandOfTrain(g, t)));
  const per = new Map<number, number>(); for (const t of idle) per.set(islandOfTrain(g, t), (per.get(islandOfTrain(g, t)) ?? 0) + 1);
  return idle.sort((a, b) => per.get(islandOfTrain(g, b))! - per.get(islandOfTrain(g, a))!);
}

/** Ship a train that has nothing to do on another island over to this landing, for the crossing fee. */
export function shipTrainTo(g: Game, dock: Building): Train | string {
  if (!isLinked(g, dock)) return 'This landing is not reached by your docks yet';
  const from = spareTrains(g, dock)[0]; if (!from) return 'No train is waiting for work on another island with a dock';
  if (FERRY_FEE > g.s.money) return `Need $${(FERRY_FEE - g.s.money).toLocaleString('en-US')} more for the crossing`;
  const t = onYard(g, dock, from.id); if (!t) return "The landing's yard is busy: try again in a moment";
  g.s.trains[g.s.trains.indexOf(from)] = t; g.s.money -= FERRY_FEE; g.sys.rebuildHolds();
  return t;
}

/** Units of stock (of one good, for docks) already promised to trains on their way to collect. */
const claimed = (g: Game, b: Building, k?: string) => g.s.trains.reduce((a, t) => a + (t.job?.src === b.id && t.job.phase === 'toLoad' && (k === undefined || t.job.good === k) ? trainCap(g) : 0), 0);

/** What a building has ready of a good: its stock, or for a dock what ships landed. */
export const readyOf = (b: Building, k: string) => isDock(b) ? b.landed?.[k as Good] ?? 0 : b.stock;

/** Where a building's goods (or a dock's landed good) go in the plan. */
export const planFor = (plan: Plan, b: Building, k: string) => isDock(b) ? plan.docks.get(dockKey(b.id, k)) : plan.get(b.id);

/** Where the head of the train is (a track square). */
export const headSquare = (g: Game, t: Train) => g.net.pieces[t.trail.at(-1)!.piece]!.squares.at(-1)!;

const parked = (t: Train) => t.dest === undefined && t.plan.length === 0 && t.refuge === undefined && t.pause <= 0 && t.v === 0;

/**
 * Running cost of a trip of this many squares (there and on to the drop), counting the slow parts: starting, stopping,
 * turning back and waiting at signals take about three times as long as running flat out.
 */
export const tripCost = (g: Game, squares: number) => UPKEEP * fleetMul(g.s.trains.length) * fleetMulOf(g, 'rep') * (squares * 32 / g.sys.vmax * 3 + 10);

/** Goods nobody is waiting for (past-order buying or surplus) that pay less than the trip costs are not worth fetching. */
export const losesMoney = (g: Game, ship: Ship, pay: number, reach: number) =>
  (ship.why === 'steady' || ship.why === 'extra') && !ship.rush && ship.sea === undefined && pay < tripCost(g, reach + ship.d);

/** Pick the best waiting load for an idle train: needed goods first, then by pay per square of travel. */
function bestJob(g: Game, t: Train, plan: Plan): { b: Building; k: Good; ship: Ship } | null {
  const at = headSquare(g, t);
  let best: { b: Building; k: Good; ship: Ship } | null = null, bs = -Infinity;
  for (const b of g.s.buildings ?? []) {
    if (!isLinked(g, b) || b.closed) continue; // ⛔ closed: no train is sent there
    const reach = bldDist(g, b)[at]!; if (reach < 0) continue;
    const goods = isDock(b) ? Object.keys(b.landed ?? {}) as Good[] : [INDUSTRIES[b.kind].makes];
    for (const k of goods) {
      const ship = planFor(plan, b, k); if (!ship) continue;
      const avail = readyOf(b, k) - claimed(g, b, isDock(b) ? k : undefined); if (avail < minLoad(g)) continue;
      const v = payFor(k, Math.min(trainCap(g), avail), ship.d, ship.why);
      if (losesMoney(g, ship, v, reach)) continue; // a load that pays less than the trip costs: the train waits for better work, for free
      const s = v / (reach + ship.d + 8) + (ship.why === 'order' || ship.rush || ship.sea !== undefined ? 1e3 : 0);
      if (s > bs) { bs = s; best = { b, k, ship }; }
    }
  }
  return best;
}

/**
 * A train on its way to a building that just closed: off to the best other load if there is one, else it stops at
 * the end of the line it has already cleared and waits there for work (never at the barrier).
 */
function divert(g: Game, t: Train, plan: Plan) {
  const best = bestJob(g, t, plan);
  if (best) {
    t.job = { src: best.b.id, to: best.ship.to, good: best.k, phase: 'toLoad', timer: 0, ...(best.ship.sea !== undefined ? { sea: best.ship.sea } : {}), ...(best.ship.then !== undefined ? { then: best.ship.then } : {}) };
    if (g.sys.sendToArea(t, yardSquares(g.world.n, best.b))) return;
    endJob(t);
  }
  let steps = 0, cut = 0;
  for (; cut < t.plan.length; cut++) { if (steps >= t.held) break; if (!isRev(t.plan[cut])) steps++; }
  t.plan = t.plan.slice(0, cut); g.sys.rebuildHolds();
}

/** Send a loaded train to where it unloads; if that place fell off the railway, to the nearest town that is still on it. */
function sendLoaded(g: Game, t: Train) {
  const j = t.job!, sq = destSquares(g, j.to);
  if (!(j.to.kind === 'bld' && bldOf(g, j.to.id)?.closed) && sq.length && g.sys.sendToArea(t, sq)) return; // ⛔ a closed factory: take it to a town instead
  const to = nearestTown(g, t);
  if (to && g.sys.sendToArea(t, destSquares(g, to))) j.to = to;
  else j.timer = 5; // no way anywhere yet: wait and try again
}

/** Railway level unlocks, in plain words (index = level). */
export const UNLOCKS = ['', '🏭 Sawmill, Brickworks and Flour Mill', '🏭 Steel Mill, Refinery and Cannery', '🏭 Textile Mill', '⬆ industries and factories grow to level 4', '🚂 Express engines: every train 15% faster', '⬆ industries and factories grow to level 5', '🚃 Longer trains: 20% more cargo on every train', '🚂 Express engines II: another 15% faster', ''];

const pay = (g: Game, v: number) => { g.s.money += v; g.s.earned = (g.s.earned ?? 0) + v; };

/**
 * Unload: at a factory, as many as it has room for (paid half); at a town, fill the order first, then steady
 * demand, then extra. Anything a factory has no room for stays on the train and goes on to the nearest town.
 */
function unload(g: Game, t: Train) {
  const j = t.job!, c = t.cargo!, k = c.good as Good;
  g.s.loads = (g.s.loads ?? 0) + 1; // train loads delivered (for achievements)
  if (j.to.kind === 'bld' && isDock(bldOf(g, j.to.id)!)) { // a dock: the goods wait for a ship (or stay landed for this island)
    const d = bldOf(g, j.to.id)!;
    if (j.sea !== undefined) { const q = (d.outq ??= []).find(x => x.to === j.sea && x.good === k && x.then === j.then); if (q) q.n += c.n; else d.outq.push({ good: k, n: c.n, to: j.sea, ...(j.then !== undefined ? { then: j.then } : {}) }); }
    else (d.landed ??= {})[k] = (d.landed[k] ?? 0) + c.n;
    const v = payFor(k, c.n, c.d, 'factory'); pay(g, v);
    t.lastPay = { pay: Math.round(v), at: g.s.t, n: c.n, good: k, to: j.to };
    t.cargo = undefined; endJob(t); return;
  }
  if (j.to.kind === 'bld') {
    const f = bldOf(g, j.to.id)!, n = Math.min(c.n, Math.floor(factoryRoom(f, k)));
    (f.inbuf ??= {})[k] = (f.inbuf[k] ?? 0) + n;
    let v = payFor(k, n, c.d, 'factory'); v -= rushDelivered(g, j.to, k, n, v); pay(g, v);
    t.lastPay = { pay: Math.round(v), at: g.s.t, n, good: k, to: j.to };
    c.n -= n;
    if (c.n > 0) { j.to = nearestTown(g, t) ?? j.to; j.phase = 'toDrop'; sendLoaded(g, t); return; }
    t.cargo = undefined; endJob(t); return;
  }
  const town = siteOf(g, j.to.id)!;
  const p = deliverToTown(g, town, k, c.n, tradeRoom(g, town, k));
  let v = (payFor(k, p.order + p.trade, c.d, 'order') + payFor(k, p.steady, c.d, 'steady') + payFor(k, p.surplus, c.d, 'extra')) * payMul(g, town); // 🏛 town projects pay more
  v -= rushDelivered(g, j.to, k, p.order, v); pay(g, v);
  t.lastPay = { pay: Math.round(v), at: g.s.t, n: c.n, good: k, to: j.to };
  if (!town.filled && orderDone(g, town)) {
    town.filled = true;
    const r = Math.round(reward(stepOf(town)) * fallsMul(g, town.x, town.y) * rewardMul(g)); pay(g, r); // ⛪ Cathedral +5%
    g.s.orders = (g.s.orders ?? 0) + 1;
    news(g, `✅ ${town.name}'s order is filled! +$${r.toLocaleString('en-US')} · tap ⬆ to grow it into a ${sizeName(stepOf(town) + 1)}`);
    checkLevel(g);
  }
  const tr = tradeDelivered(g, town, p.trade);
  if (tr) { // 🤝 a trade order filled: it counts as a filled order too
    const o = g.s.trade![g.world.islandOf[town.y * g.world.n + town.x]!]!, r = Math.round(tr * rewardMul(g)); pay(g, r);
    g.s.orders = (g.s.orders ?? 0) + 1; g.s.tradeDone = (g.s.tradeDone ?? 0) + 1;
    news(g, `🤝 ${town.name}'s trade order is filled: ${o.need} ${GOODS[o.good].icon} from ${islandName(g, o.from)}! +$${r.toLocaleString('en-US')}`);
    checkLevel(g);
  }
  t.cargo = undefined; endJob(t);
}

/** The nearest town on the railway from where the train stands. */
function nearestTown(g: Game, t: Train): { kind: 'town'; id: number } | null {
  const at = headSquare(g, t);
  let to: Site | undefined, bd = Infinity;
  for (const s of g.s.sites) {
    if (s.kind !== 'town') continue; const h = hallOf(g.track, g.world.n, s, g.world.terr); if (!h) continue;
    const d = railDist(g, 't' + s.id, h.squares)[at]!; if (d >= 0 && d < bd) { bd = d; to = s; }
  }
  return to ? { kind: 'town', id: to.id } : null;
}

/** Goods trains run themselves: each idle train collects the best waiting load and takes it where the plan says. */
export function tickTrains(g: Game, dt: number) {
  tickShips(g, dt); tickScouts(g, dt);
  if (Math.floor(g.s.t) !== Math.floor(g.s.t - dt)) { tickMissions(g); if (Math.floor(g.s.t) % 5 === 0) { checkLevel(g); tickTrade(g); } } // reaching an island can let a held level through
  let plan: Plan | null = null;
  const P = () => (plan ??= shipPlan(g));
  const fm = fleetMul(g.s.trains.length) * fleetMulOf(g, 'rep');
  g.sys.vmax = V_MAX * fleetMulOf(g, 'eng') * expressMul(g);
  // bridges cost a little to keep up, every minute, like trains on the move (counted with running costs)
  const br = bridgeSquares(g) * BRIDGE_UPKEEP / 60 * dt;
  if (br > 0) { g.s.money -= br; g.s.upkeep = (g.s.upkeep ?? 0) + br; }
  for (const t of g.s.trains.filter(x => x.sellAfter && !x.cargo && x.job?.phase !== 'loading')) { // delivered: now it goes
    const v = trainRefund(g); g.s.trains.splice(g.s.trains.indexOf(t), 1); g.s.money += v; g.sys.rebuildHolds();
    news(g, `💰 Train ${t.id} delivered its load and was sold for $${v.toLocaleString('en-US')}`);
  }
  for (const t of g.s.trains) {
    if (t.v > 0) { const c = UPKEEP * fm * dt; g.s.money -= c; g.s.upkeep = (g.s.upkeep ?? 0) + c; }
    const j = t.job;
    // held up: a train with somewhere to go standing still (not loading, reversing, broken down or resting aside)
    if (j && (j.phase === 'toLoad' || j.phase === 'toDrop') && t.v === 0 && t.pause <= 0 && !t.broke && !t.rr && t.plan.length) t.stopT = (t.stopT ?? 0) + dt;
    else if (t.stopT) t.stopT = 0;
    if (!j) {
      t.noWork = (t.noWork ?? 0) + dt;
      if (!parked(t)) continue;
      if ((t.idle = (t.idle ?? 0) - dt) > 0) continue;
      t.idle = 2; // look again every 2 s
      const best = bestJob(g, t, P()); if (!best) continue;
      t.noWork = 0;
      t.job = { src: best.b.id, to: best.ship.to, good: best.k, phase: 'toLoad', timer: 0, ...(best.ship.sea !== undefined ? { sea: best.ship.sea } : {}), ...(best.ship.then !== undefined ? { then: best.ship.then } : {}) };
      if (!g.sys.sendToArea(t, yardSquares(g.world.n, best.b))) endJob(t);
      continue;
    }
    if (j.timer > 0) { j.timer -= dt; if (j.timer > 0) continue; }
    const src = (g.s.buildings ?? []).find(b => b.id === j.src);
    if (j.phase === 'toLoad') {
      if (!src) { endJob(t); continue; }
      if (src.closed) { endJob(t); divert(g, t, P()); continue; } // ⛔ closed while the train was on its way: it finds other work
      if (!parked(t)) continue;
      if (!yardSquares(g.world.n, src).includes(headSquare(g, t))) { if (!g.sys.sendToArea(t, yardSquares(g.world.n, src))) endJob(t); continue; }
      j.phase = 'loading'; j.timer = loadTime(g, t);
    } else if (j.phase === 'loading') {
      if (!src) { endJob(t); continue; }
      const n = Math.min(trainCap(g), Math.floor(readyOf(src, j.good)));
      if (n <= 0) { endJob(t); continue; }
      if (isDock(src)) src.landed![j.good as Good]! -= n; else src.stock -= n;
      const ship = planFor(shipPlan(g, t), src, j.good); if (ship) { j.to = ship.to; j.sea = ship.sea; j.then = ship.then; }
      t.cargo = { good: j.good, n, d: ship?.d ?? 8 };
      j.phase = 'toDrop'; sendLoaded(g, t);
    } else if (j.phase === 'toDrop') {
      if (j.to.kind === 'bld' && bldOf(g, j.to.id)?.closed && t.dest !== undefined) { sendLoaded(g, t); continue; } // ⛔ the factory closed: on to a town
      if (!parked(t)) continue;
      if (destSquares(g, j.to).includes(headSquare(g, t)) && !(j.to.kind === 'bld' && bldOf(g, j.to.id)?.closed)) { j.phase = 'unloading'; j.timer = loadTime(g, t); }
      else sendLoaded(g, t);
    } else if (j.phase === 'unloading') {
      if (j.to.kind === 'bld' ? bldOf(g, j.to.id) : siteOf(g, j.to.id)) unload(g, t); else { j.phase = 'toDrop'; sendLoaded(g, t); }
    }
  }
}

/** What a train is doing, in plain words. */
export function trainStatus(g: Game, t: Train): string {
  const j = t.job;
  if (!j) return t.v > 0 ? '🚂 On its way' : `💤 Waiting for a load (a building needs ${minLoad(g)} ready)`;
  const src = (g.s.buildings ?? []).find(b => b.id === j.src), where = destName(g, j.to), icon = GOODS[j.good as Good]?.icon ?? '';
  const name = src ? INDUSTRIES[src.kind].name : 'the yard';
  if (j.phase === 'toLoad') return `🚂 Going to the ${name} for ${icon}`;
  if (j.phase === 'loading') return `${icon} Loading at the ${name}`;
  if (j.phase === 'toDrop') return `🚂 Taking ${t.cargo?.n ?? ''} ${icon} to ${where}`;
  return `${icon} Unloading at ${where}`;
}

/** One island's trains, as the 🚂 Your trains card shows them. */
export interface IslandFleet {
  island: number; name: string; trains: Train[];
  /** where a new train for this island comes from: the engine shed (home) or a landing's yard (it comes over by boat) */
  buyAt: 'shed' | Building | null;
  price: number;
  /** a landing here with idle trains on another island that could be shipped over */
  shipTo?: Building;
}

/** Every island with your railway on it (home first): its trains and how to add one. */
export function fleetByIsland(g: Game): IslandFleet[] {
  const per = new Map<number, Train[]>();
  for (const t of g.s.trains) { const k = islandOfTrain(g, t); per.set(k, [...(per.get(k) ?? []), t]); }
  const docks = (g.s.buildings ?? []).filter(b => isDock(b) && isLinked(g, b));
  const isl = new Set<number>([g.world.home, ...per.keys(), ...docks.map(b => islandOfB(g, b))]);
  const out: IslandFleet[] = [];
  for (const k of isl) {
    const dock = docks.find(b => islandOfB(g, b) === k), home = k === g.world.home;
    const f: IslandFleet = { island: k, name: k < 0 ? 'On bridges' : islandName(g, k), trains: per.get(k) ?? [], buyAt: home ? 'shed' : dock ?? null, price: trainPrice(g) + (home ? 0 : FERRY_FEE) };
    if (!home && dock && spareTrains(g, dock).length) f.shipTo = dock;
    if (k < 0 && !f.trains.length) continue;
    out.push(f);
  }
  return out.sort((a, b) => +(b.island === g.world.home) - +(a.island === g.world.home) || b.trains.length - a.trains.length);
}

/** Buy a train for an island: from the engine shed at home, or by boat to a landing elsewhere. */
export function buyTrainFor(g: Game, island: number): Train | string {
  if (island === g.world.home) return buyTrain(g);
  const dock = (g.s.buildings ?? []).find(b => isDock(b) && isLinked(g, b) && islandOfB(g, b) === island);
  if (!dock) return 'Trains reach this island by boat: build a dock or landing on it first';
  return buyTrainAt(g, dock);
}

/** The train to sell first on an island: one with no work, then an empty one, then one that delivers its load first. */
export function trainToSell(g: Game, island: number): Train | undefined {
  const ts = g.s.trains.filter(t => islandOfTrain(g, t) === island && !t.sellAfter && !t.broke);
  return ts.find(t => !t.job && !t.cargo) ?? ts.find(t => !t.cargo && t.job?.phase !== 'loading') ?? ts[0];
}
