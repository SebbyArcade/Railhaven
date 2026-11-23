import type { Game, Site } from '../state.ts';
import { say } from '../core/news.ts';
import { hash } from '../core/rng.ts';
import { isRevealed } from './fog.ts';
import { reachedIslands } from '../progress/missions.ts';

/**
 * 🗝 Island secrets (Sébastien chose them with boom towns, 2026-11-22): every island the railway reaches hides one
 * secret, Ashford Isle too. Three 📜 clues lie inland; run your railway past one (within CLUE_R squares) to read it,
 * and a 🗝 search circle on the map shrinks round the secret. After the third clue the spot is marked ✖: lay track
 * to it and the secret is yours, each with something you can't get anywhere else.
 */
export type SecretKind = 'treasure' | 'stones' | 'valley';
export interface Secret {
  id: number; kind: SecretKind;
  x: number; y: number;
  clues: { x: number; y: number; got?: boolean }[];
  /** search circle shown after the first clue: middle and radius (0 = the exact spot) */
  cx?: number; cy?: number; r?: number;
  /** found at this game minute */
  found?: number;
}

export const CLUE_R = 2, SPOT_R = 1;
/** Search circle radius after 1, 2 and 3 clues. */
export const SEARCH_R = [10, 5, 0];
/** Bonuses: deliveries to towns on a 🗿 standing-stones island, output of buildings in a 🌾 hidden-valley island. */
export const STONES_PAY = 1.2, VALLEY_MADE = 1.2;
/** Islands smaller than this keep no secret (no room for clues). */
export const SECRET_MIN_SIZE = 60;

export const SECRET_INFO: Record<SecretKind, { icon: string; name: string; rumour: string; perk: string }> = {
  treasure: { icon: '💰', name: 'The lost payroll', rumour: 'a railway payroll chest vanished there, long ago', perk: 'a chest of old coins' },
  stones: { icon: '🗿', name: 'The standing stones', rumour: 'folk there leave flowers at old stones nobody can find', perk: 'every delivery to a town on this island pays 20% more' },
  valley: { icon: '🌾', name: 'The hidden valley', rumour: 'old maps show a green valley no surveyor ever reached', perk: 'every industry and factory on this island makes 20% more' },
};
const CLUE_TEXT = ['a torn page of an old map', 'a carved marker stone', 'a rusty survey stake', 'initials cut into a tree', 'a cold campfire with an arrow of stones'];
const KINDS: SecretKind[] = ['treasure', 'stones', 'valley'];

const islOf = (g: Game, x: number, y: number) => g.world.islandOf[y * g.world.n + x]!;
const islName = (g: Game, k: number) => k === g.world.home ? 'Ashford Isle' : g.world.islands[k]?.name ?? 'the island';
const fmt = (v: number) => '$' + Math.round(v).toLocaleString('en-US');
/** A treasure chest's coins: more at higher Railway levels. */
export const treasureCash = (g: Game) => 4000 + 2000 * (g.s.rlv ?? 0);

/** The secret hidden on an island, if one was placed. */
export const secretOn = (g: Game, k: number) => (g.s.secrets ?? []).find(s => islOf(g, s.x, s.y) === k);

/** Pay bonus for deliveries to a town (🗿 standing stones found on its island). */
export function secretPay(g: Game, t: Site): number {
  const s = secretOn(g, islOf(g, t.x, t.y)); return s?.found !== undefined && s.kind === 'stones' ? STONES_PAY : 1;
}
/** Output bonus for a building on an island with a 🌾 hidden valley found. */
export function secretMade(g: Game, k: number): number {
  const s = secretOn(g, k); return s?.found !== undefined && s.kind === 'valley' ? VALLEY_MADE : 1;
}

/** Place a secret and its clues on an island (seeded: the same map hides the same secrets). Null if it's too small. */
export function placeSecret(g: Game, k: number): Secret | null {
  const n = g.world.n, isl = g.world.islands[k]; if (!isl || isl.size < SECRET_MIN_SIZE) return null;
  const near = (x: number, y: number, r: number) => g.s.sites.some(s => Math.hypot(s.x - x, s.y - y) < r);
  const cand: number[] = [];
  for (let i = 0; i < n * n; i++) {
    if (g.world.islandOf[i] !== k) continue;
    const v = g.world.terr[i]; if (v === 4 || v === 0) continue; // no mountains: track must reach it without a tunnel
    const x = i % n, y = (i / n) | 0;
    if (k === g.world.home && Math.hypot(x - g.world.cx, y - g.world.cy) < 10) continue; // not in Ashford's back yard
    if (!near(x, y, 3) && !g.track.has(i)) cand.push(i);
  }
  if (cand.length < 12) return null;
  const id = (g.s.secretN ?? 0) + 1, r = (j: number) => hash(g.s.seed % 983 + k * 31, j, 7717);
  const pick = (j: number, ok: (x: number, y: number) => boolean) => {
    for (let a = 0; a < 60; a++) { const i = cand[Math.floor(r(j * 100 + a) * cand.length) % cand.length]!, x = i % n, y = (i / n) | 0; if (ok(x, y)) return { x, y }; }
    const i = cand[Math.floor(r(j * 100 + 99) * cand.length) % cand.length]!; return { x: i % n, y: (i / n) | 0 };
  };
  const spot = pick(1, () => true), clues: { x: number; y: number }[] = [];
  for (let c = 0; c < 3; c++) clues.push(pick(2 + c, (x, y) => Math.hypot(x - spot.x, y - spot.y) >= 6 && clues.every(o => Math.hypot(o.x - x, o.y - y) >= 6)));
  const kind = k === g.world.home ? 'treasure' : KINDS[Math.floor(r(9) * KINDS.length) % KINDS.length]!;
  const s: Secret = { id, kind, x: spot.x, y: spot.y, clues };
  (g.s.secrets ??= []).push(s); g.s.secretN = id;
  return s;
}

