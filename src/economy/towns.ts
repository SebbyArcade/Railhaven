import type { Game, Site } from '../state.ts';
import { addSupplies, DEPOT_GOODS, depotTakes, isDepot, townGrew } from '../frontier/frontier.ts';
import { farText, type Good, INDUSTRIES, type IndustryKind, inputsOf, isFactory, yardSet } from '../buildings/industries.ts';
import { hallOf } from '../buildings/stations.ts';
import { reveal } from '../world/fog.ts';
import { islandSpec } from '../world/specialty.ts';
import { orderMul } from '../buildings/parks.ts';

/** The order ladder: one order per step; filling it lets the town grow one size. */
export const LADDER: Partial<Record<Good, number>>[] = [
  { farm: 30, wood: 20 },
  { farm: 60, wood: 40, stone: 30 },
  { farm: 100, coal: 50, planks: 40, bricks: 30 },
  { farm: 150, flour: 60, planks: 60, bricks: 60, steel: 40 },
  { flour: 150, bricks: 120, steel: 100, fuel: 80 },
];
/** Big-city order sizes (at Megacity) for goods past the ladder: the dear new products come in smaller amounts. */
const NEW_BASE: Partial<Record<Good, number>> = { glass: 60, tools: 40, furniture: 40, gold: 40, gems: 40, jewellery: 20, cocoa: 50, chocolate: 40, rubber: 50, tyres: 30 };
export const SIZE_NAMES = ['Hamlet', 'Village', 'Town', 'City', 'Metropolis', 'Megacity'];
/** reward for filling the order of each step, and the price of tapping ⬆ Upgrade after it */
export const reward = (L: number) => L < 5 ? [600, 1500, 3000, 6000, 12500][L]! : Math.round(12500 * (1 + 0.25 * (L - 4)) / 100) * 100;
export const upgradePrice = (L: number) => L < 5 ? [250, 800, 2500, 6000, 15000][L]! : Math.round(15000 * Math.pow(1.35, L - 4) / 100) * 100;
/** most people a town holds at each size */
export const sizeCap = (L: number) => L < 6 ? [100, 400, 1200, 3000, 8000, 20000][L]! : Math.round(20000 * Math.pow(1.35, L - 5) / 100) * 100;
const sizeFloor = (L: number) => L === 0 ? 15 : sizeCap(L - 1);
/** steady buying of goods from steps already climbed pays this share */
export const STEADY_PAY = 0.35;
export const SURPLUS_PAY = 0.175;
export const steadyRate = (pop: number) => 10 + Math.sqrt(Math.max(0, pop)) * 0.6; // units per minute, and the most it holds

export function sizeName(L: number): string { return SIZE_NAMES[Math.min(L, SIZE_NAMES.length - 1)]! + (L >= SIZE_NAMES.length ? ' ' + (L - SIZE_NAMES.length + 2) : ''); }

/** The town's step on the ladder (stored on the site). */
export const stepOf = (t: Site) => t.lvl ?? 0;

/** The current order: fixed for the first five steps, then the goods the railway makes, a quarter bigger each step. */
export function orderOf(g: Game, t: Site): Partial<Record<Good, number>> {
  const m = orderMul(g, t), o0 = orderOfFull(g, t);
  if (m >= 1) return o0;
  // 🌳 parks and a 🚋 Tram Line make the order smaller
  const o: Partial<Record<Good, number>> = {};
  for (const k of Object.keys(o0) as Good[]) o[k] = Math.max(5, Math.round(o0[k]! * m / 5) * 5);
  return o;
}

/** The order before parks make it smaller. */
export function orderOfFull(g: Game, t: Site): Partial<Record<Good, number>> {
  const o = orderBase(g, t);
  if (!t.sea0) return o;
  // towns by the sea with a fishing dock on their island order seafood too (more on a fishing island)
  const L = stepOf(t), isl = g.world.islandOf[t.y * g.world.n + t.x]!, m = islandSpec(g, isl) === 'fish' ? 1.5 : 1;
  return { ...o, fish: Math.round((20 + 15 * L) * m / 5) * 5 };
}

function orderBase(g: Game, t: Site): Partial<Record<Good, number>> {
  const L = stepOf(t);
  if (L < LADDER.length) return LADDER[L]!;
  const made = madeGoods(g), base = LADDER[LADDER.length - 1]!;
  if (made.length < 2) return { farm: Math.round(150 * Math.pow(1.25, L - 4) / 5) * 5 };
  const o: Partial<Record<Good, number>> = {};
  for (let k = 0; k < Math.min(3, made.length); k++) { const good = made[(L * 2 + k) % made.length]!; o[good] = Math.round((base[good] ?? LADDER[3]![good] ?? NEW_BASE[good] ?? 60) * Math.pow(1.25, L - 4) / 5) * 5; }
  return o;
}

