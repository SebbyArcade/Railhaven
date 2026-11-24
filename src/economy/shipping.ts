import type { Game, Site } from '../state.ts';
import type { Train } from '../trains/train.ts';
import { bufOf, type Building, GOODS, type Good, INDUSTRIES, inputsOf, isFactory, isLinked, outputOf, yardSquares, yardSet } from '../buildings/industries.ts';
import { hallOf } from '../buildings/stations.ts';
import { orderOf, steadyFull, steadyGoods, townLinked, townRoom } from './towns.ts';
import { capOf, minLoad, trainCap } from './upgrades.ts';
import { isDock, islandOfB } from '../ships/docks.ts';
import { tradeRoom } from './trade.ts';
import { lanesFrom, seaBound, seaLanes } from '../ships/ships.ts';
import { isCrossing } from '../track/state.ts';
import { sameRail } from '../track/isles.ts';
import { depotTakes, fr } from '../frontier/frontier.ts';

/** Train load, and the least a train waits for before it sets off to collect (it leaves mostly full). */
/** a train's load before any wagon upgrade (the real one is trainCap(g)) */
export const TRAIN_CAP = 20;
export const MIN_LOAD = 15;
export const PAY = 0.41;
/** factories pay half for the raw goods they take */
export const FACP = 0.5;
/** distance factor: longer hauls pay more per unit */
export const DF = (d: number) => Math.pow(Math.max(8, d) / 8, 0.85);

/** Rail distance in squares from a set of squares to every track square (-1 = not joined). Cached until the track changes. */
export function railDist(g: Game, key: string, from: number[]): Int32Array {
  const c = (g.dist ??= new Map()).get(key); if (c) return c;
  const n = g.world.n, out = new Int32Array(n * n).fill(-1), q: [number, number, number][] = [];
  // a flat crossing is passed straight over, once along each line: it is visited per line, each with its own distance
  const seen = new Set<number>();
  for (const i of from) if (g.track.has(i)) { out[i] = 0; q.push([i, -1, 0]); }
  for (let h = 0; h < q.length; h++) {
    const [i, came, at] = q[h]!, sq = g.track.get(i)!, flat = came >= 0 && isCrossing(g.track, i);
    for (const [d, j] of [[0, i + 1], [1, i + n], [2, i - 1], [3, i - n]] as const) {
      if (!(sq.links & (1 << d)) || (flat && d !== came)) continue;
      const o = g.track.get(j); if (!o || !(o.links & (1 << ((d + 2) % 4)))) continue;
      if (isCrossing(g.track, j)) { if (seen.has(j * 2 + (d & 1))) continue; seen.add(j * 2 + (d & 1)); if (out[j] === -1) out[j] = at + 1; q.push([j, d, at + 1]); continue; }
      if (out[j] !== -1) continue;
      out[j] = at + 1; q.push([j, d, at + 1]);
    }
  }
  g.dist.set(key, out);
  return out;
}
export const bldDist = (g: Game, b: Building) => railDist(g, 'b' + b.id, yardSquares(g.world.n, b));

export type Dest = { kind: 'town' | 'bld'; id: number };
export type Why = 'order' | 'factory' | 'steady' | 'extra';
/** where a load goes; `sea` = the far dock when it goes to a dock for a ship */
export interface Ship { to: Dest; why: Why; d: number; /** 🧭 for a supply depot (track supplies) */ sup?: boolean; /** steady buying paid in full (the town's order waits on the outer islands) */ full?: boolean; /** a factory whose product an open order is waiting for */ feeds?: boolean; rush?: boolean; sea?: number; /** a second sea route: the far dock passes it on to this dock */ then?: number }
type Pair = { s: { b: Building; k: Good; sk: string }; b: Building; to: Dest; d: number; t?: Site; f?: Building };
type Targets = (from: Building, k: Good, d0: number, dist: Int32Array, push: (p: Omit<Pair, 's' | 'b'>) => void) => void;
/** The plan: building id → where its goods go; `docks` holds landed goods at docks, keyed `dockId/good`. */
export type Plan = Map<number, Ship> & { docks: Map<string, Ship> };
export const dockKey = (id: number, k: string) => `${id}/${k}`;

