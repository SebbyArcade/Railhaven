import type { Game, Site } from '../state.ts';
import { hash } from '../core/rng.ts';
import { isRevealed, reveal } from '../world/fog.ts';
import { refreshIslands, refreshWater, T } from '../world/terrain.ts';
import { townLinked } from '../economy/towns.ts';
import { parkSpot } from '../buildings/parks.ts';
import type { Good } from '../buildings/industries.ts';

/**
 * 🧭 Frontier Village (preview, 2026-11-24): the railhead pushes into the fog, and the towns it reaches grow into
 * villages the player shapes. Track costs 🛤 track supplies, not money. Supplies come from wood and stone that trains
 * bring to a supply depot (Ashford, and any town that picks the 🏗 Supply Depot). Towns grant wishes (link me to my
 * neighbour, fill my order) and each wish lets the player pick 1 of 3 buildings for that town, each a lasting perk for
 * the railhead. The island has two set pieces (a mountain ridge with one pass, a sea inlet to bridge or go round) and a
 * 🏁 golden spike on its far coast: reaching it finishes the island.
 *
 * All of it lives under g.s.fr; a game without it is the normal game, unchanged.
 */
export type PerkKind = 'depot' | 'gang' | 'bridge' | 'tunnel' | 'lookout' | 'market'
  | 'foreman' | 'mason' | 'timber' | 'school' | 'well' | 'surveyor' | 'post' | 'harbour' | 'granary' | 'engine';
export interface PerkInfo { icon: string; name: string; text: string; /** the town building drawing it uses */ art: 'tram' | 'clock' | 'bridgeworks' | 'foundry' | 'park' | 'market' | 'theatre' | 'grandstation' | 'cathedral' | 'exhibition' }
export const PERKS: Record<PerkKind, PerkInfo> = {
  depot: { icon: '🏗', name: 'Supply Depot', text: 'This town takes wood and stone as track supplies (shorter hauls near the railhead), and the supply pile holds 60 more', art: 'tram' },
  gang: { icon: '🛠', name: 'Track Gang Hut', text: 'New track costs 20% fewer supplies everywhere (stacks, down to half)', art: 'clock' },
  bridge: { icon: '🌉', name: 'Bridge Works', text: 'Bridges cost half the supplies', art: 'bridgeworks' },
  tunnel: { icon: '⛰', name: 'Tunnel Guild', text: 'Track can tunnel through mountains', art: 'foundry' },
  lookout: { icon: '🔭', name: 'Lookout Tower', text: 'Clears the fog 14 squares round this town right away', art: 'park' },
  market: { icon: '🛒', name: 'Market Hall', text: 'Deliveries to this town pay 30% more money', art: 'market' },
  foreman: { icon: '👷', name: "Foreman's Lodge", text: '25 track supplies right away, and the supply pile holds 20 more', art: 'clock' },
  mason: { icon: '⛏', name: 'Stonemasons', text: 'Track over hills costs the same as flat land', art: 'foundry' },
  timber: { icon: '🪚', name: 'Timber Yard', text: 'Wood and stone make 25% more supplies everywhere', art: 'tram' },
  school: { icon: '📚', name: 'Railway School', text: 'From now on every pick offers 4 buildings instead of 3', art: 'exhibition' },
  well: { icon: '🍀', name: 'Wishing Well', text: 'This town grants another wish right away: pick again', art: 'cathedral' },
  surveyor: { icon: '📐', name: "Surveyor's Office", text: 'Clears the fog in a wide strip from this town to the golden spike', art: 'theatre' },
  post: { icon: '📮', name: 'Post Office', text: 'Every town on this island shows on the map, with the land round it', art: 'clock' },
  harbour: { icon: '⚓', name: 'Harbour Master', text: 'Your next ⚓ Dock is free, and docks unlock now', art: 'bridgeworks' },
  granary: { icon: '🌾', name: 'Granary', text: "This town's orders ask for 25% less", art: 'market' },
  engine: { icon: '🚂', name: 'Engine Works', text: 'Every train runs 15% faster (stacks)', art: 'grandstation' },
};
const KINDS = Object.keys(PERKS) as PerkKind[];

