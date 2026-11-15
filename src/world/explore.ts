import type { Game } from '../state.ts';
import { Rng } from '../core/rng.ts';
import { isRevealed, reveal } from './fog.ts';
import { T } from './terrain.ts';
import { buildingSquares, isLinked } from '../buildings/industries.ts';
import { townLinked } from '../economy/towns.ts';

/**
 * Exploring. Scouts set out from a town on the railway (on foot, over land) or from a dock (by boat, over water) along
 * a route the player draws, square by square; they uncover the land 3 squares either side as they go. A route that
 * meets the wrong ground under the fog ends there, and 90% of the unused part is paid back.
 *
 * Landmarks wait in the fog: old ruins (nearby industries make 10% more), lighthouses (ships near them sail 20%
 * faster), lookout hills (uncover far around) — each taken over once your track comes within 2 squares. Shipwrecks
 * lie off the coasts: a ship or scout boat passing by salvages them.
 */

// ---- landmarks

export type PoiKind = 'ruins' | 'lighthouse' | 'lookout' | 'wreck';
export interface Poi { id: number; kind: PoiKind; x: number; y: number; seen?: boolean; got?: boolean; pay?: number }
export const POI: Record<PoiKind, { icon: string; name: string; perk: string }> = {
  ruins: { icon: '🏛', name: 'Old ruins', perk: 'industries within 6 squares make 10% more' },
  lighthouse: { icon: '🗼', name: 'Lighthouse', perk: 'ships within 10 squares sail 20% faster' },
  lookout: { icon: '⛰', name: 'Lookout hill', perk: 'uncovers the land 10 squares around' },
  wreck: { icon: '⚓', name: 'Shipwreck', perk: 'a ship or scout boat passing by salvages it' },
};
export const CLAIM_R = 2, RUINS_R = 6, RUINS_BONUS = 1.1, LIGHT_R = 10, LIGHT_BONUS = 1.2, LOOKOUT_R = 10;

/** Place the landmarks for a map (deterministic from the seed). */
export function makePois(g: Game): Poi[] {
  const w = g.world, n = w.n, rng = new Rng(g.s.seed * 31 + 7), out: Poi[] = [];
  const busy = (x: number, y: number) => g.s.sites.some(s => Math.abs(s.x - x) <= 3 && Math.abs(s.y - y) <= 3) || out.some(p => Math.abs(p.x - x) <= 4 && Math.abs(p.y - y) <= 4);
  const coast = (i: number) => [i + 1, i - 1, i + n, i - n].some(j => w.ocean[j]);
  w.islands.forEach((isl, k) => {
    if (!isl.name) return;
    const sq: number[] = []; for (let i = 0; i < n * n; i++) if (w.islandOf[i] === k) sq.push(i);
    const pick = (ok: (i: number) => boolean, kind: PoiKind) => {
      for (let t = 0; t < 200; t++) {
        const i = sq[rng.int(sq.length)]!, x = i % n, y = (i / n) | 0;
        if (x < 2 || y < 2 || x >= n - 2 || y >= n - 2 || !ok(i) || busy(x, y)) continue;
        if (k === w.home && Math.hypot(x - w.cx, y - w.cy) < 12) continue; // not right beside Ashford
        out.push({ id: out.length + 1, kind, x, y }); return;
      }
    };
    pick(i => w.terr[i] === T.Grass || w.terr[i] === T.Forest, 'ruins');
    if (k !== w.home) pick(i => w.terr[i] !== T.Water && w.terr[i] !== T.Mountain && coast(i), 'lighthouse');
    pick(i => w.terr[i] === T.Hills, 'lookout');
    // a wreck in the water off this island's coast
    if (k !== w.home || rng.next() < 0.5) for (let t = 0; t < 200; t++) {
      const i = sq[rng.int(sq.length)]!; if (!coast(i)) continue;
      const a = rng.next() * Math.PI * 2, d = 3 + rng.int(4), x = Math.round((i % n) + Math.cos(a) * d), y = Math.round(((i / n) | 0) + Math.sin(a) * d);
      if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1 || !w.ocean[y * n + x]) continue;
      out.push({ id: out.length + 1, kind: 'wreck', x, y, pay: 1500 + rng.int(4) * 500 }); break;
    }
  });
  return out;
}

