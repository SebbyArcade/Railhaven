import type { Game, Site } from '../state.ts';
import { BUY_SUP, buyPrice, choices, ISLE_SUP, nextIsle, PER_SUP, sailStep, SUP, supCap, supFull, fr, PERKS, type Piece, spikeGap, wishOf } from './frontier.ts';
/** below this many supplies the 🪓 backup purchase shows */
const LOW_SUP = 10;
import { townLinked } from '../economy/towns.ts';
import { isRevealed } from '../world/fog.ts';
import { isLinked } from '../buildings/industries.ts';
import { islandOfB, linkedDocks } from '../ships/docks.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const bar = (f: number, col: string) => `<div class="bar"><i style="width:${Math.round(Math.min(1, Math.max(0, f)) * 100)}%;background:${col}"></i></div>`;
const town = (g: Game, id: number) => g.s.sites.find(s => s.id === id);
const look = (x: number, y: number, label = '📍 Show') => `<button class="mini" data-act="lookxy" data-x="${x}" data-y="${y}">${label}</button>`;

/** The goal pill under the top bar: supplies and how far the golden spike is. */
export function frPill(g: Game): string {
  const f = fr(g)!;
  if (f.done !== undefined) return `<span class="mtext">🏁 Golden spike driven! ${nextIsle(g) !== undefined ? '<b>Tap to sail on ⛵</b>' : '<b>Tap for your railway</b>'}</span>`;
  const pick = f.picks.length ? ` · ✨ <b>Pick a building</b>` : '';
  const step = firstStep(g);
  if (step && !pick) return `<span class="mtext">🛤 <b>${f.sup}</b> · 👉 ${step}</span>`;
  return `<span class="mtext">🛤 <b>${f.sup}</b> supplies · 🏁 ${spikeGap(g)} squares to the ${isleName(g)} spike${pick}</span>`;
}

/** The island the current spike stands on. */
export const isleName = (g: Game) => { const f = fr(g)!; return f.isle === undefined ? 'Ashford Isle' : g.world.islands[f.isle]?.name ?? 'island'; };
/** Docks joined to the railway: the islands they stand on, and whether one is on Ashford Isle. */
function dockIsles(g: Game) {
  return new Set(linkedDocks(g).map(b => islandOfB(g, b)));
}

/**
 * 🧑‍🏫 The frontier guide (the lessons are off here): one step at a time, each with what to do, why it matters and a
 * tip for reading the land. It never says where: finding the spot is the player's part (Sébastien, 2026-11-24: "too
 * easy to know where to build", and "the game needs to teach the player better what to do").
 */