export interface Piece { kind: 'ridge' | 'inlet'; name: string; x: number; y: number; /** the pass through the ridge */ px?: number; py?: number }
export interface Perk { town: number; k: PerkKind }
export interface Wish { town: number; /** link to this town */ to?: number; /** grow: fill the current order and upgrade */ grow?: boolean }
export interface FrState {
  /** 🛤 track supplies in stock */
  sup: number;
  /** the golden spike square */
  spike: number;
  pieces: Piece[];
  /** set pieces whose card was shown */
  seen: number[];
  perks: Perk[];
  /** open link wishes */
  wishes: Wish[];
  /** towns that granted a wish and wait for the player to pick a building (in order) */
  picks: number[];
  /** wishes granted so far */
  granted: number;
  /** squares of track laid, supplies used */
  laid: number; used: number;
  /** game time the spike was driven */
  done?: number;
  /** the intro and finale cards were shown */
  intro?: boolean; fin?: boolean;
  /** wood and stone delivered toward the next supply */
  units?: number;
  /** supplies earned by hauling so far */
  earned?: number;
  /** 🪓 supply loads bought from Ashford's crew */
  bought?: number;
  /** towns that already made their link wish (each town wishes for a neighbour once; growing grants the rest) */
  wished?: number[];
  /** picks whose card already opened by itself (counted from the first) */
  shown?: number;
  /** golden spikes driven before this island's (0 on Ashford Isle) */
  stage?: number;
  /** the island this spike stands on (undefined: Ashford Isle) */
  isle?: number;
  /** islands whose spike was driven */
  isles?: number[];
  /** squares of the spikes already driven */
  spikes?: number[];
  /** game time this island's frontier opened */
  t0?: number;
  /** ⚓ free docks left (the reward for a spike: one on your coast, one landing on the next island) */
  freeDocks?: number;
  /** the next island's first card was shown */
  sailed?: boolean;
}

export const fr = (g: Game): FrState | undefined => (g.s as { fr?: FrState }).fr;
export const START_SUP = 30;
/** a depot pile holds this many supplies (+60 for each 🏗 Supply Depot): past it, trains stop hauling wood and stone there */
export const SUP_CAP = 120;
export const supCap = (g: Game) => SUP_CAP + 60 * perkCount(g, 'depot') + 20 * perkCount(g, 'foreman');
/** 🚂 Engine Works: trains' top speed multiplier */
export const frSpeed = (g: Game) => 1 + 0.15 * perkCount(g, 'engine');
/** 🪓 the no-fail way to get supplies: Ashford's crew cuts them for money, dearer each time (a fallback, not a shop) */
export const BUY_SUP = { n: 5, price: 500 };
export const buyPrice = (g: Game) => BUY_SUP.price * Math.min(4, 1 + (fr(g)?.bought ?? 0));
/** supplies per new square, by what it crosses */
export const SUP = { flat: 1, hills: 2, tunnel: 5, bridge: [0, 4, 7, 10] };
export const SPIKE_R = 2;

export const perkCount = (g: Game, k: PerkKind) => fr(g)?.perks.filter(p => p.k === k).length ?? 0;
export const hasPerk = (g: Game, k: PerkKind, t?: Site) => !!fr(g)?.perks.some(p => p.k === k && (!t || p.town === t.id));
/** Ashford is always a depot; other towns once they pick the 🏗 Supply Depot. */
export const isDepot = (g: Game, t: Site) => !!fr(g) && (t === g.s.sites[0] || hasPerk(g, 'depot', t));
/** the supply pile is full: depots take no more wood and stone for now */
export const supFull = (g: Game) => (fr(g)?.sup ?? 0) >= supCap(g);
export const DEPOT_GOODS: Good[] = ['wood', 'stone'];
export const depotTakes = (g: Game, t: Site, k: Good) => isDepot(g, t) && DEPOT_GOODS.includes(k) && !supFull(g);

