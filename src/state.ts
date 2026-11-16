import type { World } from './world/terrain.ts';
import type { SavedTrack } from './track/state.ts';
import type { TrackMap } from './track/types.ts';
import type { Network } from './track/network.ts';
import type { Train, TrainSystem } from './trains/train.ts';
import type { Shed } from './buildings/shed.ts';
import type { Break } from './track/breaks.ts';
import type { Building } from './buildings/industries.ts';

export type Resource = 'wood' | 'farm' | 'stone' | 'coal' | 'iron' | 'oil' | 'gold' | 'gems' | 'cocoa' | 'rubber';

/** A place on the map. Towns and settlement sites are preset; deposits wait for the player to build a mine. */
export interface Site {
  id: number;
  kind: 'town' | 'plot' | 'dep';
  x: number;
  y: number;
  name?: string;
  /** a town the player founded on a settlement site (founding the next one costs more) */
  founded?: boolean;
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
  /** map maker version (missing = 1, the old game's maps; 2 adds sister islands) */
  mapV?: number;
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
  /** crews riding back to base along the rails after a job (drawn only) */
  crews?: import('./world/crews.ts').CrewRun[];
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
  /** when the railway board last paid for a needed building, and which kind (no-fail for a slow start) */
  grantAt?: number;
  grantFor?: import('./buildings/industries.ts').IndustryKind;
  /** 💡 money tips switched off in Settings */
  tipsOff?: boolean;
  /** forests: wood cut so far from a forest square (each holds TREE_WOOD), and when a cut-down square grows back (game time) */
  cut?: Record<number, number>;
  stumps?: Record<number, number>;
  /** Engine shed fleet upgrade levels */
  fleet?: Partial<Record<'wag' | 'eng' | 'rep', number>>;
  /** Fleet upgrade levels per island (island number -> levels); `fleet` is only read once, from older saves */
  fleetI?: Record<number, Partial<Record<'wag' | 'eng' | 'rep', number>>>;
  /** goods being rushed (at most three) */
  rush?: import('./economy/upgrades.ts').Rush[];
  rlv?: number;
  /** the Railway level whose ⛵ "needs islands" note was last shown (shown once per level) */
  sailNag?: number;
  /** landmarks and shipwrecks (placed from the seed on first use) */
  pois?: import('./world/explore.ts').Poi[];
  /** 2 once the later landmarks (old halt, falls, ranger hut, windmill) were added to this map */
  poiV?: number;
  /** 🗺 area maps bought (each marks what hides in the fog inside its circle) */
  maps?: import('./world/maps.ts').AreaMap[];
  /** scouts out exploring */
  scouts?: import('./world/explore.ts').Scout[];
  /** 🧭 scout reports, the last few (newest last) */
  reports?: import('./world/explore.ts').ScoutReport[];
  /** islands whose arrival card was shown (missing: an older game, filled in quietly with the islands already reached) */
  isles?: number[];
  /** guided lesson reached (new games start at 0; absent = no lessons), game time the last one was done, lesson bar folded */
  tut?: number; lesAt?: number; lesMin?: boolean;
  /** missions with Mira, and the act shown */
  ms?: import('./progress/missions.ts').MissionState;
  /** ship upgrade levels: faster ships, bigger holds */
  shipU?: Partial<Record<'spd' | 'hold', number>>;
  /** cargo ships */
  ships?: import('./ships/ships.ts').CargoShip[];
  /** ⛴ boats carrying a new train over to another island */
  ferries?: import('./ships/ships.ts').Ferry[];
  /** 🗺 expedition rings sent: the map has grown by this many rings of sea */
  rings?: number;
  /** town parks and town projects, one square each */
  parks?: import('./buildings/parks.ts').Park[];
  /** money earned and spent, for the report */
  earned?: number;
  upkeep?: number;
  /** rushes finished (for achievements) */
  rushDone?: number;
  /** train loads and ship loads delivered (for achievements) */
  loads?: number; shipLoads?: number;
  /** orders already counted toward the all-games orders achievement */
  achOrd?: number;
  /** 👑 region capitals (island → town id) and each capital's 🤝 trade order (by island) */
  caps?: Record<number, number>;
  trade?: Record<number, import('./economy/trade.ts').TradeOrder>;
  /** trade orders filled */
  tradeDone?: number;
}

/** The running game: saved state plus the world rebuilt from the seed. */
export interface Game {
  s: GameState;
  world: World;
  /** live track and the rail network built from it (rebuilt on every track change) */
  track: TrackMap;
  net: Network;
  sys: TrainSystem;
  /** squares where trains reversed partway along a trip lately (for the ⤺ marks in the Problems view) */
  revs?: Map<number, { n: number; at: number }>;
  /** track squares joined to Ashford (rebuilt with the network) */
  linked?: Set<number>;
  /** closed buildings whose barriers are down, as a key (derived) */
  closedKey?: string;
  /** rail distances from buildings and towns (cleared when the track changes) */
  dist?: Map<string, Int32Array>;
  /** island specialties (cache) */
  spec?: Map<number, import('./world/specialty.ts').Specialty | null>;
  /** towns with the sea nearby (cache) */
  coast?: Map<number, boolean>;
  /** squares sailed from each dock (cache) */
  seaCache?: Map<string, Int32Array>;
  /** squares under buildings and their loading tracks (cache, keyed by where the buildings stand) */
  yardSqs?: { key: number; set: Set<number>; t: number; len: number };
  /** squares already built on (cached; rebuilt when the network or buildings change) */
  taken?: { key: string; net: Network; set: Set<number> };
  /** things to tell the player (the UI shows and clears them) */
  news?: string[];
  /** the place each note is about, for its Go › button (not saved) */
  newsGo?: Map<string, import('./core/news.ts').NewsGo>;
  /** [time, earned minus running costs] every few seconds, for the last few minutes (not saved) */
  netLog?: [number, number][];
  /** when the 💡 money tip last came up (not saved) */
  tipAt?: number;
  /** mines that have an uncovered deposit to stand on, checked now and then (not saved) */
  mineOk?: Map<string, { at: number; ok: boolean }>;
  /** landmarks just spotted, waiting for their discovery card (not saved) */
  found?: number[];
  /** scout reports just filed, waiting for their card (not saved) */
  reported?: number[];
  /** islands just reached, waiting for their arrival card (not saved) */
  arrived?: number[];
  /** set by the renderer: squares whose baked terrain must be redrawn (track hides trees) */
  terrainDirty?: (squares: number[]) => void;
  /** forest squares already redrawn as saplings */
  sapl?: Set<number>;
}
