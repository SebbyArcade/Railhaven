import type { Game, Site } from '../state.ts';
import { dockReachError, landingSeeds } from '../ships/docks.ts';
import { isRevealed } from '../world/fog.ts';
import { T } from '../world/terrain.ts';
import { isMountainFoot } from '../world/sites.ts';
import { hallAt, hallsOf, stationLinkError } from './stations.ts';
import { specMul } from '../world/specialty.ts';
import { kindMul, ruinsMul } from '../world/explore.ts';

/** Goods and what they are worth per unit (the old game's `rate`). */
export const GOODS = {
  wood: { name: 'Wood', icon: '🪵', value: 5 },
  farm: { name: 'Wheat', icon: '🌾', value: 7 },
  stone: { name: 'Stone', icon: '🪨', value: 5 },
  coal: { name: 'Coal', icon: '⚫', value: 6 },
  iron: { name: 'Iron', icon: '🧲', value: 9 },
  oil: { name: 'Oil', icon: '🛢', value: 12 },
  wool: { name: 'Wool', icon: '🐑', value: 10 },
  fish: { name: 'Fish', icon: '🐟', value: 9 },
  shellfish: { name: 'Shellfish', icon: '🦞', value: 16 },
  planks: { name: 'Planks', icon: '🪚', value: 14 },
  bricks: { name: 'Bricks', icon: '🧱', value: 14 },
  flour: { name: 'Flour', icon: '🍞', value: 18 },
  steel: { name: 'Steel', icon: '⚙️', value: 30 },
  fuel: { name: 'Fuel', icon: '⛽', value: 45 },
  cloth: { name: 'Cloth', icon: '🧵', value: 24 },
  cans: { name: 'Canned fish', icon: '🥫', value: 22 },
  // two-goods factories at home
  glass: { name: 'Glass', icon: '🪟', value: 24 },
  tools: { name: 'Tools', icon: '🔨', value: 70 },
  furniture: { name: 'Furniture', icon: '🪑', value: 65 },
  // 🗺 the far seas: one new chain with each expedition
  gold: { name: 'Gold', icon: '🪙', value: 20 },
  gems: { name: 'Gems', icon: '💎', value: 24 },
  jewellery: { name: 'Jewellery', icon: '💍', value: 110 },
  cocoa: { name: 'Cocoa', icon: '🫘', value: 15 },
  chocolate: { name: 'Chocolate', icon: '🍫', value: 60 },
  rubber: { name: 'Rubber', icon: '🌿', value: 15 },
  tyres: { name: 'Tyres', icon: '🛞', value: 85 },
} as const;
export type Good = keyof typeof GOODS;

type KindInfo = { name: string; icon: string; makes: Good; price: number; rate: number; needs: string; in?: Partial<Record<Good, number>>; unlock?: number; /** 🗺 found only past the edge of the sea: needs this many expeditions */ ring?: number };

/**
 * What the player builds: industries that dig or grow raw goods, and factories (Railway level 1+) that turn one
 * raw good into a product (the Steel Mill needs coal and iron). Factories stand on any open flat land.
 */