/** Supplies one new square costs (before the Track Gang), from the money price the normal rules give it. */
export function squareSup(g: Game, i: number, money: number): number {
  const t = g.world.terr[i];
  let c: number;
  if (t === T.Mountain) c = SUP.tunnel;
  else if (t === T.Water) c = money >= 3500 ? SUP.bridge[3]! : money >= 1500 ? SUP.bridge[2]! : SUP.bridge[1]!;
  else c = t === T.Hills && !hasPerk(g, 'mason') ? SUP.hills : SUP.flat;
  if (t === T.Water && hasPerk(g, 'bridge')) c = Math.ceil(c / 2);
  return c;
}
export const gangMul = (g: Game) => Math.max(0.5, 1 - 0.2 * perkCount(g, 'gang'));
export const stroke = (g: Game, per: number[]) => per.length ? Math.max(1, Math.round(per.reduce((a, b) => a + b, 0) * gangMul(g))) : 0;

/** units of wood or stone that make one 🛤 supply */
export const PER_SUP = 2;
/** Deliveries a depot took as supplies (PER_SUP units each; the rest waits for the next load). */
/** Turn delivered wood and stone into supplies; returns how many supplies they made. */
export function addSupplies(g: Game, n: number): number {
  const f = fr(g); if (!f) return 0;
  const u = (f.units ?? 0) + n * (1 + 0.25 * perkCount(g, 'timber')), got = Math.min(Math.floor(u / PER_SUP), Math.max(0, supCap(g) - f.sup));
  f.sup += got; f.units = u - got * PER_SUP; if (f.units >= PER_SUP) f.units = u % PER_SUP; f.earned = (f.earned ?? 0) + got; return got;
}

export function buySupplies(g: Game): string {
  const f = fr(g); if (!f) return '';
  const p = buyPrice(g);
  if (g.s.money < p) return `Need $${(p - Math.floor(g.s.money)).toLocaleString('en-US')} more`;
  g.s.money -= p; f.sup += BUY_SUP.n; f.bought = (f.bought ?? 0) + 1;
  return '';
}

// ---------------------------------------------------------------- setup

const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

/** Land squares by walking distance from a start square (Ashford by default): water and mountains block. */
function landDist(g: Game, from?: number): Int32Array {
  const w = g.world, n = w.n, out = new Int32Array(n * n).fill(-1), a = g.s.sites[0]!, q = [from ?? a.y * n + a.x];
  out[q[0]!] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!, x = i % n, y = (i / n) | 0;
    for (const [dx, dy] of D4) { const j = (y + dy) * n + x + dx; if (w.terr[j] && w.terr[j] !== T.Mountain && out[j] === -1 && !g.s.sites.some(s => s.kind !== 'town' && s.y * n + s.x === j)) { out[j] = out[i]! + 1; q.push(j); } }
  }
  return out;
}

/** Make the frontier: the golden spike on the far coast, a mountain ridge with one pass, a sea inlet. */
export function setupFrontier(g: Game) {
  const a = g.s.sites[0]!, { spike, pieces } = carve(g, a.x, a.y, 11, 0);
  plotsToTowns(g, g.world.home);
  (g.s as { fr?: FrState }).fr = { sup: START_SUP, spike, pieces, seen: [], perks: [], wishes: [], picks: [], granted: 0, laid: 0, used: 0, stage: 0 };
  g.s.tut = undefined; // the frontier has its own first card instead of the lessons
}

/**
 * Carve one island's frontier from a start square (Ashford, or the landing shore of a later island): the spike on the
 * farthest roomy square, a ridge with a pass at 45% of the way, an inlet at 75%. `clear`: squares kept free round the start.
 */
