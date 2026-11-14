import type { Game, GameState } from './state.ts';
import { generateWorld, refreshIslands, refreshWater, TILE } from './world/terrain.ts';
import { generateSites } from './world/sites.ts';
import { emptyFog, reveal } from './world/fog.ts';

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

export function newGame(seed = Math.floor(Math.random() * 1e6)): Game {
  const world = generateWorld(seed);
  const { sites, mountains } = generateSites(world);
  const terrainEdits: Record<number, number> = {};
  for (const i of mountains) terrainEdits[i] = world.terr[i]!;
  const s: GameState = {
    version: 1, seed, t: 0, money: START_MONEY, fog: emptyFog(world.n), sites, terrainEdits,
    camera: { x: world.cx * TILE + TILE / 2, y: world.cy * TILE + TILE / 2, z: 1.8 },
  };
  const g: Game = { s, world };
  reveal(g, world.cx, world.cy, START_REVEAL);
  return g;
}

export function loadGame(s: GameState): Game {
  return { s, world: buildWorld(s) };
}
