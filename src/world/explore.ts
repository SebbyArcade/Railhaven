import type { Game } from '../state.ts';
import { Rng } from '../core/rng.ts';
import { isRevealed, reveal } from './fog.ts';
import { T } from './terrain.ts';
import { squareCost } from '../track/rules.ts';
import { buildingSquares, footprint, isLinked } from '../buildings/industries.ts';
import { townLinked } from '../economy/towns.ts';
import { type NewsGo, say } from '../core/news.ts';
import { poiGift } from '../frontier/frontier.ts';

/**
 * Exploring. Scouts set out from a town on the railway (on foot, over land) or from a dock (by boat, over water) along
 * a route the player draws, square by square; they uncover the land 3 squares either side as they go. A route that
 * meets the wrong ground under the fog ends there, and 90% of the unused part is paid back.
 *
 * Landmarks wait in the fog: old ruins (nearby buildings make 10% more), lighthouses (ships near them sail 20%
 * faster), lookout hills (uncover far around) — each taken over once your track comes within 2 squares. Shipwrecks
 * lie off the coasts: a ship or scout boat passing by salvages them.
 */

// ---- landmarks

export type PoiKind = 'ruins' | 'lighthouse' | 'lookout' | 'wreck' | 'halt' | 'falls' | 'ranger' | 'mill' | 'shaft' | 'camp';
export interface Poi { id: number; kind: PoiKind; x: number; y: number; seen?: boolean; got?: boolean; pay?: number }
export const POI: Record<PoiKind, { icon: string; name: string; perk: string }> = {
  ruins: { icon: '🏛', name: 'Old ruins', perk: 'buildings with any part within 6 squares make 10% more' },
  lighthouse: { icon: '🗼', name: 'Lighthouse', perk: 'ships within 10 squares sail 20% faster' },
  lookout: { icon: '⛰', name: 'Lookout hill', perk: 'uncovers the land 10 squares around, and the coast and towns of the nearest island across the sea' },
  wreck: { icon: '⚓', name: 'Shipwreck', perk: 'a ship or scout boat passing by salvages it' },
  halt: { icon: '🏚', name: 'Old halt', perk: 'its old rails and fittings are salvaged: +$2,000' },
  falls: { icon: '💧', name: 'Silver Falls', perk: 'tourists come: town orders within 12 squares pay 10% bigger rewards' },
  ranger: { icon: '🌲', name: 'Ranger hut', perk: 'lumber camps with any part within 8 squares make 10% more' },
  mill: { icon: '🌾', name: 'Old windmill', perk: 'wheat farms with any part within 8 squares make 10% more' },
  // frontier finds: only on islands across the sea
  shaft: { icon: '⛏', name: 'Old mine shaft', perk: 'mines and quarries with any part within 8 squares make 10% more' },
  camp: { icon: '🏕', name: "Explorer's camp", perk: "the explorer's notes mark everything still hidden on this island with a ?, and chart the coasts and towns of the 2 nearest islands" },
};
/** Landmarks found only on islands across the sea. */
export const FRONTIER: PoiKind[] = ['shaft', 'camp'];
/** how special a find is, for its discovery card: 0 interesting, 1 rare, 2 legendary */
export const POI_RARITY: Record<PoiKind, 0 | 1 | 2> = { ruins: 0, ranger: 0, mill: 0, shaft: 0, lookout: 1, halt: 1, lighthouse: 1, wreck: 1, camp: 1, falls: 2 };
export const RARITY = [{ icon: '⚪', name: 'Interesting find', col: '#d8d2c4' }, { icon: '🔵', name: 'Rare find', col: '#6fb4ff' }, { icon: '🟣', name: 'Legendary find', col: '#c58bff' }] as const;
export const HALT_PAY = 2000, FALLS_R = 12, FALLS_BONUS = 1.1, KIND_R = 8, KIND_BONUS = 1.1;
export const CLAIM_R = 2, RUINS_R = 6, RUINS_BONUS = 1.1, LIGHT_R = 10, LIGHT_BONUS = 1.2, LOOKOUT_R = 10, CAMP_R = 8;
/** How far a landmark's gift reaches, in squares (drawn as a circle when it is tapped); none for one-off gifts. */
export const POI_REACH: Partial<Record<PoiKind, number>> = { ruins: RUINS_R, lighthouse: LIGHT_R, lookout: LOOKOUT_R, falls: FALLS_R, ranger: KIND_R, mill: KIND_R, shaft: KIND_R };
/** How to take a landmark over, in plain words. */
export const CLAIM_TEXT = 'bring track into the dashed square around it (2 squares out, corners count too)';

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

