import type { TrackMap } from './types.ts';

/** Saved form of the track: [square, links, flags] triples (flag 1 = double track, 2 = flat crossing). */
export type SavedTrack = [number, number, number][];

export const trackToSave = (t: TrackMap): SavedTrack => [...t].map(([i, s]) => [i, s.links, (s.dbl ? 1 : 0) | (s.cross ? 2 : 0)]);
export const trackFromSave = (a: SavedTrack): TrackMap => new Map(a.map(([i, links, f]) => [i, { links, ...(f & 1 ? { dbl: true } : {}), ...(f & 2 ? { cross: true } : {}) }]));

/** A flat crossing: marked as one, with all four sides joined. */
export const isCrossing = (t: TrackMap, i: number) => { const s = t.get(i); return !!s?.cross && s.links === 15; };
