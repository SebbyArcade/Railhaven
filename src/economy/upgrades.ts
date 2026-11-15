import type { Game } from '../state.ts';
import { type Building, GOODS, type Good, INDUSTRIES, isFactory, yardSquares } from '../buildings/industries.ts';
import { type Dest, siteOf, bldOf } from './shipping.ts';
import { orderOf } from './towns.ts';

// ---- building levels

export const MAX_LVL = 3;

/** Price to take a building up one level: industries 1.5× then 3× their base price, factories $3,000 then $7,500. */
export function levelPrice(b: Building): number {
  if (b.kind === 'dock') return [8000, 15000][b.lvl - 1] ?? Infinity;
  if (isFactory(b.kind)) return [3000, 7500][b.lvl - 1] ?? Infinity;
  return Math.round(INDUSTRIES[b.kind].price * ([1.5, 3][b.lvl - 1] ?? Infinity) / 50) * 50;
}

/** What the next level gives, in plain words. */
export const levelGain = (b: Building) => b.kind === 'dock' ? `reaches ${[70, 110][b.lvl - 1] ?? ''} squares by sea` : isFactory(b.kind) ? 'works faster, holds more' : '+50% output, +40 storage';

export function upgradeBuilding(g: Game, b: Building): string {
  if (b.lvl >= MAX_LVL) return 'It is at full size: build a second one to make more';
  const p = levelPrice(b);
  if (g.s.money < p) return `Need $${(p - Math.floor(g.s.money)).toLocaleString('en-US')} more`;
  g.s.money -= p; b.lvl++; b.paid = (b.paid ?? 0) + p;
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

// ---- engine shed fleet upgrades (the whole fleet; the old game's prices)

export type FleetKey = 'wag' | 'eng' | 'rep';
export const FLEET: Record<FleetKey, { icon: string; name: string; what: string; lv: number[]; price: number[]; text: (l: number) => string }> = {
  wag: { icon: '🚃', name: 'Bigger wagons', what: 'every train carries more', lv: [1, 1.5, 2.25, 3.25], price: [4500, 12000, 30000], text: l => `${Math.round(20 * [1, 1.5, 2.25, 3.25][l]!)} per load` },
  eng: { icon: '⚙', name: 'Stronger engines', what: 'every train runs faster', lv: [1, 1.25, 1.5, 1.8], price: [6000, 15000, 37500], text: l => `${['steam', 'fast steam', 'diesel', 'express diesel'][l]} · ×${[1, 1.25, 1.5, 1.8][l]} speed` },
  rep: { icon: '🔧', name: 'Repair works', what: 'well-kept trains cost less to run', lv: [1, 0.75, 0.55], price: [7500, 22500], text: l => `running cost −${[0, 25, 45][l]}%` },
};
export const fleetLvl = (g: Game, k: FleetKey) => g.s.fleet?.[k] ?? 0;
export const fleetMulOf = (g: Game, k: FleetKey) => FLEET[k].lv[fleetLvl(g, k)]!;
/** How many units one train carries. */
export const trainCap = (g: Game) => Math.round(20 * fleetMulOf(g, 'wag'));
/** A train sets off when this many are ready (three quarters of a load). */
export const minLoad = (g: Game) => Math.round(trainCap(g) * 0.75);

export function buyFleet(g: Game, k: FleetKey): string {
  const l = fleetLvl(g, k), p = FLEET[k].price[l];
  if (p === undefined) return 'Already at the top level';
  if (g.s.money < p) return `Need $${(p - Math.floor(g.s.money)).toLocaleString('en-US')} more`;
  g.s.money -= p; (g.s.fleet ??= {})[k] = l + 1;
  return '';
}

// ---- rush a good

export const MAX_RUSH = 3, RUSH_FEE = 0.3;
export interface Rush { to: Dest; good: Good; left: number }

/** How many units a rush asks for: what the order still needs, or 50 for a factory. */
export function rushNeed(g: Game, to: Dest, k: Good): number {
  if (to.kind === 'town') { const t = siteOf(g, to.id); return t ? Math.max(0, (orderOf(g, t)[k] ?? 0) - (t.got?.[k] ?? 0)) : 0; }
  return bldOf(g, to.id) ? 50 : 0;
}

export const rushOf = (g: Game, to: Dest, k: Good) => (g.s.rush ?? []).find(r => r.to.kind === to.kind && r.to.id === to.id && r.good === k);

/** Start (or stop) rushing a good to a place: its makers send there first; those deliveries pay 30% less. */
export function toggleRush(g: Game, to: Dest, k: Good): string {
  const cur = rushOf(g, to, k);
  if (cur) { g.s.rush = g.s.rush!.filter(r => r !== cur); return ''; }
  if ((g.s.rush ?? []).length >= MAX_RUSH) return `At most ${MAX_RUSH} rushes at once: stop one first`;
  const n = rushNeed(g, to, k); if (n <= 0) return 'Nothing left to rush there';
  (g.s.rush ??= []).push({ to, good: k, left: n });
  return '';
}

/** A delivery arrived: count it against a rush and return the fee to take off its pay. */
export function rushDelivered(g: Game, to: Dest, k: Good, n: number, pay: number): number {
  const r = rushOf(g, to, k); if (!r) return 0;
  r.left -= n;
  if (r.left <= 0 || rushNeed(g, to, k) <= 0) g.s.rush = g.s.rush!.filter(x => x !== r);
  return Math.round(pay * RUSH_FEE);
}