/** The landmarks added later (old halt, falls, ranger hut, old windmill): own random stream, so maps made before keep theirs. */
export function morePois(g: Game, have: Poi[]): Poi[] {
  const w = g.world, n = w.n, rng = new Rng(g.s.seed * 53 + 11), out: Poi[] = [];
  const all = () => [...have, ...out];
  const busy = (x: number, y: number) => g.s.sites.some(s => Math.abs(s.x - x) <= 3 && Math.abs(s.y - y) <= 3) || all().some(p => Math.abs(p.x - x) <= 4 && Math.abs(p.y - y) <= 4);
  const lake = (i: number) => [i + 1, i - 1, i + n, i - n].some(j => w.terr[j] === T.Water && !w.ocean[j]);
  let id = Math.max(0, ...have.map(p => p.id));
  w.islands.forEach((isl, k) => {
    if (!isl.name) return;
    const sq: number[] = []; for (let i = 0; i < n * n; i++) if (w.islandOf[i] === k) sq.push(i);
    const pick = (ok: (i: number) => boolean, kind: PoiKind) => {
      for (let t = 0; t < 300; t++) {
        const i = sq[rng.int(sq.length)]!, x = i % n, y = (i / n) | 0;
        if (x < 2 || y < 2 || x >= n - 2 || y >= n - 2 || !ok(i) || busy(x, y)) continue;
        if (k === w.home && Math.hypot(x - w.cx, y - w.cy) < 12) continue;
        out.push({ id: ++id, kind, x, y }); return;
      }
    };
    if (rng.next() < 0.7) pick(i => w.terr[i] === T.Grass, 'halt');
    if (rng.next() < 0.6) pick(i => w.terr[i] === T.Hills || (w.terr[i] !== T.Water && w.terr[i] !== T.Mountain && lake(i)), 'falls');
    if (rng.next() < 0.7) pick(i => w.terr[i] === T.Forest, 'ranger');
    if (rng.next() < 0.6) pick(i => w.terr[i] === T.Grass, 'mill');
  });
  return out;
}

/**
 * Landmarks on the islands across the sea (own random stream per island, so maps made before keep theirs): every
 * named island but Ashford Isle may get an old mine shaft (by the mountains) and an explorer's camp. Islands that have
 * no landmark at all yet (the far seas an expedition found) get the whole set first. Only islands numbered `from` or
 * later are looked at (an expedition passes its first new island).
 */