export const INDUSTRIES = {
  wood: { name: 'Lumber Camp', icon: '🪵', makes: 'wood', price: 600, rate: 1.1, needs: 'forest next to it' },
  farm: { name: 'Wheat Farm', icon: '🌾', makes: 'farm', price: 800, rate: 1.1, needs: 'open grass for fields' },
  stone: { name: 'Stone Quarry', icon: '🪨', makes: 'stone', price: 800, rate: 1.1, needs: 'a rock outcrop at the foot of mountains' },
  coal: { name: 'Coal Mine', icon: '⚫', makes: 'coal', price: 1000, rate: 1.1, needs: 'a coal seam at the foot of mountains' },
  iron: { name: 'Iron Mine', icon: '🧲', makes: 'iron', price: 1500, rate: 1.1, needs: 'an iron deposit (outer islands)' },
  oil: { name: 'Oil Well', icon: '🛢', makes: 'oil', price: 2500, rate: 0.6, needs: 'an oil seep (outer islands)' },
  wool: { name: 'Sheep Farm', icon: '🐑', makes: 'wool', price: 900, rate: 1.1, needs: 'open grassland for pasture' },
  dock: { name: 'Dock', icon: '⚓', makes: 'fish', price: 4000, rate: 0, needs: 'a shore: its pier stands over the water, its yard on land', unlock: 1 },
  sawmill: { name: 'Sawmill', icon: '🪚', makes: 'planks', price: 2500, rate: 0.6, needs: 'open flat land', in: { wood: 1 }, unlock: 1 },
  brickworks: { name: 'Brickworks', icon: '🧱', makes: 'bricks', price: 2500, rate: 0.6, needs: 'open flat land', in: { stone: 1 }, unlock: 1 },
  gristmill: { name: 'Flour Mill', icon: '🍞', makes: 'flour', price: 2500, rate: 0.6, needs: 'open flat land', in: { farm: 1 }, unlock: 1 },
  mill: { name: 'Steel Mill', icon: '⚙️', makes: 'steel', price: 2500, rate: 0.6, needs: 'open flat land', in: { coal: 1, iron: 1 }, unlock: 2 },
  refinery: { name: 'Refinery', icon: '⛽', makes: 'fuel', price: 2500, rate: 0.6, needs: 'open flat land', in: { oil: 1 }, unlock: 2 },
  textile: { name: 'Textile Mill', icon: '🧵', makes: 'cloth', price: 2500, rate: 0.6, needs: 'open flat land', in: { wool: 1 }, unlock: 3 },
  cannery: { name: 'Cannery', icon: '🥫', makes: 'cans', price: 2500, rate: 0.6, needs: 'open flat land', in: { fish: 1 }, unlock: 2 },
  // factories that need two goods, both made at home
  glassworks: { name: 'Glassworks', icon: '🪟', makes: 'glass', price: 4000, rate: 0.6, needs: 'open flat land', in: { stone: 1, coal: 1 }, unlock: 3 },
  toolworks: { name: 'Toolworks', icon: '🔨', makes: 'tools', price: 6000, rate: 0.6, needs: 'open flat land', in: { steel: 1, planks: 1 }, unlock: 4 },
  furniture: { name: 'Furniture Works', icon: '🪑', makes: 'furniture', price: 6000, rate: 0.6, needs: 'open flat land', in: { planks: 1, cloth: 1 }, unlock: 5 },
  // 🗺 the far seas: each expedition ring brings one new chain
  gold: { name: 'Gold Mine', icon: '🪙', makes: 'gold', price: 3000, rate: 0.8, needs: 'a gold seam at the foot of mountains (far seas)', ring: 1 },
  gems: { name: 'Gem Mine', icon: '💎', makes: 'gems', price: 3500, rate: 0.7, needs: 'a gem vein at the foot of mountains (far seas)', ring: 1 },
  jeweller: { name: 'Jeweller', icon: '💍', makes: 'jewellery', price: 8000, rate: 0.5, needs: 'open flat land', in: { gold: 1, gems: 1 }, ring: 1 },
  cocoa: { name: 'Cocoa Grove', icon: '🫘', makes: 'cocoa', price: 2500, rate: 1, needs: 'a wild cocoa grove (far seas)', ring: 2 },
  chocolate: { name: 'Chocolate Factory', icon: '🍫', makes: 'chocolate', price: 7000, rate: 0.6, needs: 'open flat land', in: { cocoa: 1, flour: 1 }, ring: 2 },
  rubber: { name: 'Rubber Grove', icon: '🌿', makes: 'rubber', price: 2500, rate: 1, needs: 'a wild rubber grove (far seas)', ring: 3 },
  tyreworks: { name: 'Tyre Works', icon: '🛞', makes: 'tyres', price: 8000, rate: 0.6, needs: 'open flat land', in: { rubber: 1, steel: 1 }, ring: 3 },
} as const satisfies Record<string, KindInfo>;
export type IndustryKind = keyof typeof INDUSTRIES;
export const info = (k: IndustryKind): KindInfo => INDUSTRIES[k];
export const isFactory = (k: IndustryKind) => !!info(k).in;
/** goods a factory takes in */
export const inputsOf = (k: IndustryKind) => Object.keys(info(k).in ?? {}) as Good[];
/** input store per good, by level */
export const bufOf = (b: Building) => 30 + 20 * b.lvl;
/** Why this kind can't be built yet (Railway level), or '' */
export const lockedText = (g: Game, k: IndustryKind) => (info(k).ring ?? 0) > (g.s.rings ?? 0)
  ? `🔒 Found past the edge of the sea: send ${info(k).ring === 1 ? 'an' : info(k).ring} 🗺 expedition${info(k).ring === 1 ? '' : 's'} from a level 3 dock`
  : (info(k).unlock ?? 0) > (g.s.rlv ?? 0) ? `🔒 Unlocks at Railway level ${info(k).unlock}` : '';