/** Goods the player's buildings make. */
export function madeGoods(g: Game): Good[] {
  return [...new Set((g.s.buildings ?? []).filter(b => b.kind !== 'dock' || (b.fish ?? 0) > 0).map(b => INDUSTRIES[b.kind].makes as Good))];
}

/** How far along the order is, 0-1. */
export function orderProgress(g: Game, t: Site): number {
  const o = orderOf(g, t), ks = Object.keys(o) as Good[];
  if (!ks.length) return 1;
  return ks.reduce((a, k) => a + Math.min(1, (t.got?.[k] ?? 0) / o[k]!), 0) / ks.length;
}
export const orderDone = (g: Game, t: Site) => orderProgress(g, t) >= 1;

/** Goods of steps already climbed: the town keeps buying these (steady demand). Towns by the sea also buy fish, and
 *  shellfish from Town size. While its order waits on goods from the outer islands, it keeps buying its order's other goods too. */
export function steadyGoods(t: Site, g?: Game): Good[] {
  const out = [...new Set(LADDER.slice(0, Math.min(stepOf(t), LADDER.length)).flatMap(o => Object.keys(o) as Good[]))];
  if (g && isCoastal(g, t)) { out.push('fish'); if (stepOf(t) >= 2) out.push('shellfish'); }
  if (g) for (const k of waitsAbroad(g, t).length ? Object.keys(orderOf(g, t)) as Good[] : []) if (!out.includes(k) && !overseas(g, k)) out.push(k);
  if (g && isDepot(g, t)) for (const k of DEPOT_GOODS) if (!out.includes(k)) out.push(k); // 🧭 a supply depot always takes wood and stone
  return out;
}

/**
 * A good nothing on the railway can make yet because it (or what its factory needs) only comes from the outer islands
 * or the far seas, and no mine for it is on the railway (e.g. steel before any iron mine is joined up).
 */
export function overseas(g: Game, k: Good): boolean {
  if (farText(g, k)) return true;
  const facs = (Object.keys(INDUSTRIES) as IndustryKind[]).filter(m => INDUSTRIES[m].makes === k && isFactory(m));
  return facs.length > 0 && facs.every(m => inputsOf(m).some(i => !!farText(g, i)));
}

/**
 * The goods the town's order still waits on that only the outer islands can supply, when that is all any order on
 * the railway still waits on (every other order, trade orders included, is filled or waits the same way): a long
 * wait, the player must sail first. While any order can still use goods the railway makes, the trains serve that.
 */
export function waitsAbroad(g: Game, t: Site): Good[] {
  const mine = orderLeft(g, t).filter(k => overseas(g, k)); if (!mine.length) return [];
  return allWaitAbroad(g) ? mine : [];
}
const orderLeft = (g: Game, s: Site) => { const o = orderOf(g, s); return (Object.keys(o) as Good[]).filter(k => (s.got?.[k] ?? 0) < o[k]!); };
const stallMemo = new WeakMap<Game, { t: number; v: boolean }>();
/** Every order on the railway waits only on goods from the outer islands (worked out once per moment of game time). */
function allWaitAbroad(g: Game): boolean {
  const m = stallMemo.get(g); if (m && m.t === g.s.t) return m.v;
  // a 🤝 trade order between islands still open: its goods are wanted
  let v = !Object.values(g.s.trade ?? {}).some(o => o.got < o.need && !overseas(g, o.good));
  if (v) for (const s of g.s.sites) {
    if (s.kind !== 'town' || !townLinked(g, s)) continue;
    if (orderLeft(g, s).some(k => !overseas(g, k))) { v = false; break; }
  }
  stallMemo.set(g, { t: g.s.t, v });
  return v;
}

/**
 * Steady buying pays its share (STEADY_PAY), but while the town's order waits on goods from the outer islands, the
 * goods of that same order it can get at home pay in full: deliveries keep paying while the player sets out to sea.
 */
export const steadyFull = (g: Game, t: Site, k: Good) => !!orderOf(g, t)[k] && !overseas(g, k) && waitsAbroad(g, t).length > 0;

/** A town with the open sea within 4 squares. */
export function isCoastal(g: Game, t: Site): boolean {
  const c = (g.coast ??= new Map()), hit = c.get(t.id); if (hit !== undefined) return hit;
  const n = g.world.n; let yes = false;
  for (let dy = -4; dy <= 4 && !yes; dy++) for (let dx = -4; dx <= 4 && !yes; dx++) {
    const x = t.x + dx, y = t.y + dy; if (x >= 0 && y >= 0 && x < n && y < n && g.world.ocean[y * n + x]) yes = true;
  }
  c.set(t.id, yes); return yes;
}

