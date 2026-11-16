import type { Game } from '../state.ts';
import type { Train } from '../trains/train.ts';
import { bodyPoint } from '../trains/train.ts';
import { buildingSquares, capOf, INDUSTRIES, isLinked, type Building, yardSquares, yardSet } from '../buildings/industries.ts';
import { townLinked } from '../economy/towns.ts';
import { breakRail } from '../track/breaks.ts';
import { hallOf } from '../buildings/stations.ts';
import { backRun, type CrewRun, crewRun, moveCrews, railPath, runTime } from './crews.ts';
import { hash } from '../core/rng.ts';
import { TILE } from './terrain.ts';
import { isRevealed } from './fog.ts';

/**
 * Events that make the railway feel alive: storms drifting across the map, trains breaking down and building fires.
 * Crews always fix them in under a minute and nothing is lost for good (the no-fail rule): they only slow things
 * down for a moment. None starts before EVENTS_START.
 */
export interface Storm { x: number; y: number; vx: number; vy: number; r: number; t0: number; until: number; wash?: boolean }
export interface Mishap { crewAt: number; doneAt: number }

export const EVENTS_START = 12 * 60;
/** inside a storm trains run at this share of their top speed */
export const STORM_SLOW = 0.5;
const STORM_GAP = [6 * 60, 9 * 60], BREAKDOWN_GAP = [7 * 60, 10 * 60], FIRE_GAP = [8 * 60, 12 * 60];
const FIX_TRAIN = 20, FIX_FIRE = 22;

const gap = (g: Game, k: number, [a, b]: number[]) => g.s.t + a! + hash(g.s.seed, Math.floor(g.s.t), k, 51) * (b! - a!);

/** Nearest town name to a square, for the news ("near Brinemoor"). */
export function nearName(g: Game, x: number, y: number): string {
  let best = '', bd = Infinity;
  for (const s of g.s.sites) if (s.kind === 'town' && s.name) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s.name; } }
  return best ? `near ${best}` : 'out on the line';
}

/** Where a crew sets off from: the engine shed, else Ashford. Seconds to ride out at about a square a second. */
function crewTime(g: Game, x: number, y: number, from?: { x: number; y: number }) {
  const f = from ?? g.s.shed ?? g.s.sites[0]!;
  return 4 + Math.hypot(x - f.x, y - f.y) * 0.6;
}

/** Squares a second a storm drifts. */
const STORM_SPEED = 0.12;

/**
 * A storm over the track square (ax, ay): it starts upwind and drifts over the line, along a path that stays on land
 * you have discovered, never in the fog (he asked). It tries other wind directions, then a slower drift, and at last
 * stands still over the line.
 */
function stormPath(g: Game, ax: number, ay: number, ang0: number, life: number): Storm {
  const n = g.world.n, seen = (x: number, y: number) => {
    const ix = Math.round(x), iy = Math.round(y);
    return ix >= 0 && iy >= 0 && ix < n && iy < n && !!isRevealed(g, iy * n + ix);
  };
  for (const speed of [STORM_SPEED, STORM_SPEED / 2, STORM_SPEED / 4]) for (let k = 0; k < 12; k++) {
    const ang = ang0 + k * Math.PI / 6, vx = Math.cos(ang) * speed, vy = Math.sin(ang) * speed;
    const x0 = ax - vx * life / 2, y0 = ay - vy * life / 2, steps = Math.ceil(speed * life * 2);
    let ok = true;
    for (let i = 0; i <= steps && ok; i++) ok = seen(x0 + vx * life * i / steps, y0 + vy * life * i / steps);
    if (ok) return { x: x0, y: y0, vx, vy, r: 7, t0: g.s.t, until: g.s.t + life };
  }
  return { x: ax, y: ay, vx: 0, vy: 0, r: 7, t0: g.s.t, until: g.s.t + life };
}

export function inStorm(g: Game, x: number, y: number): boolean {
  const s = g.s.storm; return !!s && g.s.t < s.until && Math.hypot(x - s.x, y - s.y) < s.r;
}

/** Speed share for a train: 0 while broken down, slower in a storm. */
export function trainSpeedMul(g: Game, t: Train): number {
  if (t.broke && g.s.t < t.broke.doneAt) return 0;
  if (!g.s.storm || !t.trail.length) return 1;
  const p = bodyPoint(g.net, t, 0);
  return inStorm(g, p.x / TILE, p.y / TILE) ? STORM_SLOW : 1;
}

export const onFire = (g: Game, b: Building) => !!b.fire && g.s.t < b.fire.doneAt;

