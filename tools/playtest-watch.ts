// Watches a bot game for problems once a game minute (PLAYTEST=1 in tools/bot.ts): money and order pace, idle and
// stuck trains, trains sharing track pieces, broken numbers in every card's text, Needs-you causes, ships.
import type { Game } from '../src/state.ts';
import { cardHtml, type Card } from '../src/ui/cards.ts';
import { stuckList, ordersHtml, bottlenecks } from '../src/ui/orders.ts';
import { gameReport } from '../src/ui/report.ts';
import { storyHtml } from '../src/ui/story.ts';
import { mapHtml, VIEWS } from '../src/ui/mapviews.ts';
import { townLinked, orderOf, stepOf } from '../src/economy/towns.ts';
import { isLinked, INDUSTRIES } from '../src/buildings/industries.ts';
import { jams } from '../src/economy/jams.ts';
import { reachedIslands } from '../src/progress/missions.ts';
import { islandOfTrain } from '../src/economy/dispatch.ts';

const series: string[] = [];
const issues = new Map<string, { n: number; first: number; ex: string }>();
const note = (g: Game, key: string, ex = '') => { const e = issues.get(key); if (e) e.n++; else issues.set(key, { n: 1, first: g.s.t / 60, ex }); };
const idleFor = new Map<number, number>(), stopFor = new Map<number, number>();
const stuckCount = new Map<string, number>();
let lastEarned = 0, lastOrders = 0;

