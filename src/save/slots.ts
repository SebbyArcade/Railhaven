import type { Game } from '../state.ts';
import { townLinked } from '../economy/towns.ts';
import { islandName } from '../ships/docks.ts';
import { loadFrom, SAVE_KEY, type Storage } from './save.ts';

/**
 * Save slots: up to five games kept side by side. The game being played stays under SAVE_KEY (as before, so a crash
 * or a reload always finds it); the others wait under their own keys. A small index lists every game with the stats
 * shown on the Your games page.
 */
export const MAX_SLOTS = 5;
export const INDEX_KEY = SAVE_KEY + '.slots';
export const slotKey = (id: number) => `${SAVE_KEY}.slot.${id}`;

export interface SlotMeta {
  id: number;
  name: string;
  seed: number;
  /** game time played, seconds */
  t: number;
  money: number;
  /** Railway level */
  rlv: number;
  orders: number;
  /** towns linked to the railway */
  towns: number;
  /** when it was last played (ms since 1970) */
  at: number;
  /** a small map picture (data URL), made by the screen side */
  pic?: string;
}
export interface SlotIndex { active: number; next: number; list: SlotMeta[] }

export interface SlotStore extends Storage { removeItem(k: string): void }

export function statsOf(g: Game): Omit<SlotMeta, 'id' | 'name' | 'pic'> {
  return {
    seed: g.s.seed, t: g.s.t, money: g.s.money, rlv: g.s.rlv ?? 0, orders: g.s.orders ?? 0,
    towns: g.s.sites.filter(s => s.kind === 'town' && townLinked(g, s)).length, at: Date.now(),
  };
}

/** A name for a new game: its home island and seed, such as "Ashford Isle 142931". */
export const defaultName = (g: Game) => `${islandName(g, g.world.home)} ${g.s.seed}`;

function writeIndex(store: SlotStore, ix: SlotIndex) { store.setItem(INDEX_KEY, JSON.stringify(ix)); }

/** The list of games. The first time, the game already in this browser becomes the first slot. */
export function readIndex(store: SlotStore): SlotIndex {
  let ix: SlotIndex | null = null;
  try { const raw = store.getItem(INDEX_KEY); if (raw) ix = JSON.parse(raw); } catch { ix = null; }
  if (ix && Array.isArray(ix.list)) {
    // the live game has no entry (a save put in by hand, or a lost index): give it one
    if (!ix.list.some(m => m.id === ix!.active) && store.getItem(SAVE_KEY)) {
      const g = loadFrom(store);
      if (g) { ix.active = ix.next++; ix.list.unshift({ id: ix.active, name: defaultName(g), ...statsOf(g) }); writeIndex(store, ix); }
    }
    return ix;
  }
  ix = { active: 1, next: 2, list: [] };
  const g = store.getItem(SAVE_KEY) ? loadFrom(store) : null;
  if (g) ix.list.push({ id: 1, name: defaultName(g), ...statsOf(g) });
  writeIndex(store, ix);
  return ix;
}

/** Keep the playing game's line of stats up to date (called with every save). */
export function touchActive(store: SlotStore, g: Game, pic?: string) {
  const ix = readIndex(store);
  let m = ix.list.find(x => x.id === ix.active);
  if (!m) { m = { id: ix.active, name: defaultName(g), ...statsOf(g) }; ix.list.unshift(m); }
  Object.assign(m, statsOf(g)); if (pic) m.pic = pic;
  writeIndex(store, ix);
}

/** Games sorted newest first, the one being played on top. */
export const sortedSlots = (ix: SlotIndex) => [...ix.list].sort((a, b) => (b.id === ix.active ? 1 : 0) - (a.id === ix.active ? 1 : 0) || b.at - a.at);

/** Put the playing game aside under its slot key. */
function stash(store: SlotStore, ix: SlotIndex) {
  const live = store.getItem(SAVE_KEY);
  if (live && ix.list.some(m => m.id === ix.active)) store.setItem(slotKey(ix.active), live);
}

/**
 * Start playing a game in a new slot (a new map, or a game brought in from a code or file). The game being played is
 * put aside first. Returns why not when all five slots are taken.
 */
