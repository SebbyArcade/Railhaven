import type { Game } from '../state.ts';
import { isFactory } from '../buildings/industries.ts';
import { stepOf, townLinked } from '../economy/towns.ts';
import { FISHING, FLEET, type FleetKey, fleetLvl, MAX_LVL } from '../economy/upgrades.ts';
import { INDUSTRIES, type IndustryKind } from '../buildings/industries.ts';
import { railDist } from '../economy/shipping.ts';
import { hallOf } from '../buildings/stations.ts';
import { RLV } from '../economy/dispatch.ts';
import { ashford, msOf, reachedIslands } from './missions.ts';

/**
 * Achievements: medals earned in any game and kept across all of them (in the player's profile, not in a game).
 * Each medal gives XP; XP unlocks looks (train paints, town themes) that change nothing in play.
 * No medal can be missed for good, and none pays money (money comes only from deliveries and selling).
 */

export interface Profile {
  /** medal id -> when it was earned (ms since 1970) */
  medals: Record<string, number>;
  /** orders filled across all games */
  orders: number;
  /** map numbers of games played */
  seeds: number[];
  /** looks picked */
  paint?: string; theme?: string;
}
export const emptyProfile = (): Profile => ({ medals: {}, orders: 0, seeds: [] });

export type Group = 'start' | 'orders' | 'deliveries' | 'towns' | 'industry' | 'upgrades' | 'explore' | 'sea' | 'track' | 'railway';
export const GROUPS: { k: Group; icon: string; name: string }[] = [
  { k: 'start', icon: '🚩', name: 'First steps' }, { k: 'orders', icon: '📋', name: 'Orders' }, { k: 'deliveries', icon: '📦', name: 'Deliveries' },
  { k: 'towns', icon: '🏘', name: 'Towns' }, { k: 'industry', icon: '🏭', name: 'Buildings' }, { k: 'upgrades', icon: '⬆', name: 'Upgrades' },
  { k: 'explore', icon: '🧭', name: 'Islands' }, { k: 'sea', icon: '⚓', name: 'Ships and sea' }, { k: 'track', icon: '🛤', name: 'Track' },
  { k: 'railway', icon: '⭐', name: 'Railway' },
];

export interface Medal { id: string; g: Group; icon: string; name: string; how: string; xp: number; prog: (g: Game, p: Profile) => [number, number] }

const towns = (g: Game) => g.s.sites.filter(s => s.kind === 'town');
const linkedTowns = (g: Game) => towns(g).filter(t => t !== ashford(g) && townLinked(g, t));
const biggest = (g: Game) => Math.max(0, ...towns(g).filter(t => (t.pop ?? 0) > 0).map(t => stepOf(t)));
const blds = (g: Game) => g.s.buildings ?? [];
const has = (b: boolean): [number, number] => [b ? 1 : 0, 1];
const PRODUCTS = ['planks', 'bricks', 'flour', 'steel', 'fuel', 'cloth', 'cans', 'glass', 'tools', 'furniture', 'jewellery', 'chocolate', 'tyres'];
const islandAt = (g: Game, s: { x: number; y: number }) => g.world.islandOf[s.y * g.world.n + s.x]!;
const newIslands = (g: Game) => reachedIslands(g).size - 1;
const islandsWithTowns = (g: Game) => new Set(linkedTowns(g).map(t => islandAt(g, t)).filter(k => k !== g.world.home)).size;
const docks = (g: Game) => blds(g).filter(b => b.kind === 'dock');
const dockIslands = (g: Game) => new Set(docks(g).map(b => g.world.islandOf[b.y * g.world.n + b.x] ?? -1)).size;
const explored = (g: Game) => { let n = 0; for (const v of g.s.fog) for (let b = v; b; b &= b - 1) n++; return n / (g.world.n * g.world.n); };
const railIslands = (g: Game) => new Set(g.s.track.map(t => g.world.islandOf[t[0]]).filter(k => k !== undefined && k >= 0)).size;
const doubled = (g: Game) => g.s.track.filter(t => t[2]).length;
const TOP_LVL = RLV.length - 1;
/** Fresh Start: a map counts once it reaches this Railway level, so starting and quitting doesn't count */
export const FRESH_LVL = 2;
const KINDS = Object.keys(INDUSTRIES) as IndustryKind[];
const kindsBuilt = (g: Game) => new Set(blds(g).map(b => b.kind)).size;
const mostOfOne = (g: Game) => Math.max(0, ...KINDS.map(k => blds(g).filter(b => b.kind === k).length));
/** best level of an upgrade on any island */
const topLvl = (g: Game, k: FleetKey) => Math.max(0, ...Object.keys(g.s.fleetI ?? {}).map(i => fleetLvl(g, k, +i)));
const fleetBought = (g: Game) => (Object.keys(FLEET) as FleetKey[]).reduce((a, k) => a + topLvl(g, k), 0);
const fleetMax = (Object.keys(FLEET) as FleetKey[]).reduce((a, k) => a + FLEET[k].lv.length - 1, 0);
/** the farthest track square from Ashford's station, in squares along the rails */
function reach(g: Game) {
  const h = hallOf(g.track, g.world.n, ashford(g), g.world.terr); if (!h) return 0;
  const d = railDist(g, 'achAshford', h.squares); let m = 0; for (const v of d) if (v > m) m = v; return m;
}
function farShore(g: Game) {
  const r = reachedIslands(g);
  return g.s.sites.some(s => s.kind === 'dep' && (s.res === 'iron' || s.res === 'oil') && islandAt(g, s) !== g.world.home && r.has(islandAt(g, s)));
}

