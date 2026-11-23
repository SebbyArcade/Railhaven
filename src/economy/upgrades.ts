import { perks } from '../progress/prizes.ts';
import type { Game } from '../state.ts';
import type { Train } from '../trains/train.ts';
import { aName, type Building, GOODS, type Good, growsTracks, INDUSTRIES, isFactory, isLinked, stripError, tracksOf, yardSquares } from '../buildings/industries.ts';
import { type Dest, DF, PAY, siteOf, bldOf } from './shipping.ts';
import { orderOf } from './towns.ts';
import { isleMembers, railIsle, sameRail } from '../track/isles.ts';

// ---- building levels

export const MAX_LVL = 3;
/** Railway level 4 lets industries and factories grow to level 4, Railway level 6 to level 5 (docks stop at 3). */
export const maxLvlOf = (g: Game, b: Building) => b.kind === 'dock' ? MAX_LVL : MAX_LVL + ((g.s.rlv ?? 0) >= 4 ? 1 : 0) + ((g.s.rlv ?? 0) >= 6 ? 1 : 0);
/** the Railway level that lets a building grow past this level, or 0 if none does */
export const lvlUnlockAt = (b: Building) => b.kind === 'dock' ? 0 : b.lvl === 3 ? 4 : b.lvl === 4 ? 6 : 0;
/** Express engines (Railway levels 5 and 8): every train 15% faster each time. */
/** Express speed: Railway levels 5 and 8, and 🌟 prize engines. */
export const expressMul = (g: Game) => ((g.s.rlv ?? 0) >= 5 ? 1.15 : 1) * ((g.s.rlv ?? 0) >= 8 ? 1.15 : 1) * perks(g).spd;

/** Price to take a building up one level: industries 1.5×, 3×, 6×, 12× their base price, factories $3,000, $7,500, $18,000, $40,000. */
export function levelPrice(b: Building): number {
  if (b.kind === 'dock') return [8000, 15000][b.lvl - 1] ?? Infinity;
  if (isFactory(b.kind)) return [3000, 7500, 18000, 40000][b.lvl - 1] ?? Infinity;
  return Math.round(INDUSTRIES[b.kind].price * ([1.5, 3, 6, 12][b.lvl - 1] ?? Infinity) / 50) * 50;
}

/** What the next level gives, in plain words. */
export const levelGain = (b: Building) => (b.kind === 'dock' ? `reaches ${[70, 110][b.lvl - 1] ?? ''} squares by sea` : isFactory(b.kind) ? 'works faster, holds more' : '+50% output, +40 storage') + (growsTracks(b.kind) && tracksOf(b) < Math.min(4, b.lvl + 2) ? `, ${['', '', '', '3rd', '4th'][b.lvl + 2]} loading track` : '');

export function upgradeBuilding(g: Game, b: Building): string {
  if (b.lvl >= maxLvlOf(g, b)) return lvlUnlockAt(b) ? `Railway level ${lvlUnlockAt(b)} lets it grow bigger: fill more town orders` : 'It is at full size: build a second one to make more';
  const p = levelPrice(b);
  if (g.s.money < p) return `Need $${(p - Math.floor(g.s.money)).toLocaleString('en-US')} more`;
  const more = growsTracks(b.kind) && tracksOf(b) < Math.min(4, b.lvl + 2);
  if (more && tracksOf(b) < 3) { const e = stripError(g, b); if (e) return `No room for another loading track: ${e}`; }
  g.s.money -= p; b.lvl++; b.paid = (b.paid ?? 0) + p;
  if (more) b.tracks = Math.min(4, b.lvl + 1);
  return '';
}

// ---- fishing (docks)

/** Dock fishing levels: boats, a bigger fleet, then shellfish traps as well (the old game's prices). */
export const FISHING = [
  { icon: '🎣', name: 'Fishing boats', price: 3000, text: 'boats catch 🐟 30 a minute off the dock' },
  { icon: '⛵', name: 'Bigger fleet', price: 6000, text: '🐟 48 a minute' },
  { icon: '🦞', name: 'Shellfish traps', price: 12000, text: 'adds 🦞 18 a minute' },
];
/** Catch per second at a fishing level. */
export const catchOf = (lvl: number): { fish: number; shellfish: number } => ({ fish: lvl >= 2 ? 0.8 : lvl >= 1 ? 0.5 : 0, shellfish: lvl >= 3 ? 0.3 : 0 });