export function frontierPois(g: Game, have: Poi[], from = 0): Poi[] {
  const w = g.world, n = w.n, out: Poi[] = [], all = () => [...have, ...out];
  const busy = (x: number, y: number) => g.s.sites.some(s => Math.abs(s.x - x) <= 3 && Math.abs(s.y - y) <= 3) || all().some(p => Math.abs(p.x - x) <= 4 && Math.abs(p.y - y) <= 4);
  const coast = (i: number) => [i + 1, i - 1, i + n, i - n].some(j => w.ocean[j]);
  const land = (i: number) => w.terr[i] !== T.Water && w.terr[i] !== T.Mountain;
  const byHills = (i: number) => land(i) && [i + 1, i - 1, i + n, i - n, i + 2, i - 2, i + 2 * n, i - 2 * n].some(j => w.terr[j] === T.Mountain);
  let id = Math.max(0, ...have.map(p => p.id));
  const on = new Map<number, Set<PoiKind>>();
  for (const p of have) { const k = w.islandOf[p.y * n + p.x]!; if (!on.has(k)) on.set(k, new Set()); on.get(k)!.add(p.kind); }
  w.islands.forEach((isl, k) => {
    if (!isl.name || k === w.home || k < from) return;
    const kinds = on.get(k) ?? new Set<PoiKind>();
    if (FRONTIER.some(f => kinds.has(f))) return; // already done
    const rng = new Rng(g.s.seed * 97 + k * 131 + 5);
    const sq: number[] = []; for (let i = 0; i < n * n; i++) if (w.islandOf[i] === k) sq.push(i);
    const pick = (ok: (i: number) => boolean, kind: PoiKind) => {
      for (let t = 0; t < 300; t++) {
        const i = sq[rng.int(sq.length)]!, x = i % n, y = (i / n) | 0;
        if (x < 2 || y < 2 || x >= n - 2 || y >= n - 2 || !ok(i) || busy(x, y)) continue;
        out.push({ id: ++id, kind, x, y }); return true;
      }
      return false;
    };
    if (!kinds.size) { // a far-sea island: the landmarks every island has
      pick(i => w.terr[i] === T.Grass || w.terr[i] === T.Forest, 'ruins');
      pick(i => land(i) && coast(i), 'lighthouse');
      pick(i => w.terr[i] === T.Hills, 'lookout');
      if (rng.next() < 0.7) pick(i => w.terr[i] === T.Grass, 'halt');
      if (rng.next() < 0.5) pick(i => w.terr[i] === T.Hills, 'falls');
      if (rng.next() < 0.6) pick(i => w.terr[i] === T.Forest, 'ranger');
      if (rng.next() < 0.5) pick(i => w.terr[i] === T.Grass, 'mill');
      for (let t = 0; t < 200; t++) { // a wreck in the water off its coast
        const i = sq[rng.int(sq.length)]!; if (!coast(i)) continue;
        const a = rng.next() * Math.PI * 2, d = 3 + rng.int(4), x = Math.round((i % n) + Math.cos(a) * d), y = Math.round(((i / n) | 0) + Math.sin(a) * d);
        if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1 || !w.ocean[y * n + x]) continue;
        out.push({ id: ++id, kind: 'wreck', x, y, pay: 1500 + rng.int(4) * 500 }); break;
      }
    }
    if (rng.next() < 0.75) pick(byHills, 'shaft');
    const inland = (i: number) => [i + 1, i - 1, i + n, i - n, i + n + 1, i + n - 1, i - n + 1, i - n - 1].every(j => w.terr[j] !== T.Water); // room round it for track
    if (sq.length >= 60 && rng.next() < 0.85) pick(i => land(i) && w.terr[i] !== T.Forest && inland(i), 'camp');
  });
  return out;
}

/** The landmark a tap on square i means: one within a square of it, but never when a building stands on i
 *  (a Lumber Camp built beside old ruins opened the ruins instead of its own card, he couldn't tap it). */
export function poiTapAt(g: Game, i: number): Poi | undefined {
  const n = g.world.n, x = i % n, y = (i / n) | 0;
  if (g.s.buildings?.some(b => footprint(n, b).includes(i))) return undefined;
  return poisOf(g).find(p => p.seen && Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1 && !(p.kind === 'wreck' && p.got));
}
export const poisOf = (g: Game) => {
  if (!g.s.pois) g.s.pois = makePois(g);
  if (!g.s.poiV) { g.s.poiV = 2; g.s.pois.push(...morePois(g, g.s.pois)); } // older games get the new landmarks too
  if (g.s.poiV < 3) { g.s.poiV = 3; g.s.pois.push(...frontierPois(g, g.s.pois)); } // and the frontier finds across the sea
  return g.s.pois;
};

/** Islands whose explorer's camp is yours: everything still hidden there shows as a ? on the map. */
export const toldIslands = (g: Game) => new Set((g.s.pois ?? []).filter(p => p.kind === 'camp' && p.got).map(p => g.world.islandOf[p.y * g.world.n + p.x]!));

const news = (g: Game, s: string, go?: NewsGo) => say(g, s, go);

/** Landmarks that came out of the fog say so once; those your track reaches are taken over. */
export function checkPois(g: Game) {
  const n = g.world.n;
  for (const p of poisOf(g)) {
    if (!p.seen && isRevealed(g, p.y * n + p.x)) { p.seen = true; (g.found ??= []).push(p.id); if (p.kind !== 'wreck') news(g, `${POI[p.kind].icon} ${POI[p.kind].name} found: ${CLAIM_TEXT} to take it over (${POI[p.kind].perk})`, { kind: 'sq', x: p.x, y: p.y }); else news(g, `⚓ A shipwreck lies off the coast: a ship or scout boat passing by can salvage it`, { kind: 'sq', x: p.x, y: p.y }); }
    if (p.got || p.kind === 'wreck' || !p.seen) continue;
    let near = false;
    for (let dy = -CLAIM_R; dy <= CLAIM_R && !near; dy++) for (let dx = -CLAIM_R; dx <= CLAIM_R && !near; dx++) if (g.linked?.has((p.y + dy) * n + p.x + dx)) near = true;
    if (!near) continue;
    p.got = true;
    if (p.kind === 'lookout') { reveal(g, p.x, p.y, LOOKOUT_R); chartIslands(g, p.x, p.y, 1); }
    if (p.kind === 'halt') { g.s.money += HALT_PAY; g.s.earned = (g.s.earned ?? 0) + HALT_PAY; }
    if (p.kind === 'camp') { reveal(g, p.x, p.y, CAMP_R); chartIslands(g, p.x, p.y, 2); }
    news(g, `${POI[p.kind].icon} ${POI[p.kind].name} is yours: ${POI[p.kind].perk}${poiGift(g, p.kind, p.x, p.y)}`, { kind: 'sq', x: p.x, y: p.y });
  }
}

