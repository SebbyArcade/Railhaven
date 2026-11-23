import type { Game, Site } from '../state.ts';
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
import { say } from '../core/news.ts';
import { hash } from '../core/rng.ts';

import { reachedIslands } from '../progress/missions.ts';

/**
 * 🗝 Island secrets (Sébastien chose them with boom towns, 2026-11-22): every island the railway reaches hides one
 * secret, Ashford Isle too, at the end of a trail of three 📜 clues. Nothing on the map shows where they are: each
 * step comes with a written hint (a direction, a rough distance and what the land is like there), starting from a
 * town. Run your railway within CLUE_R squares of a clue to read it and get the next hint; the third leads to the
 * secret itself (within SPOT_R). Sébastien asked for hints, not markers (2026-11-22).
 */
export type SecretKind = 'treasure' | 'stones' | 'valley';
export interface Secret {
  id: number; kind: SecretKind;
  x: number; y: number;
  clues: { x: number; y: number; got?: boolean }[];
  /** old saves of the preview: a search circle (no longer used) */
  cx?: number; cy?: number; r?: number;
  /** found at this game minute */
  found?: number;
}

/** Track this close reads a clue / digs up the secret (both hidden on the map: only the hints say where). */
export const CLUE_R = 3, SPOT_R = 2;
/** Each leg of the trail: this many squares from the last clue (the first from your railway). */
export const LEG_MIN = 6, LEG_MAX = 14;
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

/** Place a secret and its trail on an island (seeded: the same map and railway hide the same secrets). Null if too small. */
export function placeSecret(g: Game, k: number): Secret | null {
  const n = g.world.n, isl = g.world.islands[k]; if (!isl || isl.size < SECRET_MIN_SIZE) return null;
  const near = (x: number, y: number, r: number) => g.s.sites.some(s => Math.hypot(s.x - x, s.y - y) < r);
  const cand: number[] = [];
  for (let i = 0; i < n * n; i++) {
    if (g.world.islandOf[i] !== k) continue;
    const v = g.world.terr[i]; if (v === 4 || v === 0) continue; // no mountains: track must reach it without a tunnel
    if (!near(i % n, (i / n) | 0, 3) && !g.track.has(i)) cand.push(i);
  }
  if (cand.length < 12) return null;
  const rail: [number, number][] = []; let m = 0;
  for (const i of g.linked ?? []) if (g.world.islandOf[i] === k && (m++ & 3) === 0) rail.push([i % n, (i / n) | 0]);
  const railD = (x: number, y: number) => rail.reduce((a, [rx, ry]) => Math.min(a, Math.hypot(rx - x, ry - y)), Infinity);
  const id = (g.s.secretN ?? 0) + 1, r = (j: number) => hash(g.s.seed % 983 + k * 31, j, 7717);
  const pick = (j: number, ok: (x: number, y: number) => boolean) => {
    for (let a = 0; a < 200; a++) { const i = cand[Math.floor(r(j * 1000 + a) * cand.length) % cand.length]!, x = i % n, y = (i / n) | 0; if (ok(x, y)) return { x, y }; }
    return null;
  };
  const leg = (p: { x: number; y: number }, used: { x: number; y: number }[]) => (x: number, y: number) => { const d = Math.hypot(x - p.x, y - p.y); return d >= LEG_MIN && d <= LEG_MAX && used.every(o => Math.hypot(o.x - x, o.y - y) >= LEG_MIN) && railD(x, y) > CLUE_R + 1; };
  const pts: { x: number; y: number }[] = [];
  const first = pick(1, (x, y) => { const d = railD(x, y); return rail.length ? d > CLUE_R + 1 && d <= LEG_MAX : true; }) ?? pick(2, () => true);
  if (!first) return null; pts.push(first);
  const apart = (x: number, y: number) => pts.every(o => Math.hypot(o.x - x, o.y - y) >= LEG_MIN);
  for (let c = 1; c < 4; c++) { const p = pick(2 + c, leg(pts[c - 1]!, pts)) ?? pick(10 + c, (x, y) => apart(x, y) && railD(x, y) > CLUE_R + 1) ?? pick(20 + c, apart); if (!p) return null; pts.push(p); }
  const kind = k === g.world.home ? 'treasure' : KINDS[Math.floor(r(9) * KINDS.length) % KINDS.length]!;
  const s: Secret = { id, kind, x: pts[3]!.x, y: pts[3]!.y, clues: pts.slice(0, 3) };
  (g.s.secrets ??= []).push(s); g.s.secretN = id;
  return s;
}