export const MINES = new Set<IndustryKind>(['stone', 'coal', 'iron', 'oil', 'gold', 'gems', 'cocoa', 'rubber']);
/** Deposits found only on the far seas (expedition islands), by the ring that brings them. */
export const FAR_RES = { gold: 1, gems: 1, cocoa: 2, rubber: 3 } as const;

/**
 * A building and its yard. The yard is a row of four track squares (two loading tracks, entered at the ends);
 * the building stands on the row of four squares beside it.
 */
export interface Building {
  id: number;
  kind: IndustryKind;
  /** west/north end of the yard track */
  x: number;
  y: number;
  horizontal: boolean;
  /** which side of the yard the building row is on: +1 south/east, -1 north/west */
  side: 1 | -1;
  lvl: number;
  stock: number;
  /** factories: raw goods waiting to be made into the product */
  inbuf?: Partial<Record<Good, number>>;
  /** the deposit a mine stands on */
  dep?: number;
  /** on fire: makes nothing until the fire crew puts it out */
  fire?: { crewAt: number; doneAt: number };
  /** money paid for it and its levels (half comes back if it is removed) */
  paid?: number;
  /** docks: how far out the sea is already charted */
  chart?: number;
  /** docks: goods a ship brought, waiting for this island's trains */
  landed?: Partial<Record<Good, number>>;
  /** docks: fishing level (0 = no boats; 1 boats, 2 bigger fleet, 3 shellfish traps too) */
  fish?: number;
  /** where the player pinned its goods to go (else the plan picks) */
  pin?: { kind: 'town' | 'bld'; id: number };
  /** ⛔ closed by the player: makes nothing, takes nothing, barriers keep trains out */
  closed?: boolean;
  /** loading tracks in the yard: 2, then a 3rd at level 2 and a 4th at level 3 on the strip beside the yard */
  tracks?: number;
  /** docks: goods waiting for a ship to another dock */
  outq?: import('../ships/ships.ts').SeaLoad[];
}

export const YARD_LEN = 4;

