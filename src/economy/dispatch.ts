import type { Game, Site } from '../state.ts';
import { fallsMul } from '../world/explore.ts';
import type { Train } from '../trains/train.ts';
import { placeTrain } from '../trains/train.ts';
import { type Building, GOODS, type Good, INDUSTRIES, isLinked, yardSquares } from '../buildings/industries.ts';
import { hallOf } from '../buildings/stations.ts';
import { shedSiding } from '../buildings/shed.ts';
import { bldDist, bldOf, destName, destSquares, dockKey, factoryRoom, payFor, type Plan, railDist, type Ship, shipPlan, siteOf } from './shipping.ts';
import { isDock, islandName, islandOfB, linkedDocks, railIsleName, railIsleOfB } from '../ships/docks.ts';
import { railIsle, railIsleAt, sameRail } from '../track/isles.ts';
import { type Ferry, freeSlot, seaBetween, seaPath, shipSpeed, tickShips } from '../ships/ships.ts';
import { tickScouts } from '../world/explore.ts';
import { reachedIslands, tickMissions } from '../progress/missions.ts';
import { capOf, expressMul, fleetIsl, fleetMulOf, FLEET, minLoad, rushDelivered } from './upgrades.ts';
import { V_MAX } from '../trains/train.ts';
import { isRev } from '../track/route.ts';
import { GRAND_LOAD, hasGrandStation, payMul, rewardMul } from '../buildings/parks.ts';
import { BRIDGE_UPKEEP, bridgeSquares } from '../track/rules.ts';
import { tickTrade, tradeDelivered, tradeRoom } from './trade.ts';
import { deliverToTown, orderDone, reward, sizeName, steadyFull, stepOf } from './towns.ts';

export const LOAD_TIME = 4;
/** Loading or unloading time for this train: 🚉 the Grand Station makes it 25% shorter on Ashford Isle. */
export function loadTime(g: Game, t: Train): number {
  if (!hasGrandStation(g)) return LOAD_TIME;
  const a = g.s.sites[0]; return a && g.world.islandOf[headSquare(g, t)] === g.world.islandOf[a.y * g.world.n + a.x] ? LOAD_TIME * GRAND_LOAD : LOAD_TIME;
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
  const k = fleetSize(g), p = 1000 + 250 * Math.max(0, k - 5);
  return (g.s.rlv ?? 0) < 3 ? Math.min(2500, p) : p;
}

/** Trains you own: on the rails, plus any aboard a boat to another island. */
export const fleetSize = (g: Game) => g.s.trains.length + (g.s.ferries?.length ?? 0);

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
  const k = Math.max(0, fleetSize(g) - 1), p = 1000 + 250 * Math.max(0, k - 5);
  return Math.round(((g.s.rlv ?? 0) < 3 ? Math.min(2500, p) : p) / 2);
}

/**
 * 💰 Sell a train for half its price. One carrying goods delivers them first (it is marked and sold when empty).
 * Returns why not, 'later' when it will go after its delivery, or '' when sold.
 */