export interface Coach { k: string; icon: string; short: string; title: string; what: string; why: string; tip: string }
export function coach(g: Game): Coach | undefined {
  const f = fr(g)!, bs = g.s.buildings ?? [], raw = (b: { kind: string }) => b.kind === 'wood' || b.kind === 'stone';
  if (!bs.some(raw)) return { k: 'camp', icon: '🪵', short: 'Build a 🪵 Lumber Camp by a forest', title: 'Start a supply line',
    what: 'Open 🏗 Build and choose 🪵 Lumber Camp, then tap a spot for it.',
    why: 'Track costs 🛤 supplies, and supplies are made from wood and stone. No camp, no new track.',
    tip: 'A camp makes more the more trees stand round it: look for thick dark-green woods. The card shows how much it would make before you pay.' };
  if (!bs.some(b => raw(b) && isLinked(g, b))) return { k: 'rail', icon: '🛤', short: 'Rail your camp to your track', title: 'Join the camp to your railway',
    what: 'Open 🛤 Rails and drag from your track to one of the camp\'s gold end squares, then ✓ Build.',
    why: 'Trains only reach buildings joined to the railway. Each square costs 1 🛤 supply (hills 2), and you start with a few.',
    tip: 'Short and straight is cheapest. Rails can\'t cross mountains (yet) or run along a station\'s side.' };
  if (!g.s.trains.length) return { k: 'train', icon: '🚂', short: 'Buy a 🚂 Train', title: 'Buy your first train',
    what: 'Tap 🚂 Train and buy one.',
    why: 'Trains run themselves: each one takes goods from a building to the nearest place that needs them. Wood and stone go to Ashford and become supplies.',
    tip: 'One train per camp is plenty to start. More trains cost a little each minute while they run.' };
  if (!f.earned) return { k: 'haul', icon: '📦', short: `Wait for wood at Ashford: ${PER_SUP} 🪵 = 1 🛤`, title: 'Your first haul',
    what: 'Watch your train load at the camp and bring the wood to Ashford.',
    why: `Every ${PER_SUP} wood or stone that reaches Ashford makes 1 🛤 supply, shown top left.`,
    tip: 'While you wait, look at the land: where are the towns? Where are the hills and the sea?' };
  const towns = g.s.sites.filter(s => s.kind === 'town' && s !== g.s.sites[0] && townLinked(g, s));
  if (!towns.length) return { k: 'link', icon: '🏘', short: 'Link a town to your railway', title: 'Reach your first town',
    what: 'Lay track from your line into a town you can see. A station appears where the line runs through or ends beside it.',
    why: 'Linked towns make ✨ wishes. Grant one (link it to its neighbour) and you pick a new building for the town.',
    tip: 'Track uncovers the land round it, so pushing out also finds towns hidden in the fog.' };
  if (!g.s.orders) return { k: 'order', icon: '📋', short: 'Fill a town\'s order', title: 'Feed a town',
    what: 'Tap a town to see what it wants (its order), build what makes it, and join that to your railway.',
    why: 'Filled orders pay money and raise your Railway level. A town with a full order can grow: that\'s another ✨ pick.',
    tip: 'Farms need open grass, quarries sit at the foot of mountains, camps by forests.' };
  if (g.s.sites.some(s => s.kind === 'town' && s.filled) && f.granted < 3) return { k: 'grow', icon: '⬆', short: 'Tap ⬆ on a town to grow it', title: 'Grow a town',
    what: 'A town whose order is full shows ⬆. Tap the town and Upgrade it.',
    why: 'Growing a town grants a wish: pick one of its buildings. Some make track cheaper, some let you tunnel or bridge.',
    tip: 'Each pick is a surprise: you never know which three buildings will be offered.' };
  const sail = sailStep(g, dockIsles(g));
  if (sail) return { k: 'sail' + (f.stage ?? 0) + (sail.startsWith('Land') ? 'b' : 'a'), icon: '⚓', short: sail, title: sail.startsWith('Land') ? 'Land on the new island' : 'Build a dock',
    what: sail.startsWith('Land') ? `Open 🏗 Build, choose ⚓ Dock, and place it on the shore of ${isleName(g)}.` : `Open 🏗 Build, choose ⚓ Dock, and place it on a shore facing ${isleName(g)}. Then rail it to your track.`,
    why: 'Bridges can\'t join two islands. Docks can: a dock joined to your railway lets you land another one across the sea, and your track there starts from it.',
    tip: 'A dock\'s pier stands over the water and its loading track on land. The nearer the shores, the easier the crossing.' };
  return;
}
/** The short step for the goal pill and card. */
export const firstStep = (g: Game) => coach(g)?.short ?? '';
/** The guide card to open by itself: when the step changes (once per step). */
export function coachNext(g: Game): string | undefined {
  const f = fr(g); if (!f || !f.intro) return;
  const c = coach(g); if (!c || f.coach === c.k) return;
  f.coach = c.k; return 'coach';
}

/** Start distance to the spike, for the progress bar. */
const startGap = new WeakMap<object, number>();