export const MEDALS: Medal[] = [
  { id: 'track', g: 'start', icon: '🛤', name: 'Wake the Line', how: 'Lay your first track from Ashford', xp: 10, prog: g => has(g.s.track.length > 0) },
  { id: 'train', g: 'start', icon: '🚂', name: 'First Whistle', how: 'Buy your first train', xp: 10, prog: g => has(g.s.trains.length > 0) },
  { id: 'link', g: 'start', icon: '🤝', name: 'Opening Day', how: 'Link your first town to Ashford', xp: 10, prog: g => has(linkedTowns(g).length > 0) },
  { id: 'order1', g: 'start', icon: '✅', name: 'Paid in Full', how: 'Fill your first order', xp: 10, prog: g => has((g.s.orders ?? 0) > 0) },
  { id: 'order25', g: 'orders', icon: '📋', name: 'Busy Office', how: 'Fill 25 orders in one game', xp: 25, prog: g => [g.s.orders ?? 0, 25] },
  { id: 'order100', g: 'orders', icon: '📚', name: 'Ledger Full', how: 'Fill 100 orders in one game', xp: 50, prog: g => [g.s.orders ?? 0, 100] },
  { id: 'rush', g: 'orders', icon: '⚡', name: 'Rush Job', how: 'Finish a rush', xp: 25, prog: g => has((g.s.rushDone ?? 0) > 0) },
  { id: 'order250', g: 'orders', icon: '🗃', name: 'Order Book', how: 'Fill 250 orders in one game', xp: 75, prog: g => [g.s.orders ?? 0, 250] },
  { id: 'order2000', g: 'orders', icon: '🎖', name: 'Lifetime Railwayman', how: 'Fill 2,000 orders across all your games', xp: 75, prog: (_g, p) => [p.orders, 2000] },
  { id: 'loads100', g: 'deliveries', icon: '🚂', name: 'Regular Service', how: 'Trains deliver 100 loads in one game', xp: 10, prog: g => [g.s.loads ?? 0, 100] },
  { id: 'loads1000', g: 'deliveries', icon: '🕰', name: 'Like Clockwork', how: 'Trains deliver 1,000 loads in one game', xp: 25, prog: g => [g.s.loads ?? 0, 1000] },
  { id: 'loads10000', g: 'deliveries', icon: '🏅', name: 'Ten Thousand Trips', how: 'Trains deliver 10,000 loads in one game', xp: 75, prog: g => [g.s.loads ?? 0, 10000] },
  { id: 'earn100k', g: 'deliveries', icon: '💰', name: 'Six Figures', how: 'Earn $100,000 in one game', xp: 25, prog: g => [Math.floor(g.s.earned ?? 0), 100000] },
  { id: 'earn1m', g: 'deliveries', icon: '💎', name: 'Rail Baron', how: 'Earn $1,000,000 in one game', xp: 50, prog: g => [Math.floor(g.s.earned ?? 0), 1000000] },
  { id: 'earn10m', g: 'deliveries', icon: '🏦', name: 'Golden Spike', how: 'Earn $10,000,000 in one game', xp: 75, prog: g => [Math.floor(g.s.earned ?? 0), 10000000] },
  { id: 'order500', g: 'orders', icon: '🏆', name: 'Never Idle', how: 'Fill 500 orders across all your games', xp: 50, prog: (_g, p) => [p.orders, 500] },
  { id: 'village', g: 'towns', icon: '🏡', name: 'Village Green', how: 'Grow a town to Village', xp: 10, prog: g => [biggest(g), 1] },
  { id: 'city', g: 'towns', icon: '🏙', name: 'Bright Lights', how: 'Grow a town to City', xp: 25, prog: g => [biggest(g), 3] },
  { id: 'metro', g: 'towns', icon: '🌆', name: 'Skyline', how: 'Grow a town to Metropolis', xp: 25, prog: g => [biggest(g), 4] },
  { id: 'mega', g: 'towns', icon: '🌃', name: 'Megacity', how: 'Grow a town to Megacity', xp: 50, prog: g => [biggest(g), 5] },
  { id: 'towns10', g: 'towns', icon: '🗺', name: 'Well Connected', how: 'Link 10 towns in one game', xp: 25, prog: g => [linkedTowns(g).length, 10] },
  { id: 'towns25', g: 'towns', icon: '🧩', name: 'Grand Union', how: 'Link 25 towns in one game', xp: 50, prog: g => [linkedTowns(g).length, 25] },
  { id: 'mega3', g: 'towns', icon: '🌉', name: 'Three Megacities', how: 'Have 3 Megacities in one game', xp: 75, prog: g => [towns(g).filter(t => (t.pop ?? 0) > 0 && stepOf(t) >= 5).length, 3] },
  { id: 'ashmega', g: 'towns', icon: '🏰', name: 'Capital of the Isles', how: 'Grow Ashford to Megacity', xp: 50, prog: g => [stepOf(ashford(g)), 5] },
  { id: 'capital', g: 'towns', icon: '👑', name: 'Capital Pride', how: 'Grow Ashford to City', xp: 25, prog: g => [stepOf(ashford(g)), 3] },
  { id: 'factory', g: 'industry', icon: '🪚', name: 'Sawdust', how: 'Build your first factory', xp: 10, prog: g => has(blds(g).some(b => isFactory(b.kind))) },
  { id: 'chain', g: 'industry', icon: '🔗', name: 'Full Chain', how: 'Get something a factory made to a town', xp: 25, prog: g => has(towns(g).some(t => PRODUCTS.some(k => (t.got?.[k] ?? 0) > 0 || (t.steady?.[k] ?? 0) > 0))) },
  { id: 'mines', g: 'industry', icon: '⛏', name: 'Down the Mine', how: 'Have a stone quarry, coal mine and iron mine in one game', xp: 25, prog: g => [(['stone', 'coal', 'iron'] as const).filter(k => blds(g).some(b => b.kind === k)).length, 3] },
  { id: 'oil', g: 'industry', icon: '🛢', name: 'Black Gold', how: 'Bring oil from an oil well to where it is needed', xp: 25, prog: g => has(blds(g).some(b => (b.inbuf?.oil ?? 0) > 0) || towns(g).some(t => (t.got?.oil ?? 0) > 0)) },
  { id: 'kinds8', g: 'industry', icon: '🧰', name: 'Variety', how: 'Have 8 different kinds of building in one game', xp: 25, prog: g => [kindsBuilt(g), 8] },
  { id: 'kindsall', g: 'industry', icon: '🗂', name: 'Collector', how: `Have every kind of building (${KINDS.length}) in one game`, xp: 75, prog: g => [kindsBuilt(g), KINDS.length] },
  { id: 'same5', g: 'industry', icon: '🖐', name: 'Five of a Kind', how: 'Have 5 buildings of the same kind', xp: 25, prog: g => [mostOfOne(g), 5] },
  { id: 'blds25', g: 'industry', icon: '🏘', name: 'Industrial Estate', how: 'Have 25 buildings in one game', xp: 25, prog: g => [blds(g).length, 25] },
  { id: 'blds50', g: 'industry', icon: '🌇', name: 'Industrial Empire', how: 'Have 50 buildings in one game', xp: 50, prog: g => [blds(g).length, 50] },
  { id: 'maxlvl', g: 'upgrades', icon: '🏗', name: 'Big Works', how: `Raise any building to level ${MAX_LVL}`, xp: 25, prog: g => [Math.max(1, ...blds(g).map(b => b.lvl)), MAX_LVL] },
  { id: 'max10', g: 'upgrades', icon: '🏭', name: 'Fully Upgraded', how: `Have 10 buildings at level ${MAX_LVL}`, xp: 50, prog: g => [blds(g).filter(b => b.lvl >= MAX_LVL).length, 10] },
  { id: 'fleet1', g: 'upgrades', icon: '🔧', name: 'Shed Work', how: 'Buy your first Engine shed upgrade', xp: 10, prog: g => has(fleetBought(g) > 0) },
  { id: 'wagmax', g: 'upgrades', icon: '🚃', name: 'Heavy Haulers', how: 'Bigger wagons at their top level', xp: 25, prog: g => [topLvl(g, 'wag'), FLEET.wag.lv.length - 1] },
  { id: 'engmax', g: 'upgrades', icon: '⚙', name: 'Express Diesel', how: 'Stronger engines at their top level', xp: 25, prog: g => [topLvl(g, 'eng'), FLEET.eng.lv.length - 1] },
  { id: 'fleetmax', g: 'upgrades', icon: '🏆', name: 'Top of the Line', how: 'Every Engine shed upgrade at its top level', xp: 75, prog: g => [fleetBought(g), fleetMax] },
  { id: 'fishmax', g: 'upgrades', icon: '🦞', name: 'Full Nets', how: 'Give a dock every fishing upgrade', xp: 25, prog: g => [Math.max(0, ...docks(g).map(b => b.fish ?? 0)), FISHING.length] },
  { id: 'island', g: 'explore', icon: '🏝', name: 'Land Ho', how: 'Reach your first new island', xp: 25, prog: g => [newIslands(g), 1] },
  { id: 'island3', g: 'explore', icon: '🧭', name: 'Island Hopper', how: 'Reach 3 new islands in one game', xp: 50, prog: g => [newIslands(g), 3] },
  { id: 'island5', g: 'explore', icon: '🗺', name: 'Archipelago', how: 'Reach 5 new islands in one game', xp: 50, prog: g => [newIslands(g), 5] },
  { id: 'island8', g: 'explore', icon: '👑', name: 'Lord of the Isles', how: 'Reach 8 new islands in one game', xp: 75, prog: g => [newIslands(g), 8] },
  { id: 'isltowns', g: 'explore', icon: '🌉', name: 'Island Network', how: 'Link towns on 4 other islands in one game', xp: 50, prog: g => [islandsWithTowns(g), 4] },
  { id: 'far', g: 'explore', icon: '🌊', name: 'Far Shores', how: 'Reach an island with iron or oil', xp: 25, prog: g => has(farShore(g)) },
  { id: 'poi', g: 'explore', icon: '🗝', name: 'Treasure Hunter', how: 'Claim a landmark or salvage a shipwreck', xp: 25, prog: g => has((g.s.pois ?? []).some(p => p.got)) },
  { id: 'map25', g: 'explore', icon: '🔭', name: 'Cartographer', how: 'Explore a quarter of the whole map', xp: 50, prog: g => [Math.floor(explored(g) * 100), 25] },
  { id: 'ship', g: 'sea', icon: '🚢', name: 'First Sailing', how: 'Get your first cargo ship', xp: 10, prog: g => has((g.s.ships ?? []).length > 0) },
  { id: 'fish', g: 'sea', icon: '🎣', name: 'Catch of the Day', how: 'Put fishing boats on a dock', xp: 10, prog: g => has(docks(g).some(b => (b.fish ?? 0) > 0)) },
  { id: 'docks5', g: 'sea', icon: '🏗', name: 'Port Authority', how: 'Have 5 docks in one game', xp: 25, prog: g => [docks(g).length, 5] },
  { id: 'docks3', g: 'sea', icon: '⚓', name: 'Three Harbours', how: 'Have docks on 3 different islands', xp: 25, prog: g => [dockIslands(g), 3] },
  { id: 'ships5', g: 'sea', icon: '⛴', name: 'Merchant Fleet', how: 'Run 5 cargo ships at once', xp: 25, prog: g => [(g.s.ships ?? []).length, 5] },
  { id: 'ships10', g: 'sea', icon: '🛳', name: 'Shipping Line', how: 'Run 10 cargo ships at once', xp: 50, prog: g => [(g.s.ships ?? []).length, 10] },
  { id: 'sea100', g: 'sea', icon: '📦', name: 'Busy Harbour', how: 'Ships deliver 100 loads in one game', xp: 25, prog: g => [g.s.shipLoads ?? 0, 100] },
  { id: 'sea1000', g: 'sea', icon: '🌐', name: 'Ruler of the Waves', how: 'Ships deliver 1,000 loads in one game', xp: 75, prog: g => [g.s.shipLoads ?? 0, 1000] },
  { id: 'lvl3', g: 'railway', icon: '⭐', name: 'Level Up', how: 'Reach Railway level 3', xp: 10, prog: g => [g.s.rlv ?? 0, 3] },
  { id: 'lvl6', g: 'railway', icon: '🌟', name: 'Express Lines', how: 'Reach Railway level 6', xp: 25, prog: g => [g.s.rlv ?? 0, 6] },
  { id: 'lvl10', g: 'railway', icon: '💫', name: 'The Network', how: `Reach the top Railway level (${TOP_LVL})`, xp: 50, prog: g => [g.s.rlv ?? 0, TOP_LVL] },
  { id: 'mira', g: 'railway', icon: '🎯', name: "Mira's Favourite", how: "Finish 25 of Mira's missions in one game", xp: 25, prog: g => [msOf(g).done.length, 25] },
  { id: 'fleet', g: 'railway', icon: '🚃', name: 'Big Fleet', how: 'Run 20 trains at once', xp: 25, prog: g => [g.s.trains.length, 20] },
  { id: 'fleet40', g: 'railway', icon: '🚄', name: 'Rolling Stock', how: 'Run 40 trains at once', xp: 50, prog: g => [g.s.trains.length, 40] },
  { id: 'track250', g: 'track', icon: '🛤', name: 'Branch Line', how: 'Lay 250 squares of track in one game', xp: 10, prog: g => [g.s.track.length, 250] },
  { id: 'track1000', g: 'track', icon: '🚞', name: 'Main Line', how: 'Lay 1,000 squares of track in one game', xp: 25, prog: g => [g.s.track.length, 1000] },
  { id: 'track2500', g: 'track', icon: '🛤', name: 'Iron Road', how: 'Lay 2,500 squares of track in one game', xp: 50, prog: g => [g.s.track.length, 2500] },
  { id: 'track5000', g: 'track', icon: '🌍', name: 'Coast to Coast', how: 'Lay 5,000 squares of track in one game', xp: 75, prog: g => [g.s.track.length, 5000] },
  { id: 'reach70', g: 'track', icon: '📏', name: 'Long Haul', how: 'Run a line 70 squares out from Ashford, along the rails', xp: 50, prog: g => [reach(g), 70] },
  { id: 'railisl3', g: 'track', icon: '🏝', name: 'Island Lines', how: 'Have rails on 3 islands in one game', xp: 25, prog: g => [railIslands(g), 3] },
  { id: 'railisl6', g: 'track', icon: '🌉', name: 'Rails Across the Sea', how: 'Have rails on 6 islands in one game', xp: 75, prog: g => [railIslands(g), 6] },
  { id: 'double500', g: 'track', icon: '═', name: 'Double the Line', how: 'Double 500 squares of track in one game', xp: 25, prog: g => [doubled(g), 500] },
  { id: 'double1500', g: 'track', icon: '🚄', name: 'Four-Track Mainline', how: 'Double 1,500 squares of track in one game', xp: 50, prog: g => [doubled(g), 1500] },
  { id: 'exhibition', g: 'railway', icon: '🏛', name: 'Royal Exhibition', how: 'Build the Royal Exhibition Hall in Ashford', xp: 75, prog: g => has((g.s.parks ?? []).some(p => p.k === 'exhibition')) },
  { id: 'games3', g: 'railway', icon: '🗂', name: 'Fresh Start', how: `Play three different maps to Railway level ${FRESH_LVL}`, xp: 25, prog: (_g, p) => [p.seeds.length, 3] },
];