export const siteOf = (g: Game, id: number): Site | undefined => g.s.sites.find(s => s.id === id);
export const bldOf = (g: Game, id: number): Building | undefined => g.s.buildings?.find(b => b.id === id);
/** Where a train stops to unload: the town's station hall, or the factory's yard. */
export const destSquares = (g: Game, to: Dest): number[] => {
  if (to.kind === 'bld') { const b = bldOf(g, to.id); return b ? yardSquares(g.world.n, b) : []; }
  const t = siteOf(g, to.id); const h = t && hallOf(g.track, g.world.n, t, g.world.terr, yardSet(g)); return h ? h.squares : [];
};
export const destName = (g: Game, to: Dest) => to.kind === 'bld' ? `the ${INDUSTRIES[bldOf(g, to.id)?.kind ?? 'sawmill'].name}` : siteOf(g, to.id)?.name ?? 'a town';
export const goodOf = (b: Building): Good => INDUSTRIES[b.kind].makes;
export const PART_PAY: Record<Why, number> = { order: 1, factory: FACP, steady: 0.35, extra: 0.175 };
const key = (to: Dest, k: Good) => `${to.kind}${to.id}/${k}`;

/** Units already on their way to (or about to be collected for) each place and good. */
function enRoute(g: Game, skip?: Train): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of g.s.trains) {
    const j = t.job; if (!j || t === skip) continue;
    const k = key(j.to, j.good as Good);
    m.set(k, (m.get(k) ?? 0) + (t.cargo?.n ?? capOf(g, t)));
  }
  return m;
}

/** How much a factory still has room for of one of its inputs. */
export const factoryRoom = (f: Building, k: Good) => Math.max(0, bufOf(f) - (f.inbuf?.[k] ?? 0));

/**
 * The shipping plan: where each building sends its goods. Open orders and factories first, shared out
 * nearest-first so several camps don't all pile into one place; then towns that keep buying the good (steady
 * demand); else the nearest town on the railway (paid as extra).
 */
