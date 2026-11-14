import type { Game, GameState } from './state.ts';
import { generateWorld, refreshIslands, refreshWater, TILE } from './world/terrain.ts';
import { generateSites } from './world/sites.ts';
import { emptyFog, reveal } from './world/fog.ts';
import { buildNetwork, type Network } from './track/network.ts';
import { trackFromSave, trackToSave } from './track/state.ts';
import type { TrackMap } from './track/types.ts';
import { TrainSystem } from './trains/train.ts';
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

function makeNetwork(track: TrackMap, n: number): Network {
  return buildNetwork(track, n);
}

function assemble(s: GameState): Game {
  const world = buildWorld(s), track = trackFromSave(s.track ?? []), net = makeNetwork(track, world.n);
  s.trains ??= []; s.nextId ??= 1;
  const g: Game = { s, world, track, net, sys: new TrainSystem(net, s.trains) };
  if (s.netKey !== networkKey(net)) {
    // the rails were built by different code: find every train again by where it stood
    for (const t of s.trains) if (t.at) relocate(net, t, t.at);
    s.netKey = networkKey(net);
  }
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
  g.net = makeNetwork(g.track, g.world.n);
  g.sys.setNetwork(g.net);
  g.s.trains.forEach((t, k) => { relocate(g.net, t, where[k]!); });
  g.sys.rebuildHolds();
  for (const t of g.s.trains) if (t.dest !== undefined) g.sys.sendTo(t, t.dest);
  g.s.netKey = networkKey(g.net);
}