export const TOTAL_XP = MEDALS.reduce((a, m) => a + m.xp, 0);
export const xpOf = (p: Profile) => MEDALS.reduce((a, m) => a + (p.medals[m.id] ? m.xp : 0), 0);

/** Count this game's new orders into the all-games total, remember its map, and award every medal now earned. */
export function checkMedals(g: Game, p: Profile, now = Date.now()): Medal[] {
  const o = g.s.orders ?? 0;
  if (g.s.achOrd === undefined) { g.s.achOrd = o; p.orders += o; } // a game from before achievements counts its orders once
  else if (o > g.s.achOrd) { p.orders += o - g.s.achOrd; g.s.achOrd = o; }
  if ((g.s.rlv ?? 0) >= FRESH_LVL && !p.seeds.includes(g.s.seed)) p.seeds.push(g.s.seed); // a map counts once it is really played: Railway level 2
  const got: Medal[] = [];
  for (const m of MEDALS) {
    if (p.medals[m.id]) continue;
    const [v, n] = m.prog(g, p);
    if (v >= n) { p.medals[m.id] = now; got.push(m); }
  }
  return got;
}

export const PROFILE_KEY = 'railhaven.profile';
export function loadProfile(store: { getItem(k: string): string | null }): Profile {
  try { const o = JSON.parse(store.getItem(PROFILE_KEY) ?? 'null'); if (o && typeof o === 'object') return { ...emptyProfile(), ...o }; } catch { /* a fresh profile */ }
  return emptyProfile();
}
export function saveProfile(store: { setItem(k: string, v: string): void }, p: Profile) { store.setItem(PROFILE_KEY, JSON.stringify(p)); }