export function buyFishing(g: Game, b: Building): string {
  const l = b.fish ?? 0, f = FISHING[l];
  if (!f) return 'Fishing is at its top level';
  if (g.s.money < f.price) return `Need $${(f.price - Math.floor(g.s.money)).toLocaleString('en-US')} more`;
  g.s.money -= f.price; b.fish = l + 1; b.paid = (b.paid ?? 0) + f.price;
  return '';
}

// ---- selling stock (only when the player chooses)

export const SELL_SHARE = 0.75, SELL_PRICE = 0.6;

/** What selling now gives: three quarters of the stock at 60% of its value. */
export function sellOffer(b: Building): { n: number; pay: number } {
  const n = Math.floor(b.stock * SELL_SHARE), k = INDUSTRIES[b.kind].makes;
  return { n, pay: Math.round(n * GOODS[k].value * SELL_PRICE) };
}

export function sellStock(g: Game, b: Building): string {
  const o = sellOffer(b); if (o.n <= 0) return 'Nothing ready to sell';
  b.stock -= o.n; g.s.money += o.pay; g.s.earned = (g.s.earned ?? 0) + o.pay;
  return '';
}

// ---- removing a building

/** Half of what was paid for it (building and levels) comes back. */
export const refundOf = (b: Building) => Math.round((b.paid ?? INDUSTRIES[b.kind].price) / 2 / 10) * 10;

export function removeBuilding(g: Game, b: Building): string {
  const yard = new Set(yardSquares(g.world.n, b));
  if (g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]!.squares.some(q => yard.has(q))))) return 'A train is in its yard: wait until it leaves';
  if ((g.s.ships ?? []).some(s => s.to === b.id || (s.to === undefined && s.at === b.id) || s.hold.some(q => q.to === b.id))) return 'A ship is at this dock or sailing to it: wait until it has gone';
  for (const t of g.s.trains) if (t.job && (t.job.src === b.id || (t.job.to.kind === 'bld' && t.job.to.id === b.id))) {
    if (t.job.phase === 'toDrop' || t.job.phase === 'unloading') t.job.to = { kind: 'town', id: g.s.sites[0]!.id }; // keep the load: it goes to a town
    else { t.job = undefined; t.dest = undefined; t.plan = []; }
  }
  g.s.money += refundOf(b);
  g.s.buildings = (g.s.buildings ?? []).filter(x => x !== b);
  g.s.rush = (g.s.rush ?? []).filter(r => !(r.to.kind === 'bld' && r.to.id === b.id));
  return '';
}

// ---- fleet upgrades, bought separately for each island (trains never cross the sea by themselves)

export type FleetKey = 'wag' | 'eng' | 'rep';
export const FLEET: Record<FleetKey, { icon: string; name: string; what: string; lv: number[]; price: number[]; text: (l: number) => string }> = {
  wag: { icon: '🚃', name: 'Bigger wagons', what: 'every train carries more', lv: [1, 1.5, 2.25, 3.25], price: [4500, 12000, 30000], text: l => `${Math.round(20 * [1, 1.5, 2.25, 3.25][l]!)} per load` },
  eng: { icon: '⚙', name: 'Stronger engines', what: 'every train runs faster', lv: [1, 1.25, 1.5, 1.8], price: [6000, 15000, 37500], text: l => `${['steam', 'fast steam', 'diesel', 'express diesel'][l]} · ×${[1, 1.25, 1.5, 1.8][l]} speed` },
  rep: { icon: '🔧', name: 'Repair works', what: 'well-kept trains cost less to run', lv: [1, 0.75, 0.55], price: [7500, 22500], text: l => `running cost −${[0, 25, 45][l]}%` },
};
/**
 * An island's upgrade level (Ashford Isle when no island is given). Islands joined by a 🌉 bridge share their
 * upgrades (trains drive across): the best level any of them bought counts.
 */
export const fleetLvl = (g: Game, k: FleetKey, isl = g.world.home) => isl < 0 ? g.s.fleetI?.[isl]?.[k] ?? 0 : Math.max(0, ...isleMembers(g, isl).map(i => g.s.fleetI?.[i]?.[k] ?? 0));
export const fleetMulOf = (g: Game, k: FleetKey, isl = g.world.home) => FLEET[k].lv[fleetLvl(g, k, isl)]!;

/** The island a train works on: where its engine stands, or the last land it stood on while it crosses a bridge (islands joined by bridges count as one). */
const lastIsl = new WeakMap<Train, number>();
export function fleetIsl(g: Game, t: Train): number {
  const head = t.trail.at(-1), sq = head ? g.net.pieces[head.piece]?.squares.at(-1) : undefined;
  const k = sq === undefined ? -1 : g.world.islandOf[sq]!;
  if (k >= 0) { const r = railIsle(g, k); lastIsl.set(t, r); return r; }
  return lastIsl.get(t) ?? g.world.home;
}

