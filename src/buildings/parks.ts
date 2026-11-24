import type { Game, Site } from '../state.ts';
import { isRevealed } from '../world/fog.ts';
import { T, TILE } from '../world/terrain.ts';
import { labelAt } from '../render/stations.ts';
import { hash } from '../core/rng.ts';
import { takenSquares, yardSet } from './industries.ts';
import { hallsOf } from './stations.ts';

/**
 * 🌳 Town parks and 🏛 town projects, as in the old game. Each one takes one square near the town, is drawn there,
 * and gives a small lasting bonus to that town only. Parks make its orders smaller; projects make deliveries there
 * pay more (the Tram Line makes orders smaller instead). Nothing here earns money by itself.
 */
export type ParkKind = 'park' | 'clock' | 'market' | 'tram' | 'theatre' | 'foundry' | 'bridgeworks' | 'grandstation' | 'cathedral' | 'exhibition';
export interface Park { town: number; x: number; y: number; k: ParkKind; /** 🧭 a Frontier Village perk building: drawn as k, its effect is the perk's alone */ fp?: string }

/** up to 3 parks per town, each making its orders 5% smaller */
export const PARK_PRICE = [5000, 10000, 20000];
export const PARK_ORDER = 0.05;

export interface Project { k: Exclude<ParkKind, 'park'>; icon: string; name: string; price: number; size: number; pay?: number; order?: number; text: string; /** Ashford only, from this Railway level */ ashford?: boolean; rlv?: number }
/** size = the town's step it needs (2 Town, 3 City, 4 Metropolis) */
export const PROJECTS: Project[] = [
  // the old game's Ashford landmark: it casts the iron for tunnel linings, so track can cross mountains
  { k: 'foundry', icon: '⛰', name: 'Foundry', price: 6000, size: 0, ashford: true, rlv: 2, text: 'Tunnels: track can cross mountains ($250 a square)' },
  // the old game's 🌉 Bridge Works: here it builds strait bridges, so sister islands a few squares apart can be joined by rail
  { k: 'bridgeworks', icon: '🌉', name: 'Bridge Works', price: 18000, size: 0, ashford: true, rlv: 6, text: 'Strait bridges anywhere on the map: track may cross up to 3 squares of sea between two islands ($4,000 a square)' },
  // 🏛 Grand Ashford: late-game landmarks that turn spare money into lasting help (and one medal for show)
  { k: 'grandstation', icon: '🚉', name: 'Grand Station', price: 50000, size: 3, ashford: true, rlv: 6, text: 'Trains load and unload 25% faster everywhere on Ashford Isle' },
  { k: 'cathedral', icon: '⛪', name: 'Cathedral', price: 100000, size: 4, ashford: true, rlv: 7, text: 'Every town order pays a 5% bigger reward' },
  { k: 'exhibition', icon: '🏛', name: 'Royal Exhibition Hall', price: 200000, size: 4, ashford: true, rlv: 8, text: 'Wins the 🏛 Royal Exhibition medal and the Royal Mail train paint' },
  { k: 'clock', icon: '🕰', name: 'Clock Tower', price: 15000, size: 2, pay: 0.10, text: 'Deliveries to this town pay 10% more' },
  { k: 'market', icon: '🛒', name: 'Market Hall', price: 30000, size: 3, pay: 0.15, text: 'Deliveries to this town pay 15% more' },
  { k: 'tram', icon: '🚋', name: 'Tram Line', price: 50000, size: 3, order: 0.05, text: 'Its orders are 5% smaller' },
  { k: 'theatre', icon: '🎭', name: 'Grand Theatre', price: 80000, size: 4, pay: 0.20, text: 'Deliveries to this town pay 20% more' },
];
export const projectOf = (k: ParkKind) => PROJECTS.find(p => p.k === k);
/** The projects a town can have (the Foundry is Ashford's alone). */
export const projectsFor = (g: Game, t: Site) => PROJECTS.filter(P => !P.ashford || t === g.s.sites[0]);
/** ⛰ Has Ashford built the Foundry? Then track may tunnel through mountains. */
export const hasTunnels = (g: Game) => (g.s.parks ?? []).some(p => p.k === 'foundry') || !!(g.s as { fr?: { perks: { k: string }[] } }).fr?.perks.some(p => p.k === 'tunnel');

/** 🚉 Grand Station: load and unload time on Ashford Isle. */
export const GRAND_LOAD = 0.75;
export const hasGrandStation = (g: Game) => (g.s.parks ?? []).some(p => p.k === 'grandstation');
/** ⛪ Cathedral: order rewards 5% bigger. */
export const CATHEDRAL_PAY = 0.05;
export const rewardMul = (g: Game) => (g.s.parks ?? []).some(p => p.k === 'cathedral') ? 1 + CATHEDRAL_PAY : 1;

export const parksOf = (g: Game, t: Site) => (g.s.parks ?? []).filter(p => p.town === t.id && p.k === 'park' && !p.fp);
export const projectsOf = (g: Game, t: Site) => (g.s.parks ?? []).filter(p => p.town === t.id && p.k !== 'park' && !p.fp);
export const hasProject = (g: Game, t: Site, k: ParkKind) => (g.s.parks ?? []).some(p => p.town === t.id && p.k === k && !p.fp);

