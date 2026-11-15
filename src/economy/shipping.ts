import type { Game, Site } from '../state.ts';
import { type Building, GOODS, type Good, INDUSTRIES, isLinked, yardSquares } from '../buildings/industries.ts';
import { hallOf } from '../buildings/stations.ts';
import { orderOf, steadyGoods, townLinked, townRoom } from './towns.ts';

/** Train load, and the least a train waits for before it sets off to collect (it leaves mostly full). */
export const TRAIN_CAP = 20;
export const MIN_LOAD = 15;
export const PAY = 0.41;
/** distance factor: longer hauls pay more per unit */
export const DF = (d: number) => Math.pow(Math.max(8, d) / 8, 0.85);

/** Rail distance in squares from a set of squares to every track square (-1 = not joined). Cached until the track changes. */
export function railDist(g: Game, key: string, from: number[]): Int32Array {
  const c = (g.dist ??= new Map()).get(key); if (c) return c;
  const n = g.world.n, out = new Int32Array(n * n).fill(-1), q: number[] = [];
  for (const i of from) if (g.track.has(i)) { out[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!, sq = g.track.get(i)!;
    for (const [d, j] of [[0, i + 1], [1, i + n], [2, i - 1], [3, i - n]] as const) {
      if (!(sq.links & (1 << d)) || out[j] !== -1) continue;
      const o = g.track.get(j); if (!o || !(o.links & (1 << ((d + 2) % 4)))) continue;
      out[j] = out[i]! + 1; q.push(j);
    }
  }
  g.dist.set(key, out);
  return out;
}
export const bldDist = (g: Game, b: Building) => railDist(g, 'b' + b.id, yardSquares(g.world.n, b));

export type Dest = { kind: 'town'; id: number };
export type Why = 'order' | 'steady' | 'extra';
export interface Ship { to: Dest; why: Why; d: number }

export const destSquares = (g: Game, to: Dest): number[] => { const t = siteOf(g, to.id); const h = t && hallOf(g.track, g.world.n, t); return h ? h.squares : []; };
export const siteOf = (g: Game, id: number): Site | undefined => g.s.sites.find(s => s.id === id);
export const goodOf = (b: Building): Good => INDUSTRIES[b.kind].makes;
export const PART_PAY: Record<Why, number> = { order: 1, steady: 0.35, extra: 0.175 };

/** Units already on their way to (or about to be collected for) each town and good. */
function enRoute(g: Game): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of g.s.trains) {
    const j = t.job; if (!j) continue;
    const k = `${j.to.id}/${j.good}`;
    m.set(k, (m.get(k) ?? 0) + (t.cargo?.n ?? TRAIN_CAP));
  }
  return m;
}

/**
 * The shipping plan: where each building sends its goods. Open orders first, shared out nearest-first so
 * several camps don't all pile into one town; then towns that keep buying the good (steady demand); else the
 * nearest town on the railway (paid as extra).
 */
export function shipPlan(g: Game): Map<number, Ship> {
  const out = new Map<number, Ship>(), n = g.world.n;
  const towns = g.s.sites.filter(t => t.kind === 'town' && townLinked(g, t));
  const bs = (g.s.buildings ?? []).filter(b => isLinked(g, b));
  const way = enRoute(g);
  const pairs: { b: Building; t: Site; d: number }[] = [];
  for (const b of bs) {
    const dist = bldDist(g, b);
    for (const t of towns) { const h = hallOf(g.track, n, t)!, d = dist[h.squares[1]]!; if (d >= 0) pairs.push({ b, t, d }); }
  }
  pairs.sort((p, q) => p.d - q.d);
  for (const why of ['order', 'steady'] as const) {
    const left = new Map<string, number>();
    for (const { b, t, d } of pairs) {
      if (out.has(b.id)) continue;
      const k = goodOf(b), key = `${t.id}/${k}`;
      if (why === 'order' && !orderOf(g, t)[k]) continue;
      if (why === 'steady' && !steadyGoods(t).includes(k)) continue;
      if (!left.has(key)) { const r = townRoom(g, t, k); left.set(key, (why === 'order' ? r.order : Math.max(r.steady, 1)) - (why === 'order' ? way.get(key) ?? 0 : 0)); }
      if (left.get(key)! <= 0) continue;
      out.set(b.id, { to: { kind: 'town', id: t.id }, why, d });
      left.set(key, left.get(key)! - TRAIN_CAP);
    }
  }
  for (const { b, t, d } of pairs) if (!out.has(b.id)) out.set(b.id, { to: { kind: 'town', id: t.id }, why: 'extra', d });
  return out;
}

/** What a load of n units pays when delivered there. */
export const payFor = (k: Good, n: number, d: number, why: Why) => GOODS[k].value * DF(d) * PAY * n * PART_PAY[why];