/** How many units one train carries on an island. Longer trains (Railway level 7): +20% cargo on every train. */
export const trainCap = (g: Game, isl = g.world.home) => Math.round(20 * fleetMulOf(g, 'wag', isl) * ((g.s.rlv ?? 0) >= 7 ? 1.2 : 1) * perks(g).cap);
/** What this train carries (its island's wagons). */
export const capOf = (g: Game, t: Train) => trainCap(g, fleetIsl(g, t));
/** A train sets off when this many are ready (three quarters of a load). */
export const minLoad = (g: Game, isl = g.world.home) => Math.round(trainCap(g, isl) * 0.75);

export function buyFleet(g: Game, k: FleetKey, isl = g.world.home): string {
  const l = fleetLvl(g, k, isl), p = FLEET[k].price[l];
  if (p === undefined) return 'Already at the top level';
  if (g.s.money < p) return `Need $${(p - Math.floor(g.s.money)).toLocaleString('en-US')} more`;
  g.s.money -= p; ((g.s.fleetI ??= {})[isl < 0 ? isl : railIsle(g, isl)] ??= {})[k] = l + 1;
  return '';
}

/** Islands with their own upgrades to show: Ashford Isle first, then every island already upgraded or with trains on it. */
export function fleetIsls(g: Game): number[] {
  const s = new Set<number>([g.world.home, ...Object.keys(g.s.fleetI ?? {}).map(Number).filter(k => k >= 0).map(k => railIsle(g, k))]);
  for (const t of g.s.trains) s.add(fleetIsl(g, t));
  return [...s].filter(k => k >= 0);
}

/** Saves from before upgrades were per island: what was bought stays on every island already reached. */
export function fleetPerIsland(g: Game, reached: Iterable<number>) {
  const old = g.s.fleet; if (!old) return;
  for (const k of reached) { const cur = ((g.s.fleetI ??= {})[k] ??= {}); for (const f of Object.keys(old) as FleetKey[]) cur[f] = Math.max(cur[f] ?? 0, old[f] ?? 0); }
  g.s.fleet = undefined;
}

// ---- rush a good

/**
 * ⭐ Rush: every maker of the good that reaches the place sends there first (by ship when only another island makes it).
 * Paid up front: 30% of what the delivery normally pays (×1.5 when it must come by ship), at least $150, and dearer
 * the more rushes run at once (1st ×1.25, 2nd ×1.5, 3rd ×2). The undelivered part is refunded when it is cancelled.
 */
export const MAX_RUSH = 3, RUSH_FEE = 0.3, RUSH_SEA = 1.5, RUSH_MIN = 150, RUSH_STEP = 20;
export const RUSH_MUL = [1.25, 1.5, 2];
export interface Rush {
  to: Dest; good: Good;
  /** units still to come */
  left: number;
  /** units asked for in all, price paid per unit, and how many of the units still to come are paid for (older saves have none) */
  n?: number; pu?: number; paid?: number;
}

/** How many units a rush asks for: what the order still needs, or 50 for a factory. */
export function rushNeed(g: Game, to: Dest, k: Good): number {
  if (to.kind === 'town') { const t = siteOf(g, to.id); return t ? Math.max(0, (orderOf(g, t)[k] ?? 0) - (t.got?.[k] ?? 0)) : 0; }
  return bldOf(g, to.id) ? 50 : 0;
}

export const rushOf = (g: Game, to: Dest, k: Good) => (g.s.rush ?? []).find(r => r.to.kind === to.kind && r.to.id === to.id && r.good === k);

/** The island a town or building stands on. */
export function destIsland(g: Game, to: Dest): number {
  if (to.kind === 'town') { const t = siteOf(g, to.id); return t ? g.world.islandOf[t.y * g.world.n + t.x]! : -1; }
  const b = bldOf(g, to.id); return b ? g.world.islandOf[yardSquares(g.world.n, b)[0]!]! : -1;
}

/** No building of yours on that island (or an island joined to it by a bridge) makes the good: a rush has to come by ship. */
export function rushBySea(g: Game, to: Dest, k: Good): boolean {
  const isl = destIsland(g, to), n = g.world.n;
  return !(g.s.buildings ?? []).some(b => b.kind !== 'dock' && INDUSTRIES[b.kind].makes === k && !b.closed && sameRail(g, g.world.islandOf[yardSquares(n, b)[0]!]!, isl) && isLinked(g, b));
}

