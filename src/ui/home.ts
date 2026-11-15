import { MAX_SLOTS, type SlotIndex, type SlotMeta, sortedSlots } from '../save/slots.ts';
import { fmtMoney } from './hud.ts';

/** The pages of the home screen (the rest of the 🗺 Game card's pages are in gamecard.ts, under ⚙ Settings). */
export const HOME_PAGES = ['', 'games', 'slot', 'new', 'learn', 'medals'];
export const isHomePage = (page: string | undefined) => HOME_PAGES.includes(page ?? '');

const esc = (t: string) => t.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
export function played(t: number) {
  const m = Math.floor(t / 60);
  return m < 1 ? 'just started' : m < 60 ? `${m} min played` : `${Math.floor(m / 60)} h ${m % 60} min played`;
}
export function lastPlayed(at: number, now = Date.now()) {
  const d = new Date(at), n = new Date(now), days = Math.round((new Date(n.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return days <= 0 ? `today ${time}` : days === 1 ? `yesterday ${time}` : days < 7 ? `${days} days ago` : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
const pic = (m: SlotMeta) => m.pic ? `<img class="spic" src="${m.pic}" alt="">` : `<b class="spic">🗺</b>`;
const chips = (m: SlotMeta) => `<span class="chip2">⭐ Railway level ${m.rlv}</span><span class="chip2">💰 ${fmtMoney(m.money)}</span><span class="chip2">🏘 ${m.towns} town${m.towns === 1 ? '' : 's'}</span><span class="chip2">📋 ${m.orders} order${m.orders === 1 ? '' : 's'}</span>`;

export function homeHtml(page: string | undefined, ix: SlotIndex, slotId = 0, delArmed = false): string {
  const back = (to = '') => `<button class="act back" data-act="page" data-page="${to}">‹ Back</button>`;
  const cur = ix.list.find(m => m.id === ix.active);
  if (page === 'games') {
    const list = sortedSlots(ix);
    return `<div class="head"><b class="big">🗂</b><div><h2>Your games</h2><span class="chip2">${list.length} of ${MAX_SLOTS} slots</span></div></div>`
      + list.map(m => `<button class="slot${m.id === ix.active ? ' on' : ''}" data-act="slotpage" data-id="${m.id}">${pic(m)}<span class="grow"><span class="sname">${esc(m.name)}</span>`
        + `<span class="chips">${chips(m)}</span><small>${m.id === ix.active ? '▶ Playing now · ' : ''}${played(m.t)} · ${lastPlayed(m.at)}</small></span></button>`).join('')
      + (list.length < MAX_SLOTS
        ? `<button class="slot new" data-act="page" data-page="new"><b class="spic">＋</b><span class="grow"><span class="sname">New game</span><small>a fresh map, random or from a number</small></span></button>`
        : `<div class="note">All ${MAX_SLOTS} slots are in use. Delete a game to start a new one.</div>`)
      + back();
  }
  if (page === 'slot') {
    const m = ix.list.find(x => x.id === slotId);
    if (!m) return homeHtml('games', ix);
    const on = m.id === ix.active;
    return `<div class="head">${pic(m)}<div><h2>${esc(m.name)}</h2><span class="chip2">${on ? '▶ playing now' : 'waiting'}</span></div></div>`
      + `<div class="chips">${chips(m)}</div><div class="note">⏱ ${played(m.t)} · last played ${lastPlayed(m.at)} · map number ${m.seed}</div>`
      + `<button class="act" data-act="play" data-id="${m.id}">▶ ${on ? 'Keep playing' : 'Play this game'}</button>`
      + `<h3>✏ Name</h3><div class="pair"><input id="slotName" maxlength="40" value="${esc(m.name)}"><button class="act alt" data-act="rename" data-id="${m.id}">Save name</button></div>`
      + `<div class="pair"><button class="act alt" data-act="copyslot" data-id="${m.id}"${ix.list.length >= MAX_SLOTS ? ' disabled' : ''}>📄 Copy it</button>`
      + `<button class="act ${delArmed ? 'sure' : 'warnb'}" data-act="delslot" data-id="${m.id}">${delArmed ? '⚠ Tap again to delete it' : '🗑 Delete'}</button></div>`
      + (ix.list.length >= MAX_SLOTS ? `<div class="note">A copy needs a free slot: all ${MAX_SLOTS} are in use.</div>` : '')
      + back('games');
  }
  if (page === 'new') {
    return `<div class="head"><b class="big">🗺</b><div><h2>New game</h2><span class="chip2">your other games stay saved</span></div></div>`
      + `<button class="act" data-act="newgame">🎲 Start on a random map</button>`
      + `<h3>🔢 Or play a map by its number</h3><div class="note">The same number always makes the same map, so you can share a map with a friend.</div>`
      + `<div class="pair"><input id="seedIn" inputmode="numeric" maxlength="7" placeholder="such as 142931"><button class="act alt" data-act="newgame" data-seed="1">Start</button></div>`
      + back('games');
  }
  if (page === 'learn') {
    const rows: [string, string, string][] = [
      ['🛤', 'Lay rails from Ashford', 'Build → Rails. Paint square by square; every new square joins your line.'],
      ['🌲', 'Build what towns want', 'Camps, farms and mines make goods. Put them beside your rails.'],
      ['🚂', 'Buy trains', 'Trains run themselves: each building ships to the nearest place that needs its goods.'],
      ['📋', 'Fill town orders', 'Every order filled pays and lets the town grow. Tap ⬆ over a town to grow it.'],
      ['⭐', 'Raise your Railway level', 'Orders filled raise it. It opens mills, docks and more.'],
      ['🔭', 'Explore', 'Scout the fog, find new towns, and cross the sea to new islands.'],
    ];
    return `<div class="head"><b class="big">📖</b><div><h2>How to play</h2><span class="chip2">you can never lose: keep growing</span></div></div>`
      + rows.map(([i, b, s]) => `<div class="row"><span class="ico">${i}</span><div class="grow"><b>${b}</b><small>${s}</small></div></div>`).join('')
      + `<div class="note">One finger moves the map, two fingers zoom. Tap anything to see what it needs.</div>` + back();
  }
  if (page === 'medals') {
    return `<div class="head"><b class="big">🏅</b><div><h2>Achievements</h2><span class="chip2">coming in the next update</span></div></div>`
      + `<div class="note">Medals for orders, towns, islands, factories and Railway levels. Each one earns XP, and XP unlocks train paints and building looks. Nothing changes how the game plays.</div>` + back();
  }
  // the home screen itself
  return `<div class="title"><b>🚂</b><h1>Railhaven</h1><span>rails across the islands</span></div>`
    + (cur ? `<button class="slot cont" data-act="close">${pic(cur)}<span class="grow"><span class="sname">▶ Continue</span><span class="sname2">${esc(cur.name)}</span><small>⭐ Railway level ${cur.rlv} · 💰 ${fmtMoney(cur.money)} · ${played(cur.t)}</small></span></button>`
      : `<button class="act" data-act="newgame">🗺 Start a new game</button>`)
    + `<div class="tiles"><button class="tile" data-act="page" data-page="games">🗂 Your games<small>${ix.list.length} of ${MAX_SLOTS} · switch or start a new one</small></button>`
    + `<button class="tile" data-act="page" data-page="medals">🏅 Achievements<small>coming next</small></button>`
    + `<button class="tile" data-act="page" data-page="settings">⚙ Settings<small>sound, Move my game, report</small></button>`
    + `<button class="tile" data-act="page" data-page="learn">📖 How to play<small>the basics in six steps</small></button></div>`;
}