export function yardSquares(n: number, b: Pick<Building, 'x' | 'y' | 'horizontal'>): number[] {
  const out: number[] = [];
  for (let k = 0; k < YARD_LEN; k++) out.push(b.horizontal ? b.y * n + b.x + k : (b.y + k) * n + b.x);
  return out;
}
export function buildingSquares(n: number, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side'>): number[] {
  return yardSquares(n, b).map(i => b.horizontal ? i + b.side * n : i + b.side);
}
export const footprint = (n: number, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side'> & { tracks?: number }) => [...yardSquares(n, b), ...buildingSquares(n, b), ...((b.tracks ?? 2) > 2 ? stripSquares(n, b) : [])];

/** Kinds whose yards grow extra loading tracks with their levels (farms grow fields instead; docks reach farther). */
export const growsTracks = (k: IndustryKind) => k !== 'farm' && k !== 'wool' && k !== 'dock';
export const tracksOf = (b: { tracks?: number }) => b.tracks ?? 2;
/** The strip beside the yard, on the side away from the building: room for the 3rd and 4th loading tracks. */
export function stripSquares(n: number, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side'>): number[] {
  return yardSquares(n, b).map(i => b.horizontal ? i - b.side * n : i - b.side);
}
/** Where each loading track runs across the yard row, in px from its middle (the 3rd and 4th out on the strip). */
export function yardLanes(b: Pick<Building, 'side'> & { tracks?: number }): number[] {
  const s = -b.side, out = [-8, 8];
  if (tracksOf(b) >= 3) out.push(24 * s);
  if (tracksOf(b) >= 4) out.push(40 * s);
  return out.sort((p, q) => p - q);
}
/** Why the strip beside the yard can't take more loading tracks, in plain words, or ''. */
export function stripError(g: Game, b: Building): string {
  const n = g.world.n;
  for (const i of stripSquares(n, b)) {
    if (g.track.has(i)) return 'your track runs along the strip beside its yard (the side away from the building): move that track off it';
    const x = i % n, y = (i / n) | 0, t = g.world.terr[i];
    if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) return 'its yard is at the edge of the map';
    if (!isRevealed(g, i)) return 'the strip beside its yard is still in the fog';
    if (t === T.Water) return 'there is water beside its yard';
    if (t === T.Mountain) return 'there is mountain beside its yard';
    for (const o of g.s.buildings ?? []) if (o !== b && footprint(n, o).includes(i)) return `the ${INDUSTRIES[o.kind].name} stands beside its yard`;
    for (const s of g.s.sites) if (s.kind === 'town' && Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1) return `${s.name} is right beside its yard`;
    if (g.s.shed && g.s.shed.x === x && g.s.shed.y === y) return 'the engine shed stands beside its yard';
    const st = g.s.sites.find(o => o.x === x && o.y === y && o.kind !== 'town');
    if (st) return st.kind === 'plot' ? 'a settlement site is beside its yard' : 'a deposit is beside its yard';
  }
  return '';
}

/** Price of the next building of this kind: +25% for every one already built. */
export function priceOf(g: Game, kind: IndustryKind): number {
  const have = (g.s.buildings ?? []).filter(b => b.kind === kind).length;
  return Math.round(INDUSTRIES[kind].price * Math.pow(1.25, have) / 50) * 50;
}

/** Squares within `r` of the building row (for forest, fields and pasture). */
function around(g: Game, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side'>, r: number): number[] {
  const n = g.world.n, own = new Set(footprint(n, b)), out = new Set<number>();
  for (const i of buildingSquares(n, b)) {
    const x = i % n, y = (i / n) | 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
      const j = Y * n + X; if (!own.has(j)) out.add(j);
    }
  }
  return [...out];
}

/** How much of its full output the place gives (forest, fields or pasture around it), 0-1. `extra`: squares about to be built on. */
export function shareAt(g: Game, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side' | 'kind'>, extra?: Set<number>): number {
  const t = g.world.terr, taken = takenSquares(g), free = (i: number) => !taken.has(i) && !extra?.has(i);
  if (b.kind === 'wood') return Math.min(1, around(g, b, 2).filter(i => t[i] === T.Forest && free(i) && !g.s.stumps?.[i]).length / 6);
  if (b.kind === 'farm') return Math.min(1, around(g, b, 1).filter(i => t[i] === T.Grass && free(i)).length / 6);
  if (b.kind === 'wool') return Math.min(1, around(g, b, 1).filter(i => t[i] === T.Grass && free(i)).length / 6);
  return 1;
}

/** Forest squares a lumber camp can cut now (within 2 squares, not covered, not cut down), most cut first. */
export function forestOf(g: Game, b: Building): number[] {
  const t = g.world.terr, taken = takenSquares(g), cut = g.s.cut ?? {};
  return around(g, b, 2).filter(i => t[i] === T.Forest && !taken.has(i) && !g.s.stumps?.[i]).sort((p, q) => (cut[q] ?? 0) - (cut[p] ?? 0) || p - q);
}

/** Forest squares around a lumber camp that are cut down and growing back. */
export const stumpsOf = (g: Game, b: Building) => around(g, b, 2).filter(i => g.s.stumps?.[i] !== undefined);

