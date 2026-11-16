import type { Game } from '../state.ts';
import { buildingSquares, buildingUp } from '../buildings/industries.ts';
import { TILE } from '../world/terrain.ts';
import type { View } from '../render/camera.ts';
import { nearness, place } from './scene.ts';

/**
 * One-off sounds for things that just happened: a building put up, rails laid, an order filled.
 * Found by comparing the game with how it was a moment ago, so game rules never need to know about sound.
 */
export type CueKind = 'build' | 'built' | 'rails' | 'unrails' | 'upgrade' | 'remove' | 'train' | 'ship' | 'order' | 'grow' | 'level' | 'break' | 'fire';
export interface Cue { kind: CueKind; vol: number; pan: number }

export interface CueMemo {
  blds: Map<number, number>; // building id -> level
  track: Set<number>; net: unknown; // the rail set is only compared again when the network was rebuilt
  trains: number; ships: number; orders: number; rlv: number;
  towns: Map<number, number>; // town id -> level
  breaks: Set<number>; fires: Set<number>;
  /** buildings whose builders are still at work */
  ups: Set<number>;
}

export function cueMemo(g: Game, old?: CueMemo): CueMemo {
  const same = old && old.net === g.net;
  return {
    blds: new Map((g.s.buildings ?? []).map(b => [b.id, b.lvl])),
    track: same ? old.track : new Set(g.track.keys()), net: g.net,
    trains: g.s.trains.length, ships: (g.s.ships ?? []).length, orders: g.s.orders ?? 0, rlv: g.s.rlv ?? 0,
    towns: new Map(g.s.sites.filter(s => s.kind === 'town').map(s => [s.id, s.lvl ?? 0])),
    breaks: new Set((g.s.breaks ?? []).map(b => b.square)),
    fires: new Set((g.s.buildings ?? []).filter(b => b.fire && g.s.t < b.fire.doneAt).map(b => b.id)),
    ups: new Set((g.s.buildings ?? []).filter(b => buildingUp(g, b) !== null).map(b => b.id)),
  };
}

/** What changed since `m` (which is then brought up to date). */
export function cues(g: Game, v: View, m: CueMemo): Cue[] {
  const out: Cue[] = [], n = g.world.n, near = nearness(g.s.camera.z);
  const sq = (i: number) => [(i % n + 0.5) * TILE, (((i / n) | 0) + 0.5) * TILE] as const;
  // the player's own work is always heard (a little), things that just happen only when close
  const mine = (kind: CueKind, wx: number, wy: number) => { const p = place(g, v, wx, wy); out.push({ kind, vol: Math.max(0.35, p.vol * near), pan: p.pan }); };
  const world = (kind: CueKind, wx: number, wy: number) => { const p = place(g, v, wx, wy); if (p.vol * near > 0.05) out.push({ kind, vol: p.vol * near, pan: p.pan }); };
  const ui = (kind: CueKind) => out.push({ kind, vol: 1, pan: 0 });
  const now = cueMemo(g, m);
  for (const b of g.s.buildings ?? []) {
    const was = m.blds.get(b.id), [wx, wy] = sq(buildingSquares(n, b)[1]!);
    if (was === undefined) mine('build', wx, wy); else if (b.lvl > was) mine('upgrade', wx, wy);
    if (m.ups.has(b.id) && !now.ups.has(b.id)) mine('built', wx, wy); // the builders are done
    if (now.fires.has(b.id) && !m.fires.has(b.id)) world('fire', wx, wy);
  }
  if (m.blds.size && [...m.blds.keys()].some(id => !now.blds.has(id))) ui('remove');
  if (now.track !== m.track) {
    const added = [...now.track].filter(i => !m.track.has(i));
    if (added.length) { let x = 0, y = 0; for (const i of added) { const [a, b] = sq(i); x += a; y += b; } mine('rails', x / added.length, y / added.length); }
    else if (now.track.size < m.track.size) ui('unrails');
  }
  for (const b of g.s.breaks ?? []) if (!m.breaks.has(b.square)) { const [wx, wy] = sq(b.square); world('break', wx, wy); }
  if (now.trains > m.trains) ui('train');
  if (now.ships > m.ships) ui('ship');
  let grew = false;
  for (const [id, l] of now.towns) if (l > (m.towns.get(id) ?? l)) grew = true;
  if (now.rlv > m.rlv) ui('level'); else if (grew) ui('grow'); else if (now.orders > m.orders) ui('order');
  Object.assign(m, now);
  return out;
}