/**
 * 🗺 A camp's notes or a lookout's view across the sea (Sébastien, 2026-11-24: since landing crews map a whole island,
 * camps and lookouts did little): the coasts and towns of the nearest islands not yet reached come out of the fog,
 * so they point the way to the next crossing.
 */
export function chartIslands(g: Game, x: number, y: number, count: number) {
  const w = g.world, n = w.n, here = w.islandOf[y * n + x];
  const near = w.islands.map((isl, k) => ({ k, isl })).filter(o => o.k !== here && o.k !== w.home && o.isl.name)
    .sort((a, b) => Math.hypot(a.isl.cx - x, a.isl.cy - y) - Math.hypot(b.isl.cx - x, b.isl.cy - y)).slice(0, count);
  const ks = new Set(near.map(o => o.k));
  for (let i = 0; i < n * n; i++) {
    if (!ks.has(w.islandOf[i]!)) continue;
    if ([i + 1, i - 1, i + n, i - n].some(j => w.terr[j] === T.Water)) reveal(g, i % n, (i / n) | 0, 1);
  }
  for (const s of g.s.sites) if (s.kind === 'town' && ks.has(w.islandOf[s.y * n + s.x]!)) reveal(g, s.x, s.y, 3);
}

/** Salvage a wreck within a square of (x, y), once. Returns the money found (0 if none). */
export function salvageAt(g: Game, x: number, y: number): number {
  for (const p of poisOf(g)) {
    if (p.kind !== 'wreck' || p.got || Math.abs(p.x - x) > 1.5 || Math.abs(p.y - y) > 1.5) continue;
    p.got = true; p.seen = true;
    const v = p.pay ?? 2000; g.s.money += v; g.s.earned = (g.s.earned ?? 0) + v;
    news(g, `⚓ Shipwreck salvaged: +$${v.toLocaleString('en-US')} in cargo and brass fittings`, { kind: 'sq', x: p.x, y: p.y });
    return v;
  }
  return 0;
}

/** Is any of these squares inside a landmark's reach circle (as drawn: r and a half squares from its middle)? */
const touches = (p: Poi, sq: number[], n: number, r: number) => sq.some(i => Math.hypot(p.x - i % n, p.y - ((i / n) | 0)) <= r + 0.5);

/** Output bonus from old ruins (taken over ones only) for a building any part of which is in their reach. */
export function ruinsMul(g: Game, x: number, y: number, sq: number[] = [y * g.world.n + x]): number {
  return (g.s.pois ?? []).some(p => p.kind === 'ruins' && p.got && touches(p, sq, g.world.n, RUINS_R)) ? RUINS_BONUS : 1;
}

const MINES = new Set(['stone', 'coal', 'iron', 'gold', 'gems']);
/** Output bonus from a ranger hut (lumber camps), old windmill (wheat farms) or old mine shaft (mines and quarries) that is yours, any part in reach. */
export function kindMul(g: Game, kind: string, x: number, y: number, sq: number[] = [y * g.world.n + x]): number {
  const k = kind === 'wood' ? 'ranger' : kind === 'farm' ? 'mill' : MINES.has(kind) ? 'shaft' : null; if (!k) return 1;
  return (g.s.pois ?? []).some(p => p.kind === k && p.got && touches(p, sq, g.world.n, KIND_R)) ? KIND_BONUS : 1;
}