/** The squares a wheat or sheep farm works (its fields or pasture): free grass next to it, at most six. */
export function fieldSquares(g: Game, b: Building): number[] {
  if (b.kind !== 'farm' && b.kind !== 'wool') return [];
  const t = g.world.terr, taken = takenSquares(g);
  return around(g, b, 1).filter(i => t[i] === T.Grass && !taken.has(i)).slice(0, 6);
}

/** Buildings that would make less if these squares were built on, and how much less per minute. */
export function harmOf(g: Game, squares: number[]): { b: Building; lost: number }[] {
  const extra = new Set(squares), out: { b: Building; lost: number }[] = [];
  for (const b of g.s.buildings ?? []) {
    if (b.kind !== 'wood' && b.kind !== 'farm' && b.kind !== 'wool') continue;
    const before = shareAt(g, b), after = shareAt(g, b, extra);
    if (after < before) out.push({ b, lost: Math.round(INDUSTRIES[b.kind].rate * (1 + 0.5 * (b.lvl - 1)) * (before - after) * 60) });
  }
  return out;
}
export const harmText = (h: { b: Building; lost: number }[]) => h.length ? ` · ⚠ covers ${h.map(x => `${x.b.kind === 'wood' ? 'trees' : 'fields'} of the ${INDUSTRIES[x.b.kind].name} (−${x.lost}/min)`).join(', ')}` : '';

/** Squares already used by track, buildings, towns and the shed. */
export function takenSquares(g: Game, except?: Building): Set<number> {
  const key = `${g.track.size}/${g.s.buildings?.length ?? 0}/${(g.s.buildings ?? []).reduce((a, b) => a + tracksOf(b), 0)}/${g.s.shed?.x},${g.s.shed?.y}/${g.s.sites.filter(s => s.kind === 'town').length}/${g.s.parks?.length ?? 0}`;
  if (!except && g.taken?.key === key && g.taken.net === g.net) return g.taken.set;
  const n = g.world.n, out = new Set<number>(g.track.keys());
  for (const b of g.s.buildings ?? []) if (b !== except) for (const i of footprint(n, b)) out.add(i);
  for (const s of g.s.sites) if (s.kind === 'town') for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.add((s.y + dy) * n + s.x + dx);
  if (g.s.shed) out.add(g.s.shed.y * n + g.s.shed.x);
  for (const p of g.s.parks ?? []) out.add(p.y * n + p.x);
  if (!except) g.taken = { key, net: g.net, set: out };
  return out;
}

/**
 * Can this building go here? Returns the reason in plain words (and what to do instead), or ''.
 * Placement is permissive: any spot that works is allowed.
 */
export function placeError(g: Game, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side' | 'kind'>): string {
  const n = g.world.n, info = INDUSTRIES[b.kind], t = g.world.terr;
  for (const i of footprint(n, b)) { const e = squareError(g, b, i); if (e) return e; }
  if (MINES.has(b.kind)) {
    const dep = depositUnder(g, b);
    if (!dep) return `A ${info.name} must stand on ${info.needs}`;
    if (!isMountainFoot(g.world, dep.x, dep.y) && (b.kind === 'stone' || b.kind === 'coal')) return 'This deposit is not at the foot of mountains';
  } else if (b.kind === 'dock') {
    return dockReachError(g, b);
  } else if (b.kind === 'wool' && buildingSquares(n, b).some(i => t[i] !== T.Grass)) {
    return 'A Sheep Farm stands on grassland: move it off the hills and woods onto open grass';
  } else if (shareAt(g, b) < 2 / 6) {
    return `A ${info.name} needs ${info.needs}: there is too little here`;
  }
  return '';
}