/** Run events. Returns true when rails broke (the caller replans trains). */
export function tickEvents(g: Game, dt: number): boolean {
  const s = g.s, news = (m: string) => (g.news ??= []).push(m);
  let railsBroke = false;
  const t0 = Math.max(s.t, EVENTS_START); // an older save starts its events a minute or more after loading, never all at once
  s.nextEvent ??= { storm: t0 + 60, breakdown: t0 + 3 * 60, fire: t0 + 5 * 60 };
  const ne = s.nextEvent;
  // ⛈ storms: a rain cloud drifts in from the sea and across the land
  if (s.storm) {
    const st = s.storm; st.x += st.vx * dt; st.y += st.vy * dt;
    if (!st.wash && s.t > st.until - 40 && hash(s.seed, Math.floor(s.t), 7, 52) < 0.5 * dt * 0.1) {
      // now and then heavy rain washes out a rail under it
      const n = g.world.n, cands = [...g.track.keys()].filter(i => Math.hypot(i % n - st.x, ((i / n) | 0) - st.y) < st.r * 0.7);
      if (cands.length) {
        const b = breakRail(g, cands[Math.floor(hash(s.seed, Math.floor(s.t), cands.length, 53) * cands.length)]!);
        if (b) { b.kind = 'washout'; st.wash = true; railsBroke = true; news(`🌊 The storm washed out a rail ${nearName(g, b.square % n, (b.square / n) | 0)}: a repair crew is on its way`); }
      }
    }
    if (s.t >= st.until) { s.storm = undefined; news('🌤 The storm has passed'); }
  } else if (s.t >= ne.storm && g.track.size) {
    ne.storm = gap(g, 1, STORM_GAP);
    const tr = [...g.track.keys()], n = g.world.n, at = tr[Math.floor(hash(s.seed, Math.floor(s.t), 2, 54) * tr.length)]!;
    const ax = at % n, ay = (at / n) | 0, ang0 = hash(s.seed, Math.floor(s.t), 3, 55) * Math.PI * 2, life = 100 + hash(s.seed, Math.floor(s.t), 4, 56) * 50;
    s.storm = stormPath(g, ax, ay, ang0, life);
    news(`⛈ A storm is rolling in ${nearName(g, ax, ay)}: trains slow down under it`);
  }
  // 🔧 breakdowns: a moving train stops and waits for the crew
  for (const t of s.trains) if (t.broke && s.t >= t.broke.doneAt) { t.broke = undefined; news(`🔧 Train ${t.id} is fixed and on its way again`); }
  if (s.t >= ne.breakdown) {
    ne.breakdown = gap(g, 5, BREAKDOWN_GAP);
    const moving = s.trains.filter(t => Math.abs(t.v) > 20 && !t.broke && t.trail.length);
    if (moving.length && !s.trains.some(t => t.broke)) {
      const t = moving[Math.floor(hash(s.seed, Math.floor(s.t), moving.length, 57) * moving.length)]!, p = bodyPoint(g.net, t, 0), x = p.x / TILE, y = p.y / TILE;
      const crewAt = s.t + crewTime(g, x, y); t.broke = { crewAt, doneAt: crewAt + FIX_TRAIN };
      news(`🔧 Train ${t.id} broke down ${nearName(g, x, y)}: a repair crew is on its way`);
    }
  }
  // 🔥 fires: a working building stops until the fire crew from the nearest town on the railway puts it out
  for (const b of s.buildings ?? []) if (b.fire && s.t >= b.fire.doneAt) { if (b.fire.run) (s.crews ??= []).push(backRun(b.fire.run, s.t)); b.fire = undefined; news(`🚒 The fire at the ${INDUSTRIES[b.kind].name} ${nearName(g, b.x, b.y)} is out: it is working again`); }
  if (s.t >= ne.fire) {
    ne.fire = gap(g, 6, FIRE_GAP);
    const ok = (s.buildings ?? []).filter(b => b.kind !== 'dock' && isLinked(g, b) && b.stock < capOf(b) && !b.fire);
    if (ok.length && !(s.buildings ?? []).some(b => onFire(g, b))) {
      const b = ok[Math.floor(hash(s.seed, Math.floor(s.t), ok.length, 58) * ok.length)]!, n = g.world.n, m = buildingSquares(n, b)[1]!;
      const towns = s.sites.filter(t => t.kind === 'town' && townLinked(g, t)), x = m % n, y = (m / n) | 0;
      towns.sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y)); const from = towns[0];
      // the crew rides the rails from the nearest town's station that has a way there
      let run: CrewRun | null = null, base = from;
      for (const t of towns) { const h = hallOf(g.track, n, t, g.world.terr, yardSet(g)); run = h ? crewRun(g, 'fire', railPath(g, h.squares, yardSquares(n, b)), s.t) : null; if (run) { base = t; break; } }
      const crewAt = run ? s.t + runTime(run) : s.t + crewTime(g, x, y, from);
      b.fire = { crewAt, doneAt: crewAt + FIX_FIRE, ...(run ? { run } : {}), ...(base?.name ? { from: base.name } : {}) };
      news(`🔥 Fire at the ${INDUSTRIES[b.kind].name} ${nearName(g, x, y)}! It stops working until the fire crew${base?.name ? ` from ${base.name}` : ''} ${run ? 'rides out along the rails and ' : ''}puts it out`);
    }
  }
  moveCrews(g, dt); // crews ride on (or wait for trains), and hold the stretch they stand on
  return railsBroke;
}
