import type { Game, GameState, Site } from './state.ts';
import { trainSpeedMul } from './world/events.ts';
import { checkPois } from './world/explore.ts';
import { chartSea, islandOfB, linkedDocks } from './ships/docks.ts';
const isHomeDock = (g: Game, b: import('./buildings/industries.ts').Building) => islandOfB(g, b) === g.world.home;
import { doubleSquares, hallsOf } from './buildings/stations.ts';
import { generateWorld, MAP_N, MAP_VERSION, refreshIslands, refreshWater, TILE } from './world/terrain.ts';
import { generateSites } from './world/sites.ts';
import { emptyFog, reveal } from './world/fog.ts';
import { buildNetwork, type Network } from './track/network.ts';
import { trackFromSave, trackToSave } from './track/state.ts';
import type { TrackMap } from './track/types.ts';
import { TrainSystem } from './trains/train.ts';
import { placeShed } from './buildings/shed.ts';
import { bestPlacement, type Building, nearestSpot, linkedSquares, tracksOf, yardLanes, yardSquares } from './buildings/industries.ts';
import { blockedPieces } from './track/breaks.ts';
import { networkKey, relocate, snapshot } from './trains/relocate.ts';

export const START_MONEY = 12000;
export const START_REVEAL = 9;
export const START_DEPOSIT_REVEAL = 4;

/** Rebuild the world from the seed and apply saved terrain edits. */
export function buildWorld(s: GameState) {
  const world = generateWorld(s.seed, MAP_N, s.mapV ?? 1, s.rings ?? 0); // saves from before sister islands keep their maps
  const edits = Object.entries(s.terrainEdits);
  if (edits.length) {
    for (const [i, t] of edits) world.terr[+i] = t;
    refreshWater(world); refreshIslands(world);
  }
  return world;
}

function makeNetwork(track: TrackMap, n: number, sites: Site[], buildings: Building[], terr: Uint8Array): Network {
  const halls = hallsOf(track, n, sites, terr), dbl = doubleSquares(track, halls), still = new Set<number>(), lanes = new Map<number, number[]>();
  const stn = new Set<number>(), ends = new Set<number>(), yard = new Set<number>();
  for (const h of halls) for (const i of [...h.squares, ...h.approaches]) { still.add(i); stn.add(i); }
  for (const h of halls) for (const i of h.approaches) ends.add(i);
  for (const b of buildings) { // yards: two loading tracks, the turnouts on the square past each end
    const sq = yardSquares(n, b), along = b.horizontal ? 0b0101 : 0b1010, step = b.horizontal ? 1 : n;
    const ln = tracksOf(b) > 2 ? yardLanes(b) : undefined; // 3 or 4 loading tracks: the extra ones run out on the strip
    for (const i of sq) { if (track.has(i)) { dbl.add(i); if (ln) lanes.set(i, ln); } still.add(i); yard.add(i); }
    for (const i of [sq[0]! - step, sq.at(-1)! + step]) { const t = track.get(i); still.add(i); yard.add(i); if (t && (t.links & ~along) === 0) { dbl.add(i); if (ln) lanes.set(i, ln); } }
  }
  return buildNetwork(track, n, { forceDouble: i => dbl.has(i), noWide: i => still.has(i), lanes: i => lanes.get(i), crossOk: i => ends.has(i) && !yard.has(i), stationEnd: i => ends.has(i) });
}

function assemble(s: GameState): Game {
  const world = buildWorld(s), track = trackFromSave(s.track ?? []);
  s.trains ??= []; s.nextId ??= 1;
  const g = { s, world, track } as Game;
  g.linked = linkedSquares(g); placeShed(g); g.linked = linkedSquares(g); // the shed lays its siding first
  const net = makeNetwork(track, world.n, s.sites, s.buildings ?? [], world.terr);
  g.net = net; g.sys = new TrainSystem(net, s.trains); g.sys.speedOf = t => trainSpeedMul(g, t);
  g.sys.onMidReverse = (_t, sq) => { const r = (g.revs ??= new Map()).get(sq); g.revs.set(sq, { n: (r?.n ?? 0) + 1, at: g.s.t }); };
  if (s.netKey !== networkKey(net)) {
    // the rails were built by different code: find every train again by where it stood
    for (const t of s.trains) if (t.at) relocate(net, t, t.at);
    s.netKey = networkKey(net);
  }
  g.sys.blocked = blockedPieces(g); g.sys.anyLane = platformPieces(g);
  for (const t of s.trains) if (t.dest !== undefined && t.plan.length === 0) g.sys.sendTo(t, t.dest, t.area);
  g.sys.rebuildHolds();
  return g;
}