/** The outline squares that can't be used, so the outline marks only those red. */
export const badSquares = (g: Game, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side' | 'kind'>) => footprint(g.world.n, b).filter(i => squareError(g, b, i));

/** Links along a yard's line (east-west or north-south). */
const alongMask = (horizontal: boolean) => horizontal ? 0b0101 : 0b1010;

/**
 * Why one square of the outline can't be used, in plain words with what to do instead, or ''.
 * A loading-track square may sit on your own straight track when the rails run the same way: the yard joins that line.
 */
function squareError(g: Game, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side' | 'kind'>, i: number): string {
  const n = g.world.n, info = INDUSTRIES[b.kind], t = g.world.terr, x = i % n, y = (i / n) | 0;
  const inRow = buildingSquares(n, b).includes(i); // mines dig into the mountain: their building row may stand on it
  if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) return 'Too close to the edge of the map';
  if (!isRevealed(g, i)) return 'Part of this spot is still in the fog: explore it first';
  const pier = b.kind === 'dock' && inRow;
  // a ragged coast is fine: the pier needs at least 2 of its 4 squares over the water, and stands on the shore for the rest
  if (pier && t[i] !== T.Water && (t[i] === T.Mountain || buildingSquares(n, b).filter(j => t[j] === T.Water).length < 2)) return t[i] === T.Mountain ? 'A dock\'s pier can\'t stand on mountain: slide it along the coast' : 'A dock\'s pier stands over the water: turn it so at least half of the green row is on the sea';
  if (t[i] === T.Water && !pier) return b.kind === 'dock' ? 'A dock\'s yard track goes on the shore: turn it so the blue row is on land' : 'Part of this spot is water: pick dry land';
  if (t[i] === T.Mountain && !(MINES.has(b.kind) && inRow)) return MINES.has(b.kind) ? 'The blue loading track needs flat land: turn it so the green row is on the mountain and the blue row beside it' : 'The yard track can\'t go on mountain: turn it to the flat land';
  const taken = takenSquares(g).has(i); // buildings, towns, the shed and track: the checks below only matter on these squares
  if (taken) for (const o of g.s.buildings ?? []) if (footprint(n, o).includes(i)) return `The ${INDUSTRIES[o.kind].name} is in the way (red squares): move the outline to open land`;
  if (taken) for (const s of g.s.sites) if (s.kind === 'town' && Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1) return `Too close to ${s.name}: towns keep the squares around them free`;
  if (g.s.shed && g.s.shed.x === x && g.s.shed.y === y) return 'The engine shed is in the way: move the outline off it';
  if (taken) { const p = (g.s.parks ?? []).find(q => q.x === x && q.y === y); if (p) return `${parkName(g, p)} is in the way: move the outline to open land`; }
  const tr = g.track.get(i);
  if (tr) {
    if (inRow) return 'Your track runs under the green building row: slide the outline so only the blue row sits on your line';
    if (hallAt(hallsOf(g.track, n, g.s.sites, g.world.terr), i)) return 'A station is in the way: move the outline off the platforms';
    if (tr.links & ~alongMask(b.horizontal)) return 'Your track crosses the blue loading track: turn the outline so the blue row runs along your rails';
  }
  const s = g.s.sites.find(o => o.x === x && o.y === y);
  if (s && s.kind === 'plot') return 'A settlement site is here: keep it free for a town';
  if (s && s.kind === 'dep' && !(MINES.has(b.kind) && inRow && s.res === info.makes)) return MINES.has(b.kind) && s.res === info.makes ? 'The deposit must be under the green building row, not the blue track' : 'A deposit is here: only a mine for it can stand on it';
  return '';
}

export function depositUnder(g: Game, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side' | 'kind'>): Site | undefined {
  const n = g.world.n, sq = new Set(buildingSquares(n, b)), res = INDUSTRIES[b.kind].makes;
  return g.s.sites.find(s => s.kind === 'dep' && !s.hidden && s.res === res && sq.has(s.y * n + s.x));
}

/** Every way the building could stand with its building row on square (x, y): both directions, both sides. */
export function placementsAt(kind: IndustryKind, x: number, y: number) {
  const out: { x: number; y: number; horizontal: boolean; side: 1 | -1; kind: IndustryKind }[] = [];
  for (const horizontal of [true, false]) for (const side of [1, -1] as const) for (let k = 0; k < YARD_LEN; k++) {
    // the tapped square is in the building row; the yard runs beside it
    const yx = horizontal ? x - k : x - side, yy = horizontal ? y - side : y - k;
    out.push({ x: yx, y: yy, horizontal, side, kind });
  }
  return out;
}

