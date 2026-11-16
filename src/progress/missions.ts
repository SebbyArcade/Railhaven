import type { Game, Site } from '../state.ts';
import { hash } from '../core/rng.ts';
import { aName, GOODS, type Good, INDUSTRIES, type IndustryKind, inputsOf, isFactory, isLinked, lockedText, nearestSpot } from '../buildings/industries.ts';
import { orderOf, sizeName, stepOf, townLinked } from '../economy/towns.ts';
import { islandName, islandOfB, linkedDocks } from '../ships/docks.ts';
import { islandSpec, SPEC_TEXT } from '../world/specialty.ts';
import { isRevealed } from '../world/fog.ts';
import { lessonOn, tickLessons } from './lessons.ts';

/**
 * Missions with Mira the dispatcher (the old game's final design, v258+). One main mission and two side missions,
 * picked from what the game needs right now: goods towns want that nothing makes, buildings just unlocked, towns to
 * find and link, islands to reach, orders close to done. Each pays a reward when done. Acts follow the Railway level,
 * each with its title and Mira's opening line. Picks are seeded from the map, so the same game gets the same story.
 */

export const ACTS: { icon: string; title: string; intro: [string, string] }[] = [
  { icon: '🚂', title: 'The Old Line', intro: ['Ashford’s yard has been silent for eleven years. Mira hands you the keys: “Wake the line up. One camp, one farm, one town at a time.”', 'Mira blows the dust off the timetable. “Nobody’s run a train here in years. Let’s give them a reason to listen for the whistle.”'] },
  { icon: '🏭', title: 'Mills and Docks', intro: ['“Raw wood and wheat only go so far,” Mira says. “Mills turn them into what towns really want. And the sea is open now.”', 'The first sawdust drifts over Ashford. “Now we make things,” Mira grins. “And the harbour master says the docks can reopen.”'] },
  { icon: '⚙️', title: 'Steel and Wool', intro: ['“Cities want steel and cloth,” Mira says. “Iron is never where you want it. Find it.”', 'Mira pins a chart to the wall. “Steel for the bridges, wool for the winters. Neither will come to us.”'] },
  { icon: '🌊', title: 'Deep Water', intro: ['“Bigger ships, longer crossings,” Mira says. “The far islands are waiting.”', 'The harbour fills with deepwater hulls. “Every island we link makes the next one easier,” says Mira.'] },
  { icon: '🏙', title: 'Growing Towns', intro: ['“Our industries can grow bigger now,” Mira says. “The towns will grow with them.”', '“Big towns, big orders,” Mira warns. “Keep the goods flowing.”'] },
  { icon: '🚄', title: 'Express Lines', intro: ['“Faster engines!” Mira laughs. “The timetable will never be the same.”', 'The first fast train thunders through Ashford. Mira checks her watch twice.'] },
  { icon: '🏗', title: 'Heavy Industry', intro: ['“Big works,” Mira whistles. “Feed them and they’ll feed the whole map.”', 'Smoke from the big works can be seen from the next island. “Good,” says Mira.'] },
  { icon: '🚃', title: 'Long Trains', intro: ['“Longer trains, more cargo,” Mira says. “Let’s fill them.”', 'The platforms had to be lengthened. Mira didn’t complain.'] },
  { icon: '⚡', title: 'Faster Still', intro: ['“Faster still,” Mira says. “The islands feel close now.”', 'The old timetable is framed in the office. Nobody uses it any more.'] },
  { icon: '👑', title: 'The Network', intro: ['“Look at it,” Mira says from the clock tower. “Every whistle out there is ours.”', 'Mira hands you her old cap. “It’s your railway now. Keep it growing.”'] },
];

const MIRA: Record<string, string[]> = {
  build: ['“{why} A {n} would change everything,” Mira says.', 'Mira taps the map. “{why} Put a {n} here and watch.”', '“{why} Time for a {n},” says Mira.'],
  reach: ['“Sailors talk about {isl},” Mira says. “{rum}”', 'Mira unrolls a sea chart. “{isl}. {rum} Let’s go and see.”', '“There’s land out there,” Mira says. “{isl}. {rum}”'],
  find: ['“Old maps show a town {dir} of {from},” Mira says. “Send a scout and see if it’s still there.”', 'Mira squints at a faded map. “Something {dir} of {from}. A scout would find it.”'],
  link: ['“{town} still remembers the trains,” Mira says. “Bring them back.”', '“The people of {town} wave at every whistle they hear,” Mira says. “Let’s give them one that stops.”', 'Mira circles {town} on the map. “That one’s next.”'],
  order: ['“{town} needs {goods},” Mira says. “Help it grow into a {tier}.”', 'A letter from {town}: they want {goods}. Mira puts it on top of the pile.', '“If {town} gets {goods}, it becomes a {tier},” Mira says. “That’s more trade for us.”'],
  fish: ['“Fish are jumping by the dock,” Mira says. “Boats would pay for themselves.”', 'The old fishermen at the dock ask about boats. Mira nods at you.'],
};

