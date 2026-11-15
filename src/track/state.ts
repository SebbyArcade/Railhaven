import type { TrackMap } from './types.ts';

/** Saved form of the track: [square, links, double] triples. */
export type SavedTrack = [number, number, 0 | 1][];

export const trackToSave = (t: TrackMap): SavedTrack => [...t].map(([i, s]) => [i, s.links, s.dbl ? 1 : 0]);
export const trackFromSave = (a: SavedTrack): TrackMap => new Map(a.map(([i, links, d]) => [i, d ? { links, dbl: true } : { links }]));