function carve(g: Game, ox: number, oy: number, clear: number, nth: number): { spike: number; pieces: Piece[] } {
  const w = g.world, n = w.n, a = { x: ox, y: oy }, d = landDist(g, oy * n + ox);
  let spike = a.y * n + a.x, far = 0;
  // the farthest square with open land round it (not the tip of a one-square spit)
  const roomy = (i: number) => [1, -1, n, -n, n + 1, n - 1, -n + 1, -n - 1].filter(o => d[i + o]! >= 0).length >= 6;
  for (let i = 0; i < n * n; i++) if (d[i]! > far && roomy(i)) { far = d[i]!; spike = i; }
  const sx = spike % n, sy = (spike / n) | 0, len = Math.hypot(sx - a.x, sy - a.y) || 1;
  const ux = (sx - a.x) / len, uy = (sy - a.y) / len, px = -uy, py = ux; // along and across the way to the spike
  const keep = (x: number, y: number) => Math.hypot(x - a.x, y - a.y) < clear || Math.hypot(x - sx, y - sy) < 4
    || g.s.sites.some(s => Math.abs(s.x - x) <= 2 && Math.abs(s.y - y) <= 2);
  const land = (x: number, y: number) => x > 1 && y > 1 && x < n - 2 && y < n - 2 && w.terr[y * n + x]! > 0;
  const edits = g.s.terrainEdits, pieces: Piece[] = [];
  const was = new Map<number, { t: number; e: number | undefined; piece: 'ridge' | 'inlet' }>();
  const set = (x: number, y: number, t: T) => { const i = y * n + x; if (!was.has(i)) was.set(i, { t: w.terr[i]!, e: edits[i], piece: t === T.Water ? 'inlet' : 'ridge' }); w.terr[i] = t; edits[i] = t; };
  const undo = (piece: 'ridge' | 'inlet', keepIf?: (i: number) => boolean) => {
    for (const [i, o] of was) if (o.piece === piece && !keepIf?.(i)) { w.terr[i] = o.t; if (o.e === undefined) delete edits[i]; else edits[i] = o.e; was.delete(i); }
  };

  // ⛰ the ridge, 45% of the way: mountains straight across the island, with one 3-square pass near one end
  const rf = 0.45, rx = a.x + ux * len * rf, ry = a.y + uy * len * rf;
  const arm = (s: 1 | -1) => { let k = 0; while (land(Math.round(rx + px * s * (k + 1)), Math.round(ry + py * s * (k + 1)))) k++; return k; };
  const L1 = arm(1), L2 = arm(-1), side: 1 | -1 = L1 >= L2 ? 1 : -1, passAt = Math.round(Math.max(L1, L2) * 0.72);
  if (L1 + L2 > 6) {
    for (let s of [1, -1] as const) for (let k = 0; k <= (s === 1 ? L1 : L2); k++) {
      if (s === side && Math.abs(k - passAt) <= 1) continue;
      for (const o of [0, 1]) {
        const x = Math.round(rx + px * s * k + ux * o), y = Math.round(ry + py * s * k + uy * o);
        if (land(x, y) && !keep(x, y)) set(x, y, T.Mountain);
      }
    }
    pieces.push({ kind: 'ridge', name: RIDGES[((g.s.seed >>> 0) + nth) % RIDGES.length]!, x: Math.round(rx), y: Math.round(ry), px: Math.round(rx + px * side * passAt), py: Math.round(ry + py * side * passAt) });
  }

  // 🌊 the inlet, 75% of the way: sea cutting in from the nearer coast, two squares wide, halfway across
  const ixf = 0.75, ix = a.x + ux * len * ixf, iy = a.y + uy * len * ixf;
  const reach = (s: 1 | -1) => { let k = 0; while (k < 60 && land(Math.round(ix + px * s * (k + 1)), Math.round(iy + py * s * (k + 1)))) k++; return k; };
  const R1 = reach(1), R2 = reach(-1), from: 1 | -1 = R1 <= R2 ? 1 : -1, wide = R1 + R2;
  if (wide > 8 && nth === 0) { // later islands get no inlet: cutting land could split an island and renumber the islands
    const coast = from === 1 ? R1 : R2, depth = Math.round(wide * 0.6);
    for (let k = coast; k >= coast - depth; k--) for (const o of [0, 1]) {
      const x = Math.round(ix + px * from * k + ux * o), y = Math.round(iy + py * from * k + uy * o);
      if (land(x, y) && !keep(x, y)) set(x, y, T.Water);
    }
    pieces.push({ kind: 'inlet', name: INLETS[((g.s.seed >>> 3) + nth) % INLETS.length]!, x: Math.round(ix + px * from * (coast - depth / 2)), y: Math.round(iy + py * from * (coast - depth / 2)) });
  }
  refreshWater(w); refreshIslands(w);
  // the spike must stay reachable without a tunnel (round the ridge by its pass, round the inlet by its head):
  // if the carving shut the way, take the inlet back out, then widen the pass, then drop the ridge
  const open = () => { const dd = landDist(g, a.y * n + a.x); return dd[spike]! >= 0 && w.islandOf[spike] === w.islandOf[a.y * n + a.x]; };
  if (!open()) { undo('inlet'); const k = pieces.findIndex(p => p.kind === 'inlet'); if (k >= 0) pieces.splice(k, 1); refreshWater(w); refreshIslands(w); }
  const rg = pieces.find(p => p.kind === 'ridge');
  if (!open() && rg?.px !== undefined) { undo('ridge', i => Math.hypot(i % n - rg.px!, ((i / n) | 0) - rg.py!) > 4); refreshWater(w); refreshIslands(w); }
  if (!open()) { undo('ridge'); const k = pieces.findIndex(p => p.kind === 'ridge'); if (k >= 0) pieces.splice(k, 1); refreshWater(w); refreshIslands(w); }
  return { spike, pieces };
}