export const poisOf = (g: Game) => (g.s.pois ??= makePois(g));

const news = (g: Game, s: string) => (g.news ??= []).push(s);

/** Landmarks that came out of the fog say so once; those your track reaches are taken over. */
export function checkPois(g: Game) {
  const n = g.world.n;
  for (const p of poisOf(g)) {
    if (!p.seen && isRevealed(g, p.y * n + p.x)) { p.seen = true; if (p.kind !== 'wreck') news(g, `${POI[p.kind].icon} ${POI[p.kind].name} found: reach it with track to take it over (${POI[p.kind].perk})`); else news(g, `⚓ A shipwreck lies off the coast: a ship or scout boat passing by can salvage it`); }
    if (p.got || p.kind === 'wreck' || !p.seen) continue;
    let near = false;
    for (let dy = -CLAIM_R; dy <= CLAIM_R && !near; dy++) for (let dx = -CLAIM_R; dx <= CLAIM_R && !near; dx++) if (g.linked?.has((p.y + dy) * n + p.x + dx)) near = true;
    if (!near) continue;
    p.got = true;
    if (p.kind === 'lookout') reveal(g, p.x, p.y, LOOKOUT_R);
    news(g, `${POI[p.kind].icon} ${POI[p.kind].name} is yours: ${POI[p.kind].perk}`);
  }
}

/** Salvage a wreck within a square of (x, y), once. Returns the money found (0 if none). */
export function salvageAt(g: Game, x: number, y: number): number {
  for (const p of poisOf(g)) {
    if (p.kind !== 'wreck' || p.got || Math.abs(p.x - x) > 1.5 || Math.abs(p.y - y) > 1.5) continue;
    p.got = true; p.seen = true;
    const v = p.pay ?? 2000; g.s.money += v; g.s.earned = (g.s.earned ?? 0) + v;
    news(g, `⚓ Shipwreck salvaged: +$${v.toLocaleString('en-US')} in cargo and brass fittings`);
    return v;
  }
  return 0;
}

/** Output bonus from old ruins near a building (taken over ones only). */
export function ruinsMul(g: Game, x: number, y: number): number {
  return (g.s.pois ?? []).some(p => p.kind === 'ruins' && p.got && Math.hypot(p.x - x, p.y - y) <= RUINS_R) ? RUINS_BONUS : 1;
}

/** Speed bonus for a ship at (x, y) from a lighthouse that is yours. */
export function lightMul(g: Game, x: number, y: number): number {
  return (g.s.pois ?? []).some(p => p.kind === 'lighthouse' && p.got && Math.hypot(p.x - x, p.y - y) <= LIGHT_R) ? LIGHT_BONUS : 1;
}

// ---- scouts

export const SCOUT_CAP = { land: 36, sea: 50 }, SCOUT_SPEED = 2, SCOUT_R = 3, MAX_SCOUTS = 2;
export interface Scout { id: number; path: number[]; pos: number; boat: boolean; paid: number }

/** A route of n squares: 10 per square plus a little more for each square farther out; boats cost half again. */
export const scoutCost = (n: number, boat: boolean) => Math.round((10 * n + n * (n + 1)) * (boat ? 1.5 : 1));

/** Where scouts can set out from: towns on the railway (on foot) and docks on the railway (by boat). */
export function scoutStarts(g: Game): { sq: number; boat: boolean; name: string }[] {
  const n = g.world.n, out: { sq: number; boat: boolean; name: string }[] = [];
  for (const t of g.s.sites) if (t.kind === 'town' && townLinked(g, t)) out.push({ sq: t.y * n + t.x, boat: false, name: t.name ?? 'town' });
  for (const b of g.s.buildings ?? []) if (b.kind === 'dock' && isLinked(g, b)) {
    const w = buildingSquares(n, b).find(i => !g.world.terr[i]); if (w !== undefined) out.push({ sq: w, boat: true, name: 'the dock' });
  }
  return out;
}