const BAD = /undefined|NaN|\[object|Infinity|null\b|\$-|-\$|\b1 (trains|ships|towns|orders|squares|buildings)\b|\ba ([AEIOU]\w+)/;

function scanText(g: Game, where: string, html: string | null) {
  if (!html) return;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const m = BAD.exec(text); if (!m) return;
  const at = Math.max(0, m.index - 50);
  note(g, `text: "${m[0]}" in ${where}`, text.slice(at, m.index + 60));
}

export function monitor(g: Game) {
  const min = Math.round(g.s.t / 60);
  const earned = g.s.earned ?? 0, orders = g.s.orders ?? 0;
  if (!Number.isFinite(g.s.money)) note(g, 'money is not a number', String(g.s.money));
  if (g.s.money < 0) note(g, 'money below zero', String(Math.round(g.s.money)));
  // trains
  const piece = new Map<number, number>();
  let idle = 0, moving = 0;
  for (const t of g.s.trains) {
    if (!Number.isFinite(t.v) || !Number.isFinite(t.headS)) note(g, 'train speed/position not a number', `train ${t.id}`);
    for (const s of t.trail) {
      if (!g.net.pieces[s.piece]) { note(g, 'train on a piece that no longer exists', `train ${t.id}`); continue; }
      const o = piece.get(s.piece); if (o !== undefined && o !== t.id) note(g, 'two trains on the same rail piece', `trains ${o} and ${t.id} at square ${g.net.pieces[s.piece]!.squares[0]}`);
      piece.set(s.piece, t.id);
    }
    if (!t.job && !t.cargo) { idle++; idleFor.set(t.id, (idleFor.get(t.id) ?? 0) + 1); } else idleFor.set(t.id, 0);
    if (t.v < 0.01 && t.job && t.job.phase !== 'loading' && t.job.phase !== 'unloading') stopFor.set(t.id, (stopFor.get(t.id) ?? 0) + 1); else stopFor.set(t.id, 0);
    if (t.v > 0.01) moving++;
    if ((idleFor.get(t.id) ?? 0) === 20) note(g, 'train idle 20+ game minutes', `train ${t.id} on island ${islandOfTrain(g, t)}`);
    if ((stopFor.get(t.id) ?? 0) === 10) note(g, 'train with a job stopped 10+ minutes', `train ${t.id} ${JSON.stringify(t.job)} wait ${Math.round(t.wait)}`);
  }
  // buildings
  for (const b of g.s.buildings ?? []) {
    if (b.stock < 0 || !Number.isFinite(b.stock)) note(g, 'building stock negative or not a number', `${b.kind} ${b.id} ${b.stock}`);
    if (!isLinked(g, b)) note(g, 'building not joined to the railway', `${b.kind} ${b.id}`);
  }
  // Needs you
  let stuck: ReturnType<typeof stuckList> = [];
  try { stuck = stuckList(g); } catch (e) { note(g, 'stuckList threw', String(e)); }
  for (const s of stuck) { const k = s.icon; stuckCount.set(k, (stuckCount.get(k) ?? 0) + 1); }
  let jm = 0; try { jm = jams(g).length; } catch (e) { note(g, 'jams threw', String(e)); }
  const towns = g.s.sites.filter(t => t.kind === 'town' && townLinked(g, t));
  // card text, every 10 minutes (slow)
  if (min % 10 === 0) {
    const cards: Card[] = [{ kind: 'shed', id: 0 }, { kind: 'fleet', id: 0 }, { kind: 'story', id: 0 }, { kind: 'orders', id: 0 }, { kind: 'ships', id: 0 }];
    for (const p of ['trains', 'upgrades', 'fleet']) cards.push({ kind: 'shed', id: 0, page: p });
    for (const t of towns) for (const page of [undefined, 'parks', 'projects']) cards.push({ kind: 'town', id: t.id, page });
    for (const b of g.s.buildings ?? []) for (const page of [undefined, 'sea', 'fish', 'isl', 'exp', 'trains', 'pin']) cards.push({ kind: 'bld', id: b.id, page });
    for (const t of g.s.trains.slice(0, 40)) cards.push({ kind: 'train', id: t.id });
    for (const s of g.s.ships ?? []) cards.push({ kind: 'ship', id: s.id });
    for (const k of reachedIslands(g)) cards.push({ kind: 'isle', id: k });
    for (const c of cards) { try { scanText(g, `${c.kind}${'page' in c && c.page ? '/' + c.page : ''} card`, cardHtml(g, c)); } catch (e) { note(g, `card ${c.kind}${'page' in c && c.page ? '/' + c.page : ''} threw`, String((e as Error).stack?.split('\n').slice(0, 3).join(' | '))); } }
    for (const [w, f] of [['Orders board', () => ordersHtml(g)], ['Game report', () => gameReport(g)], ['Story', () => storyHtml(g)], ...VIEWS.map(v => [`map view ${v.k}`, () => mapHtml(g, v.k)] as const)] as const) {
      try { scanText(g, w, (f as () => string)()); } catch (e) { note(g, `${w} threw`, String(e)); }
    }
    for (const s of stuck) scanText(g, 'Needs you list', s.text);
    for (const m of g.news ?? []) scanText(g, 'news', m);
  }
  const bn = (() => { try { return bottlenecks(g).map(b => `${b.good}×${b.towns.length}`).join(','); } catch { return '?'; } })();
  series.push(`${String(min).padStart(3)}m $${Math.round(g.s.money)} +$${Math.round(earned - lastEarned)}/min orders ${orders}(+${orders - lastOrders}) lvl ${g.s.rlv ?? 0} isl ${reachedIslands(g).size} towns ${towns.length} trains ${g.s.trains.length} (idle ${idle}, moving ${moving}) ships ${g.s.ships?.length ?? 0} bld ${(g.s.buildings ?? []).length} needs ${stuck.length} [${stuck.map(s => s.icon).join('')}] jams ${jm} bottlenecks ${bn}`);
  lastEarned = earned; lastOrders = orders;
}

export function report(g: Game) {
  console.log('--- money/progress, every 15 min ---');
  for (let i = 14; i < series.length; i += 15) console.log(series[i]);
  console.log('--- issues ---');
  for (const [k, v] of [...issues].sort((a, b) => b[1].n - a[1].n)) console.log(`${v.n}× (first ${v.first.toFixed(0)}m) ${k} :: ${v.ex.slice(0, 200)}`);
  console.log('--- needs-you minutes by icon ---', JSON.stringify(Object.fromEntries(stuckCount)));
  console.log('--- towns ---');
  for (const t of g.s.sites) if (t.kind === 'town' && townLinked(g, t)) console.log(`  ${t.name} step ${stepOf(t)} order ${JSON.stringify(orderOf(g, t))} got ${JSON.stringify(t.got ?? {})}`);
  const kinds = new Map<string, number>(); for (const b of g.s.buildings ?? []) kinds.set(INDUSTRIES[b.kind].name, (kinds.get(INDUSTRIES[b.kind].name) ?? 0) + 1);
  console.log('--- buildings ---', JSON.stringify(Object.fromEntries(kinds)));
  console.log('--- parks/projects ---', JSON.stringify((g.s.parks ?? []).map(p => p.k)));
}
