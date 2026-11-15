import type { Game } from '../state.ts';
import { buildingSquares, capOf, inputsOf, isFactory, type IndustryKind } from '../buildings/industries.ts';
import { bodyPoint } from '../trains/train.ts';
import { shipPlace } from '../ships/ships.ts';
import { townLinked } from '../economy/towns.ts';
import { T, TILE } from '../world/terrain.ts';
import { isRevealed } from '../world/fog.ts';
import type { View } from '../render/camera.ts';

/** What makes a sound on the map. Only rules state is read: this never changes the game. */
export type SoundKind = 'train' | 'load' | 'repair' | 'ship' | 'town' | 'fire' | IndustryKind;

/** One thing you can hear: how loud (0-1) and where, left -1 to right +1. */
export interface Hear { id: string; kind: SoundKind; vol: number; pan: number; rate?: number; moving?: boolean }

/** Everything audible right now, and the land around it for ambience. */
export interface Scene {
  /** 0 when zoomed out (no effects), 1 when close */
  near: number;
  sources: Hear[];
  /** share of the view that is sea, forest, grass, hills/mountain (0-1) */
  sea: number; forest: number; grass: number; hills: number;
  /** a storm over a washout on screen (0-1) */
  storm: number;
}

/** Effects fade out between these zooms: zoomed right out you hear only the music. */
export const QUIET_ZOOM = 0.6, FULL_ZOOM = 1.1;

export const nearness = (z: number) => Math.max(0, Math.min(1, (z - QUIET_ZOOM) / (FULL_ZOOM - QUIET_ZOOM)));

/** How loud a thing at world point (wx, wy) is from the camera, and its pan. Things just off screen are faint. */
export function place(g: Game, v: View, wx: number, wy: number): { vol: number; pan: number } {
  const c = g.s.camera, sx = (wx - c.x) * c.z, sy = (wy - c.y) * c.z;
  const r = Math.max(v.w, v.h) * 0.6, d = Math.hypot(sx, sy * 1.2) / r;
  const vol = d >= 1 ? 0 : (1 - d) * (1 - d) * Math.min(1, c.z / 1.4);
  return { vol, pan: Math.max(-1, Math.min(1, sx / (v.w / 2))) * 0.7 };
}

export function hearScene(g: Game, v: View): Scene {
  const near = nearness(g.s.camera.z), out: Scene = { near, sources: [], sea: 0, forest: 0, grass: 0, hills: 0, storm: 0 };
  if (near <= 0) return out;
  const n = g.world.n, add = (h: Omit<Hear, 'vol' | 'pan'>, wx: number, wy: number) => {
    const p = place(g, v, wx, wy); if (p.vol * near > 0.02) out.sources.push({ ...h, vol: p.vol * near, pan: p.pan });
  };
  for (const t of g.s.trains) {
    if (!t.trail.length) continue;
    const p = bodyPoint(g.net, t, 0), moving = Math.abs(t.v) > 4;
    if (t.broke && g.s.t < t.broke.doneAt) { add({ id: `t${t.id}`, kind: g.s.t >= t.broke.crewAt ? 'repair' : 'train', rate: 0, moving: false }, p.x, p.y); continue; } // broken down
    if (moving) add({ id: `t${t.id}`, kind: 'train', rate: Math.min(1, Math.abs(t.v) / 70), moving }, p.x, p.y);
    else if (t.job?.phase === 'loading' || t.job?.phase === 'unloading') add({ id: `t${t.id}`, kind: 'load', moving }, p.x, p.y);
    else add({ id: `t${t.id}`, kind: 'train', rate: 0, moving }, p.x, p.y); // standing still: only the whistle when it sets off
  }
  for (const b of g.s.buildings ?? []) {
    const sq = buildingSquares(n, b), mid = sq[1]!, wx = (mid % n + 1) * TILE, wy = (((mid / n) | 0) + 0.5) * TILE;
    const working = b.kind === 'dock' || (b.stock < capOf(b) && (!isFactory(b.kind) || inputsOf(b.kind).every(k => (b.inbuf?.[k] ?? 0) >= 1)));
    if (b.fire && g.s.t < b.fire.doneAt) add({ id: `b${b.id}`, kind: 'fire', moving: g.s.t >= b.fire.crewAt }, wx, wy); // on fire: crackling, and the crew's water once they arrive
    else if (working) add({ id: `b${b.id}`, kind: b.kind }, wx, wy);
  }
  for (const s of g.s.ships ?? []) {
    const p = shipPlace(g, s); add({ id: `s${s.id}`, kind: 'ship', moving: s.to !== undefined }, (p.x + 0.5) * TILE, (p.y + 0.5) * TILE);
  }
  for (const b of g.s.breaks ?? []) {
    const wx = (b.square % n + 0.5) * TILE, wy = (((b.square / n) | 0) + 0.5) * TILE;
    if (g.s.t >= b.crewAt && g.s.t < b.doneAt) add({ id: `r${b.square}`, kind: 'repair' }, wx, wy);
    if (b.kind === 'washout' && g.s.t < b.doneAt) out.storm = Math.max(out.storm, Math.min(1, place(g, v, wx, wy).vol * 2.5) * near);
  }
  const st = g.s.storm; // a storm cloud over the screen: rain, wind and thunder
  if (st && g.s.t < st.until) {
    const life = Math.max(0, Math.min(1, (st.until - g.s.t) / 20, (g.s.t - st.t0) / 20)), c = g.s.camera;
    const d = Math.hypot(st.x * TILE - c.x, st.y * TILE - c.y) / TILE;
    out.storm = Math.max(out.storm, Math.max(0, Math.min(1, (st.r * 1.6 - d) / (st.r * 0.8))) * life * near);
  }
  // the nearest town on the railway rings its bell now and then
  let town: { id: number; x: number; y: number } | null = null, best = Infinity;
  for (const s of g.s.sites) {
    if (s.kind !== 'town' || !townLinked(g, s)) continue;
    const d = Math.hypot((s.x + 0.5) * TILE - g.s.camera.x, (s.y + 0.5) * TILE - g.s.camera.y); if (d < best) { best = d; town = s; }
  }
  if (town) add({ id: `w${town.id}`, kind: 'town' }, (town.x + 0.5) * TILE, (town.y + 0.5) * TILE);
  // the land on screen, sampled on a small grid
  const c = g.s.camera, hw = v.w / 2 / c.z, hh = v.h / 2 / c.z; let k = 0;
  for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) {
    const x = Math.floor((c.x - hw + (a + 0.5) * hw * 2 / 7) / TILE), y = Math.floor((c.y - hh + (b + 0.5) * hh * 2 / 7) / TILE);
    if (x < 0 || y < 0 || x >= n || y >= n || !isRevealed(g, y * n + x)) continue;
    k++; const tr = g.world.terr[y * n + x]!;
    if (tr === T.Water) out.sea++; else if (tr === T.Forest) out.forest++; else if (tr === T.Grass) out.grass++; else out.hills++;
  }
  if (k) { out.sea /= k; out.forest /= k; out.grass /= k; out.hills /= k; }
  for (const key of ['sea', 'forest', 'grass', 'hills'] as const) out[key] *= near;
  return out;
}
