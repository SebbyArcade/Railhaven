import type { Game, GameState, Site } from './state.ts';
import { doubleSquares, hallsOf } from './buildings/stations.ts';
import { generateWorld, refreshIslands, refreshWater, TILE } from './world/terrain.ts';
import { generateSites } from './world/sites.ts';
import { emptyFog, reveal } from './world/fog.ts';
import { buildNetwork, type Network } from './track/network.ts';
import { trackFromSave, trackToSave } from './track/state.ts';
import type { TrackMap } from './track/types.ts';
import { TrainSystem } from './trains/train.ts';
import { placeShed, shedSquare } from './buildings/shed.ts';
import { type Building, linkedSquares, yardSquares } from './buildings/industries.ts';
import { blockedPieces } from './track/breaks.ts';
import { networkKey, relocate, snapshot } from './trains/relocate.ts';

export const START_MONEY = 12000;
export const START_REVEAL = 9;

/** Rebuild the world from the seed and apply saved terrain edits. */
export function buildWorld(s: GameState) {
  const world = generateWorld(s.seed);
  const edits = Object.entries(s.terrainEdits);
  if (edits.length) {
    for (const [i, t] of edits) world.terr[+i] = t;
    refreshWater(world); refreshIslands(world);
  }
  return world;
}

function makeNetwork(track: TrackMap, n: number, sites: Site[], buildings: Building[] = []): Network {
  const halls = hallsOf(track, n, sites), dbl = doubleSquares(track, halls), still = new Set<number>();
  for (const h of halls) for (const i of [...h.squares, ...h.approaches]) still.add(i);
  for (const b of buildings) { // yards: two loading tracks, the turnouts on the square past each end
    const sq = yardSquares(n, b), along = b.horizontal ? 0b0101 : 0b1010, step = b.horizontal ? 1 : n;
    for (const i of sq) { if (track.has(i)) dbl.add(i); still.add(i); }
    for (const i of [sq[0]! - step, sq.at(-1)! + step]) { const t = track.get(i); still.add(i); if (t && (t.links & ~along) === 0) dbl.add(i); }
  }
  return buildNetwork(track, n, { forceDouble: i => dbl.has(i), noWide: i => still.has(i) });
}

function assemble(s: GameState): Game {
  const world = buildWorld(s), track = trackFromSave(s.track ?? []), net = makeNetwork(track, world.n, s.sites, s.buildings);
  s.trains ??= []; s.nextId ??= 1;
  const g: Game = { s, world, track, net, sys: new TrainSystem(net, s.trains) };
  if (s.netKey !== networkKey(net)) {
    // the rails were built by different code: find every train again by where it stood
    for (const t of s.trains) if (t.at) relocate(net, t, t.at);
    s.netKey = networkKey(net);
  }
  g.linked = linkedSquares(g); placeShed(g); g.sys.blocked = blockedPieces(g);
  for (const t of s.trains) if (t.dest !== undefined && t.plan.length === 0) g.sys.sendTo(t, t.dest);
  g.sys.rebuildHolds();
  return g;
}

export function newGame(seed = Math.floor(Math.random() * 1e6)): Game {
  const world = generateWorld(seed);
  const { sites, mountains } = generateSites(world);
  const terrainEdits: Record<number, number> = {};
  for (const i of mountains) terrainEdits[i] = world.terr[i]!;
  const s: GameState = {
    version: 1, seed, t: 0, money: START_MONEY, fog: emptyFog(world.n), sites, terrainEdits,
    camera: { x: world.cx * TILE + TILE / 2, y: world.cy * TILE + TILE / 2, z: 1.8 },
    track: [], trains: [], netKey: '', nextId: 1,
  };
  const g = assemble(s);
  reveal(g, world.cx, world.cy, START_REVEAL);
  return g;
}

export function loadGame(s: GameState): Game {
  return assemble(s);
}

/** Before saving: write the live track and where every train stands into the state. */
export function prepareSave(g: Game) {
  g.s.track = trackToSave(g.track);
  g.s.netKey = networkKey(g.net);
  for (const t of g.s.trains) t.at = snapshot(g.net, t);
}

/** After the track changed: rebuild the rails and put every train back where it stood. */
export function trackChanged(g: Game) {
  const where = g.s.trains.map(t => snapshot(g.net, t));
  g.net = makeNetwork(g.track, g.world.n, g.s.sites, g.s.buildings);
  g.linked = linkedSquares(g);
  g.sys.setNetwork(g.net);
  g.s.trains.forEach((t, k) => { relocate(g.net, t, where[k]!); });
  g.s.breaks = g.s.breaks?.filter(b => g.track.has(b.square));
  const oldShed = shedSquare(g); placeShed(g);
  if (shedSquare(g) !== oldShed) g.terrainDirty?.([oldShed, shedSquare(g)].filter(i => i >= 0)); g.sys.blocked = blockedPieces(g);
  g.sys.rebuildHolds();
  for (const t of g.s.trains) if (t.dest !== undefined) g.sys.sendTo(t, t.dest);
  g.s.netKey = networkKey(g.net);
}

/** Broken rails came or went: trains plan around them again. */
export function breaksChanged(g: Game) {
  g.sys.blocked = blockedPieces(g);
  for (const t of g.s.trains) if (t.dest !== undefined && !t.refuge) g.sys.sendTo(t, t.dest);
}