/** The next step of a secret's trail: the first clue not read yet, else the ✖ (null once found). */
export function trailNext(s: Secret): { x: number; y: number; spot: boolean } | null {
  if (s.found !== undefined) return null;
  const c = s.clues.find(o => !o.got); return c ? { x: c.x, y: c.y, spot: false } : { x: s.x, y: s.y, spot: true };
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

/** Read every clue in order that the railway now passes; the next step comes out of the fog. Returns how many. */
function readTrail(g: Game, s: Secret): number {
  let k = 0;
  for (let t = trailNext(s); t && !t.spot && railNear(g, t.x, t.y, CLUE_R); t = trailNext(s)) { s.clues.find(o => !o.got)!.got = true; k++; }
  return k;
}

/** Once a second: hide secrets on islands just reached, follow trails the railway passes, and find secrets. */
export function tickSecrets(g: Game) {
  if ((g.s.orders ?? 0) < 1) return; // after the first order: the start is for learning
  const fresh: Secret[] = [];
  for (const k of reachedIslands(g)) {
    if (secretOn(g, k) || (g.s.noSecret ?? []).includes(k)) continue;
    const s = placeSecret(g, k);
    if (!s) { (g.s.noSecret ??= []).push(k); continue; }
    readTrail(g, s); fresh.push(s); // track already there reads its clues quietly
  }
  if (fresh.length > 2) say(g, `🗝 ${fresh.length} islands on your railway hide secrets: each starts with a hint in Story → 🗝 Secrets`);
  else for (const s of fresh) (g.secretCards ??= []).push({ id: s.id, ev: 'new' }); // its card explains it
  for (const s of g.s.secrets ?? []) {
    if (s.found !== undefined) continue;
    const k = islOf(g, s.x, s.y), I = SECRET_INFO[s.kind];
    if (readTrail(g, s)) {
      g.secretCards = (g.secretCards ?? []).filter(c => !(c.id === s.id && c.ev === 'clue')).concat({ id: s.id, ev: 'clue' }); // its card says where the trail goes next
      const got = s.clues.filter(o => o.got).length; say(g, `📜 Clue ${got} of 3 read on ${islName(g, k)}: ${got < 3 ? 'its hint points to the next one' : 'its hint points to the secret'}`);
    }
    if (s.clues.every(c => c.got) && railNear(g, s.x, s.y, SPOT_R)) {
      s.found = Math.floor(g.s.t / 60);
      let extra = '';
      if (s.kind === 'treasure') { const v = treasureCash(g); g.s.money += v; g.s.earned = (g.s.earned ?? 0) + v; extra = `: ${fmt(v)} in old coins`; }
      else extra = `: ${I.perk}`;
      say(g, `🗝 Secret found on ${islName(g, k)}! ${I.icon} ${I.name}${extra}`, { kind: 'sq', x: s.x, y: s.y });
      g.secretCards = (g.secretCards ?? []).filter(c => c.id !== s.id); g.secretCards.push({ id: s.id, ev: 'found' });
    }
  }
}

const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
/** Where a hint starts: the last clue read, else the town on the island nearest the first clue. */
export function hintFrom(g: Game, s: Secret): { x: number; y: number; name: string } {
  const got = s.clues.filter(c => c.got), read = got.at(-1); if (read) return { ...read, name: `clue ${got.length} (the glowing 📜${got.length} on the map)` };
  const k = islOf(g, s.x, s.y), c = s.clues[0]!;
  const t = g.s.sites.filter(o => o.kind === 'town' && islOf(g, o.x, o.y) === k).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
  return t ? { x: t.x, y: t.y, name: t.name ?? 'the town' } : { x: c.x, y: c.y, name: 'the shore' };
}
/** What the land is like round a square, in a few words. */
function landAt(g: Game, x: number, y: number, skip?: string): string {
  const n = g.world.n; let f = 0, h = 0, m = 0, w = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
    const v = g.world.terr[Y * n + X]; if (v === 0) w++; else if (v === 2) f++; else if (v === 3) h++; else if (v === 4) m++;
  }
  const t = g.s.sites.find(o => o.kind === 'town' && o.name !== skip && Math.hypot(o.x - x, o.y - y) <= 6);
  const land = m >= 3 ? 'at the foot of the mountains' : w >= 7 ? 'near the water' : h >= 6 ? 'up in the hills' : f >= 10 ? 'deep in the forest' : f >= 4 ? 'at the edge of a wood' : 'on open grassland';
  return land + (t ? `, not far from ${t.name}` : '');
}
/** The hint for the next step: direction, rough distance and the land there. Never the exact spot. */
export function secretHint(g: Game, s: Secret): string {
  const t = trailNext(s); if (!t) return '';
  const o = hintFrom(g, s), d = Math.hypot(t.x - o.x, t.y - o.y), a = Math.atan2(t.y - o.y, t.x - o.x);
  const dir = DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]!, far = Math.max(5, Math.round(d / 5) * 5);
  return `From ${o.name}, head ${dir}, about ${far} squares, ${landAt(g, t.x, t.y, o.name)}. ${t.spot ? 'The secret is buried there' : 'A clue is hidden there'}: bring your track within ${t.spot ? SPOT_R : CLUE_R} squares of it.`;
}

/** For the map: clues already read (as faded ticks) and found secrets. Nothing shows where the next step is. */
export function secretMarks(g: Game) {
  const out: { read: { x: number; y: number; got?: boolean }[]; found?: { x: number; y: number; icon: string } }[] = [];
  for (const s of g.s.secrets ?? []) out.push(s.found !== undefined ? { read: [], found: { x: s.x, y: s.y, icon: SECRET_INFO[s.kind].icon } } : { read: s.clues.filter(c => c.got) });
  return out;
}