/** The 🧭 Frontier card (the story card in this mode). */
export function frStoryHtml(g: Game, page?: string): string {
  const f = fr(g)!, n = g.world.n, sx = f.spike % n, sy = (f.spike / n) | 0;
  if (page === 'intro') {
    return `<div class="actcard"><div class="aic">🧭</div><small class="cap">FRONTIER VILLAGE · PREVIEW</small><h2>Drive the golden spike</h2>`
      + `<p>Get your track to the 🏁 <b>golden spike</b> on the far coast.</p></div>`
      + `<div class="row"><b class="ico">🛤</b><div class="grow"><b>Track costs supplies, not money</b><small>You have ${f.sup}. Trains bring 🪵 wood and 🪨 stone to Ashford: every ${PER_SUP} make 1 supply, and 1 supply lays 1 square.</small></div></div>`
      + `<div class="row"><b class="ico">✨</b><div class="grow"><b>Towns make wishes</b><small>Grant one and pick 1 of 3 buildings for that town.</small></div></div>`
      + `<div class="row"><b class="ico">⛰</b><div class="grow"><b>The land fights back</b><small>${f.pieces.length === 2 ? 'A ridge and a sea inlet stand' : f.pieces.length ? `A ${f.pieces[0]!.kind === 'ridge' ? 'ridge' : 'sea inlet'} stands` : 'Hills and water stand'} in the way. Go round, or grow a town that gets you through.</small></div></div>`
      + `<div class="pair"><button class="act alt" data-act="frshow">🏁 Show me the spike</button><button class="act" data-act="close">🚂 Let's go</button></div>`;
  }
  if (page === 'pick') {
    const t = town(g, f.picks[0] ?? -1); if (!t) return '';
    let h = `<div class="actcard"><div class="aic">✨</div><small class="cap">WISH GRANTED</small><h2>${esc(t.name ?? 'Town')} grows</h2><p>Pick a new building for ${esc(t.name ?? 'the town')}. It stays for good.</p></div>`;
    for (const k of choices(g, t)) {
      const P = PERKS[k];
      h += `<button class="tile pick" data-act="frpick" data-town="${t.id}" data-k="${k}"><b>${P.icon} ${P.name}</b><small>${esc(P.text)}</small></button>`;
    }
    return h + (f.picks.length > 1 ? `<div class="note">✨ ${f.picks.length - 1} more wish${f.picks.length > 2 ? 'es' : ''} waiting after this one</div>` : '');
  }
  if (page?.startsWith('piece')) {
    const p = f.pieces[+page.slice(5)]; if (!p) return '';
    return pieceCard(p) + `<button class="act" data-act="close">👍 Got it</button>`;
  }
  if (page === 'spike') {
    const nx = nextIsle(g), mins = Math.round(((f.done ?? g.s.t) - (f.t0 ?? 0)) / 60), towns = g.s.sites.filter(s => s.kind === 'town' && townLinked(g, s)).length;
    return `<div class="actcard"><div class="aic">🏁</div><small class="cap">THE GOLDEN SPIKE</small><h2>Coast to coast!</h2><p>The last spike is driven on the far shore. The whole island turned out to watch.</p></div>`
      + `<div class="chips"><span class="chip2 ok">⏱ ${mins} min</span><span class="chip2 ok">🛤 ${f.laid} squares laid</span><span class="chip2 ok">🏘 ${towns} towns linked</span><span class="chip2 ok">✨ ${f.granted} wishes granted</span><span class="chip2 ok">🏗 ${f.perks.length} buildings</span></div>`
      + (nx !== undefined
        ? `<div class="row main"><b class="ico">⛵</b><div class="grow"><b>Next: ${esc(g.world.islands[nx]?.name ?? 'a new island')}</b><small>A new golden spike lights up across the sea. You get <b>2 free ⚓ Docks</b> (one on your coast, one to land there) and 🛤 ${ISLE_SUP} supplies.</small></div></div>`
          + `<button class="act" data-act="frsail">⛵ Sail on</button><button class="act alt" data-act="close">Stay a while</button>`
        : `<div class="note">That's every island in this preview. Keep playing if you like: your towns keep growing.</div><button class="act" data-act="close">🎉 Wonderful</button>`);
  }
  if (page === 'coach') {
    const c = coach(g); if (!c) return `<div class="note">Nothing to do right now: head for the 🏁 golden spike.</div><button class="act" data-act="close">👍 Got it</button>`;
    return `<div class="actcard"><div class="aic">${c.icon}</div><small class="cap">YOUR NEXT STEP</small><h2>${c.title}</h2></div>`
      + `<div class="row main"><b class="ico">👉</b><div class="grow"><b>What to do</b><small>${c.what}</small></div></div>`
      + `<div class="row"><b class="ico">💡</b><div class="grow"><b>Why</b><small>${c.why}</small></div></div>`
      + `<div class="row"><b class="ico">🔎</b><div class="grow"><b>Tip</b><small>${c.tip}</small></div></div>`
      + `<button class="act" data-act="close">👍 Got it</button>`;
  }
  if (page === 'isle') {
    return `<div class="actcard"><div class="aic">⛵</div><small class="cap">A NEW FRONTIER · ISLAND ${(f.stage ?? 0) + 1}</small><h2>${esc(isleName(g))}</h2><p>Its golden spike glows on the far side. Get your railway across the sea and out to it.</p></div>`
      + `<div class="row"><b class="ico">⚓</b><div class="grow"><b>1. Build a Dock on your coast</b><small>Free. On ${esc(f.isles?.length && f.isles.at(-1) !== g.world.home ? g.world.islands[f.isles.at(-1)!]?.name ?? 'your island' : 'Ashford Isle')}, facing ${esc(isleName(g))}, joined to your railway.</small></div></div>`
      + `<div class="row"><b class="ico">⚓</b><div class="grow"><b>2. Land a Dock on ${esc(isleName(g))}</b><small>Free too. Your track there starts from it.</small></div></div>`
      + `<div class="row"><b class="ico">🛤</b><div class="grow"><b>3. Rail to the spike</b><small>Supplies still come from wood and stone at Ashford (or any 🏗 Supply Depot). Towns there make new wishes.</small></div></div>`
      + `<div class="pair"><button class="act alt" data-act="frshow">🏁 Show me</button><button class="act" data-act="close">🚂 Let's go</button></div>`;
  }
  // the main card
  const gap = spikeGap(g); if (!startGap.has(f)) startGap.set(f, Math.max(gap, 1));
  const g0 = Math.max(startGap.get(f)!, gap);
  const step = firstStep(g);
  let h = `<div class="head"><b class="big">🧭</b><div><h2>Frontier Village</h2><span class="chip2">🛤 ${f.sup} supplies</span> <span class="chip2">✨ ${f.granted} wishes</span> <span class="chip2">🏗 ${f.perks.length} buildings</span></div></div>`;
  if (step) h += `<button class="act alt" data-act="page" data-page="coach">👉 Next: ${step} ›</button>`;
  if (f.picks.length) h += `<button class="act alt" data-act="page" data-page="pick">✨ Pick a building for ${esc(town(g, f.picks[0]!)?.name ?? 'a town')} ›</button>`;
  h += `<div class="row main"><b class="ico">🏁</b><div class="grow"><div class="line"><span>Golden spike</span><span>${f.done !== undefined ? '✅ Driven' : `${gap} squares to go`}</span></div>${bar(f.done !== undefined ? 1 : 1 - gap / g0, '#ffd27a')}<small>On the far coast. Your track must reach within ${2} squares of it.</small>${look(sx, sy)}</div></div>`;
  h += `<div class="row"><b class="ico">🛤</b><div class="grow"><div class="line"><span>Track supplies</span><span><b>${f.sup}</b> / ${supCap(g)}</span></div><small>Rails are built with supplies, not money: ${SUP.flat} a square, ${SUP.hills} on hills, ${SUP.bridge[1]}-${SUP.bridge[3]} a bridge square, ${SUP.tunnel} a tunnel.</small></div></div>`;
  h += `<div class="row"><b class="ico">🪵</b><div class="grow"><b>Earn supplies by hauling</b><div class="chips"><span class="chip2">🪵 Lumber Camp or 🪨 Quarry</span> → <span class="chip2">🚂 train</span> → <span class="chip2">🏛 Ashford</span> → <span class="chip2">🛤 ${f.earned ?? 0} earned</span></div><small>Trains bring 🪵 wood and 🪨 stone to a 🏗 depot (Ashford first): every ${PER_SUP} 🪵 or 🪨 make 1 supply. ${supFull(g) ? '<b>The pile is full</b>: lay track, or pick a 🏗 Supply Depot for more room.' : ''}</small></div></div>`;
  // the 🪓 backup purchase shows only when supplies run low, so it never reads as the way to get them
  if (f.sup < LOW_SUP) h += `<div class="row"><b class="ico">🪓</b><div class="grow"><b>Running low?</b><small>A backup so you're never stuck: Ashford's crew sells a few.</small><div class="btns"><button class="mini buy" data-act="frbuy" ${g.s.money >= buyPrice(g) ? '' : 'disabled'}>🪓 Buy ${BUY_SUP.n} for $${buyPrice(g).toLocaleString('en-US')}</button></div></div></div>`;
  const wishes = f.wishes.map(w => ({ w, t: town(g, w.town), to: w.to !== undefined ? town(g, w.to) : undefined })).filter(x => x.t && x.to);
  h += `<h3>✨ Wishes</h3>`;
  if (!wishes.length) h += `<div class="note">Link a town to your railway and it makes a wish. Growing a town (fill its order, then ⬆ Upgrade) grants one too.</div>`;
  for (const { t, to } of wishes) {
    const seen = isRevealed(g, to!.y * n + to!.x);
    h += `<div class="row"><b class="ico">🤝</b><div class="grow"><div class="line"><span>${esc(t!.name ?? '')} wants a line to ${seen ? esc(to!.name ?? '') : 'a town in the fog'}</span></div><small>${seen ? 'Link both and pick a building for ' + esc(t!.name ?? '') : 'Somewhere ' + dir(to!.x - t!.x, to!.y - t!.y) + ' of it, past the fog'}</small>${seen ? look(to!.x, to!.y) : ''}</div></div>`;
  }
  const seenPieces = f.pieces.filter((_, k) => f.seen.includes(k));
  if (seenPieces.length) {
    h += `<h3>⛰ On the way</h3>`;
    for (const p of seenPieces) h += `<div class="row"><b class="ico">${p.kind === 'ridge' ? '⛰' : '🌊'}</b><div class="grow"><div class="line"><span>${esc(p.name)}</span></div><small>${p.kind === 'ridge' ? 'Go round by the pass, or pick the ⛰ Tunnel Guild in a town' : 'Bridge it (pick 🌉 Bridge Works to halve the cost), or go round its head'}</small>${look(p.x, p.y)}</div></div>`;
  }
  if (f.perks.length) {
    h += `<h3>🏗 Your buildings</h3><div class="chips">`;
    for (const p of f.perks) h += `<span class="chip2">${PERKS[p.k].icon} ${PERKS[p.k].name} · ${esc(town(g, p.town)?.name ?? '')}</span>`;
    h += `</div>`;
  }
  return h;
}