/** Is the town on the railway: its station hall joined to Ashford? */
export function townLinked(g: Game, t: Site): boolean {
  const h = hallOf(g.track, g.world.n, t, g.world.terr, yardSet(g));
  return !!h && !!g.linked?.has(h.squares[1]);
}

/** How many units of a good the town takes right now, split into open-order and steady parts. */
export function townRoom(g: Game, t: Site, k: Good): { order: number; steady: number } {
  const o = orderOf(g, t), left = o[k] ? Math.max(0, o[k]! - (t.got?.[k] ?? 0)) : 0;
  return { order: left, steady: depotTakes(g, t, k) ? 999 : steadyGoods(t, g).includes(k) ? Math.floor(t.steady?.[k] ?? 0) : 0 };
}
export const townWants = (g: Game, t: Site, k: Good) => { const r = townRoom(g, t, k); return r.order + r.steady > 0 || steadyGoods(t, g).includes(k) || !!orderOf(g, t)[k]; };

/**
 * Unload goods at a town: fills the order first, then a capital's 🤝 trade order (up to `tradeLeft`, counted by the
 * caller), then steady demand, the rest is surplus. Returns the units in each part.
 */
export function deliverToTown(g: Game, t: Site, k: Good, n: number, tradeLeft = 0) {
  const r = townRoom(g, t, k), order = Math.min(n, r.order), trade = Math.min(n - order, tradeLeft), steady = Math.min(n - order - trade, r.steady), surplus = n - order - trade - steady;
  if (order) { (t.got ??= {})[k] = (t.got[k] ?? 0) + order; }
  if (depotTakes(g, t, k)) { addSupplies(g, steady + surplus); return { order, trade, steady: steady + surplus, surplus: 0 }; } // 🧭 into the supply pile
  if (steady) (t.steady ??= {})[k] = (t.steady[k] ?? 0) - steady;
  return { order, trade, steady, surplus };
}

/** Steady demand refills; people move in as the order fills. */
export function tickTowns(g: Game, dt: number) {
  for (const t of g.s.sites) {
    if (t.kind !== 'town' || !townLinked(g, t)) continue;
    const cap = steadyRate(t.pop ?? 0);
    for (const k of steadyGoods(t, g)) (t.steady ??= {})[k] = Math.min(cap, (t.steady[k] ?? 0) + dt * cap / 60);
    const L = stepOf(t), target = sizeFloor(L) + (sizeCap(L) - sizeFloor(L)) * orderProgress(g, t);
    if ((t.pop ?? 0) < target) t.pop = Math.min(target, (t.pop ?? 0) + dt * Math.max(0.5, target * 0.01));
  }
}

/** The order is filled and the player taps ⬆ Upgrade: pay, climb a step, start the next order. */
export function upgradeTown(g: Game, t: Site): string {
  if (!orderDone(g, t)) return `${t.name} still needs goods for its order`;
  const price = upgradePrice(stepOf(t));
  if (price > g.s.money) return `Need $${(price - g.s.money).toLocaleString('en-US')} more to upgrade ${t.name}`;
  g.s.money -= price;
  t.lvl = stepOf(t) + 1; t.got = {}; t.filled = false;
  townGrew(g, t); // 🧭 a grown town picks a new building
  const isl = g.world.islandOf[t.y * g.world.n + t.x];
  t.sea0 = isCoastal(g, t) && (g.s.buildings ?? []).some(b => b.kind === 'dock' && (b.fish ?? 0) > 0 && g.world.islandOf[(b.y) * g.world.n + b.x] === isl) || undefined;
  return '';
}

/** Founding a town on a settlement site: $2,500, then 25% more for every town founded on the same island, 5% for every one elsewhere. */
export const FOUND_PRICE = 2500;
export function foundPrice(g: Game, p: Site): number {
  const isl = (s: Site) => g.world.islandOf[s.y * g.world.n + s.x], k = isl(p); let same = 0, other = 0;
  for (const s of g.s.sites) if (s.founded) { if (isl(s) === k) same++; else other++; }
  return Math.round(FOUND_PRICE * Math.pow(1.25, same) * Math.pow(1.05, other) / 50) * 50;
}

/** Turn a settlement site into a new hamlet. Returns why it can't, or ''. */
export function foundTown(g: Game, p: Site): string {
  if (p.kind !== 'plot') return 'Towns can only be founded on 🚩 settlement sites';
  const price = foundPrice(g, p);
  if (g.s.money < price) return `Need ${'$' + (price - Math.floor(g.s.money)).toLocaleString('en-US')} more to found a town`;
  g.s.money -= price;
  p.kind = 'town'; p.founded = true; p.pop = 15; p.lvl = 0; p.got = {};
  reveal(g, p.x, p.y, 3);
  return '';
}