/** A new game. mapV picks the map maker version: the latest for new games, 1 for saves imported from the old game (its exact maps). */
export function newGame(seed = Math.floor(Math.random() * 1e6), mapV = MAP_VERSION): Game {
  const world = generateWorld(seed, MAP_N, mapV);
  const { sites, mountains } = generateSites(world);
  const terrainEdits: Record<number, number> = {};
  for (const i of mountains) terrainEdits[i] = world.terr[i]!;
  const s: GameState = {
    version: 1, ...(mapV > 1 ? { mapV } : {}), seed, t: 0, money: START_MONEY, fog: emptyFog(world.n), sites, terrainEdits,
    camera: { x: world.cx * TILE + TILE / 2, y: world.cy * TILE + TILE / 2, z: 1.8 },
    track: [], trains: [], netKey: '', nextId: 1,
  };
  const g = assemble(s);
  reveal(g, world.cx, world.cy, START_REVEAL);
  revealFirstDeposits(g);
  return g;
}

export function loadGame(s: GameState): Game {
  const g = assemble(s);
  revealFirstDeposits(g); // older saves started with every deposit in the fog
  return g;
}

/** The nearest stone outcrop and coal seam are uncovered (if none of that kind is yet), so the first quarry and mine can be built. */
function revealFirstDeposits(g: Game) {
  const { cx, cy } = g.world;
  for (const res of ['stone', 'coal'] as const) {
    const deps = g.s.sites.filter(s => s.kind === 'dep' && s.res === res && !s.hidden);
    if (nearestSpot(g, res, cx, cy)) continue; // one is already uncovered and a mine fits
    // the nearest one where a mine actually fits (try uncovering it; put the fog back if it doesn't fit)
    for (const d of deps.sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy))) {
      const fog = g.s.fog.slice();
      reveal(g, d.x, d.y, START_DEPOSIT_REVEAL);
      if (bestPlacement(g, res, d.x, d.y).place) break;
      g.s.fog = fog;
    }
  }
}

/** Before saving: write the live track and where every train stands into the state. */
export function prepareSave(g: Game) {
  g.s.track = trackToSave(g.track);
  g.s.netKey = networkKey(g.net);
  for (const t of g.s.trains) t.at = snapshot(g.net, t);
}

/** A landing's crew surveys its island: iron and oil deposits there come into view (and the news says what was found). */
function surveyLandings(g: Game) {
  const n = g.world.n;
  for (const b of linkedDocks(g)) {
    if (isHomeDock(g, b)) continue;
    const k = g.world.islandOf[yardSquares(n, b)[0]!];
    const found = g.s.sites.filter(s => s.kind === 'dep' && s.hidden && g.world.islandOf[s.y * n + s.x] === k);
    for (const s of found) { s.hidden = false; reveal(g, s.x, s.y, 2); }
    if (found.length) (g.news ??= []).push(`🔎 The landing crew surveyed ${g.world.islands[k!]?.name ?? 'the island'}: ${[...new Set(found.map(s => s.res === 'iron' ? '🧲 iron' : s.res === 'oil' ? '🛢 oil' : s.res))].join(' and ')} found`);
  }
}

/** After the track changed: rebuild the rails and put every train back where it stood. */
export function trackChanged(g: Game) {
  const where = g.s.trains.map(t => snapshot(g.net, t));
  g.linked = linkedSquares(g);
  const moved = placeShed(g); // may move the shed and its siding: before the rails are rebuilt
  if (moved.length) { g.linked = linkedSquares(g); g.terrainDirty?.(moved); }
  g.net = makeNetwork(g.track, g.world.n, g.s.sites, g.s.buildings ?? [], g.world.terr);
  g.dist = new Map();
  g.sys.setNetwork(g.net);
  for (const b of linkedDocks(g)) if (chartSea(g, b)) { (g.news ??= []).push(`⚓ The ${isHomeDock(g, b) ? 'dock' : 'landing'} charts the sea around it: new shores are out of the fog`); }
  surveyLandings(g);
  checkPois(g);
  g.s.trains.forEach((t, k) => { relocate(g.net, t, where[k]!); });
  g.s.breaks = g.s.breaks?.filter(b => g.track.has(b.square));
  g.sys.blocked = blockedPieces(g); g.sys.anyLane = platformPieces(g);
  g.sys.rebuildHolds();
  for (const t of g.s.trains) if (t.dest !== undefined) g.sys.sendTo(t, t.dest, t.area);
  g.s.netKey = networkKey(g.net);
}

/** Pieces wholly inside station halls and yards, where trains may use either lane. */
function platformPieces(g: Game): Set<number> {
  const n = g.world.n, sq = new Set<number>();
  for (const h of hallsOf(g.track, n, g.s.sites, g.world.terr)) for (const i of h.squares) sq.add(i);
  for (const b of g.s.buildings ?? []) for (const i of yardSquares(n, b)) sq.add(i);
  return new Set(g.net.pieces.filter(p => p.squares.every(i => sq.has(i))).map(p => p.id));
}

/** Broken rails came or went: trains plan around them again. */
export function breaksChanged(g: Game) {
  g.sys.blocked = blockedPieces(g);
  for (const t of g.s.trains) if (t.dest !== undefined && !t.refuge) g.sys.sendTo(t, t.dest, t.area);
}