export function shipPlan(g: Game, skip?: Train): Plan {
  const out = new Map<string, Ship>(), n = g.world.n;
  const towns = g.s.sites.filter(t => t.kind === 'town' && townLinked(g, t));
  const bs = (g.s.buildings ?? []).filter(b => isLinked(g, b) && !b.closed); // ⛔ closed: sends nothing, takes nothing
  const facs = bs.filter(b => isFactory(b.kind));
  const way = enRoute(g, skip); // a train being loaded doesn't count its own load against the order it is fetching for
  // sources: every building's own good, and goods landed at docks (sent on by that island's trains)
  const srcs: { b: Building; k: Good; sk: string }[] = [];
  for (const b of bs) {
    if (!isDock(b)) srcs.push({ b, k: goodOf(b), sk: String(b.id) });
    else for (const k of Object.keys(b.landed ?? {}) as Good[]) if ((b.landed![k] ?? 0) > 0) srcs.push({ b, k, sk: dockKey(b.id, k) });
  }
  const targets: Targets = (from, k, d0, dist, push) => {
    for (const t of towns) { const h = hallOf(g.track, n, t, g.world.terr, yardSet(g))!, d = dist[h.squares[1]]!; if (d >= 0) push({ to: { kind: 'town', id: t.id }, d: d + d0, t }); }
    for (const f of facs) if (f !== from && inputsOf(f.kind).includes(k)) { const d = dist[yardSquares(n, f)[1]!]!; if (d >= 0) push({ to: { kind: 'bld', id: f.id }, d: d + d0, f }); }
  };
  const pairs: Pair[] = [];
  for (const s of srcs) targets(s.b, s.k, 0, bldDist(g, s.b), p => pairs.push({ ...p, s, b: s.b }));
  pairs.sort((p, q) => p.d - q.d);
  const left = new Map<string, number>();
  // a factory's inputs count as needed only while an open order on the railway waits for what it makes;
  // otherwise it is fed after the open orders, like a town that keeps buying
  const wanted = new Set<Good>();
  for (const t of towns) { const o = orderOf(g, t); for (const k of Object.keys(o) as Good[]) if (townRoom(g, t, k).order + tradeRoom(g, t, k) > 0) wanted.add(k); }
  const feeds = (f: Building) => wanted.has(goodOf(f));
  const room = (p: Pair, why: 'need' | 'steady'): number => {
    const k = p.s.k, kk = key(p.to, k) + why;
    if (!left.has(kk)) {
      let r = 0;
      if (p.f) r = (why === 'need') === feeds(p.f) ? factoryRoom(p.f, k) : 0;
      else if (why === 'need') r = (orderOf(g, p.t!)[k] ? townRoom(g, p.t!, k).order : 0) + tradeRoom(g, p.t!, k); // 🤝 a capital's trade order counts like its own order
      else r = p.t && steadyGoods(p.t, g).includes(k) ? Math.max(townRoom(g, p.t, k).steady, 1) : 0;
      // goods already on their way count against the room, so loads spread over the towns that buy them instead of
      // every train queuing at the nearest one
      left.set(kk, r - (way.get(key(p.to, k)) ?? 0));
    }
    return left.get(kk)!;
  };
  // rushed goods first: every maker of the good on the railway sends there until the rush is covered
  for (const r of g.s.rush ?? []) {
    let want = r.left - (way.get(key(r.to, r.good)) ?? 0);
    for (const p of pairs) {
      if (want <= 0) break;
      if (out.has(p.s.sk) || p.s.k !== r.good || p.to.kind !== r.to.kind || p.to.id !== r.to.id) continue;
      out.set(p.s.sk, { to: p.to, why: p.f ? 'factory' : 'order', d: p.d, rush: true });
      want -= trainCap(g, islandOfB(g, p.s.b));
    }
    // 🚢 nothing on its railway makes it: makers on another island send it to their dock first, and ships carry it over
    if (want > 0 && !pairs.some(p => p.s.k === r.good && p.to.kind === r.to.kind && p.to.id === r.to.id)) {
      const before = new Set(out.keys());
      const only: Targets = (from, k, d0, dist, push) => targets(from, k, d0, dist, p => { if (p.to.kind === r.to.kind && p.to.id === r.to.id) push(p); });
      seaNeeds(g, srcs.filter(s => s.k === r.good && !out.has(s.sk) && !isDock(s.b)), out, only, () => want);
      for (const [k, v] of out) if (!before.has(k)) v.rush = true;
    }
  }
  // pinned buildings: the player chose where their goods go
  for (const s of srcs) {
    const pin = s.b.pin; if (!pin || isDock(s.b) || out.has(s.sk)) continue;
    const p = pairs.find(q => q.s === s && q.to.kind === pin.kind && q.to.id === pin.id); if (!p) continue;
    const why: Why = p.f ? 'factory' : room(p, 'need') > 0 ? 'order' : room(p, 'steady') > 0 ? 'steady' : 'extra';
    out.set(s.sk, { to: p.to, why, d: p.d, ...(p.f && feeds(p.f) ? { feeds: true } : {}), ...(why === 'steady' && p.t && steadyFull(g, p.t, s.k) ? { full: true } : {}) });
    if (why === 'order' || why === 'factory') { const kk = key(p.to, s.k) + (p.f && !feeds(p.f) ? 'steady' : 'need'); room(p, p.f && !feeds(p.f) ? 'steady' : 'need'); left.set(kk, left.get(kk)! - trainCap(g, islandOfB(g, s.b))); }
  }
  // a maker that makes nothing (its fields all covered) and holds less than a train load can't fill an order: it
  // mustn't take the order's room from another maker that can (seed-4 playtest: Ashford's first order waited for ever)
  const dead = (b: Building) => !isDock(b) && outputOf(g, b) <= 0 && b.stock < minLoad(g, islandOfB(g, b));
  const take = (why: 'need' | 'steady') => {
    for (const p of pairs) {
      if (out.has(p.s.sk) || dead(p.s.b) || room(p, why) <= 0) continue;
      out.set(p.s.sk, { to: p.to, why: p.f ? 'factory' : why === 'steady' ? 'steady' : 'order', d: p.d, ...(p.f && why === 'need' ? { feeds: true } : {}), ...(why === 'steady' && p.t && steadyFull(g, p.t, p.s.k) ? { full: true } : {}) });
      const kk = key(p.to, p.s.k) + why; left.set(kk, left.get(kk)! - trainCap(g, islandOfB(g, p.s.b)));
    }
  };
  take('need');
  // across the sea a factory draws goods whether or not an order waits for its product (as before)
  seaNeeds(g, srcs.filter(s => !out.has(s.sk) && !isDock(s.b)), out, targets, (p: Pair, w: 'need') => p.f ? factoryRoom(p.f, p.s.k) - (way.get(key(p.to, p.s.k)) ?? 0) : room(p, w));
  // 🧭 Frontier: once no order wants it, wood and stone go to the nearest supply depot (track supplies) before any
  // town that merely keeps buying them (Sébastien, 2026-11-24: a camp beside Brinemoor fed Brinemoor, Ashford got none)
  if (fr(g)) for (const p of pairs) if (!out.has(p.s.sk) && p.t && !dead(p.s.b) && depotTakes(g, p.t, p.s.k)) out.set(p.s.sk, { to: p.to, why: 'steady', d: p.d });
  take('steady');
  for (const p of pairs) if (!out.has(p.s.sk) && p.t) out.set(p.s.sk, { to: p.to, why: 'extra', d: p.d });
  const plan = new Map<number, Ship>() as Plan; plan.docks = new Map();
  for (const [k, v] of out) if (k.includes('/')) plan.docks.set(k, v); else plan.set(+k, v);
  // 🧭 Frontier: wood and stone for a supply depot become track supplies, worth the trip whatever they pay
  if (fr(g)) for (const s of srcs) { const v = out.get(s.sk), t = v?.to.kind === 'town' ? siteOf(g, v.to.id) : undefined; if (v && t && v.why !== 'order' && depotTakes(g, t, s.k)) v.sup = true; }
  return plan;
}

