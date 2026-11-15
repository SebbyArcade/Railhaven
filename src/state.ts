import type { World } from './world/terrain.ts';
import type { SavedTrack } from './track/state.ts';
import type { TrackMap } from './track/types.ts';
import type { Network } from './track/network.ts';
import type { Train, TrainSystem } from './trains/train.ts';
import type { Shed } from './buildings/shed.ts';
import type { Break } from './track/breaks.ts';
import type { Building } from './buildings/industries.ts';

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
  track: SavedTrack;
  trains: Train[];
  /** fingerprint of the rail network the trains' positions refer to */
  netKey: string;
  nextId: number;
  /** the engine shed beside the line near Ashford (placed once there is track) */
  shed?: Shed;
  /** broken rails being repaired, and when the next one may happen */
  breaks?: Break[];
  nextBreak?: number;
  /** industries and factories the player built */
  buildings?: Building[];
}

/** The running game: saved state plus the world rebuilt from the seed. */
export interface Game {
  s: GameState;
  world: World;
  /** live track and the rail network built from it (rebuilt on every track change) */
  track: TrackMap;
  net: Network;
  sys: TrainSystem;
  /** track squares joined to Ashford (rebuilt with the network) */
  linked?: Set<number>;
  /** set by the renderer: squares whose baked terrain must be redrawn (track hides trees) */
  terrainDirty?: (squares: number[]) => void;
}