// ---------------------------------------------------------------- the next island

/** On a frontier island every settlement site is a town waiting for the railway: more towns, more wishes. */
function plotsToTowns(g: Game, isl: number) {
  const n = g.world.n;
  for (const s of g.s.sites) if (s.kind === 'plot' && g.world.islandOf[s.y * n + s.x] === isl) Object.assign(s, { kind: 'town', pop: 0, lvl: 0, got: {} });
}

/** Supplies a new island's frontier brings (a fresh start for its railhead). */
export const ISLE_SUP = 30;

/** The next island to open after a spike: the nearest named island of fair size not yet done, by straight line from the spike. */
export function nextIsle(g: Game): number | undefined {
  const f = fr(g); if (!f) return;
  const w = g.world, n = w.n, sx = f.spike % n, sy = (f.spike / n) | 0, done = new Set([w.home, ...(f.isles ?? []), ...(f.isle !== undefined ? [f.isle] : [])]);
  let best: number | undefined, bd = Infinity;
  w.islands.forEach((isl, k) => {
    if (done.has(k) || !isl.name || isl.size < 120) return;
    const d = Math.hypot(isl.cx - sx, isl.cy - sy); if (d < bd) { bd = d; best = k; }
  });
  return best;
}

/** After a spike: open the next island's frontier (its own spike, ridge and inlet) and give two free docks to reach it. */
export function sailOn(g: Game): string {
  const f = fr(g); if (!f) return '';
  if (f.done === undefined) return 'Drive this golden spike first';
  const k = nextIsle(g); if (k === undefined) return 'No more islands to open in this preview';
  const w = g.world, n = w.n, sx = f.spike % n, sy = (f.spike / n) | 0;
  // land where the island is nearest the last spike: that shore is the start of its railhead
  let o = -1, od = Infinity;
  for (let i = 0; i < n * n; i++) if (w.islandOf[i] === k && w.terr[i] !== T.Mountain) { const d = Math.hypot(i % n - sx, ((i / n) | 0) - sy); if (d < od) { od = d; o = i; } }
  if (o < 0) return 'No shore to land on';
  (f.isles ??= []).push(f.isle ?? w.home); (f.spikes ??= []).push(f.spike);
  const { spike, pieces } = carve(g, o % n, (o / n) | 0, 5, (f.stage ?? 0) + 1);
  plotsToTowns(g, k);
  f.isle = k; f.stage = (f.stage ?? 0) + 1; f.spike = spike; f.pieces.push(...pieces);
  f.done = undefined; f.fin = false; f.sailed = false; f.t0 = g.s.t; f.freeDocks = 2;
  f.sup = Math.min(supCap(g), f.sup + ISLE_SUP);
  reveal(g, o % n, (o / n) | 0, 4); // the landing shore shows, so the player sees where to land
  return '';
}