export function addSlot(store: SlotStore, liveJson: string, g: Game, name = defaultName(g)): string | null {
  const ix = readIndex(store);
  if (ix.list.length >= MAX_SLOTS) return `All ${MAX_SLOTS} game slots are taken: delete a game in Your games first`;
  stash(store, ix);
  const id = ix.next++;
  ix.list.push({ id, name, ...statsOf(g) }); ix.active = id;
  store.setItem(SAVE_KEY, liveJson); writeIndex(store, ix);
  return null;
}

/** Switch to another game. Returns the game, or why it could not be opened. */
export function openSlot(store: SlotStore, id: number): Game | string {
  const ix = readIndex(store);
  if (id === ix.active) return loadFrom(store) ?? 'This game could not be read';
  const raw = store.getItem(slotKey(id));
  if (!raw || !ix.list.some(m => m.id === id)) return 'This game is missing';
  const g = loadFrom({ getItem: () => raw, setItem() {} });
  if (!g) return 'This game could not be read';
  stash(store, ix);
  store.setItem(SAVE_KEY, raw); store.removeItem(slotKey(id));
  ix.active = id; const m = ix.list.find(x => x.id === id)!; m.at = Date.now();
  writeIndex(store, ix);
  return g;
}

/** Copy a game into a new slot (the copy waits; the game being played does not change). */
export function copySlot(store: SlotStore, id: number): string | null {
  const ix = readIndex(store);
  if (ix.list.length >= MAX_SLOTS) return `All ${MAX_SLOTS} game slots are taken: delete a game first`;
  const m = ix.list.find(x => x.id === id); if (!m) return 'This game is missing';
  const raw = id === ix.active ? store.getItem(SAVE_KEY) : store.getItem(slotKey(id));
  if (!raw) return 'This game is missing';
  const nid = ix.next++;
  store.setItem(slotKey(nid), raw);
  ix.list.push({ ...m, id: nid, name: copyName(ix, m.name), at: Date.now() });
  writeIndex(store, ix);
  return null;
}
function copyName(ix: SlotIndex, name: string) {
  const base = name.replace(/ \(copy( \d+)?\)$/, '');
  for (let k = 1; ; k++) { const n = k === 1 ? `${base} (copy)` : `${base} (copy ${k})`; if (!ix.list.some(m => m.name === n)) return n; }
}

export function renameSlot(store: SlotStore, id: number, name: string): string | null {
  const t = name.trim().slice(0, 40); if (!t) return 'Type a name first';
  const ix = readIndex(store), m = ix.list.find(x => x.id === id); if (!m) return 'This game is missing';
  m.name = t; writeIndex(store, ix); return null;
}

/**
 * Delete a game for good. Deleting the game being played opens the most recently played other game;
 * returns 'switch' with that game, 'empty' when no game is left (the caller starts a new map), or why not.
 */
export function deleteSlot(store: SlotStore, id: number): { ok: 'gone' } | { ok: 'switch'; g: Game } | { ok: 'empty' } | string {
  const ix = readIndex(store); if (!ix.list.some(m => m.id === id)) return 'This game is missing';
  if (id !== ix.active) { store.removeItem(slotKey(id)); ix.list = ix.list.filter(m => m.id !== id); writeIndex(store, ix); return { ok: 'gone' }; }
  ix.list = ix.list.filter(m => m.id !== id);
  const next = [...ix.list].sort((a, b) => b.at - a.at)[0];
  store.removeItem(SAVE_KEY);
  if (!next) { ix.active = ix.next++; writeIndex(store, ix); return { ok: 'empty' }; }
  const raw = store.getItem(slotKey(next.id)), g = raw ? loadFrom({ getItem: () => raw, setItem() {} }) : null;
  if (!raw || !g) { store.removeItem(slotKey(next.id)); ix.list = ix.list.filter(m => m.id !== next.id); ix.active = ix.next++; writeIndex(store, ix); return { ok: 'empty' }; }
  store.setItem(SAVE_KEY, raw); store.removeItem(slotKey(next.id));
  ix.active = next.id; next.at = Date.now(); writeIndex(store, ix);
  return { ok: 'switch', g };
}
