import type { World } from './world/terrain.ts';

export type Resource = 'wood' | 'farm' | 'stone' | 'coal' | 'iron' | 'oil';

/** A place on the map. Towns and settlement sites are preset; deposits wait for the player to build a mine. */
export interface Site {
  id: number;
  kind: 'town' | 'plot' | 'dep';
  x: number;
  y: number;
  name?: string;
  /** town population, 0 = ruins waiting to be linked */
  pop?: number;
  /** deposit resource */
  res?: Resource;
  /** richer deposit (far islands) */
  rich?: boolean;
  /** deposit hidden until surveyed (iron and oil) */
  hidden?: boolean;
}

/** Everything that is saved. Plain JSON. */
export interface GameState {
  version: 1;
  seed: number;
  /** game time in seconds */
  t: number;
  money: number;
  /** revealed squares, as a bitset */
  fog: Uint8Array;
  sites: Site[];
  /** squares whose terrain changed from the generated map (index -> terrain) */
  terrainEdits: Record<number, number>;
  camera: { x: number; y: number; z: number };
}

/** The running game: saved state plus the world rebuilt from the seed. */
export interface Game {
  s: GameState;
  world: World;
}