export type MissionType = 'build' | 'reach' | 'find' | 'link' | 'order' | 'fish';
export interface Mission {
  id: string; ty: MissionType;
  /** 3 = something is stuck, 2 = a step forward, 1 = growth */
  pr: number;
  side?: boolean;
  /** what to build, which town or building, which island */
  k?: IndustryKind; site?: number; bld?: number; isl?: number;
  /** count or town step when it began */
  base?: number;
  why?: string;
  title: string; how: string; mira: string; reward: number;
}
export interface MissionState {
  main?: Mission | null; side: Mission[];
  /** done missions (latest 30): title, minute, reward */
  done: { id: string; title: string; min: number; reward: number }[];
  /** act shown (Railway level + 1) and Mira's line for it; actNew until the act card was shown */
  act?: number; actLine?: string; actNew?: boolean;
  /** missions picked so far (seeds the choices), last main type, swapped-away ids */
  n: number; lastTy?: MissionType; skip?: string[];
}

export const SIDE_COUNT = 2, SWAP_SHARE = 0.25;
const r100 = (v: number) => Math.round(v / 100) * 100;
const lc = (k: Good) => GOODS[k].name.toLowerCase();
const fill = (s: string, o: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

export const actOf = (g: Game) => Math.min(ACTS.length, (g.s.rlv ?? 0) + 1);
export const msOf = (g: Game): MissionState => (g.s.ms ??= { side: [], done: [], n: 0 });
const rnd = (g: Game, n: number) => hash(g.s.seed % 997, n % 9973, 577);
const pick = <T>(g: Game, a: T[], n: number) => a[Math.floor(rnd(g, n) * a.length) % a.length]!;

export const ashford = (g: Game) => g.s.sites[0]!;
const towns = (g: Game) => g.s.sites.filter(s => s.kind === 'town');
const islandAt = (g: Game, s: { x: number; y: number }) => g.world.islandOf[s.y * g.world.n + s.x]!;

/** named islands the railway's track stands on (a 🌉 strait bridge carries it onto a sister island), per linked-track set */
const railIsl = new WeakMap<Set<number>, number[]>();
/** Islands your railway reaches: Ashford Isle, every island with a landing on the railway, and every named island its track runs onto. */
export function reachedIslands(g: Game): Set<number> {
  const out = new Set([g.world.home]); for (const b of linkedDocks(g)) out.add(islandOfB(g, b));
  if (g.linked) {
    let r = railIsl.get(g.linked);
    if (!r) { const s = new Set<number>(); for (const i of g.linked) { const k = g.world.islandOf[i]!; if (k >= 0 && g.world.islands[k]?.name) s.add(k); } railIsl.set(g.linked, (r = [...s])); }
    for (const k of r) out.add(k);
  }
  return out;
}

/** Order goods a town still needs. */
const missing = (g: Game, t: Site) => { const o = orderOf(g, t); return (Object.keys(o) as Good[]).filter(k => (t.got?.[k] ?? 0) < o[k]!); };
function orderProgress(g: Game, t: Site) { const o = orderOf(g, t); let v = 0, n = 0; for (const k of Object.keys(o) as Good[]) { n += o[k]!; v += Math.min(o[k]!, Math.floor(t.got?.[k] ?? 0)); } return { v, n }; }

const makerOf = (k: Good) => (Object.keys(INDUSTRIES) as IndustryKind[]).find(m => m !== 'dock' && INDUSTRIES[m].makes === k);
const has = (g: Game, k: IndustryKind) => (g.s.buildings ?? []).some(b => b.kind === k);

/** Can this kind be built anywhere you can see (rechecked every 20 s)? */
const canCache = new WeakMap<Game, Map<string, { t: number; v: boolean }>>();
function canBuild(g: Game, k: IndustryKind): boolean {
  if (lockedText(g, k)) return false;
  if (isFactory(k)) return true;
  let c = canCache.get(g); if (!c) canCache.set(g, (c = new Map()));
  const e = c.get(k); if (e && g.s.t - e.t < 20) return e.v;
  const a = ashford(g), v = !!nearestSpot(g, k, a.x, a.y, 40);
  c.set(k, { t: g.s.t, v }); return v;
}

/** The nearest island you haven't reached that has towns (and the good, if one is asked for). */
function islandWith(g: Game, k?: Good): number | null {
  const reached = reachedIslands(g), n = g.world.n;
  let best: number | null = null, bd = Infinity;
  g.world.islands.forEach((isl, j) => {
    if (!isl.name || reached.has(j) || !towns(g).some(t => islandAt(g, t) === j)) return;
    if (k && islandSpec(g, j) !== k && !g.s.sites.some(s => s.kind === 'dep' && s.res === k && g.world.islandOf[s.y * n + s.x] === j)) return;
    if (isl.dist < bd) { bd = isl.dist; best = j; }
  });
  return best;
}

type Cand = Omit<Mission, 'title' | 'how' | 'mira' | 'reward'>;

/** A factory needs its inputs first: the step that gets the first missing one (build its maker, or reach an island that has it). */
function stepFor(g: Game, fk: IndustryKind, pr: number, why: string): Cand | null {
  for (const k of inputsOf(fk)) {
    const mk = makerOf(k);
    if (!mk || has(g, mk)) continue;
    const more = `${why} A ${INDUSTRIES[fk].name} needs ${lc(k)} first.`;
    if (isFactory(mk)) return lockedText(g, mk) ? null : stepFor(g, mk, pr, more);
    if (canBuild(g, mk)) return { id: 'build:' + mk, ty: 'build', k: mk, pr, why: more };
    const j = islandWith(g, k);
    return j !== null && !lockedText(g, 'dock') ? { id: 'reach:' + j, ty: 'reach', isl: j, pr, why: `${more} Your islands have none.` } : null;
  }
  return { id: 'build:' + fk, ty: 'build', k: fk, pr, why };
}

/** Everything worth doing right now. */
export function candidates(g: Game): Cand[] {
  const C: Cand[] = [], L = g.s.rlv ?? 0, a = ashford(g), reached = reachedIslands(g), n = g.world.n;
  const linked = towns(g).filter(t => t === a || townLinked(g, t)); // Ashford is where the railway starts
  // stuck goods: towns want something nothing makes
  const gaps = new Map<Good, Site[]>();
  for (const t of linked) for (const k of missing(g, t)) { const m = makerOf(k); if (m && !has(g, m)) gaps.set(k, [...(gaps.get(k) ?? []), t]); }
  for (const [k, ts] of gaps) {
    const m = makerOf(k)!, why = `${ts.length > 1 ? `${ts.length} towns want` : `${ts[0]!.name} wants`} ${lc(k)} and nothing makes it.`;
    if (isFactory(m)) { if (!lockedText(g, m)) { const st = stepFor(g, m, 3, why); if (st) C.push(st); } }
    else if (canBuild(g, m)) C.push({ id: 'build:' + m, ty: 'build', k: m, pr: 3, why });
    else if (!lockedText(g, 'dock')) { const j = islandWith(g, k); if (j !== null) C.push({ id: 'reach:' + j, ty: 'reach', isl: j, pr: 3, why: `${GOODS[k].name} isn’t found on your islands.` }); }
  }
  // buildings just unlocked and never built
  for (const fk of Object.keys(INDUSTRIES) as IndustryKind[]) if (isFactory(fk) && !lockedText(g, fk) && !has(g, fk)) {
    const st = stepFor(g, fk, 2, `Your railway can build ${aName(INDUSTRIES[fk].name)} now: it turns ${inputsOf(fk).map(lc).join(' and ')} into ${lc(INDUSTRIES[fk].makes)}.`);
    if (st) C.push(st);
  }
  if (!lockedText(g, 'dock') && !has(g, 'dock') && islandWith(g) !== null) C.push({ id: 'build:dock', ty: 'build', k: 'dock', pr: 2, why: 'The sea is open: a dock lets you reach other islands.' });
  for (const k of ['wood', 'farm', 'stone', 'coal', 'wool'] as const) if (!has(g, k) && (k === 'wood' || k === 'farm' || L >= 1) && canBuild(g, k)) C.push({ id: 'build:' + k, ty: 'build', k, pr: k === 'wool' ? 1 : 2, why: `You don’t make ${lc(INDUSTRIES[k].makes)} yet.` });
  const fd = (g.s.buildings ?? []).find(b => b.kind === 'dock' && isLinked(g, b) && !(b.fish ?? 0));
  if (fd) C.push({ id: 'fish:' + fd.id, ty: 'fish', bld: fd.id, pr: 1 });
  // towns to link (seen ones on islands you reach), and towns still in the fog to find
  for (const t of towns(g)) {
    if (t === a || townLinked(g, t) || !reached.has(islandAt(g, t))) continue;
    if (isRevealed(g, t.y * n + t.x)) C.push({ id: 'link:' + t.id, ty: 'link', site: t.id, pr: 2 });
    else C.push({ id: 'find:' + t.id, ty: 'find', site: t.id, pr: 1 });
  }
  // islands to reach
  if (!lockedText(g, 'dock')) { const j = islandWith(g); if (j !== null) C.push({ id: 'reach:' + j, ty: 'reach', isl: j, pr: 2 }); }
  // orders: the towns closest to growing, and Ashford's next size
  const near = linked.filter(t => missing(g, t).length).map(t => { const p = orderProgress(g, t); return { t, f: p.n ? p.v / p.n : 0 }; }).sort((p, q) => q.f - p.f).slice(0, 4);
  for (const { t } of near) C.push({ id: `order:${t.id}:${stepOf(t)}`, ty: 'order', site: t.id, pr: t === a ? 2 : 1 });
  // no dock yet: every island to reach becomes 'build a dock' first
  if (!linkedDocks(g).length) for (let i = 0; i < C.length; i++) if (C[i]!.ty === 'reach') {
    const c = C[i]!; C[i] = { id: 'build:dock', ty: 'build', k: 'dock', pr: c.pr, why: `${c.why ? c.why + ' ' : ''}${islandName(g, c.isl!)} is across the sea: you need a dock first.` };
  }
  const seen = new Set<string>(); return C.filter(c => !seen.has(c.id) && !!seen.add(c.id));
}

/** Which way a place lies from another, in plain words. */
export function compass(dx: number, dy: number): string {
  const a = Math.atan2(dy, dx) * 180 / Math.PI, i = Math.round(((a + 360) % 360) / 45) % 8;
  return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][i]!;
}

