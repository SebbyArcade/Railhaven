import type { Game, Site } from '../state.ts';
import { GOODS, type Good, INDUSTRIES, isLinked } from '../buildings/industries.ts';
import { isDock, islandOfB, linkedDocks } from '../ships/docks.ts';
import { lanesFrom, seaLanes } from '../ships/ships.ts';
import { islandSpec } from '../world/specialty.ts';
import { townLinked } from './towns.ts';
import { type Plan, shipPlan } from './shipping.ts';
import { islandOfTrain } from './dispatch.ts';

/**
 * 👑 Regions and 🤝 trade orders, as in the old game. Every island with a town on the railway is a region with a
 * capital: Ashford at home, elsewhere its biggest town on the railway when the region began (it stays the capital).
 * Once there are two regions joined by a sea route, each capital orders a good another region makes and its own
 * island can't: 40 units, then 1.4 times more each round, paying $2,500 × the round. Trade orders are optional: they
 * never hold a town back, but each one filled counts as a filled order toward the Railway level.
 */
export interface TradeOrder {
  /** the round (1, 2, 3...) */
  n: number;
  good: Good;
  need: number;
  got: number;
  /** the island the good comes from */
  from: number;
}

export const TRADE_BASE = 40, TRADE_GROW = 1.4, TRADE_REWARD = 2500;
export const tradeNeed = (n: number) => Math.round(TRADE_BASE * Math.pow(TRADE_GROW, n - 1) / 10) * 10;
export const tradeReward = (n: number) => TRADE_REWARD * n;

export const islandOfSite = (g: Game, t: Site) => g.world.islandOf[t.y * g.world.n + t.x]!;

/** Regions: island → its towns on the railway. */
export function regions(g: Game): Map<number, Site[]> {
  const out = new Map<number, Site[]>();
  for (const t of g.s.sites) if (t.kind === 'town' && townLinked(g, t)) { const k = islandOfSite(g, t); if (k < 0) continue; (out.get(k) ?? out.set(k, []).get(k)!).push(t); }
  return out;
}

/** The capital of island k's region (chosen once and kept), or undefined while the island has no town on the railway. */
export function capitalOf(g: Game, k: number, towns = regions(g).get(k)): Site | undefined {
  if (k === g.world.home) return g.s.sites[0];
  const id = g.s.caps?.[k];
  if (id !== undefined) { const t = g.s.sites.find(s => s.id === id && s.kind === 'town'); if (t) return t; }
  if (!towns?.length) return undefined;
  const best = [...towns].sort((a, b) => (b.lvl ?? 0) - (a.lvl ?? 0) || (b.pop ?? 0) - (a.pop ?? 0) || a.id - b.id)[0]!;
  (g.s.caps ??= {})[k] = best.id;
  return best;
}

/** Is this town a region's capital? */
export function isCapital(g: Game, t: Site): boolean {
  if (t === g.s.sites[0]) return true;
  return g.s.caps?.[islandOfSite(g, t)] === t.id;
}

/** Goods made on island k (by buildings on the railway, fishing docks included). */
export function madeOn(g: Game, k: number): Set<Good> {
  const out = new Set<Good>();
  for (const b of g.s.buildings ?? []) {
    if (b.closed || !isLinked(g, b) || islandOfB(g, b) !== k) continue;
    if (isDock(b)) { if ((b.fish ?? 0) > 0) out.add('fish'); continue; }
    out.add(INDUSTRIES[b.kind].makes as Good);
  }
  return out;
}

/** Islands a ship route joins to island k (docks on the railway at both ends). */
export function seaNeighbours(g: Game, k: number): Set<number> {
  return new Set(seaPaths(g, k).keys());
}

/**
 * Islands ships can carry goods to from island k, one sea route away or two (a dock in between passes them on), with
 * the docks on those routes.
 */
export function seaPaths(g: Game, k: number): Map<number, Set<number>> {
  const lanes = seaLanes(g), docks = linkedDocks(g), isl = (id: number) => { const o = docks.find(b => b.id === id); return o ? islandOfB(g, o) : -1; };
  const out = new Map<number, Set<number>>(), add = (i: number, ids: number[]) => { if (i < 0 || i === k) return; const s = out.get(i) ?? out.set(i, new Set()).get(i)!; for (const x of ids) s.add(x); };
  for (const d of docks) if (islandOfB(g, d) === k) for (const r of lanesFrom(g, d.id, lanes)) {
    add(isl(r.id), [d.id, r.id]);
    for (const r2 of lanesFrom(g, r.id, lanes)) if (r2.id !== d.id) add(isl(r2.id), [d.id, r.id, r2.id]);
  }
  return out;
}

/**
 * Goods island `from` has to spare for island k: a maker there whose goods no order or factory on its own island
 * takes now (or that already ships them to k).
 */
function spareOn(g: Game, from: number, k: number, plan: Plan): Set<Good> {
  const out = new Set<Good>(), docksK = new Set((g.s.buildings ?? []).filter(b => isDock(b) && islandOfB(g, b) === k).map(b => b.id));
  for (const b of g.s.buildings ?? []) {
    if (isDock(b) || b.closed || !isLinked(g, b) || islandOfB(g, b) !== from) continue;
    const p = plan.get(b.id);
    if (!p || p.why === 'steady' || p.why === 'extra' || (p.sea !== undefined && docksK.has(p.sea))) out.add(INDUSTRIES[b.kind].makes as Good);
  }
  return out;
}

