import type { Game } from '../state.ts';

/** Where a piece of news happened, so its note can offer Go › (pan there and open the card). */
export type NewsGo = { kind: 'bld' | 'town' | 'train' | 'isle'; id: number } | { kind: 'sq'; x: number; y: number };

/** Tell the player something; with a place, the note gets a Go › button that takes them there (Sébastien). */
export function say(g: Game, m: string, go?: NewsGo) {
  (g.news ??= []).push(m);
  if (go) (g.newsGo ??= new Map()).set(m, go);
}

/** The place a note is about (read once, when the note shows). */
export function newsPlace(g: Game, m: string): NewsGo | undefined {
  const go = g.newsGo?.get(m); g.newsGo?.delete(m); return go;
}
