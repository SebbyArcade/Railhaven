/** 🚉 City Lines cards: the goal pill, the Grand Line card, building picks and each city's travellers. */
import type { Game, Site } from '../state.ts';
import { fmtMoney } from '../ui/hud.ts';
import { sizeName, upgradePrice } from '../economy/towns.ts';
import { islandName } from '../ships/docks.ts';
import { BLDS, bldsOf, choices, cityLinked, cl, fare, goalNow, growNeed, growProgress, partners, steps, waiting, waitingAt } from './lines.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const bar = (f: number, col: string) => `<div class="bar"><i style="width:${Math.round(Math.min(1, Math.max(0, f)) * 100)}%;background:${col}"></i></div>`;
const town = (g: Game, id: number) => g.s.sites.find(s => s.id === id && s.kind === 'town');

/** The pill under the top bar: the step you are on, always in view. */
export function clPill(g: Game): string {
  const c = cl(g)!, { s, n, of } = goalNow(g);
  if (c.picks.length) return `<span class="mtext">✨ <b>${esc(town(g, c.picks[0]!)?.name ?? 'A city')} grew: pick a building</b></span><button data-clgo="pick">Pick ›</button>`;
  if (!s) return `<span class="mtext">🏁 <b>Grand Line complete!</b> Keep growing your cities</span>`;
  return `<span class="mtext">🏁 ${n}/${of} · ${esc(s.text)}</span><button data-clgo="goal">Go ›</button>`;
}

/** The Grand Line card (the story card in this mode). */
export function clStoryHtml(g: Game, page?: string): string {
  const c = cl(g)!, all = steps(g), { s } = goalNow(g);
  if (page === 'pick') {
    const t = town(g, c.picks[0] ?? -1); if (!t) return '';
    let h = `<div class="actcard"><div class="aic">✨</div><small class="cap">${esc(t.name ?? 'City')} · ${sizeName(t.lvl ?? 0).toUpperCase()}</small><h2>Pick a new building</h2><p>It stays in ${esc(t.name ?? 'the city')} for good. Each pick is a fresh shuffle.</p></div>`;
    for (const k of choices(g, t)) { const B = BLDS[k]; h += `<button class="tile pick" data-act="clpick" data-town="${t.id}" data-k="${k}"><b>${B.icon} ${B.name}</b><small>${esc(B.text)}</small></button>`; }
    return h + (c.picks.length > 1 ? `<div class="note">✨ ${c.picks.length - 1} more pick${c.picks.length > 2 ? 's' : ''} waiting after this one</div>` : '');
  }
  if (page === 'fin') {
    return `<div class="actcard"><div class="aic">🏁</div><small class="cap">THE GRAND LINE</small><h2>Kingsport is on the line!</h2><p>Ashford to Kingsport, ${c.isles.length} islands, by your own rails. ${c.carried.toLocaleString('en-US')} travellers carried so far.</p></div>`
      + `<div class="note">🚂 The game keeps going: grow your cities into Metropolises and keep picking buildings.</div><button class="act" data-act="close">🎉 Brilliant</button>`;
  }
  if (page === 'goal' && s) {
    return `<div class="actcard"><div class="aic">🏁</div><small class="cap">GRAND LINE · STEP ${c.step + 1} OF ${all.length}</small><h2>${esc(s.text)}</h2><p>${esc(s.how)}</p></div>`
      + `<div class="pair">${s.at ? `<button class="act alt" data-act="clshow">📍 Show me</button>` : ''}<button class="act" data-act="close">🚂 Let's go</button></div>`;
  }
  // the overview: every step of the Grand Line, and the islands on it
  let h = `<div class="head"><b class="big">🏁</b><div><h2>The Grand Line</h2><span class="chip2">${c.step} / ${all.length} steps</span> <span class="chip2">🧳 ${c.carried.toLocaleString('en-US')} carried</span></div></div>`;
  h += `<div class="note">Link Ashford to Kingsport, island by island, through each island's 👑 capital. Trains carry travellers between every pair of linked cities: fares are your money, visitors grow the cities.</div>`;
  all.forEach((st, i) => {
    const done = i < c.step, now = i === c.step;
    h += `<div class="row${done ? ' ok' : now ? ' main' : ''}"><b class="ico">${done ? '✅' : now ? '👉' : '⬜'}</b><div class="grow"><div class="line"><span>${esc(st.text)}</span></div>${now ? `<small>${esc(st.how)}</small>` : ''}</div>${now && st.at ? `<button class="mini" data-act="clshow">📍 Show</button>` : ''}</div>`;
  });
  h += `<h3>🏝 Islands on the line</h3><div class="chips">${c.isles.map((k, i) => { const t = town(g, c.caps[i]!); const ok = t && cityLinked(g, t); return `<span class="chip2">${ok ? '✅' : '❔'} ${esc(islandName(g, k))}${t ? ` · ${i === c.isles.length - 1 ? '🏁' : '👑'} ${esc(t.name ?? '')}` : ''}</span>`; }).join('')}</div>`;
  if (c.blds.length) h += `<h3>🏗 Your buildings</h3><div class="chips">${c.blds.map(b => `<span class="chip2">${BLDS[b.k].icon} ${esc(town(g, b.town)?.name ?? '')}</span>`).join('')}</div>`;
  return h;
}