/** How many open buildings on the railway make the good (a rush needs at least one, on any island). */
export const rushMakers = (g: Game, k: Good) => (g.s.buildings ?? []).filter(b => b.kind !== 'dock' && INDUSTRIES[b.kind].makes === k && !b.closed && isLinked(g, b)).length;

/** Price per unit of a new rush (the next one to start: dearer when others already run). */
export function rushUnitPrice(g: Game, to: Dest, k: Good): number {
  const m = RUSH_MUL[Math.min(RUSH_MUL.length - 1, (g.s.rush ?? []).length)]!;
  return GOODS[k].value * DF(20) * PAY * RUSH_FEE * (rushBySea(g, to, k) ? RUSH_SEA : 1) * m;
}
const r10 = (v: number) => Math.round(v / 10) * 10;
/** What starting a rush costs now. */
export const rushFee = (g: Game, to: Dest, k: Good) => Math.max(RUSH_MIN, r10(rushUnitPrice(g, to, k) * rushNeed(g, to, k)));

/** Start a rush (paid up front). Returns why not, or '' when started. */
export function startRush(g: Game, to: Dest, k: Good): string {
  if (rushOf(g, to, k)) return '';
  if ((g.s.rush ?? []).length >= MAX_RUSH) return `At most ${MAX_RUSH} rushes at once: stop one first`;
  const n = rushNeed(g, to, k); if (n <= 0) return 'Nothing left to rush there';
  if (!rushMakers(g, k)) { const m = Object.values(INDUSTRIES).find(d => d.makes === k); return `Nothing on your railway makes ${GOODS[k].name.toLowerCase()} yet${m ? `: build ${aName(m.name)} first` : ''}`; }
  const fee = rushFee(g, to, k);
  if (g.s.money < fee) return `This rush costs $${fee.toLocaleString('en-US')}: you need $${Math.ceil(fee - g.s.money).toLocaleString('en-US')} more`;
  g.s.money -= fee;
  (g.s.rush ??= []).push({ to, good: k, left: n, n, pu: fee / n, paid: n });
  return '';
}

/** Cancel a rush: the part not delivered yet is refunded. Returns the refund. */
export function stopRush(g: Game, to: Dest, k: Good): number {
  const r = rushOf(g, to, k); if (!r) return 0;
  g.s.rush = g.s.rush!.filter(x => x !== r);
  const back = r.pu ? r10(r.pu * Math.min(Math.max(0, r.left), r.paid ?? 0)) : 0;
  g.s.money += back;
  return back;
}

/** Start (or stop) rushing a good to a place. */
export function toggleRush(g: Game, to: Dest, k: Good): string {
  if (rushOf(g, to, k)) { stopRush(g, to, k); return ''; }
  return startRush(g, to, k);
}

/** ＋20 / −20 on a factory rush, charged or refunded at the price paid. Returns why not, or the money: + paid, − given back. */
export function rushMore(g: Game, to: Dest, k: Good, d: number): string | number {
  const r = rushOf(g, to, k); if (!r || to.kind !== 'bld') return 'Only factory rushes change size';
  const n = r.n ?? r.left, pu = r.pu ?? 0;
  if (d > 0) {
    const add = Math.min(d, 500 - n); if (add <= 0) return 'A rush asks for 500 at most';
    const c = r10(pu * add); if (g.s.money < c) return `${add} more costs $${c.toLocaleString('en-US')}`;
    g.s.money -= c; r.n = n + add; r.left += add; r.paid = (r.paid ?? 0) + add; return c;
  }
  const cut = Math.min(-d, r.left - 10); if (cut <= 0) return 'Nearly there: cancel it instead';
  const b = r10(pu * Math.min(cut, r.paid ?? 0));
  g.s.money += b; r.n = n - cut; r.left -= cut; r.paid = Math.max(0, (r.paid ?? 0) - cut); return -b;
}

/** A delivery arrived: count it against a rush. Returns true when that finished the rush. */
export function rushDelivered(g: Game, to: Dest, k: Good, n: number): boolean {
  const r = rushOf(g, to, k); if (!r || n <= 0) return false;
  r.left -= n; r.paid = Math.max(0, Math.min(r.paid ?? 0, r.left));
  if (r.left <= 0 || rushNeed(g, to, k) <= 0) { g.s.rush = g.s.rush!.filter(x => x !== r); g.s.rushDone = (g.s.rushDone ?? 0) + 1; return true; }
  return false;
}