/** What sailors say about an island. */
export function rumourOf(g: Game, j: number): string {
  const sp = islandSpec(g, j), n = g.world.n;
  const deps = [...new Set(g.s.sites.filter(s => s.kind === 'dep' && (s.res === 'iron' || s.res === 'oil') && g.world.islandOf[s.y * n + s.x] === j).map(s => s.res!))];
  const extra = deps.filter(r => r !== sp).map(r => lc(r)).join(' and ');
  if (sp) return `They say it’s a ${SPEC_TEXT[sp].replace(/^\S+ /, '').toLowerCase()}${extra ? `, with ${extra} in its hills` : ''}.`;
  return extra ? `They say it has ${extra}.` : 'Nobody has been there for years.';
}

const WHERE: Partial<Record<IndustryKind, string>> = {
  wood: 'in forest, beside your track', farm: 'on open grass, beside your track', wool: 'on open grassland',
  stone: 'on a glowing rock outcrop by the mountains', coal: 'on a glowing coal seam by the mountains',
  iron: 'on a glowing iron deposit', oil: 'on a glowing oil seep',
  gold: 'on a glowing gold seam', gems: 'on a glowing gem vein', cocoa: 'on a wild cocoa grove', rubber: 'on a wild rubber grove',
};

/** Turn a candidate into a mission: title, how-to, Mira's line and the reward. */
export function make(g: Game, c: Cand, n: number, side: boolean): Mission {
  const L = g.s.rlv ?? 0, line = (k: string) => pick(g, MIRA[k]!, n * 7 + 3);
  const m: Mission = { ...c, side: side || undefined, title: '', how: '', mira: '', reward: r100(400 * Math.max(1, L) * (side ? 0.5 : 1) + 200) };
  if (c.ty === 'build') {
    const k = c.k!, name = INDUSTRIES[k].name;
    m.base = (g.s.buildings ?? []).filter(b => b.kind === k).length;
    m.title = `Build ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${INDUSTRIES[k].icon} ${name}`;
    m.how = k === 'dock' ? '🏗 Build → ⚓ Dock: its pier over the water, its yard beside your track'
      : isFactory(k) ? `🏗 Build → ${name}: beside your track, near where its ${inputsOf(k).map(lc).join(' and ')} comes from`
      : `🏗 Build → ${name}, ${WHERE[k] ?? 'beside your track'}`;
    m.mira = fill(line('build'), { why: c.why ?? '', n: name });
  } else if (c.ty === 'link' || c.ty === 'find') {
    const t = g.s.sites.find(s => s.id === c.site)!, a = ashford(g);
    if (c.ty === 'link') {
      m.title = `Link ${t.name} to your railway`;
      m.how = `🏗 Build → 🛤 Build rails: paint track from your line into ${t.name}’s station${(t.pop ?? 0) <= 0 ? ' (it is in ruins: linking brings people back)' : ''}`;
      m.mira = fill(line('link'), { town: t.name ?? 'the town' });
    } else {
      const dir = compass(t.x - a.x, t.y - a.y);
      m.title = `Find the town ${dir} of Ashford`;
      m.how = `🔭 Scout: tap a town on your railway, then draw the scout’s route ${dir} into the fog. Track you lay uncovers the land too.`;
      m.mira = fill(line('find'), { dir, from: 'Ashford' });
    }
  } else if (c.ty === 'reach') {
    const j = c.isl!, name = islandName(g, j), rum = rumourOf(g, j);
    m.title = `Reach ${name}`;
    m.how = `${c.why ? c.why + ' ' : ''}Build a ⚓ Dock on its shore within sea reach of your dock: ships carry goods across.`;
    m.mira = fill(line('reach'), { isl: name, rum });
  } else if (c.ty === 'order') {
    const t = g.s.sites.find(s => s.id === c.site)!, L0 = stepOf(t), gs = missing(g, t), tier = sizeName(L0 + 1);
    m.base = L0;
    m.title = t === ashford(g) ? `Grow Ashford into a ${tier}` : `Help ${t.name} become a ${tier}`;
    m.how = `It still needs ${gs.map(k => GOODS[k].icon + ' ' + lc(k)).join(', ')}. Tap it to see where each comes from, then tap ⬆ Grow.`;
    m.mira = fill(line('order'), { town: t.name ?? 'The town', goods: gs.slice(0, 2).map(lc).join(' and '), tier: tier.toLowerCase() });
  } else if (c.ty === 'fish') {
    m.title = 'Buy 🎣 fishing boats at the dock';
    m.how = 'Open the dock → 🎣 Fishing: towns by the sea buy fish.';
    m.mira = line('fish');
  }
  return m;
}

