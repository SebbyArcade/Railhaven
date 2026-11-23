import type { Game, Site } from '../state.ts';
import { say } from '../core/news.ts';
import { hash } from '../core/rng.ts';
import { reveal } from './fog.ts';
import { isCoastal, townLinked } from '../economy/towns.ts';
import { linkedDocks } from '../ships/docks.ts';

/**
 * 🔥 Boom towns (Sébastien chose them, 2026-11-22, to make play less samey): every so often gold, oil, timber or fish
 * is struck at a town or settlement site the railway hasn't reached. A flare goes up over it with a countdown. Get
 * rails into its station in time and the boom pays a bonus, and for a while everything delivered there pays double.
 * Missing one costs nothing: the town stays on the map to link any time (no-fail).
 */
export type BoomKind = 'gold' | 'oil' | 'timber' | 'fish';
export interface Boom {
  id: number;
  /** the town it happened at */
  town: number;
  kind: BoomKind;
  /** squares from the railway when it began (sets the bonus) */
  d: number;
  /** when the rush ends if the railway hasn't got there */
  until: number;
  /** linked in time: the boom runs until this time, paying BOOM_PAY on deliveries there */
  boomTo?: number;
}

export const BOOM_INFO: Record<BoomKind, { icon: string; rush: string; what: string }> = {
  gold: { icon: '⛏', rush: 'Gold rush', what: 'Gold has been struck' },
  oil: { icon: '🛢', rush: 'Oil boom', what: 'Oil is gushing' },
  timber: { icon: '🌲', rush: 'Timber boom', what: 'Loggers are pouring in' },
  fish: { icon: '🐟', rush: 'Herring run', what: 'The herring are running' },
};

/** First boom this long after the first order is filled; then one every BOOM_GAP to BOOM_GAP + BOOM_SPREAD seconds after the last ends. */
export const BOOM_FIRST = 5 * 60, BOOM_GAP = 10 * 60, BOOM_SPREAD = 6 * 60;
/** How long the boom pays double once linked. */
export const BOOM_LEN = 10 * 60;
/** Deliveries to a booming town pay this many times more. */
export const BOOM_PAY = 2;
/** Squares from the railway a boom may be: the far end gives more time and a bigger bonus. */
export const BOOM_MIN = 4, BOOM_MAX = 45;

const fmt = (v: number) => '$' + Math.round(v).toLocaleString('en-US');
const mmss = (s: number) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Time to get there: 6 minutes plus 12 seconds a square, at most 16 minutes. */
export const boomTime = (d: number) => Math.min(16 * 60, 6 * 60 + d * 12);
/** The bonus for getting there in time: grows with the Railway level and how far it was. */
export const boomBonus = (g: Game, d: number) => Math.round(((1500 + 750 * (g.s.rlv ?? 0)) * (1 + d / 30)) / 100) * 100;

/** Deliveries to this town pay this many times more (a boom running there). */
export function boomMul(g: Game, t: Site): number {
  return (g.s.booms ?? []).some(b => b.town === t.id && b.boomTo !== undefined && g.s.t < b.boomTo) ? BOOM_PAY : 1;
}
/** The boom at this town, if any. */
export const boomAt = (g: Game, id: number) => (g.s.booms ?? []).find(b => b.town === id);

/** Straight-line squares from a place to the nearest square on the railway (sampled: the network can be big). */
function railDist(g: Game, x: number, y: number): number {
  const n = g.world.n; let best = Infinity, k = 0;
  for (const i of g.linked ?? []) { if ((k++ & 3) !== 0) continue; const d = Math.hypot((i % n) - x, ((i / n) | 0) - y); if (d < best) best = d; }
  return best;
}

/** What kind of boom suits the land round a town. */
function kindAt(g: Game, t: Site, r: number): BoomKind {
  const n = g.world.n; let mtn = 0, forest = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = t.x + dx, y = t.y + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue;
    const v = g.world.terr[y * n + x]; if (v === 4) mtn++; else if (v === 2) forest++;
  }
  const opts: BoomKind[] = [];
  if (mtn >= 3) opts.push('gold');
  if (forest >= 8) opts.push('timber');
  if (isCoastal(g, t)) opts.push('fish');
  if (g.world.islandOf[t.y * n + t.x] !== g.world.home) opts.push('oil');
  if (!opts.length) opts.push('gold');
  return opts[Math.floor(r * opts.length) % opts.length]!;
}

