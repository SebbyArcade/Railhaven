import type { Game, GameState } from '../state.ts';
import { loadGame, prepareSave } from '../game.ts';

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

let afterSave: ((store: Storage, g: Game) => void) | null = null;
/** Run after every save (the save slots keep their list of games up to date with it). */
export const onSave = (f: typeof afterSave) => { afterSave = f; };

export function saveTo(store: Storage, g: Game) { prepareSave(g); store.setItem(SAVE_KEY, serialize(g.s)); afterSave?.(store, g); }

/** The game as save text, ready to go under SAVE_KEY. */
export const saveJson = (g: Game) => { prepareSave(g); return serialize(g.s); };

export function loadFrom(store: Storage): Game | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try { return loadGame(deserialize(raw)); } catch (e) { console.warn('Save could not be read', e); return null; }
}

/** A save code to move a game between browsers (Chrome and the Claude app keep separate saves): RAILHAVEN3: + gzip, base64. */
export async function saveCode(g: Game): Promise<string> {
  prepareSave(g);
  const gz = new Blob([serialize(g.s)]).stream().pipeThrough(new CompressionStream('gzip'));
  return 'RAILHAVEN3:' + toB64(new Uint8Array(await new Response(gz).arrayBuffer()));
}

/** A rebuild save from a code or a save file's text, or null when the text is something else (such as an old-game save). */
export async function readSave(text: string): Promise<Game | null> {
  const t = text.trim();
  let json: string | null = null;
  if (t.startsWith('RAILHAVEN3:')) {
    const ds = new Blob([fromB64(t.slice(11).replace(/\s+/g, ''))]).stream().pipeThrough(new DecompressionStream('gzip'));
    json = await new Response(ds).text();
  } else if (t.startsWith('{') && /"version"\s*:/.test(t.slice(0, 200))) json = t;
  if (!json) return null;
  return loadGame(deserialize(json));
}