/** Why the route can't go on to square i (next to its last square), or ''. Fogged squares are allowed: the scout finds out. */
export function scoutStepError(g: Game, path: number[], i: number, boat: boolean): string {
  const n = g.world.n, last = path.at(-1)!;
  if (Math.abs((i % n) - (last % n)) + Math.abs(((i / n) | 0) - ((last / n) | 0)) !== 1) return 'Routes go square by square';
  if (path.includes(i)) return 'The route already passes here';
  if (path.length - 1 >= (boat ? SCOUT_CAP.sea : SCOUT_CAP.land)) return `A ${boat ? 'boat' : 'scout'} goes at most ${boat ? SCOUT_CAP.sea : SCOUT_CAP.land} squares in one trip`;
  if (isRevealed(g, i)) {
    const water = !g.world.terr[i];
    if (boat && !water) return 'Boats stay on the water: scouts on foot explore the land from a town';
    if (!boat && water) return 'Scouts on foot stop at the water: send a boat from a dock';
  }
  return '';
}

export function sendScout(g: Game, path: number[], boat: boolean): Scout | string {
  if ((g.s.scouts ?? []).length >= MAX_SCOUTS) return `At most ${MAX_SCOUTS} scouts out at once: wait for one to come back`;
  const steps = path.length - 1; if (steps < 1) return 'Draw a route first';
  const c = scoutCost(steps, boat);
  if (c > g.s.money) return `Need $${(c - Math.floor(g.s.money)).toLocaleString('en-US')} more`;
  g.s.money -= c;
  const s: Scout = { id: g.s.nextId++, path, pos: 0, boat, paid: c };
  (g.s.scouts ??= []).push(s);
  return s;
}

/** Scouts walk (or sail) their routes, uncovering land as they go. */
export function tickScouts(g: Game, dt: number) {
  const list = g.s.scouts; if (!list?.length) return;
  const n = g.world.n;
  for (const s of list) {
    const before = Math.floor(s.pos);
    s.pos = Math.min(s.path.length - 1, s.pos + SCOUT_SPEED * dt);
    for (let k = before + 1; k <= Math.floor(s.pos); k++) {
      const i = s.path[k]!, water = !g.world.terr[i];
      if (water !== s.boat) { // wrong ground under the fog: the trip ends one square back
        s.pos = k - 1; const done = k - 1, left = s.path.length - 1 - done;
        const back = Math.round((s.paid - scoutCost(done, s.boat)) * 0.9);
        g.s.money += back; s.path = s.path.slice(0, k);
        news(g, `${s.boat ? '⛵ The boat' : '🚶 The scout'} met ${s.boat ? 'land' : 'water'} and turned back: ${left} squares unused, $${back.toLocaleString('en-US')} back`);
        break;
      }
      reveal(g, i % n, (i / n) | 0, SCOUT_R);
      if (s.boat) salvageAt(g, i % n, (i / n) | 0);
    }
  }
  const done = list.filter(s => s.pos >= s.path.length - 1);
  for (const s of done) { const e = s.path.at(-1)!; reveal(g, e % n, (e / n) | 0, SCOUT_R); }
  if (done.length) { g.s.scouts = list.filter(s => !done.includes(s)); news(g, `${done[0]!.boat ? '⛵ The boat' : '🚶 The scout'} is back: the map is drawn`); }
  checkPois(g);
}

/** Where a scout is drawn (square coordinates, fractional). */
export function scoutPlace(g: Game, s: Scout): { x: number; y: number } {
  const n = g.world.n, k = Math.min(s.path.length - 2, Math.floor(s.pos)), f = s.pos - Math.max(0, k);
  if (s.path.length < 2) return { x: s.path[0]! % n, y: (s.path[0]! / n) | 0 };
  const p = s.path[Math.max(0, k)]!, q = s.path[Math.max(0, k) + 1]!;
  return { x: (p % n) + ((q % n) - (p % n)) * f, y: ((p / n) | 0) + (((q / n) | 0) - ((p / n) | 0)) * f };
}