/** Shrink the search circle after a clue: a smaller circle that still holds the secret. */
function narrow(s: Secret) {
  const got = s.clues.filter(c => c.got).length; if (!got) return;
  const R = SEARCH_R[Math.min(got, 3) - 1]!;
  if (!R) { s.cx = s.x; s.cy = s.y; s.r = 0; return; }
  const a = hash(s.id, got, 9091) * Math.PI * 2, off = hash(s.id, got, 9092) * R * 0.6;
  s.cx = s.x + Math.cos(a) * off; s.cy = s.y + Math.sin(a) * off; s.r = R;
}

/** Is any square within r of (x, y) on the railway? */
function railNear(g: Game, x: number, y: number, r: number): boolean {
  const n = g.world.n;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n || Math.hypot(dx, dy) > r + 0.5) continue;
    if (g.linked?.has(Y * n + X)) return true;
  }
  return false;
}

/** Once a second: hide secrets on islands just reached, read clues the railway passes, and find secrets. */
export function tickSecrets(g: Game) {
  if ((g.s.orders ?? 0) < 1) return; // after the first order: the start is for learning
  const fresh: Secret[] = [];
  for (const k of reachedIslands(g)) {
    if (secretOn(g, k) || (g.s.noSecret ?? []).includes(k)) continue;
    const s = placeSecret(g, k);
    if (!s) { (g.s.noSecret ??= []).push(k); continue; }
    for (const c of s.clues) if (railNear(g, c.x, c.y, CLUE_R)) c.got = true; // track already there reads its clue quietly
    narrow(s); fresh.push(s);
  }
  if (fresh.length > 2) say(g, `🗝 ${fresh.length} islands on your railway hide secrets: look for 📜 clues on the map, or open Story → Secrets`);
  else for (const s of fresh) {
    const k = islOf(g, s.x, s.y), I = SECRET_INFO[s.kind], got = s.clues.filter(c => c.got).length, c = s.clues.find(o => !o.got);
    say(g, `🗝 Sailors say ${islName(g, k)} hides a secret: ${I.rumour}. ${got ? `Your track already passes ${got === 1 ? 'one clue' : got + ' clues'}. ` : ''}Look for 📜 clues inland and run your track past them`, c ? { kind: 'sq', x: c.x, y: c.y } : undefined);
  }
  for (const s of g.s.secrets ?? []) {
    if (s.found !== undefined) continue;
    const k = islOf(g, s.x, s.y), I = SECRET_INFO[s.kind];
    for (const c of s.clues) {
      if (c.got || !railNear(g, c.x, c.y, CLUE_R)) continue;
      c.got = true; narrow(s);
      const got = s.clues.filter(o => o.got).length;
      say(g, got < 3 ? `📜 Clue ${got} of 3 on ${islName(g, k)}: ${CLUE_TEXT[(s.id + got) % CLUE_TEXT.length]}. The 🗝 search circle on the map is smaller now`
        : `📜 The last clue on ${islName(g, k)}! The secret's spot is marked ✖: lay track to it`, { kind: 'sq', x: Math.round(s.cx!), y: Math.round(s.cy!) });
    }
    if (s.clues.every(c => c.got) && railNear(g, s.x, s.y, SPOT_R)) {
      s.found = Math.floor(g.s.t / 60);
      let extra = '';
      if (s.kind === 'treasure') { const v = treasureCash(g); g.s.money += v; g.s.earned = (g.s.earned ?? 0) + v; extra = `: ${fmt(v)} in old coins`; }
      else extra = `: ${I.perk}`;
      say(g, `🗝 Secret found on ${islName(g, k)}! ${I.icon} ${I.name}${extra}`, { kind: 'sq', x: s.x, y: s.y });
    }
  }
}

/** For the map: clues out of the fog not yet read, the search circle, and found secrets. */
export function secretMarks(g: Game) {
  const n = g.world.n, out: { clues: { x: number; y: number }[]; circle?: { x: number; y: number; r: number }; spot?: { x: number; y: number }; found?: { x: number; y: number; icon: string } }[] = [];
  for (const s of g.s.secrets ?? []) {
    if (s.found !== undefined) { out.push({ clues: [], found: { x: s.x, y: s.y, icon: SECRET_INFO[s.kind].icon } }); continue; }
    const clues = s.clues.filter(c => !c.got && isRevealed(g, c.y * n + c.x));
    out.push({ clues, ...(s.r ? { circle: { x: s.cx!, y: s.cy!, r: s.r } } : {}), ...(s.r === 0 ? { spot: { x: s.x, y: s.y } } : {}) });
  }
  return out;
}