/** Progress as done/of (done ≥ of = finished), or null when the mission no longer makes sense. */
export function progress(g: Game, m: Mission): { v: number; of: number; got?: number; need?: number } | null {
  const site = m.site !== undefined ? g.s.sites.find(s => s.id === m.site) : undefined;
  switch (m.ty) {
    case 'build': return { v: (g.s.buildings ?? []).filter(b => b.kind === m.k).length > (m.base ?? 0) ? 1 : 0, of: 1 };
    case 'link': return site ? { v: townLinked(g, site) ? 1 : 0, of: 1 } : null;
    case 'find': return site ? { v: isRevealed(g, site.y * g.world.n + site.x) ? 1 : 0, of: 1 } : null;
    case 'reach': return { v: reachedIslands(g).has(m.isl!) ? 1 : 0, of: 1 };
    case 'fish': { const b = g.s.buildings?.find(x => x.id === m.bld); return b ? { v: (b.fish ?? 0) > 0 ? 1 : 0, of: 1 } : null; }
    case 'order': {
      if (!site) return null;
      if (stepOf(site) > (m.base ?? 0)) return { v: 1, of: 1 };
      const p = orderProgress(g, site); return { v: p.n ? Math.min(0.99, p.v / p.n) : 0, of: 1, got: p.v, need: p.n };
    }
  }
}

