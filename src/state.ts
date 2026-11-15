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
  /** town: step on the order ladder, goods got toward the current order, steady demand waiting */
  lvl?: number;
  got?: Partial<Record<string, number>>;
  steady?: Partial<Record<string, number>>;
  /** the current order was filled and its reward paid */
  filled?: boolean;
  /** town: its current order adds seafood (it is by the sea and a fishing dock worked its island when the order began) */
  sea0?: boolean;
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
  /** a storm drifting over the map, and when the next storm, breakdown and fire may come */
  storm?: import('./world/events.ts').Storm;
  nextEvent?: { storm: number; breakdown: number; fire: number };
  /** industries and factories the player built */
  buildings?: Building[];
  /** orders filled so far (Railway level comes from this) and the level reached */
  orders?: number;
  /** game time of the last no-fail top-up */
  rescueAt?: number;
  /** forests: wood cut so far from a forest square (each holds TREE_WOOD), and when a cut-down square grows back (game time) */
  cut?: Record<number, number>;
  stumps?: Record<number, number>;
  /** Engine shed fleet upgrade levels */
  fleet?: Partial<Record<'wag' | 'eng' | 'rep', number>>;
  /** goods being rushed (at most three) */
  rush?: { to: { kind: 'town' | 'bld'; id: number }; good: import('./buildings/industries.ts').Good; left: number }[];
  rlv?: number;
  /** landmarks and shipwrecks (placed from the seed on first use) */
  pois?: import('./world/explore.ts').Poi[];
  /** scouts out exploring */
  scouts?: import('./world/explore.ts').Scout[];
  /** guided lesson reached (new games start at 0; absent = no lessons), game time the last one was done, lesson bar folded */
  tut?: number; lesAt?: number; lesMin?: boolean;
  /** missions with Mira, and the act shown */
  ms?: import('./progress/missions.ts').MissionState;
  /** cargo ships */
  ships?: import('./ships/ships.ts').CargoShip[];
  /** money earned and spent, for the report */
  earned?: number;
  upkeep?: number;
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
  /** rail distances from buildings and towns (cleared when the track changes) */
  dist?: Map<string, Int32Array>;
  /** island specialties (cache) */
  spec?: Map<number, import('./world/specialty.ts').Specialty | null>;
  /** towns with the sea nearby (cache) */
  coast?: Map<number, boolean>;
  /** squares sailed from each dock (cache) */
  seaCache?: Map<string, Int32Array>;
  /** squares already built on (cached; rebuilt when the network or buildings change) */
  taken?: { key: string; net: Network; set: Set<number> };
  /** things to tell the player (the UI shows and clears them) */
  news?: string[];
  /** set by the renderer: squares whose baked terrain must be redrawn (track hides trees) */
  terrainDirty?: (squares: number[]) => void;
  /** forest squares already redrawn as saplings */
  sapl?: Set<number>;
}