/** The ⚓ steps to reach the island the spike stands on, while the railway hasn't landed there yet ('' once it has). */
export function sailStep(g: Game, linkedDockIsles: Set<number>): string {
  const f = fr(g); if (!f || f.isle === undefined || linkedDockIsles.has(f.isle)) return '';
  const w = g.world, name = w.islands[f.isle]?.name ?? 'the island', from = f.isles?.at(-1) ?? w.home;
  const free = (f.freeDocks ?? 0) > 0 ? 'free ' : '';
  if (!linkedDockIsles.has(from)) return `Build a ${free}⚓ Dock facing ${name}`;
  return `Land a ${free}⚓ Dock on ${name}`;
}

const RIDGES = ['Greyspine Ridge', 'Old Man Ridge', 'Kestrel Crags', 'The Backbone', 'Ravenwall'];
const INLETS = ['Seal Inlet', 'Heron Sound', 'Gannet Firth', 'Saltwater Arm', 'Otter Loch'];

// ---------------------------------------------------------------- wishes and picks

/** The other town nearest to this one (not Ashford when there is any other). */
function neighbour(g: Game, t: Site): Site | undefined {
  const n = g.world.n, isl = g.world.islandOf[t.y * n + t.x];
  const others = g.s.sites.filter(s => s.kind === 'town' && s !== t && g.world.islandOf[s.y * n + s.x] === isl);
  const linkedOnes = new Set(others.filter(s => townLinked(g, s)).map(s => s.id));
  return others.filter(s => !linkedOnes.has(s.id)).sort((p, q) => Math.hypot(p.x - t.x, p.y - t.y) - Math.hypot(q.x - t.x, q.y - t.y))[0];
}

export const wishOf = (g: Game, t: Site) => fr(g)?.wishes.find(w => w.town === t.id);

/** Each second: new wishes, granted wishes, set pieces in sight, the spike. Returns news lines. */
export function tickFrontier(g: Game): string[] {
  const f = fr(g); if (!f) return [];
  const out: string[] = [], n = g.world.n;
  for (const t of g.s.sites) {
    if (t.kind !== 'town' || !townLinked(g, t)) continue;
    const w = wishOf(g, t);
    if (!w) { if ((f.wished ??= []).includes(t.id)) continue; const to = neighbour(g, t); if (to) { f.wishes.push({ town: t.id, to: to.id }); f.wished.push(t.id); } continue; }
    const to = w.to !== undefined ? g.s.sites.find(s => s.id === w.to) : undefined;
    if (to && townLinked(g, to)) {
      f.wishes = f.wishes.filter(x => x !== w); f.picks.push(t.id); f.granted++;
      out.push(`✨ Wish granted: ${t.name} is linked to ${to.name}. Pick a new building for ${t.name}`);
    } else if (to && !isRevealed(g, to.y * n + to.x)) { /* still in the fog: the wish points the way */ }
  }
  if (f.done === undefined) {
    const sx = f.spike % n, sy = (f.spike / n) | 0;
    for (const i of g.track.keys()) if (Math.abs(i % n - sx) <= SPIKE_R && Math.abs(((i / n) | 0) - sy) <= SPIKE_R) { f.done = g.s.t; out.push('🏁 The golden spike is driven!'); break; }
  }
  return out;
}

/** A town grew (its order filled and the player upgraded it): that is a wish granted too. */
export function townGrew(g: Game, t: Site) { const f = fr(g); if (f) { f.picks.push(t.id); f.granted++; } }

/** The three buildings offered to a town for this pick (seeded, never one it already has, Tunnel Guild once). */
export function choices(g: Game, t: Site): PerkKind[] {
  const f = fr(g)!, nth = f.granted, have = new Set(f.perks.filter(p => p.town === t.id).map(p => p.k));
  const once: PerkKind[] = ['tunnel', 'bridge', 'mason', 'school', 'surveyor', 'post'];
  const ok = KINDS.filter(k => !have.has(k) && !(once.includes(k) && hasPerk(g, k)) && !(k === 'tunnel' && f.granted < 2) && !(k === 'depot' && t === g.s.sites[0])
    && !(k === 'surveyor' && f.done !== undefined) && !(k === 'well' && f.picks.length > 1));
  // before the first tunnel, a town at the ridge always offers the Tunnel Guild so the ridge is never a dead end
  const ranked = ok.map(k => ({ k, r: hash(g.s.seed, t.id, nth, 77 + KINDS.indexOf(k)) })).sort((p, q) => p.r - q.r).map(p => p.k);
  const m = hasPerk(g, 'school') ? 4 : 3, out = ranked.slice(0, m);
  if (ok.includes('tunnel') && !out.includes('tunnel') && f.granted >= 3) out[m - 1] = 'tunnel';
  return out;
}

