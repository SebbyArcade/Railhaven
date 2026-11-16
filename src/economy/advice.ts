import type { Game, Site } from '../state.ts';
import { aName, type Building, GOODS, type Good, INDUSTRIES, type IndustryKind, inputsOf, isFactory, isLinked, lockedText, MINES, nearestSpot, priceOf } from '../buildings/industries.ts';
import { orderOf, townLinked } from './towns.ts';
import { sellOffer } from './upgrades.ts';
import { trainRefund } from './dispatch.ts';
import { say } from '../core/news.ts';
import type { Train } from '../trains/train.ts';

/**
 * Early-game money help: how money is moving lately, the next building an open order needs, and a 💡 tip that names
 * why money is falling and one thing to do about it. No drawing here: the UI shows the tip.
 */

/** Seconds of money history kept (earned minus running costs, sampled every few seconds; not saved). */
const KEEP = 240;

export function sampleNet(g: Game) {
  const log = (g.netLog ??= []);
  log.push([g.s.t, (g.s.earned ?? 0) - (g.s.upkeep ?? 0)]);
  while (log.length > 2 && g.s.t - log[0]![0] > KEEP) log.shift();
}

/** Money made per minute over the last `secs` seconds (deliveries minus running costs), or null if not known yet. */
export function netPerMin(g: Game, secs: number): number | null {
  const log = g.netLog ?? []; if (log.length < 2) return null;
  const last = log.at(-1)!, first = log.find(e => last[0] - e[0] <= secs) ?? log[0]!;
  if (last[0] - first[0] < secs * 0.8) return null;
  return (last[1] - first[1]) * 60 / (last[0] - first[0]);
}

/** Towns on the railway (Ashford always counts). */
const linkedTowns = (g: Game) => g.s.sites.filter((t, k) => t.kind === 'town' && (k === 0 || townLinked(g, t)));

/** Goods an open order still waits for, with the town that wants each (the first town asking). */
function wanted(g: Game): Map<Good, Site> {
  const out = new Map<Good, Site>();
  for (const t of linkedTowns(g)) { const o = orderOf(g, t); for (const k of Object.keys(o) as Good[]) if ((t.got?.[k] ?? 0) < o[k]! && !out.has(k)) out.set(k, t); }
  return out;
}

/** Is there an uncovered deposit this mine fits on? (checked at most every 30 game seconds) */
function canMine(g: Game, kind: IndustryKind): boolean {
  const c = (g.mineOk ??= new Map()), hit = c.get(kind);
  if (hit && g.s.t - hit.at < 30) return hit.ok;
  const a = g.s.sites[0]!, ok = !!nearestSpot(g, kind, a.x, a.y);
  c.set(kind, { at: g.s.t, ok }); return ok;
}

export interface Step { kind: IndustryKind; price: number; good: Good; town: Site }

/**
 * The cheapest building that would let an open order move on: it makes a wanted good nobody makes yet, and if it is a
 * factory, something on the railway already makes what it needs.
 */
export function neededStep(g: Game): Step | null {
  const bs = g.s.buildings ?? [];
  const made = (k: Good) => bs.some(b => INDUSTRIES[b.kind].makes === k && (isLinked(g, b) || !isFactory(b.kind)));
  let best: Step | null = null;
  for (const [good, town] of wanted(g)) {
    if (made(good)) continue;
    for (const kind of Object.keys(INDUSTRIES) as IndustryKind[]) {
      if (INDUSTRIES[kind].makes !== good || kind === 'dock' || lockedText(g, kind)) continue;
      if (isFactory(kind) && !inputsOf(kind).every(i => bs.some(b => INDUSTRIES[b.kind].makes === i && isLinked(g, b)))) continue;
      if (MINES.has(kind) && !canMine(g, kind)) continue; // no uncovered deposit for it yet
      const price = priceOf(g, kind, g.world.islandOf[town.y * g.world.n + town.x]);
      if (!best || price < best.price) best = { kind, price, good, town };
    }
  }
  return best;
}

/** Money the player could raise now by selling stock. */
const sellable = (g: Game) => (g.s.buildings ?? []).reduce((a, b) => a + sellOffer(b).pay, 0);

/** At most one board grant this often (seconds). */
export const GRANT_GAP = 600;
/** Out of reach: at the money made lately it would take longer than this (minutes) to afford the needed building. */
export const FAR_MIN = 15;

/** Minutes until the player can afford the step at the rate money came in over the last `secs` (Infinity when not growing). */
export function minutesTo(g: Game, price: number, secs: number): number | null {
  const net = netPerMin(g, secs); if (net === null) return null;
  const gap = price - g.s.money - sellable(g);
  return gap <= 0 ? 0 : net <= 0 ? Infinity : gap / net;
}

/**
 * No-fail for a slow start: the building an open order needs costs more than the player has (selling stock included),
 * and at the money made over the last three minutes it would take more than 15 minutes to get there (or never). The
 * railway board pays the difference, at most once every ten minutes. A gift.
 */
export function checkGrant(g: Game): number {
  if (g.s.t - (g.s.grantAt ?? -1e9) < GRANT_GAP) return 0;
  const step = neededStep(g); if (!step) return 0;
  const m = minutesTo(g, step.price, 180); if (m === null || m <= FAR_MIN) return 0;
  const add = Math.ceil((step.price - g.s.money) / 100) * 100;
  g.s.money += add; g.s.grantAt = g.s.t; g.s.grantFor = step.kind;
  say(g, `🆘 The railway board gives you $${add.toLocaleString('en-US')} for ${aName(INDUSTRIES[step.kind].name)}, so ${step.town.name} can get ${GOODS[step.good].name.toLowerCase()}. It's a gift, not a loan`, { kind: 'town', id: step.town.id });
  return add;
}