/** The secret whose last read clue is on or next to this square, for a tap on the map (shows its hint). */
export function secretTapAt(g: Game, i: number): Secret | undefined {
  const n = g.world.n, x = i % n, y = (i / n) | 0;
  return (g.s.secrets ?? []).find(s => s.found === undefined && s.clues.some(c => c.got && Math.abs(c.x - x) <= 1 && Math.abs(c.y - y) <= 1));
}

/** Where 📍 Show takes the player: where the hint starts (the last clue read, or the town). */
export function secretNext(g: Game, s: Secret): { x: number; y: number } {
  const o = hintFrom(g, s); return { x: o.x, y: o.y };
}

/** The secret card: what it is, what was just found, and the hint for the next step. ev: new, clue, found, or a tap. */
export function secretCardHtml(g: Game, id: number, ev?: string): string | null {
  const s = (g.s.secrets ?? []).find(o => o.id === id); if (!s) return null;
  const I = SECRET_INFO[s.kind], k = islOf(g, s.x, s.y), nm = islName(g, k), got = s.clues.filter(c => c.got).length;
  const head = s.found !== undefined ? ['🗝', `Secret found on ${nm}!`] : ev === 'clue' ? ['📜', got < 3 ? `Clue ${got} of 3 read!` : 'All 3 clues found! Now dig'] : got >= 3 ? ['🗝', 'Now dig for the secret'] : ev === 'new' ? ['🗝', `${nm} hides a secret`] : ['📜', `${got} of 3 clues read`];
  let h = `<div class="find"><span class="rar" style="border-color:#e8a33c;color:#e8a33c">🗝 ISLAND SECRET</span><small>on ${nm}</small><b class="fbig">${head[0]}</b><h2>${head[1]}</h2></div>`;
  if (s.found !== undefined) {
    h += `<div class="gift">${I.icon} <b>${I.name}</b>: ${s.kind === 'treasure' ? 'a chest of old coins, paid into your money' : I.perk}</div>`;
    return h + `<button class="act" data-act="secrets">🗝 All secrets</button>`;
  }
  if (ev === 'clue') h += `<div class="note">📜 Your track passed ${CLUE_TEXT[(s.id + got) % CLUE_TEXT.length]}. Scratched on it is a hint to ${got < 3 ? 'the next clue' : 'where the secret is buried'}.</div>`;
  else if (ev === 'new' || !got) h += `<div class="note">Sailors say ${I.rumour}. A trail of 3 hidden clues leads to it: nothing marks them on the map, only the hints.</div>`;
  const chip = (ok: boolean, t: string) => `<span class="chip2" style="${ok ? 'background:#2f7a34;color:#fff' : ''}">${ok ? '✅' : '⬜'} ${t}</span>`;
  if (got >= 3) h += `<div class="note"><b>Last step:</b> the clues lead to where the secret is buried. Follow this hint and lay track there: when your track comes within ${SPOT_R} squares, it is dug up by itself and the reward is yours.</div>`;
  h += `<div class="gift">${got >= 3 ? '🗝' : '📜'} <i>${esc(secretHint(g, s))}</i></div>`;
  h += `<div class="note">${chip(got >= 1, '📜')} ${chip(got >= 2, '📜')} ${chip(got >= 3, '📜')} ${chip(false, '🗝')} · 🎁 ${s.kind === 'treasure' ? `a chest of old coins (${fmt(treasureCash(g))} now)` : I.perk}</div>`;
  const o = secretNext(g, s);
  return h + `<button class="act" data-act="lookxy" data-x="${o.x}" data-y="${o.y}">📍 Show ${got ? `clue ${got}` : esc(hintFrom(g, s).name)}</button>`;
}

/** The trail you're on: the secret with the most clues read (at least one), not found yet. */
export function activeSecret(g: Game): Secret | undefined {
  let best: Secret | undefined, bn = 0;
  for (const s of g.s.secrets ?? []) { if (s.found !== undefined) continue; const n = s.clues.filter(c => c.got).length; if (n > bn) { bn = n; best = s; } }
  return best;
}
/** The pill under the mission: where the trail goes next, in short, so the hint never gets lost. */
export function secretPill(g: Game): string {
  const s = activeSecret(g); if (!s) return '';
  const t = trailNext(s)!, o = hintFrom(g, s), a = Math.atan2(t.y - o.y, t.x - o.x), d = Math.max(5, Math.round(Math.hypot(t.x - o.x, t.y - o.y) / 5) * 5);
  const dir = DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]!;
  return `<span class="mtext">${t.spot ? '🗝 Dig' : `📜 Clue ${s.clues.filter(c => c.got).length + 1}`}: ${dir}, ~${d} squares from 📜${s.clues.filter(c => c.got).length}</span><button>Hint ›</button>`;
}