/**
 * Goods nobody on their own island needs, but an order or factory on another island does: the train takes them
 * to a dock with a sea route there (paid like factory supply), and a ship carries them on. When no island one route
 * away needs them, an island two routes away may (🚢 long-haul imports): the first ship lands them at a dock in
 * between, which passes them on to the next ship without leaving the quay.
 */
function seaNeeds(g: Game, srcs: { b: Building; k: Good; sk: string }[], out: Map<string, Ship>, targets: Targets, room: (p: any, why: 'need') => number) {
  if (!srcs.length) return;
  const lanes = seaLanes(g); if (!lanes.length) return;
  const docks = (g.s.buildings ?? []).filter(b => isDock(b) && isLinked(g, b)), n = g.world.n;
  const bound = new Map<string, number>(); // units already heading to each far dock by sea, per good
  for (const s of srcs) {
    const dist = bldDist(g, s.b);
    let best: Ship | null = null, bt = Infinity, bk = '';
    for (const d1 of docks) {
      if (!sameRail(g, islandOfB(g, d1), islandOfB(g, s.b))) continue; // a dock on this island, or one a bridge joins to it
      const d1d = dist[yardSquares(n, d1)[1]!]!; if (d1d < 0) continue;
      for (const r of lanesFrom(g, d1.id, lanes)) {
        const d2 = docks.find(b => b.id === r.id)!, k2 = `${d2.id}/${s.k}`;
        if (sameRail(g, islandOfB(g, d2), islandOfB(g, s.b))) continue; // a bridge joins them: trains take it there
        if (!bound.has(k2)) bound.set(k2, seaBound(g, d2.id, s.k));
        targets(d2, s.k, 0, bldDist(g, d2), p => {
          if (p.t && !orderOf(g, p.t)[s.k] && !tradeRoom(g, p.t, s.k)) return; // towns: only open orders (and trade orders) draw goods across the sea
          if (room({ ...p, s, b: s.b }, 'need') - bound.get(k2)! <= 0) return;
          const tot = d1d + r.d + p.d;
          if (tot < bt) { bt = tot; bk = k2; best = { to: { kind: 'bld', id: d1.id }, why: 'factory', d: d1d, sea: d2.id }; }
        });
      }
    }
    if (!best) { // two routes away: by way of a dock that has a route on to the island that needs them
      const home = islandOfB(g, s.b);
      for (const d1 of docks) {
        if (!sameRail(g, islandOfB(g, d1), home)) continue;
        const d1d = dist[yardSquares(n, d1)[1]!]!; if (d1d < 0) continue;
        for (const r of lanesFrom(g, d1.id, lanes)) for (const r2 of lanesFrom(g, r.id, lanes)) {
          const d3 = docks.find(b => b.id === r2.id)!; if (d3.id === d1.id || sameRail(g, islandOfB(g, d3), home)) continue;
          const k3 = `${d3.id}/${s.k}`;
          if (!bound.has(k3)) bound.set(k3, seaBound(g, d3.id, s.k));
          targets(d3, s.k, 0, bldDist(g, d3), p => {
            if (p.t && !orderOf(g, p.t)[s.k] && !tradeRoom(g, p.t, s.k)) return;
            if (room({ ...p, s, b: s.b }, 'need') - bound.get(k3)! <= 0) return;
            const tot = d1d + r.d + r2.d + p.d;
            if (tot < bt) { bt = tot; bk = k3; best = { to: { kind: 'bld', id: d1.id }, why: 'factory', d: d1d, sea: r.id, then: d3.id }; }
          });
        }
      }
    }
    if (!best) continue;
    out.set(s.sk, best);
    bound.set(bk, bound.get(bk)! + trainCap(g, islandOfB(g, s.b)));
  }
}