function pieceCard(p: Piece): string {
  if (p.kind === 'ridge') return `<div class="actcard"><div class="aic">⛰</div><small class="cap">AHEAD</small><h2>${esc(p.name)}</h2><p>A wall of mountains runs right across the island. There is one way through: a narrow pass near one end.</p></div>`
    + `<div class="row"><b class="ico">🥾</b><div class="grow"><b>Go round by the pass</b><small>Longer, but plain track.</small>${p.px !== undefined ? look(p.px, p.py!, '📍 Show the pass') : ''}</div></div>`
    + `<div class="row"><b class="ico">⛰</b><div class="grow"><b>Tunnel straight through</b><small>Grant a town's wish and pick the ⛰ Tunnel Guild. Tunnels cost ${SUP.tunnel} supplies a square.</small></div></div>`;
  return `<div class="actcard"><div class="aic">🌊</div><small class="cap">AHEAD</small><h2>${esc(p.name)}</h2><p>The sea cuts deep into the land here. Your line can bridge it or run round its head.</p></div>`
    + `<div class="row"><b class="ico">🌉</b><div class="grow"><b>Bridge it</b><small>Short and costly: ${SUP.bridge[1]} supplies a square near the shore. 🌉 Bridge Works halves that.</small></div></div>`
    + `<div class="row"><b class="ico">🛤</b><div class="grow"><b>Go round its head</b><small>Plain track, but a long way.</small>${look(p.x, p.y, '📍 Show the inlet')}</div></div>`;
}

function dir(dx: number, dy: number): string {
  const a = Math.atan2(dy, dx) * 180 / Math.PI, k = Math.round(((a + 360) % 360) / 45) % 8;
  return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][k]!;
}

/** On a town's card: its wish and its buildings. */
export function frTownHtml(g: Game, t: Site): string {
  const f = fr(g); if (!f) return '';
  const w = wishOf(g, t), to = w?.to !== undefined ? town(g, w.to) : undefined, mine = f.perks.filter(p => p.town === t.id);
  let h = '';
  if (to) h += `<div class="note">✨ Wish: a line to ${isRevealed(g, to.y * g.world.n + to.x) ? esc(to.name ?? '') : `a town ${dir(to.x - t.x, to.y - t.y)} of here, in the fog`}. Grant it and pick a new building</div>`;
  if (mine.length) h += `<div class="chips">${mine.map(p => `<span class="chip2 ok">${PERKS[p.k].icon} ${PERKS[p.k].name}</span>`).join('')}</div>`;
  if (t === g.s.sites[0] || mine.some(p => p.k === 'depot')) h += `<div class="chips"><span class="chip2">🏗 Supply depot: 🪵 wood and 🪨 stone here become 🛤 supplies</span></div>`;
  return h;
}