/** Reward bonus for a town near Silver Falls that is yours. */
export function fallsMul(g: Game, x: number, y: number): number {
  return (g.s.pois ?? []).some(p => p.kind === 'falls' && p.got && Math.hypot(p.x - x, p.y - y) <= FALLS_R) ? FALLS_BONUS : 1;
}

/** Speed bonus for a ship at (x, y) from a lighthouse that is yours. */
export function lightMul(g: Game, x: number, y: number): number {
  return (g.s.pois ?? []).some(p => p.kind === 'lighthouse' && p.got && Math.hypot(p.x - x, p.y - y) <= LIGHT_R) ? LIGHT_BONUS : 1;
}

// ---- scouts

export const SCOUT_CAP = { land: 36, sea: 50 }, SCOUT_SPEED = 2, SCOUT_R = 3, MAX_SCOUTS = 2;
/** Boats see farther over open water: they uncover this many squares either side (scouts on foot SCOUT_R). */
export const SCOUT_R_SEA = 4;
/** A boat costs the same for every square sailed (Sébastien found boat scouting got expensive fast, 2026-11-16). */
export const BOAT_SQ = 60;
export interface Scout {
  id: number; path: number[]; pos: number; boat: boolean; paid: number;
  /** boats: how many times it has sailed round land it found in the fog */ rounds?: number;
  /** where it set out from, for its report */ from?: string;
  /** what it uncovered on the way: sites (towns, settlement sites, deposits), landmarks, islands sighted */
  saw?: { sites: number[]; pois: number[]; isl: number[] };
}

/** 🧭 What a scout brought back: written when it is home, kept in the journal (the last REPORTS_KEPT). */
export interface ScoutReport {
  id: number;
  /** game minute it came back */ min: number;
  from: string; boat: boolean;
  /** squares walked or sailed, first and last square */ steps: number; start: number; end: number;
  sites: number[]; pois: number[]; isl: number[];
  /** money back when the route met the wrong ground and turned back early */ back?: number;
  /** each town found and how far it is from your railway: squares and track cost (null: no way over land you can see) */
  link?: Record<number, { sq: number; cost: number } | null>;
}
export const REPORTS_KEPT = 12;
/** A route of n squares. On foot: 20 per square plus a little more for each square farther out (twice the old game,
 *  Sébastien found scouting too cheap). By boat: a flat BOAT_SQ a square, so far shores stay worth a look. */
export const scoutCost = (n: number, boat: boolean) => boat ? BOAT_SQ * n : Math.round(2 * (10 * n + n * (n + 1)));

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

/**
 * ⛵ The way a boat sails from square `from` to square `to`: the fewest squares over water, or through the fog (it may
 * hide land: the boat sails round what it finds). Squares in `avoid` are not used again. Among equally short ways it
 * keeps to the sea it can see. Returns the squares after `from`, at most `max` of them (cut short when the way is
 * longer), or null when no way is known.
 */
export function boatRoute(g: Game, from: number, to: number, max: number, avoid: ReadonlySet<number> = new Set()): number[] | null {
  const n = g.world.n, t = g.world.terr;
  const open = (i: number) => (!t[i] || !isRevealed(g, i)) && !avoid.has(i);
  if (from === to || !open(to)) return null;
  // distances back from the goal, then walk forward downhill from the start
  const d = new Int32Array(n * n).fill(-1), q = [to]; d[to] = 0;
  for (let h = 0; h < q.length && d[from]! < 0; h++) {
    const i = q[h]!, x = i % n, y = (i / n) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
      const j = Y * n + X; if (d[j]! >= 0 || (j !== from && !open(j))) continue;
      d[j] = d[i]! + 1; q.push(j);
    }
  }
  if (d[from]! < 0) return null;
  const out: number[] = []; let cur = from;
  while (cur !== to && out.length < max) {
    const x = cur % n, y = (cur / n) | 0; let best = -1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
      const j = Y * n + X; if (d[j] !== d[cur]! - 1) continue;
      if (best < 0 || (isRevealed(g, j) && !isRevealed(g, best))) best = j;
    }
    out.push(best); cur = best;
  }
  return out;
}

/** Squares a boat may add to sail round land it finds in the fog (paid for as it goes, when the money is there). */
export const ROUND_SPARE = 10;

/**
 * A boat met land hidden in the fog at path[k]: sail round it to the same end. The way round may be up to ROUND_SPARE
 * squares longer than what is left of the route (the extra squares are paid at BOAT_SQ, only if the money is there);
 * a shorter way gives the squares not sailed back.
 */
