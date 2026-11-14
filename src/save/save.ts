import type { Game, GameState } from '../state.ts';
import { loadGame } from '../game.ts';

export const SAVE_KEY = 'railhaven2';
export const SAVE_VERSION = 1;

const toB64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b: string) => Uint8Array.from(atob(b), c => c.charCodeAt(0));

/** Turn the state into plain JSON (typed arrays become base64). */
export function serialize(s: GameState): string {
  return JSON.stringify(s, (_k, v) => v instanceof Uint8Array ? { $u8: toB64(v) } : v);
}

/** Migrations from older save versions run here, in order. */
const MIGRATIONS: Record<number, (s: any) => any> = {};

export function deserialize(json: string): GameState {
  let s = JSON.parse(json, (_k, v) => v && typeof v === 'object' && typeof v.$u8 === 'string' ? fromB64(v.$u8) : v);
  while ((s.version ?? 0) < SAVE_VERSION) {
    const m = MIGRATIONS[s.version ?? 0];
    if (!m) throw new Error('No migration from save version ' + s.version);
    s = m(s);
  }
  return s as GameState;
}

export interface Storage { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function saveTo(store: Storage, g: Game) { store.setItem(SAVE_KEY, serialize(g.s)); }

export function loadFrom(store: Storage): Game | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try { return loadGame(deserialize(raw)); } catch (e) { console.warn('Save could not be read', e); return null; }
}