/** Order sizes at this town: 5% smaller per park, and 5% smaller with a Tram Line. */
export function orderMul(g: Game, t: Site): number {
  let m = 1;
  for (const p of g.s.parks ?? []) if (p.town === t.id && !p.fp) m -= p.k === 'park' ? PARK_ORDER : projectOf(p.k)?.order ?? 0;
  return Math.max(0.5, m);
}
/** Pay for deliveries to this town: 1 plus each project's bonus. */
export function payMul(g: Game, t: Site): number {
  let m = 1;
  for (const p of g.s.parks ?? []) if (p.town === t.id) m += p.fp ? (p.fp === 'market' ? 0.3 : 0) : projectOf(p.k)?.pay ?? 0;
  return m;
}

/** The park or project standing on a square. */
export const parkAt = (g: Game, i: number) => (g.s.parks ?? []).find(p => p.y * g.world.n + p.x === i);

/** Can a park or project stand on this square: open grass in sight, no track, buildings, station or other park. */
export function parkFree(g: Game, x: number, y: number): boolean {
  const n = g.world.n, i = y * n + x;
  if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) return false;
  if (g.world.terr[i] !== T.Grass || !isRevealed(g, i) || takenSquares(g).has(i) || parkAt(g, i)) return false;
  if (g.s.sites.some(s => s.x === x && s.y === y)) return false;
  // keep clear of station halls and the station building beside them
  for (const h of hallsOf(g.track, n, g.s.sites, g.world.terr, yardSet(g))) for (const q of h.squares) if (Math.abs(q % n - x) <= 1 && Math.abs(((q / n) | 0) - y) <= 1) return false;
  return true;
}

/** The best free square 2-4 squares from the town centre: near, away from the rails. */
export function parkSpot(g: Game, t: Site, clearLabel = false): { x: number; y: number } | null {
  const n = g.world.n; let best: { x: number; y: number } | null = null, bd = Infinity;
  // 👑 Grand Ashford landmarks keep clear of the town's name board, so they are seen whole
  let box: [number, number, number, number] | null = null;
  if (clearLabel) {
    const w = Math.max((t.name ?? '').length * 7.5 + 12, 150), Hb = 12 * 1.75 + 14;
    const { LX, BT } = labelAt(g.s.seed, t, hallsOf(g.track, n, g.s.sites, g.world.terr, yardSet(g)).find(h => h.town === t), n, w, Hb);
    box = [LX - w / 2 - 4, BT - 8, LX + w / 2 + 4, BT + Hb + 16];
  }
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const d = Math.hypot(dx, dy); if (d < 2 || d > 4.3) continue;
    const x = t.x + dx, y = t.y + dy; if (!parkFree(g, x, y)) continue;
    if (box && x * TILE < box[2] && (x + 1) * TILE > box[0] && y * TILE < box[3] && (y + 1) * TILE > box[1]) continue;
    let adj = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.track.has((y + b!) * n + x + a!)) adj++;
    const sc = d + adj * 2 + hash(g.s.seed, x, y, 5) * 0.3;
    if (sc < bd) { bd = sc; best = { x, y }; }
  }
  return best;
}

const fmt = (v: number) => '$' + Math.round(v).toLocaleString('en-US');
const NO_ROOM = (t: Site) => `No free grass near ${t.name}: track, water or buildings fill every square 2-4 squares from its centre`;

/** The price of the next park, or null when the town has all 3. */
export const nextParkPrice = (g: Game, t: Site) => PARK_PRICE[parksOf(g, t).length] ?? null;

/** Open a park in a town. Returns why not, or ''. */
export function buyPark(g: Game, t: Site): string {
  const c = nextParkPrice(g, t); if (c === null) return `${t.name} already has 3 parks`;
  if ((t.pop ?? 0) <= 0) return `Join ${t.name} to your railway first`;
  if (g.s.money < c) return `Need ${fmt(c - Math.floor(g.s.money))} more`;
  const p = parkSpot(g, t); if (!p) return NO_ROOM(t);
  g.s.money -= c; (g.s.parks ??= []).push({ town: t.id, ...p, k: 'park' });
  return '';
}

/** Why a project can't be built in this town right now, or ''. */
export function projectError(g: Game, t: Site, k: ParkKind): string {
  const P = projectOf(k); if (!P) return 'Unknown project';
  if (hasProject(g, t, k)) return `${t.name} already has a ${P.name}`;
  if (P.ashford && t !== g.s.sites[0]) return `Only Ashford can build the ${P.name}`;
  if (P.rlv && (g.s.rlv ?? 0) < P.rlv) return `Needs Railway level ${P.rlv}: fill more town orders`;
  if ((t.lvl ?? 0) < P.size) return `${t.name} must grow into a ${['Hamlet', 'Village', 'Town', 'City', 'Metropolis'][P.size]} first`;
  if (g.s.money < P.price) return `Need ${fmt(P.price - Math.floor(g.s.money))} more`;
  return '';
}

/** Build a town project. Returns why not, or ''. */
export function buyProject(g: Game, t: Site, k: ParkKind): string {
  const e = projectError(g, t, k); if (e) return e;
  const P = projectOf(k)!, p = (P.ashford && P.size >= 3 ? parkSpot(g, t, true) : null) ?? parkSpot(g, t); if (!p) return NO_ROOM(t);
  g.s.money -= P.price; (g.s.parks ??= []).push({ town: t.id, ...p, k });
  return '';
}