/** What island `from` can offer island k: goods made there and not on k; spare goods first, then its specialty. */
function offers(g: Game, from: number, k: number, plan?: Plan): Good[] {
  const here = madeOn(g, k), there = [...madeOn(g, from)].filter(x => !here.has(x) && GOODS[x]);
  const sp = islandSpec(g, from) as Good | null, spare = plan ? spareOn(g, from, k, plan) : new Set<Good>();
  return there.sort((a, b) => +spare.has(b) - +spare.has(a) || +(b === sp) - +(a === sp) || GOODS[b].value - GOODS[a].value);
}

/** Pick the good and the region for round n of island k's trade order (taking turns between regions), or null. */
function pick(g: Game, k: number, n: number, from: number[], plan: Plan): { good: Good; from: number } | null {
  // a region with something to spare first (taking turns between them), else any region that makes something
  let any: { good: Good; from: number } | null = null;
  for (let i = 0; i < from.length; i++) {
    const r = from[(n - 1 + i) % from.length]!, o = offers(g, r, k, plan); if (!o.length) continue;
    const spare = spareOn(g, r, k, plan), sp = o.filter(x => spare.has(x));
    if (sp.length) return { good: sp[Math.floor((n - 1) / from.length) % sp.length]!, from: r };
    any ??= { good: o[0]!, from: r };
  }
  return any;
}

/** The capital's open trade order, if any. */
export function tradeOf(g: Game, t: Site): TradeOrder | undefined {
  if (!isCapital(g, t)) return undefined;
  const o = g.s.trade?.[islandOfSite(g, t)];
  return o && o.got < o.need ? o : undefined;
}

/** How many more of good k the town's trade order takes (0 if none). */
export function tradeRoom(g: Game, t: Site, k: Good): number {
  const o = tradeOf(g, t);
  return o && o.good === k ? o.need - o.got : 0;
}

/**
 * Every few seconds: name the capitals, start each capital's next trade order, and swap an order nobody has started
 * when it no longer makes sense (its island now makes the good itself, or the route or the maker is gone).
 */
export function tickTrade(g: Game) {
  const R = regions(g); if (R.size < 2) return;
  const plan = shipPlan(g);
  for (const [k, towns] of R) {
    if (!capitalOf(g, k, towns)) continue;
    // regions a ship route joins to this one; those a ship already sails to first
    const near = [...seaNeighbours(g, k)].filter(r => R.has(r)).sort((a, b) => a - b);
    const served = near.filter(r => shipServes(g, k, r) && g.s.trains.some(x => islandOfTrain(g, x) === r)); // and a train there to take goods to its dock
    const from = served.length ? served : near;
    const tr = (g.s.trade ??= {}), o = tr[k];
    if (o && o.got < o.need) {
      if (o.got > 0) continue; // started: keep it
      // keep it while it still makes sense and its island has the good to spare (or nothing better is spare anywhere)
      const ok = from.includes(o.from) && offers(g, o.from, k).includes(o.good), p = pick(g, k, o.n, from, plan);
      if (ok && (spareOn(g, o.from, k, plan).has(o.good) || !p || !spareOn(g, p.from, k, plan).has(p.good))) continue;
      if (p) { o.good = p.good; o.from = p.from; } else delete tr[k];
      continue;
    }
    const n = (o?.n ?? 0) + 1, p = pick(g, k, n, from, plan); if (!p) continue;
    tr[k] = { n, good: p.good, need: tradeNeed(n), got: 0, from: p.from };
  }
}

/** Goods unloaded for a trade order: count them; returns the reward when this load fills it (0 otherwise). */
export function tradeDelivered(g: Game, t: Site, n: number): number {
  const o = tradeOf(g, t); if (!o || n <= 0) return 0;
  o.got = Math.min(o.need, o.got + n);
  return o.got >= o.need ? tradeReward(o.n) : 0;
}

/** Why nothing comes for a trade order, in plain words ('' when goods are on the way or it is just a matter of time). */
export function tradeWhy(g: Game, t: Site, o: TradeOrder): string {
  const k = islandOfSite(g, t), name = (i: number) => i === g.world.home ? 'Ashford Isle' : g.world.islands[i]?.name ?? 'that island';
  if (!seaNeighbours(g, k).has(o.from)) return `No ship route to ${name(o.from)} any more: its dock or this island's dock left the railway`;
  if (!madeOn(g, o.from).has(o.good)) return `Nobody on ${name(o.from)} makes ${GOODS[o.good].name.toLowerCase()} now`;
  if (!(g.s.ships ?? []).length) return 'No cargo ship yet: buy one at a dock';
  if (!shipServes(g, k, o.from)) return `No ship sails the routes between ${name(o.from)} and here: buy one at a dock on either island`;
  // trains can't cross the sea: each island needs its own to take goods to its dock and on from the landing
  const trains = (i: number) => g.s.trains.filter(x => islandOfTrain(g, x) === i).length;
  if (!trains(o.from)) return `No train on ${name(o.from)} takes it to the dock: send one over (⚓ Dock → 🚂 Trains)`;
  if (!trains(k)) return `No train on ${name(k)} brings it from the landing: send one over (⚓ Dock → 🚂 Trains)`;
  const landed = (g.s.buildings ?? []).filter(d => isDock(d) && islandOfB(g, d) === k).reduce((a, d) => a + Math.floor(d.landed?.[o.good] ?? 0), 0);
  if (landed >= 40 && g.s.trains.every(x => islandOfTrain(g, x) !== k || x.job)) return `${landed} wait at the landing and every train on ${name(k)} is busy: send another over`;
  return '';
}

/** Is a cargo ship somewhere on the sea routes that join islands a and b (it can sail between them)? */
function shipServes(g: Game, a: number, b: number): boolean {
  const seen = seaPaths(g, a).get(b); if (!seen) return false;
  return (g.s.ships ?? []).some(s => seen.has(s.at) || (s.to !== undefined && seen.has(s.to)));
}