/** The best way to place a building with its building row on (x, y): fits, most output, yard nearest the network. */
export function bestPlacement(g: Game, kind: IndustryKind, x: number, y: number) {
  const n = g.world.n;
  let best: ReturnType<typeof placementsAt>[number] | null = null, bs = -Infinity, why = '';
  for (const p of placementsAt(kind, x, y)) {
    const e = placeError(g, p);
    if (e) { why ||= e; continue; }
    const ends = yardSquares(n, p), a = ends[0]!, z = ends[YARD_LEN - 1]!;
    let near = 99;
    for (const i of g.track.keys()) { const d = Math.min(dist(n, a, i), dist(n, z, i)); if (d < near) near = d; }
    const s = shareAt(g, p) * 10 - near * 0.5;
    if (s > bs) { bs = s; best = p; }
  }
  return best ? { place: best, why: '' } : { place: null, why: why || 'No room for a 2×4 yard here' };
}
const dist = (n: number, a: number, b: number) => Math.abs((a % n) - (b % n)) + Math.abs(((a / n) | 0) - ((b / n) | 0));

/** Build it: pay, lay the yard track, and add it. */
export function build(g: Game, p: ReturnType<typeof placementsAt>[number]): Building | string {
  const e = lockedText(g, p.kind) || placeError(g, p); if (e) return e;
  const price = priceOf(g, p.kind);
  if (price > g.s.money) return `Need $${(price - g.s.money).toLocaleString('en-US')} more`;
  g.s.money -= price;
  const dep = depositUnder(g, p);
  const b: Building = { id: g.s.nextId++, ...p, lvl: 1, stock: 0, paid: price, ...(dep ? { dep: dep.id } : {}) };
  (g.s.buildings ??= []).push(b);
  // the yard's own track: four squares in a line
  const n = g.world.n, sq = yardSquares(n, b);
  for (let k = 0; k < sq.length; k++) {
    const cur = g.track.get(sq[k]!) ?? { links: 0 };
    const along = b.horizontal ? (k > 0 ? 1 << 2 : 0) | (k < sq.length - 1 ? 1 : 0) : (k > 0 ? 1 << 3 : 0) | (k < sq.length - 1 ? 1 << 1 : 0);
    cur.links |= along; g.track.set(sq[k]!, cur);
  }
  joinYardEnds(g, b);
  return b;
}

/** A yard placed with an end against existing track joins it there (only at its ends, as everywhere). Returns how many ends joined. */
export function joinYardEnds(g: Game, b: Building): number {
  const n = g.world.n, sq = yardSquares(n, b), step = b.horizontal ? 1 : n;
  const out = b.horizontal ? [2, 0] : [3, 1]; // direction out of the first end, out of the last end
  let joined = 0;
  [[sq[0]!, sq[0]! - step, out[0]!], [sq.at(-1)!, sq.at(-1)! + step, out[1]!]].forEach(([end, next, d]) => {
    const o = g.track.get(next!); if (!o) return;
    if (stationLinkError(g.track, n, g.s.sites, end!, next!, g.world.terr) || yardLinkError(g, end!, next!)) return;
    g.track.get(end!)!.links |= 1 << d!; o.links |= 1 << ((d! + 2) % 4); joined++;
  });
  return joined;
}

/** Output per second, stock cap (by level). */
export const outputOf = (g: Game, b: Building) => b.kind === 'dock' ? 0 : isFactory(b.kind) ? 0.35 + 0.25 * b.lvl : INDUSTRIES[b.kind].rate * (1 + 0.5 * (b.lvl - 1)) * shareAt(g, b) * specMul(g, g.world.islandOf[yardSquares(g.world.n, b)[0]!]!, b.kind) * ruinsMul(g, b.x, b.y) * kindMul(g, b.kind, b.x, b.y);
export const capOf = (b: Building) => 80 + 40 * (b.lvl - 1);