/** Pick the next mission: top-priority candidates weigh most; the main mission avoids the same kind twice in a row. */
function choose(g: Game, side: boolean): Mission | null {
  const M = msOf(g), used = new Set([M.main?.id, ...M.side.map(x => x.id), ...(M.skip ?? []), ...M.done.slice(-6).map(d => d.id)]);
  let C = candidates(g).filter(c => !used.has(c.id));
  if (side) C = C.filter(c => c.pr <= 2);
  if (!C.length) return null;
  const top = Math.max(...C.map(c => c.pr));
  // early on the main mission is always the most useful step; later it varies a little
  let P = C.filter(c => c.pr >= top - (side ? 2 : M.done.length >= 3 ? 1 : 0));
  if (!side && M.lastTy) { const Q = P.filter(c => c.ty !== M.lastTy || c.pr === top); if (Q.length) P = Q; }
  // variety: not two missions of the same kind at once when something else is worth doing
  { const on = new Set([M.main, ...M.side].filter(Boolean).map(m => m!.ty)), Q = P.filter(c => !on.has(c.ty)); if (Q.length) P = Q; }
  const n = ++M.n, W = P.map(c => (c.pr === top ? 3 : 1) * (1 + 0.5 * rnd(g, n * 31 + c.id.length)));
  let r = rnd(g, n * 13 + 5) * W.reduce((s, w) => s + w, 0), got = P[0]!;
  for (let i = 0; i < P.length; i++) { r -= W[i]!; if (r <= 0) { got = P[i]!; break; } }
  return make(g, got, n, side);
}

