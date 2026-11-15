/** One painted track square. `links` is a 4-bit mask of the sides joined to the neighbour (bit d = direction d). */
export interface TrackSquare {
  links: number;
  /** double track */
  dbl?: boolean;
  /** a four-way square where the two lines cross flat (a diamond): trains go straight over, never turn */
  cross?: boolean;
}

/** Saved track: square index -> square. */
export type TrackMap = Map<number, TrackSquare>;

export type NodeKey = string;

/** A rail piece: one lane of track between two ports, as a sampled curve. Trains and drawing both use it. */
export interface Piece {
  id: number;
  /** x,y pairs along the centre line of the lane, from end a to end b */
  pts: Float64Array;
  /** cumulative length at each point */
  cum: Float64Array;
  len: number;
  a: NodeKey;
  b: NodeKey;
  /** unit heading of travel a→b at end a and at end b */
  ta: [number, number];
  tb: [number, number];
  /** squares this piece lies on */
  squares: number[];
  kind: 'straight' | 'curve' | 'wide' | 'fan' | 'lane';
  /** a buffer stop sits at end a / end b (dead end) */
  endA?: boolean;
  endB?: boolean;
}

/** Moving along a piece: +1 = a→b, -1 = b→a. */
export interface Step { piece: number; dir: 1 | -1 }