export interface Tip { text: string; go: { kind: 'build'; what: IndustryKind } | { kind: 'bld'; id: number } | { kind: 'train'; id: number } | { kind: 'orders' } }

/** A train with nothing paying to do for a while. */
const workless = (g: Game): Train | undefined => g.s.trains.filter(t => !t.job && !t.cargo && (t.noWork ?? 0) > 60).sort((a, b) => (b.noWork ?? 0) - (a.noWork ?? 0))[0];

/** Why money falls: the good most trains carried lately goes to a town whose order for it is full. */
function cause(g: Game): string {
  const by = new Map<string, number>();
  for (const t of g.s.trains) if (t.lastPay && t.lastPay.to.kind === 'town' && g.s.t - t.lastPay.at < 120) { const k = `${t.lastPay.to.id}:${t.lastPay.good}`; by.set(k, (by.get(k) ?? 0) + 1); }
  const top = [...by].sort((a, b) => b[1] - a[1])[0]; if (!top) return '';
  const [id, good] = top[0].split(':') as [string, Good], town = g.s.sites.find(s => s.id === +id); if (!town) return '';
  const o = orderOf(g, town)[good];
  if (o !== undefined && (town.got?.[good] ?? 0) < o) return '';
  return `${town.name} has all the ${GOODS[good].icon} ${GOODS[good].name.toLowerCase()} its order needs, so it pays little now. `;
}

/** 💡 A tip while money is falling: why, and one thing to do. Null when all is well or tips are off. */
export function moneyTip(g: Game): Tip | null {
  if (g.s.tipsOff || g.s.t < 90) return null;
  const net = netPerMin(g, 60), granted = g.s.grantFor && (g.s.buildings ?? []).every(b => b.kind !== g.s.grantFor) && g.s.t - (g.s.grantAt ?? -1e9) < 300;
  // the needed building is not about to be affordable from deliveries alone (selling stock may be the way: the tip says so)
  const step = neededStep(g), net2 = netPerMin(g, 120), far = !!step && g.s.money < step.price && net2 !== null && (net2 <= 0 || (step.price - g.s.money) / net2 > 5);
  const shown = g.s.t - (g.tipAt ?? -1e9) < 45; // once up, a tip stays a while (no flicker as money goes up and down)
  // only while money is barely going up and the next needed building is out of reach (never just because money dipped)
  const short = !!step && g.s.money < step.price && net !== null && net < 0;
  if (!granted && !far && !shown && !short) return null;
  const tip = pickTip(g, step);
  if (tip && !shown) g.tipAt = g.s.t;
  return tip;
}

function pickTip(g: Game, step: Step | null): Tip | null {
  const why = cause(g);
  if (step && g.s.money >= step.price) {
    const w = GOODS[step.good];
    return { text: `${why}🏗 Build ${/^[AEIOU]/.test(INDUSTRIES[step.kind].name) ? 'an' : 'a'} ${INDUSTRIES[step.kind].icon} ${INDUSTRIES[step.kind].name} ($${step.price.toLocaleString('en-US')}): ${step.town.name} wants ${w.icon} ${w.name.toLowerCase()}`, go: { kind: 'build', what: step.kind } };
  }
  if (step && g.s.money + sellable(g) >= step.price) {
    const all = (g.s.buildings ?? []).filter(x => sellOffer(x).pay > 0).sort((p, q) => sellOffer(q).pay - sellOffer(p).pay) as Building[];
    // the fewest sales that together reach the price, biggest first
    const pick: Building[] = []; let got = g.s.money;
    for (const b of all) { if (got >= step.price) break; pick.push(b); got += sellOffer(b).pay; }
    const b = pick[0]!, o = sellOffer(b), k = INDUSTRIES[b.kind].makes as Good;
    if (pick.length === 1) return { text: `${why}💸 Sell ${o.n} ${GOODS[k].icon} at the ${INDUSTRIES[b.kind].name} for $${o.pay.toLocaleString('en-US')}: then ${aName(INDUSTRIES[step.kind].name)} is in reach`, go: { kind: 'bld', id: b.id } };
    const names = pick.map(x => `${INDUSTRIES[x.kind].icon} ${INDUSTRIES[x.kind].name}`), sum = pick.reduce((a, x) => a + sellOffer(x).pay, 0);
    return { text: `${why}💸 Sell the stock at your ${names.slice(0, -1).join(', ')} and ${names.at(-1)} ($${sum.toLocaleString('en-US')} together): then ${aName(INDUSTRIES[step.kind].name)} is in reach. Start with the ${INDUSTRIES[b.kind].name} (+$${o.pay.toLocaleString('en-US')})`, go: { kind: 'bld', id: b.id } };
  }
  const t = workless(g);
  if (t && g.s.trains.length > 1) return { text: `${why}🚂 Train ${t.id} has had no paying work for a while: sell it for $${trainRefund(g).toLocaleString('en-US')}`, go: { kind: 'train', id: t.id } };
  if (step) return { text: `${why}🪙 Save up for ${/^[AEIOU]/.test(INDUSTRIES[step.kind].name) ? 'an' : 'a'} ${INDUSTRIES[step.kind].icon} ${INDUSTRIES[step.kind].name} ($${step.price.toLocaleString('en-US')}): ${step.town.name} wants ${GOODS[step.good].icon} ${GOODS[step.good].name.toLowerCase()}`, go: { kind: 'orders' } };
  return why ? { text: `${why}📋 See what your towns want next`, go: { kind: 'orders' } } : null;
}