function sailRound(g: Game, s: Scout, k: number): boolean {
  const from = s.path[k - 1]!, to = s.path.at(-1)!, left = s.path.length - 1 - (k - 1);
  const spare = Math.max(0, Math.min(ROUND_SPARE, Math.floor(g.s.money / BOAT_SQ), SCOUT_CAP.sea + ROUND_SPARE - (s.path.length - 1)));
  const way = boatRoute(g, from, to, left + spare, new Set(s.path.slice(0, k - 1)));
  if (!way || way.at(-1) !== to) return false;
  const diff = (way.length - left) * BOAT_SQ; // + more squares to pay, - squares not sailed come back
  g.s.money -= diff; s.paid += diff;
  s.path = [...s.path.slice(0, k), ...way];
  s.pos = Math.min(s.pos, s.path.length - 1);
  return true;
}

export function sendScout(g: Game, path: number[], boat: boolean): Scout | string {
  if ((g.s.scouts ?? []).length >= MAX_SCOUTS) return `At most ${MAX_SCOUTS} scouts out at once: wait for one to come back`;
  const steps = path.length - 1; if (steps < 1) return 'Draw a route first';
  const c = scoutCost(steps, boat);
  if (c > g.s.money) return `Need $${(c - Math.floor(g.s.money)).toLocaleString('en-US')} more`;
  g.s.money -= c;
  const s: Scout = { id: g.s.nextId++, path, pos: 0, boat, paid: c, from: scoutStarts(g).find(x => x.sq === path[0])?.name ?? (boat ? 'the dock' : 'a town'), saw: { sites: [], pois: [], isl: [] } };
  (g.s.scouts ??= []).push(s);
  return s;
}

/** Uncover the land round (x, y) for a scout, noting what came out of the fog for its report. */
function scoutReveal(g: Game, s: Scout, x: number, y: number) {
  const R = s.boat ? SCOUT_R_SEA : SCOUT_R, n = g.world.n, r = R + 1, near = (o: { x: number; y: number }) => Math.abs(o.x - x) <= r && Math.abs(o.y - y) <= r;
  const hid = (o: { x: number; y: number }) => !isRevealed(g, o.y * n + o.x);
  const sites = g.s.sites.filter(o => near(o) && hid(o)), pois = poisOf(g).filter(p => near(p) && hid(p));
  const isl = new Set<number>();
  for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) if (i >= 0 && j >= 0 && i < n && j < n && g.world.terr[j * n + i] && !isRevealed(g, j * n + i)) isl.add(g.world.islandOf[j * n + i]!);
  reveal(g, x, y, R);
  const saw = (s.saw ??= { sites: [], pois: [], isl: [] });
  for (const o of sites) if (!hid(o) && !saw.sites.includes(o.id)) saw.sites.push(o.id);
  for (const p of pois) if (!hid(p) && !saw.pois.includes(p.id)) saw.pois.push(p.id);
  for (const k of isl) if (k >= 0 && k !== g.world.home && g.world.islands[k]?.name && !saw.isl.includes(k)) saw.isl.push(k);
}

/** How far a square is from your railway over land you can see: squares and track cost along the cheapest way (null: none within reach). */
export function linkEstimate(g: Game, x: number, y: number, max = 120): { sq: number; cost: number } | null {
  const n = g.world.n, linked = g.linked; if (!linked?.size) return null;
  const start = y * n + x; if (linked.has(start)) return { sq: 0, cost: 0 };
  const best = new Map<number, number>([[start, 0]]), steps = new Map<number, number>([[start, 0]]);
  const heap: [number, number][] = [[0, start]];
  const push = (e: [number, number]) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p]![0] <= e[0]) break; heap[i] = heap[p]!; i = p; } heap[i] = e; };
  const pop = (): [number, number] => {
    const top = heap[0]!, last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      for (;;) {
        const a = 2 * i + 1, b = a + 1; let m = -1, mv = last[0];
        if (a < heap.length && heap[a]![0] < mv) { m = a; mv = heap[a]![0]; }
        if (b < heap.length && heap[b]![0] < mv) { m = b; }
        if (m < 0) break;
        heap[i] = heap[m]!; i = m;
      }
      heap[i] = last;
    }
    return top;
  };
  const own = (i: number) => { const c = squareCost(g, i); return typeof c === 'number' ? c : null; };
  while (heap.length) {
    const [c, i] = pop(); if (c > best.get(i)!) continue;
    const st = steps.get(i)!; if (st >= max) continue;
    const ix = i % n, iy = (i / n) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = ix + dx, Y = iy + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
      const j = Y * n + X;
      if (linked.has(j)) return { sq: st + 1, cost: Math.round(c) };
      const k = g.track.has(j) ? 0 : own(j); if (k === null) continue;
      const nc = c + k; if (nc >= (best.get(j) ?? Infinity)) continue;
      best.set(j, nc); steps.set(j, st + 1); push([nc, j]);
    }
  }
  return null;
}