/** Build the picked building in the town. */
export function pickPerk(g: Game, townId: number, k: PerkKind): string {
  const f = fr(g); if (!f) return '';
  const t = g.s.sites.find(s => s.id === townId); if (!t) return 'No such town';
  if (f.picks[0] !== townId) return 'Pick for the town shown first';
  if (!choices(g, t).includes(k)) return 'Not offered here';
  f.picks.shift();
  f.perks.push({ town: t.id, k });
  const spot = parkSpot(g, t);
  if (spot) (g.s.parks ??= []).push({ town: t.id, ...spot, k: PERKS[k].art, fp: k } as never);
  if (k === 'lookout') reveal(g, t.x, t.y, 14);
  if (k === 'foreman') f.sup += 25;
  if (k === 'well') { f.picks.unshift(t.id); f.granted++; }
  if (k === 'harbour') f.freeDocks = (f.freeDocks ?? 0) + 1;
  if (k === 'surveyor') { // a strip 3 wide from the town to the spike
    const n = g.world.n, sx = f.spike % n, sy = (f.spike / n) | 0, L = Math.ceil(Math.hypot(sx - t.x, sy - t.y));
    for (let s = 0; s <= L; s += 2) reveal(g, Math.round(t.x + (sx - t.x) * s / L), Math.round(t.y + (sy - t.y) * s / L), 3);
  }
  if (k === 'post') { const n = g.world.n, isl = g.world.islandOf[t.y * n + t.x]; for (const s of g.s.sites) if (s.kind === 'town' && g.world.islandOf[s.y * n + s.x] === isl) reveal(g, s.x, s.y, 4); }
  // the town grows a little with every building
  t.pop = (t.pop ?? 0) + 10;
  return '';
}

/** A set piece just came into sight (its card shows once). */
export function pieceInSight(g: Game): Piece | undefined {
  const f = fr(g); if (!f) return;
  const n = g.world.n;
  return f.pieces.find((p, k) => !f.seen.includes(k) && isRevealed(g, p.y * n + p.x));
}
export function markSeen(g: Game, p: Piece) { const f = fr(g)!; f.seen.push(f.pieces.indexOf(p)); }

/** Squares from the nearest track to the spike (straight line), for the goal bar. */
export function spikeGap(g: Game): number {
  const f = fr(g); if (!f) return 0;
  const n = g.world.n, sx = f.spike % n, sy = (f.spike / n) | 0; let best = Infinity;
  for (const i of g.track.keys()) { const d = Math.max(Math.abs(i % n - sx), Math.abs(((i / n) | 0) - sy)); if (d < best) best = d; }
  if (best === Infinity) { const a = g.s.sites[0]!; best = Math.max(Math.abs(a.x - sx), Math.abs(a.y - sy)); }
  return Math.max(0, best - SPIKE_R);
}

/** The frontier card to open next on its own, if any (marks it shown): intro, a set piece in sight, a pick, the spike. */
export function frNext(g: Game): string | undefined {
  const f = fr(g); if (!f) return;
  if (!f.intro) { f.intro = true; return 'intro'; }
  if (f.done !== undefined && !f.fin) { f.fin = true; return 'spike'; }
  const p = pieceInSight(g); if (p) { markSeen(g, p); return 'piece' + f.pieces.indexOf(p); }
  if (f.picks.length && (f.shown ?? 0) < f.granted - f.picks.length + 1) { f.shown = f.granted - f.picks.length + 1; return 'pick'; }
  return;
}