export function sellTrain(g: Game, t: Train): string {
  if (t.broke) return 'It is broken down: sell it once the repair crew has fixed it';
  if (t.cargo || t.job?.phase === 'loading') { t.sellAfter = true; return 'later'; }
  const v = trainRefund(g) + (t.ferry ? FERRY_FEE : 0), k = g.s.trains.indexOf(t); if (k < 0) return 'That train is gone';
  g.s.trains.splice(k, 1); g.s.money += v; g.sys.rebuildHolds(); // ⛴ not yet aboard its boat: the crossing is paid back too
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

/**
 * The dock a new train for this landing sails from: the nearest by rail from `at` (a track square on Ashford Isle)
 * among the docks on that island joined to the railway that have open water to the landing. Null if none.
 */
export function departDock(g: Game, at: number, landing: Building): Building | null {
  const isl = railIsleAt(g, at); let best: Building | null = null, bd = Infinity;
  for (const d of linkedDocks(g)) {
    if (d === landing || railIsleOfB(g, d) !== isl || d.closed) continue;
    const r = bldDist(g, d)[at]!; if (r < 0 || r >= bd) continue;
    if (seaBetween(g, d, landing) < 0) continue;
    bd = r; best = d;
  }
  return best;
}

/** Why a new train can't be shipped over to this landing now (money aside), or ''. */
export function shipNewWhy(g: Game, landing: Building): string {
  if (!isLinked(g, landing)) return 'This landing is not reached by your docks yet';
  const sd = g.s.shed ? shedSiding(g) : null;
  if (!sd) return 'Lay a straight bit of line near Ashford first: new trains leave from the engine shed beside it';
  if (departDock(g, sd.line, landing)) return '';
  const home = linkedDocks(g).filter(d => railIsleOfB(g, d) === railIsleAt(g, sd.line));
  if (!home.length) return 'A new train sails from a ⚓ Dock on Ashford Isle: build one and join it to your line';
  if (!home.some(d => bldDist(g, d)[sd.line]! >= 0)) return "No dock on Ashford Isle is joined by rail to the engine shed: lay track from the shed's line to a dock's yard";
  return 'No dock on Ashford Isle has open water to this landing';
}

/**
 * Buy a train for a landing's island: it rolls out of the engine shed, runs on the rails to the nearest dock on
 * Ashford Isle and a boat takes it over to the landing (he asked, 2026-11-16). Train and crossing are paid now.
 */
export function buyTrainAt(g: Game, dock: Building): Train | string {
  const price = trainPrice(g) + FERRY_FEE;
  const why = shipNewWhy(g, dock); if (why) return why;
  if (price > g.s.money) return `Need $${(price - g.s.money).toLocaleString('en-US')} more for a train and its crossing`;
  const t = buyTrain(g); if (typeof t === 'string') return t;
  g.s.money -= FERRY_FEE; t.ferry = { to: dock.id, paid: price };
  return t;
}

/** The dock a train on its way to a boat is heading for (from where it stands now), or null. */
export const ferryDock = (g: Game, t: Train): Building | null => {
  const to = t.ferry && bldOf(g, t.ferry.to); return to ? departDock(g, headSquare(g, t), to) : null;
};

/** ⛴ The crossing can't happen: the train stays where it is and looks for work there; the crossing is paid back. */
function ferryOff(g: Game, t: Train, why: string) {
  delete t.ferry; g.s.money += FERRY_FEE;
  news(g, `⛴ Train ${t.id} stays on ${railIsleName(g, islandOfTrain(g, t))}: ${why}. The crossing fee was paid back`);
}

/** Where a ferry ties up: its landing, or another landing on the same island if that one went. */
function ferryLanding(g: Game, f: Ferry): Building | undefined {
  const to = bldOf(g, f.to ?? -1); if (to && isLinked(g, to)) return to;
  return linkedDocks(g).find(d => sameRail(g, islandOfB(g, d), f.isl));
}

/**
 * New trains bound for another island: on the rails they run to their dock and go aboard a boat there; at sea the
 * boat sails over and sets the train down on the landing's yard (it waits at the pier while the yard is busy).
 */
function tickFerries(g: Game, dt: number) {
  for (const t of g.s.trains.filter(x => x.ferry)) {
    if (t.broke || !parked(t)) continue;
    if ((t.idle = (t.idle ?? 0) - dt) > 0) continue;
    t.idle = 1;
    const to = bldOf(g, t.ferry!.to);
    if (!to || !isLinked(g, to)) { ferryOff(g, t, 'the landing it was going to is no longer on the railway'); continue; }
    const dep = ferryDock(g, t);
    if (!dep) { ferryOff(g, t, 'no dock it can reach by rail sails to that landing any more'); continue; }
    const yard = yardSquares(g.world.n, dep);
    if (!yard.includes(headSquare(g, t))) {
      if (g.sys.sendToArea(t, yard)) { t.ferry!.tries = 0; continue; }
      if ((t.ferry!.tries = (t.ferry!.tries ?? 0) + 1) >= 5) ferryOff(g, t, 'it found no way along the rails to the dock');
      continue;
    }
    // at the dock: aboard the boat
    const f: Ferry = { id: 100000 + t.id, at: dep.id, to: to.id, path: seaPath(g, dep, to), pos: 0, hold: [], wait: 0, slot: freeSlot(g, dep.id), train: t.id, paid: t.ferry!.paid, isl: islandOfB(g, to) };
    g.s.trains.splice(g.s.trains.indexOf(t), 1); g.sys.rebuildHolds();
    (g.s.ferries ??= []).push(f);
    news(g, `⛴ Train ${t.id} went aboard a boat for ${islandName(g, f.isl)}`);
  }
  for (const f of [...(g.s.ferries ?? [])]) {
    const L = Math.max(0, (f.path?.length ?? 1) - 1);
    if (f.pos < L) { f.pos = Math.min(L, f.pos + shipSpeed(g) * dt); continue; }
    if ((f.wait -= dt) > 0) continue;
    f.wait = 1; // a busy yard: try again in a second
    const land = ferryLanding(g, f), all = g.s.ferries!;
    if (!land) { all.splice(all.indexOf(f), 1); g.s.money += f.paid; news(g, `⛴ The boat with Train ${f.train} found no landing to tie up at, so the train was paid back ($${f.paid.toLocaleString('en-US')})`); continue; }
    const t = onYard(g, land, f.train); if (!t) continue;
    all.splice(all.indexOf(f), 1); g.s.trains.push(t); g.sys.rebuildHolds();
    news(g, `🚂 Train ${t.id} landed on ${islandName(g, islandOfB(g, land))} and is looking for a load`);
  }
}

/**
 * The rail island a train is on: its island, joined with any island a 🌉 bridge links to it (trains drive across,
 * so they need no boat between them). Compare it with railIsle()/railIsleOfB(), never a bare island number.
 */
export const islandOfTrain = (g: Game, t: Train) => railIsleAt(g, headSquare(g, t));

/**
 * Trains with nothing to do on other islands that have a dock on the railway, the island with the most of them
 * first: they can be shipped over to a landing (trains can't cross the sea by themselves).
 */
export function spareTrains(g: Game, dock: Building): Train[] {
  const here = railIsleOfB(g, dock), ports = new Set((g.s.buildings ?? []).filter(b => isDock(b) && isLinked(g, b)).map(b => railIsleOfB(g, b)));
  const idle = g.s.trains.filter(t => !t.job && !t.cargo && !t.broke && !t.ferry && parked(t) && islandOfTrain(g, t) !== here && ports.has(islandOfTrain(g, t)));
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

/** Other islands (with a dock on the railway) whose trains can be shipped over to this landing: train counts, most first. */
export function trainIslands(g: Game, dock: Building): { island: number; name: string; n: number; free: number; booked: number }[] {
  const here = railIsleOfB(g, dock), ports = new Set((g.s.buildings ?? []).filter(b => isDock(b) && isLinked(g, b)).map(b => railIsleOfB(g, b)));
  const per = new Map<number, { island: number; name: string; n: number; free: number; booked: number }>();
  for (const t of g.s.trains) {
    const i = islandOfTrain(g, t); if (i === here || !ports.has(i)) continue;
    const e = per.get(i) ?? { island: i, name: railIsleName(g, i), n: 0, free: 0, booked: 0 }; per.set(i, e);
    e.n++; if (t.moveTo !== undefined || t.ferry) e.booked++; else if (!t.job && !t.cargo && !t.broke && !t.sellAfter) e.free++;
  }
  return [...per.values()].sort((a, b) => b.n - a.n);
}

/** Can this train go over to the landing now: nothing aboard, not loading, not broken down. */
const readyToCross = (t: Train) => !t.cargo && t.job?.phase !== 'loading' && !t.broke;

/**
 * ⛴ Bring a train from another island over to this landing, for the crossing fee. A train with no work goes at once;
 * when all are busy, the one closest to done is booked and goes as soon as it has delivered its load.
 * Returns the train shipped, 'later' when one is booked, or why not.
 */
export function bringTrainFrom(g: Game, dock: Building, island: number): Train | 'later' | string {
  if (!isLinked(g, dock)) return 'This landing is not reached by your docks yet';
  if (FERRY_FEE > g.s.money) return `Need $${(FERRY_FEE - g.s.money).toLocaleString('en-US')} more for the crossing`;
  const ts = g.s.trains.filter(t => islandOfTrain(g, t) === railIsle(g, island) && t.moveTo === undefined && !t.ferry && !t.sellAfter);
  if (!ts.length) return `No train on ${railIsleName(g, railIsle(g, island))} can go: every one there is already booked or sold`;
  // first choice: one waiting for work; then one on its way to load (it drops that job), then one carrying goods, broken last
  const rank = (t: Train) => (!t.job && !t.cargo && !t.broke ? 0 : readyToCross(t) ? 1 : t.cargo && !t.broke ? 2 : 3);
  const pick = [...ts].sort((a, b) => rank(a) - rank(b))[0]!;
  if (rank(pick) === 0 && parked(pick)) { const t = crossNow(g, dock, pick); if (t) { g.s.money -= FERRY_FEE; return t; } }
  pick.moveTo = dock.id; g.s.money -= FERRY_FEE;
  return 'later';
}

/** Take back a booked crossing: the fee is paid back. */
export function cancelMove(g: Game, t: Train) {
  if (t.moveTo === undefined) return;
  delete t.moveTo; g.s.money += FERRY_FEE;
}

/** Put the train down on the landing's yard (a new train object with the same id), or null if the yard is busy. */
function crossNow(g: Game, dock: Building, from: Train): Train | null {
  const t = onYard(g, dock, from.id); if (!t) return null;
  g.s.trains[g.s.trains.indexOf(from)] = t; g.sys.rebuildHolds();
  return t;
}

/** Booked trains that are free now go over (retried while the landing's yard is busy). */
function tickMoves(g: Game) {
  for (const t of g.s.trains.filter(x => x.moveTo !== undefined && readyToCross(x))) {
    const dock = (g.s.buildings ?? []).find(b => b.id === t.moveTo);
    if (!dock || !isLinked(g, dock) || islandOfTrain(g, t) === railIsleOfB(g, dock)) { cancelMove(g, t); continue; }
    const n = crossNow(g, dock, t);
    if (n) news(g, `⛴ Train ${n.id} crossed by boat to ${islandName(g, islandOfB(g, dock))} and is looking for a load`);
  }
}

/** Units of stock (of one good, for docks) already promised to trains on their way to collect. */
const claimed = (g: Game, b: Building, k?: string) => g.s.trains.reduce((a, t) => a + (t.job?.src === b.id && t.job.phase === 'toLoad' && (k === undefined || t.job.good === k) ? capOf(g, t) : 0), 0);

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
/** The fastest engines bought on any island (trains elsewhere run at their island's share of it). */
export const topEng = (g: Game) => Math.max(1, ...Object.values(g.s.fleetI ?? {}).map(l => FLEET.eng.lv[l.eng ?? 0]!));
/** A train's speed against the fastest island's: its own island's engines. */
export const engShare = (g: Game, t: Train) => fleetMulOf(g, 'eng', fleetIsl(g, t)) / topEng(g);

export const tripCost = (g: Game, squares: number, isl = g.world.home) => UPKEEP * fleetMul(g.s.trains.length) * fleetMulOf(g, 'rep', isl) * (squares * 32 / (V_MAX * fleetMulOf(g, 'eng', isl) * expressMul(g)) * 3 + 10);

/** trips remembered per train, and seconds a train waiting for better work waits before it forgets its oldest trip */
export const NET_TRIPS = 3, NET_FORGET = 300;
/** A train whose last trips cost more to run than they paid (jams and queues included, not the ideal trip): it only
 *  takes loads an order, a factory or a rush waits for, and otherwise waits for better work, for free. */
export const losingTrain = (t: Train) => (t.nets?.length ?? 0) >= 2 && t.nets!.reduce((a, b) => a + b, 0) < 0;
/** a delivery ends a trip: remember what it earned after running costs */
function tripDone(t: Train, v: number) {
  (t.nets ??= []).push(Math.round(v - (t.run ?? 0))); if (t.nets.length > NET_TRIPS) t.nets.shift();
  t.run = 0;
}

/** Goods nobody is waiting for (past-order buying or surplus) that pay less than the trip costs are not worth fetching. */
export const losesMoney = (g: Game, ship: Ship, pay: number, reach: number, isl = g.world.home) =>
  (ship.why === 'steady' || ship.why === 'extra') && !ship.rush && ship.sea === undefined && pay < tripCost(g, reach + ship.d, isl);

/** Pick the best waiting load for an idle train: open orders (and factories making what one waits for) first, then by pay per square of travel. */
function bestJob(g: Game, t: Train, plan: Plan): { b: Building; k: Good; ship: Ship } | null {
  const at = headSquare(g, t), isl = fleetIsl(g, t), cap = capOf(g, t), losing = losingTrain(t);
  let best: { b: Building; k: Good; ship: Ship } | null = null, bs = -Infinity;
  for (const b of g.s.buildings ?? []) {
    if (!isLinked(g, b) || b.closed) continue; // ⛔ closed: no train is sent there
    const reach = bldDist(g, b)[at]!; if (reach < 0) continue;
    const goods = isDock(b) ? Object.keys(b.landed ?? {}) as Good[] : [INDUSTRIES[b.kind].makes];
    for (const k of goods) {
      const ship = planFor(plan, b, k); if (!ship) continue;
      const avail = readyOf(b, k) - claimed(g, b, isDock(b) ? k : undefined); if (avail < minLoad(g, isl)) continue;
      const v = payFor(k, Math.min(cap, avail), ship.d, ship.full ? 'order' : ship.why);
      if (losesMoney(g, ship, v, reach, isl)) continue; // a load that pays less than the trip costs: the train waits for better work, for free
      // goods an order waits for: the load that fills it soonest (most units per square run, empty and loaded), whatever
      // the good is worth; other loads: the best pay per square
      const urgent = ship.why === 'order' || ship.feeds || ship.rush || ship.sea !== undefined;
      if (!urgent && losing) continue; // its last trips lost money: only work something waits for

      const s = urgent ? 1e3 + Math.min(cap, avail) / (reach + ship.d + 8) : v / (reach + ship.d + 8);
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
    t.lastPay = { pay: Math.round(v), at: g.s.t, n: c.n, good: k, to: j.to }; tripDone(t, v);
    t.cargo = undefined; endJob(t); return;
  }
  if (j.to.kind === 'bld') {
    const f = bldOf(g, j.to.id)!, n = Math.min(c.n, Math.floor(factoryRoom(f, k)));
    (f.inbuf ??= {})[k] = (f.inbuf[k] ?? 0) + n;
    const v = payFor(k, n, c.d, 'factory'); pay(g, v); if (rushDelivered(g, j.to, k, n)) news(g, `⭐ Rush done: the ${INDUSTRIES[f.kind].name} got its ${GOODS[k].name.toLowerCase()}`);
    t.lastPay = { pay: Math.round(v), at: g.s.t, n, good: k, to: j.to }; tripDone(t, v);
    c.n -= n;
    if (c.n > 0) { j.to = nearestTown(g, t) ?? j.to; j.phase = 'toDrop'; sendLoaded(g, t); return; }
    t.cargo = undefined; endJob(t); return;
  }
  const town = siteOf(g, j.to.id)!;
  const p = deliverToTown(g, town, k, c.n, tradeRoom(g, town, k));
  // 🏛 town projects pay more; while its order waits on goods from the outer islands, the rest of the order pays in full
  const v = (payFor(k, p.order + p.trade, c.d, 'order') + payFor(k, p.steady, c.d, steadyFull(g, town, k) ? 'order' : 'steady') + payFor(k, p.surplus, c.d, 'extra')) * payMul(g, town);
  pay(g, v); if (rushDelivered(g, j.to, k, p.order)) news(g, `⭐ Rush done: ${town.name} got its ${GOODS[k].name.toLowerCase()}`);
  t.lastPay = { pay: Math.round(v), at: g.s.t, n: c.n, good: k, to: j.to }; tripDone(t, v);
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
  const fm = fleetMul(g.s.trains.length);
  // each island has its own engines: vmax is the fastest, slower islands' trains run at their share of it (speedOf)
  g.sys.vmax = V_MAX * topEng(g) * expressMul(g);
  // bridges cost a little to keep up, every minute, like trains on the move (counted with running costs); never while
  // money is below zero, so bridges alone can't push a railway further into the red (no-fail)
  const br = g.s.money > 0 ? bridgeSquares(g) * BRIDGE_UPKEEP / 60 * dt : 0;
  if (br > 0) { g.s.money -= br; g.s.upkeep = (g.s.upkeep ?? 0) + br; }
  if (Math.floor(g.s.t * 2) !== Math.floor((g.s.t - dt) * 2)) tickMoves(g); // booked crossings, twice a second
  tickFerries(g, dt); // ⛴ new trains running to their dock, and boats taking them over
  for (const t of g.s.trains.filter(x => x.sellAfter && !x.cargo && x.job?.phase !== 'loading')) { // delivered: now it goes
    const v = trainRefund(g); g.s.trains.splice(g.s.trains.indexOf(t), 1); g.s.money += v; g.sys.rebuildHolds();
    news(g, `💰 Train ${t.id} delivered its load and was sold for $${v.toLocaleString('en-US')}`);
  }
  for (const t of g.s.trains) {
    if (t.v > 0) { const c = UPKEEP * fm * fleetMulOf(g, 'rep', fleetIsl(g, t)) * dt; g.s.money -= c; g.s.upkeep = (g.s.upkeep ?? 0) + c; t.run = (t.run ?? 0) + c; }
    const j = t.job;
    // held up: a train with somewhere to go standing still (not loading, reversing, broken down or resting aside)
    if (j && (j.phase === 'toLoad' || j.phase === 'toDrop') && t.v === 0 && t.pause <= 0 && !t.broke && !t.rr && t.plan.length) t.stopT = (t.stopT ?? 0) + dt;
    else if (t.stopT) t.stopT = 0;
    if (!j) {
      t.noWork = (t.noWork ?? 0) + dt;
      // waiting for better work a long while: forget its oldest trip, so it tries the best load again some time
      if (t.nets?.length && Math.floor(t.noWork / NET_FORGET) !== Math.floor((t.noWork - dt) / NET_FORGET)) t.nets.shift();
      if (!parked(t) || t.moveTo !== undefined || t.ferry) continue; // ⛴ booked to cross: it waits for the boat (or runs to its dock)
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
      const n = Math.min(capOf(g, t), Math.floor(readyOf(src, j.good)));
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
  if (t.ferry) { const to = bldOf(g, t.ferry.to); return `⛴ Going to the dock to sail to ${to ? islandName(g, islandOfB(g, to)) : 'another island'}`; }
  if (!j) return t.v > 0 ? '🚂 On its way' : `💤 Waiting for a load (a building needs ${minLoad(g, fleetIsl(g, t))} ready)`;
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
  const isl = new Set<number>([g.world.home, ...per.keys(), ...docks.map(b => railIsleOfB(g, b))]);
  const out: IslandFleet[] = [];
  for (const k of isl) {
    const dock = docks.find(b => railIsleOfB(g, b) === k), home = k === g.world.home;
    const f: IslandFleet = { island: k, name: railIsleName(g, k), trains: per.get(k) ?? [], buyAt: home ? 'shed' : dock ?? null, price: trainPrice(g) + (home ? 0 : FERRY_FEE) };
    if (!home && dock && spareTrains(g, dock).length) f.shipTo = dock;
    if (k < 0 && !f.trains.length) continue;
    out.push(f);
  }
  return out.sort((a, b) => +(b.island === g.world.home) - +(a.island === g.world.home) || b.trains.length - a.trains.length);
}

/** Buy a train for an island: from the engine shed at home, or by boat to a landing elsewhere. */
export function buyTrainFor(g: Game, island: number): Train | string {
  if (railIsle(g, island) === g.world.home) return buyTrain(g);
  const dock = (g.s.buildings ?? []).find(b => isDock(b) && isLinked(g, b) && railIsleOfB(g, b) === railIsle(g, island));
  if (!dock) return 'Trains reach this island by boat: build a dock or landing on it first';
  return buyTrainAt(g, dock);
}

/** The train to sell first on an island: one with no work, then an empty one, then one that delivers its load first. */
export function trainToSell(g: Game, island: number): Train | undefined {
  const ts = g.s.trains.filter(t => islandOfTrain(g, t) === railIsle(g, island) && !t.sellAfter && !t.broke && t.moveTo === undefined && !t.ferry);
  return ts.find(t => !t.job && !t.cargo) ?? ts.find(t => !t.cargo && t.job?.phase !== 'loading') ?? ts[0];
}