/** Write a scout's report and add it to the journal (newest last). */
function fileReport(g: Game, s: Scout, back?: number): ScoutReport {
  const saw = s.saw ?? { sites: [], pois: [], isl: [] }, link: NonNullable<ScoutReport['link']> = {};
  for (const id of saw.sites) { const t = g.s.sites.find(o => o.id === id); if (t?.kind === 'town') link[id] = linkEstimate(g, t.x, t.y); }
  const r: ScoutReport = { id: s.id, min: Math.floor(g.s.t / 60), from: s.from ?? (s.boat ? 'the dock' : 'a town'), boat: s.boat, steps: s.path.length - 1, start: s.path[0]!, end: s.path.at(-1)!, sites: saw.sites, pois: saw.pois, isl: saw.isl, link, ...(back ? { back } : {}) };
  const list = (g.s.reports ??= []); list.push(r);
  while (list.length > REPORTS_KEPT) list.shift();
  (g.reported ??= []).push(r.id);
  return r;
}

/** Scouts walk (or sail) their routes, uncovering land as they go; back home, each one files a 🧭 report. */
export function tickScouts(g: Game, dt: number) {
  const list = g.s.scouts; if (!list?.length) return;
  const n = g.world.n, backs = new Map<Scout, number>();
  for (const s of list) {
    const before = Math.floor(s.pos);
    s.pos = Math.min(s.path.length - 1, s.pos + SCOUT_SPEED * dt);
    for (let k = before + 1; k <= Math.floor(s.pos); k++) {
      const i = s.path[k]!, water = !g.world.terr[i];
      if (water !== s.boat && s.boat && (s.rounds ?? 0) < 20 && sailRound(g, s, k)) { // land under the fog: the boat sails round it
        if (!s.rounds) news(g, '⛵ The boat found land in the fog and sails round it');
        s.rounds = (s.rounds ?? 0) + 1; k--; continue;
      }
      if (water !== s.boat) { // wrong ground under the fog: the trip ends one square back
        s.pos = k - 1; const done = k - 1, left = s.path.length - 1 - done;
        const back = Math.round((s.paid - scoutCost(done, s.boat)) * 0.9);
        g.s.money += back; s.path = s.path.slice(0, k); backs.set(s, back);
        news(g, `${s.boat ? '⛵ The boat' : '🚶 The scout'} met ${s.boat ? 'land' : 'water'} and turned back: ${left} squares unused, $${back.toLocaleString('en-US')} back`);
        break;
      }
      scoutReveal(g, s, i % n, (i / n) | 0);
      if (s.boat) salvageAt(g, i % n, (i / n) | 0);
    }
  }
  const done = list.filter(s => s.pos >= s.path.length - 1);
  for (const s of done) { const e = s.path.at(-1)!; scoutReveal(g, s, e % n, (e / n) | 0); }
  if (done.length) g.s.scouts = list.filter(s => !done.includes(s));
  checkPois(g);
  for (const s of done) fileReport(g, s, backs.get(s)); // after checkPois, so its landmarks count as seen
}

/** Where a scout is drawn (square coordinates, fractional). */
export function scoutPlace(g: Game, s: Scout): { x: number; y: number } {
  const n = g.world.n, k = Math.min(s.path.length - 2, Math.floor(s.pos)), f = s.pos - Math.max(0, k);
  if (s.path.length < 2) return { x: s.path[0]! % n, y: (s.path[0]! / n) | 0 };
  const p = s.path[Math.max(0, k)]!, q = s.path[Math.max(0, k) + 1]!;
  return { x: (p % n) + ((q % n) - (p % n)) * f, y: ((p / n) | 0) + (((q / n) | 0) - ((p / n) | 0)) * f };
}