/** Every place on the railway a building could send its goods, nearest first, with how it would be paid there. */
export function destinationsOf(g: Game, b: Building): { to: Dest; d: number; why: Why }[] {
  const n = g.world.n, k = goodOf(b), dist = bldDist(g, b), out: { to: Dest; d: number; why: Why }[] = [];
  for (const t of g.s.sites) {
    if (t.kind !== 'town' || !townLinked(g, t)) continue;
    const h = hallOf(g.track, n, t, g.world.terr, yardSet(g)); const d = h ? dist[h.squares[1]!]! : -1; if (d < 0) continue;
    const why: Why = (orderOf(g, t)[k] && townRoom(g, t, k).order > 0) || tradeRoom(g, t, k) > 0 ? 'order' : steadyGoods(t, g).includes(k) ? 'steady' : 'extra';
    out.push({ to: { kind: 'town', id: t.id }, d, why });
  }
  for (const f of g.s.buildings ?? []) {
    if (f === b || !isFactory(f.kind) || !inputsOf(f.kind).includes(k) || !isLinked(g, f) || f.closed) continue;
    const d = dist[yardSquares(n, f)[1]!]!; if (d >= 0) out.push({ to: { kind: 'bld', id: f.id }, d, why: 'factory' });
  }
  return out.sort((p, q) => p.d - q.d);
}

/** What a load of n units pays when delivered there. */
export const payFor = (k: Good, n: number, d: number, why: Why) => GOODS[k].value * DF(d) * PAY * n * PART_PAY[why];