/** Places a boom could start: towns not on the railway and settlement sites, in sight range of the railway. */
export function boomSpots(g: Game): { s: Site; d: number }[] {
  const n = g.world.n, overseas = linkedDocks(g).length > 0, out: { s: Site; d: number }[] = [];
  for (const s of g.s.sites) {
    if (s.kind !== 'town' && s.kind !== 'plot') continue;
    if (s.kind === 'town' && townLinked(g, s)) continue;
    if (!overseas && g.world.islandOf[s.y * n + s.x] !== g.world.home) continue; // no dock yet: Ashford Isle only
    if ((g.s.booms ?? []).some(b => b.town === s.id)) continue;
    const d = railDist(g, s.x, s.y);
    if (d >= BOOM_MIN && d <= BOOM_MAX) out.push({ s, d });
  }
  return out.sort((a, b) => a.d - b.d);
}

/** Start a boom now (at the given spot, or a seeded pick among the nearest few). Returns it, or null if nowhere fits. */
export function startBoom(g: Game, at?: { s: Site; d: number }): Boom | null {
  const n0 = (g.s.boomN ?? 0) + 1, r = (k: number) => hash(g.s.seed % 991, n0 * 7 + k, 4111);
  if (!at) { const spots = boomSpots(g).slice(0, 6); if (!spots.length) return null; at = spots[Math.floor(r(1) * spots.length) % spots.length]!; }
  const t = at.s, kind = kindAt(g, t, r(2)), I = BOOM_INFO[kind];
  if (t.kind === 'plot') { t.kind = 'town'; t.founded = true; t.pop = 15; t.lvl = 0; t.got = {}; } // prospectors found the town themselves
  reveal(g, t.x, t.y, 4);
  const b: Boom = { id: n0, town: t.id, kind, d: Math.round(at.d), until: g.s.t + boomTime(at.d) };
  (g.s.booms ??= []).push(b); g.s.boomN = n0;
  say(g, `🔥 ${I.what} at ${t.name}! Get your rails into its station within ${mmss(b.until - g.s.t)} for a ${fmt(boomBonus(g, b.d))} bonus and double pay there`, { kind: 'town', id: t.id });
  return b;
}

/** Once a second: start booms when it's time, pay out when the railway gets there, end rushes and booms. */
export function tickBooms(g: Game, linked: (g: Game, t: Site) => boolean = townLinked) {
  const s = g.s, now = s.t;
  if ((s.orders ?? 0) < 1) return; // after the first order: the start is for learning
  s.nextBoom ??= now + BOOM_FIRST;
  const next = () => { const r = hash(s.seed % 991, (s.boomN ?? 0) * 13 + 5, 4111); s.nextBoom = now + BOOM_GAP + r * BOOM_SPREAD; };
  for (const b of [...(s.booms ?? [])]) {
    const t = s.sites.find(o => o.id === b.town), I = BOOM_INFO[b.kind];
    if (!t) { s.booms = s.booms!.filter(o => o !== b); continue; }
    if (b.boomTo === undefined) {
      if (linked(g, t)) {
        const v = boomBonus(g, b.d); s.money += v; s.earned = (s.earned ?? 0) + v;
        b.boomTo = now + BOOM_LEN; s.boomsWon = (s.boomsWon ?? 0) + 1;
        say(g, `🎉 You made it to ${t.name} in time! ${I.rush} bonus ${fmt(v)}, and everything delivered there pays double for ${BOOM_LEN / 60} minutes`, { kind: 'town', id: t.id });
      } else if (now >= b.until) {
        s.booms = s.booms!.filter(o => o !== b); next();
        say(g, `${I.icon} The ${I.rush.toLowerCase()} at ${t.name} has moved on. ${t.name} stays on the map: link it any time`, { kind: 'town', id: t.id });
      }
    } else if (now >= b.boomTo) {
      s.booms = s.booms!.filter(o => o !== b); next();
      say(g, `${I.icon} The ${I.rush.toLowerCase()} at ${t.name} is over: deliveries there pay as usual again`, { kind: 'town', id: t.id });
    }
  }
  if (!s.booms?.length && now >= s.nextBoom && !startBoom(g)) s.nextBoom = now + 60; // nowhere to boom yet: look again in a minute
}

/** The label shown over a booming town: what it is and the time left. */
export function boomLabel(g: Game, b: Boom): string {
  const I = BOOM_INFO[b.kind];
  return b.boomTo === undefined ? `${I.icon} ${I.rush} · ${mmss(b.until - g.s.t)}` : `🎉 ${I.rush} · pays ×${BOOM_PAY} · ${mmss(b.boomTo - g.s.t)}`;
}