/** A city's card in this mode: travellers waiting, visitors toward growing, its buildings. */
export function clTownHtml(g: Game, t: Site): string {
  const c = cl(g)!, L = t.lvl ?? 0, linked = cityLinked(g, t);
  let h = '';
  const k = c.caps.indexOf(t.id);
  if (k > 0) h += `<div class="gift">${k === c.caps.length - 1 ? '🏁 Kingsport, the end of the Grand Line' : `👑 Capital of ${esc(islandName(g, c.isles[k]!))}: a stop on the Grand Line`}</div>`;
  if (!linked) return h;
  const ps = partners(g, t).sort((a, b) => waiting(g, t, b.b) - waiting(g, t, a.b));
  h += `<h3>🧳 Travellers waiting here · ${waitingAt(g, t)}</h3>`;
  if (!ps.length) h += `<div class="note">🛤 Link another city by rail: then people here start travelling to it.</div>`;
  for (const { b, d } of ps.slice(0, 5)) {
    const w = waiting(g, t, b), each = fare(g, t, b, 1, d);
    h += `<div class="row"><b class="ico">🏙</b><div class="grow"><div class="line"><span>to ${esc(b.name ?? 'a city')}</span><span>${w} waiting</span></div><small>${d} squares · about ${fmtMoney(Math.max(1, Math.round(each)))} a traveller</small></div></div>`;
  }
  if (ps.length > 5) h += `<small class="why">and ${ps.length - 5} more cities</small>`;
  if (!g.s.trains.length) h += `<div class="warn">🚂 No train yet: tap 🚂 Trains and buy one. It picks up these travellers by itself.</div>`;
  const p = growProgress(g, t), need = growNeed(L);
  h += `<h3>🎟 Visitors to grow into a ${sizeName(L + 1)}</h3><div class="row"><b class="ico">👥</b><div class="grow"><div class="line"><span>Visitors</span><span>${Math.floor(Math.min(need, c.vis[t.id] ?? 0))} / ${need}</span></div>${bar(p, p >= 1 ? '#5cc46a' : '#6bb8e8')}<small>Every traveller who arrives counts; leaving counts a little too</small></div></div>`;
  if (p >= 1) {
    const pr = upgradePrice(L), can = pr <= g.s.money;
    h += `<button class="act" data-act="upgrade" data-id="${t.id}" ${can ? '' : 'disabled'}>⬆ Grow into a ${sizeName(L + 1)} · ${fmtMoney(pr)} · then pick a building</button>`;
    if (!can) h += `<small class="why">Need ${fmtMoney(pr - g.s.money)} more: fares keep coming in</small>`;
  }
  const bl = bldsOf(g, t);
  if (bl.length) h += `<h3>🏗 Buildings</h3>` + bl.map(k => `<div class="row"><b class="ico">${BLDS[k].icon}</b><div class="grow"><b>${BLDS[k].name}</b><small>${esc(BLDS[k].text)}</small></div></div>`).join('');
  return h;
}