/** Why linking neighbour squares a and b would break a yard (joined from its long side), or ''. */
export function yardLinkError(g: Game, a: number, b: number): string {
  const n = g.world.n, horizontalLink = ((a / n) | 0) === ((b / n) | 0);
  for (const bd of g.s.buildings ?? []) {
    const sq = yardSquares(n, bd);
    if ((sq.includes(a) || sq.includes(b)) && horizontalLink !== bd.horizontal) return `Track can only enter the ${INDUSTRIES[bd.kind].name}'s yard at its two ends`;
    const bs = buildingSquares(n, bd);
    if (bs.includes(a) || bs.includes(b)) return `The ${INDUSTRIES[bd.kind].name} stands here`;
    if (tracksOf(bd) > 2) { const st = stripSquares(n, bd); if (st.includes(a) || st.includes(b)) return `The ${INDUSTRIES[bd.kind].name}'s extra loading tracks run here`; }
  }
  return '';
}

/** Track squares joined to Ashford by rails (loose yards are not part of the railway until track reaches them). */
export function linkedSquares(g: Game): Set<number> {
  const n = g.world.n, a = g.s.sites[0]!, start = a.y * n + a.x, out = new Set<number>();
  if (!g.track.has(start)) return out;
  const q = [start]; out.add(start);
  // landings on other islands reached by sea from a dock already joined start their island's railway
  for (let pass = 0; pass < 6; pass++) {
    const before = out.size; flood(g, q, out);
    for (const i of landingSeeds(g, out)) if (!out.has(i) && g.track.has(i)) { out.add(i); q.push(i); }
    if (out.size === before) break;
  }
  return out;
}

function flood(g: Game, q: number[], out: Set<number>) {
  const n = g.world.n;
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!, sq = g.track.get(i)!;
    for (const [d, j] of [[0, i + 1], [1, i + n], [2, i - 1], [3, i - n]] as const) {
      if (!(sq.links & (1 << d)) || out.has(j)) continue;
      const o = g.track.get(j); if (!o || !(o.links & (1 << ((d + 2) % 4)))) continue;
      out.add(j); q.push(j);
    }
  }
  return out;
}

export const isLinked = (g: Game, b: Building) => g.linked?.has(yardSquares(g.world.n, b)[0]!) ?? false;

/**
 * The nearest place on uncovered land where this kind fits, searching out from (cx, cy); null when there is none.
 * Mines only look at their deposits; other kinds look within `R` squares.
 */
export function nearestSpot(g: Game, kind: IndustryKind, cx: number, cy: number, R = 30): { x: number; y: number } | null {
  const n = g.world.n;
  if (MINES.has(kind)) {
    const res = INDUSTRIES[kind].makes;
    const deps = g.s.sites.filter(s => s.kind === 'dep' && s.res === res && !s.hidden && isRevealed(g, s.y * n + s.x))
      .sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy));
    for (const d of deps) if (bestPlacement(g, kind, d.x, d.y).place) return { x: d.x, y: d.y };
    return null;
  }
  for (let r = 0; r <= R; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1 || !isRevealed(g, y * n + x)) continue;
    if (bestPlacement(g, kind, x, y).place) return { x, y };
  }
  return null;
}

/** Why there is nowhere to build this kind yet, and what to do. */
export const noSpotText = (kind: IndustryKind) => MINES.has(kind)
  ? `No ${INDUSTRIES[kind].needs.replace(/^an? /, '').replace(/ at the foot of mountains| \((outer islands|far seas)\)/g, '')} uncovered yet: lay track toward the mountains to uncover more land`
  : `No room for a ${INDUSTRIES[kind].name} on uncovered land: it needs ${INDUSTRIES[kind].needs}`;

/** "Ashford's park" / "Ashford's Clock Tower", for refusals. */
export function parkName(g: Game, p: { town: number; k: string }): string {
  const t = g.s.sites.find(s => s.id === p.town)?.name ?? 'a town';
  return `${t}'s ${{ park: 'park', clock: 'Clock Tower', market: 'Market Hall', tram: 'Tram Line', theatre: 'Grand Theatre' }[p.k] ?? 'park'}`;
}