const news = (g: Game, s: string) => (g.news ??= []).push(s);

/** Check missions (once a second): pay finished ones, drop ones that no longer make sense, pick new ones; start a new act on a new Railway level. */
export function tickMissions(g: Game) {
  const M = msOf(g), act = actOf(g);
  if (M.act !== act) { M.act = act; M.actLine = pick(g, ACTS[act - 1]!.intro, act * 5 + 1); M.actNew = true; }
  if (lessonOn(g)) { tickLessons(g); return; } // missions start after the lessons
  const finish = (m: Mission, main: boolean): boolean => {
    const p = progress(g, m); if (!p) return true;
    if (p.v < p.of) return false;
    g.s.money += m.reward; g.s.earned = (g.s.earned ?? 0) + m.reward;
    M.done.push({ id: m.id, title: m.title, min: Math.round(g.s.t / 60), reward: m.reward }); if (M.done.length > 30) M.done.shift();
    if (main) M.lastTy = m.ty;
    news(g, `✅ Mission done: ${m.title} · +$${m.reward.toLocaleString('en-US')}`);
    return true;
  };
  if (M.main && finish(M.main, true)) M.main = null;
  M.side = M.side.filter(m => !finish(m, false));
  if (!M.main) M.main = choose(g, false);
  if (M.side.length < SIDE_COUNT && Math.floor(g.s.t) % 4 === 0) while (M.side.length < SIDE_COUNT) { const s = choose(g, true); if (!s) break; M.side.push(s); }
}

/** Swap a mission for another one (costs a quarter of its reward). */
export function swapMission(g: Game, which: number): string {
  const M = msOf(g), m = which === 0 ? M.main : M.side[which - 1];
  if (!m) return 'No mission there';
  const cost = r100(m.reward * SWAP_SHARE);
  if (g.s.money < cost) return `Need $${(cost - Math.floor(g.s.money)).toLocaleString('en-US')} more to swap it`;
  const next = choose(g, which !== 0);
  if (!next) return 'Nothing else to do right now: this is the best next step';
  g.s.money -= cost; M.skip = [...(M.skip ?? []), m.id].slice(-6);
  if (which === 0) M.main = next; else M.side[which - 1] = next;
  return '';
}

export const missionsOf = (g: Game) => { const M = msOf(g); return [M.main, ...M.side].filter((m): m is Mission => !!m); };

/** ⭐ The build to suggest at the top of the Build menu: a build mission first, else the best build idea. */
export function recommendedBuild(g: Game): { k: IndustryKind; why: string; mission: boolean } | null {
  const m = missionsOf(g).find(x => x.ty === 'build' && x.k);
  if (m && !lockedText(g, m.k!)) return { k: m.k!, why: m.why || m.how, mission: true };
  const c = candidates(g).filter(x => x.ty === 'build' && x.k && !lockedText(g, x.k)).sort((a, b) => b.pr - a.pr)[0];
  return c ? { k: c.k!, why: c.why ?? '', mission: false } : null;
}
