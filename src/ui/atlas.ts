import type { Game } from '../state.ts';
import { atlasIslands, goalsOf, type Goal, prizeLine, type StarNews, starsOn } from '../progress/stars.ts';
import { bits, FREE, type FreeKind, prizeAt, ringStars, starCount } from '../progress/prizes.ts';
import { islandName } from '../ships/docks.ts';
import { islandKnown } from '../world/fog.ts';
import { reachedIslands } from '../progress/missions.ts';

/**
 * 🌟 The Atlas: every island's goals and stars, the prizes won and the next one, and the stars the next ring of
 * islands needs. Plus the card that comes up when a star is earned.
 */
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const bar = (f: number, col: string) => `<div class="bar"><i style="width:${Math.round(Math.min(1, Math.max(0, f)) * 100)}%;background:${col}"></i></div>`;
const starRow = (got: number, of: number) => `<span style="color:#ffd24a">${'★'.repeat(got)}</span><span style="opacity:.3">${'★'.repeat(Math.max(0, of - got))}</span>`;

/** The next prize: what it is and how many stars it needs. */
function nextPrize(g: Game): string {
  const i = g.s.prize ?? 0, p = prizeAt(i), st = starCount(g);
  return `<div class="row"><b class="ico">${p.icon}</b><div class="grow"><div class="line"><span>Next prize: ${esc(p.name)}</span><span>🌟 ${st} / ${p.at}</span></div>${bar(st / p.at, '#ffd24a')}<small>${esc(p.text)}</small></div></div>`;
}

/** Free builds waiting for a town, as chips. */
function freeChips(g: Game): string {
  const f = Object.entries(g.s.free ?? {}).filter(([, v]) => (v ?? 0) > 0) as [FreeKind, number][];
  if (!f.length) return '';
  return `<div class="gift">🎁 Ready to build: ${f.map(([k, v]) => `${FREE[k].icon} ${FREE[k].name.replace(/^Free /, '')}${v > 1 ? ` ×${v}` : ''}`).join(' · ')}. Open a town → 🏛 Town projects: it is free there.</div>`;
}

/** One goal as a row: done, or how far along with a bar. */
function goalRow(o: Goal): string {
  const f = o.of ? o.v / o.of : 0;
  return `<div class="row${o.earned ? ' ok' : ''}"><b class="ico">${o.earned ? '⭐' : o.icon}</b><div class="grow"><div class="line"><span>${esc(o.title)}</span><span>${o.earned ? '✅' : o.of > 1 ? `${o.v} / ${o.of}` : ''}</span></div>${o.earned ? '' : bar(f, '#ffd24a') + `<small>${esc(o.how)}</small>`}</div>${!o.earned && o.town !== undefined ? `<button class="mini" data-act="open" data-kind="town" data-id="${o.town}">Open ›</button>` : ''}</div>`;
}

/** 🌟 An island's goals (for its island card). */
export function islandGoalsHtml(g: Game, k: number): string {
  const gl = goalsOf(g, k); if (!gl.length) return '';
  return `<h3>🌟 Island goals · ${starRow(gl.filter(o => o.earned).length, gl.length)}</h3>` + gl.map(goalRow).join('');
}

/** The Atlas page: total stars, next prize, next ring, then every island with its stars and next goal. */
export function atlasHtml(g: Game): string {
  const st = starCount(g), need = ringStars(g), R = reachedIslands(g);
  let h = `<h3>🌟 Atlas · ${st} star${st === 1 ? '' : 's'}</h3>`;
  h += `<div class="note">Every island has goals. Each one you reach earns a ⭐ for good, and stars win prizes: named engines that help every train, free town projects, and buildings you can't buy.</div>`;
  h += nextPrize(g) + freeChips(g);
  h += `<div class="row"><b class="ico">🗺</b><div class="grow"><div class="line"><span>${st >= need ? 'The next ring of islands is charted' : 'Charts for the next ring of islands'}</span><span>🌟 ${st} / ${need}</span></div>${bar(st / need, '#6bb8e8')}<small>${st >= need ? 'A level 3 ⚓ Dock on your railway can send an expedition to new islands with new goods' : `At ${need} stars an expedition from a level 3 dock can sail to a new ring of islands`}</small></div></div>`;
  h += `<h3>🏝 Islands</h3>`;
  let hidden = 0;
  for (const k of atlasIslands(g)) {
    const gl = goalsOf(g, k), got = gl.filter(o => o.earned).length, nx = gl.find(o => !o.earned);
    const name = k === g.world.home ? 'Ashford Isle' : islandName(g, k);
    h += `<div class="row${got === gl.length ? ' ok' : ''}"><b class="ico">${k === g.world.home ? '🏰' : '🏝'}</b><div class="grow"><div class="line"><span>${esc(name)}</span><span>${starRow(got, gl.length)}</span></div><small>${nx ? `Next: ${esc(nx.title)}${nx.of > 1 ? ` (${nx.v} / ${nx.of})` : ''}` : '✅ Every goal done'}</small></div>${k !== g.world.home ? `<button class="mini" data-act="isle" data-id="${k}">Open ›</button>` : ''}</div>`;
  }
  g.world.islands.forEach((isl, k) => { if (isl.name && k !== g.world.home && !R.has(k) && !starsOn(g, k)) hidden++; });
  if (hidden) h += `<div class="note">⛵ ${hidden} more island${hidden === 1 ? '' : 's'} to reach, each with its own goals${g.world.islands.some((isl, k) => isl.name && !R.has(k) && islandKnown(g, k)) ? ': build a ⚓ Dock that reaches one' : ': scout by boat from a dock'}</div>`;
  return h;
}

/** 🎁 Prizes won, the engines first, then the rest of the list still to win. */
export function prizesHtml(g: Game): string {
  const won = g.s.prize ?? 0, st = starCount(g);
  let h = `<h3>🎁 Prizes · ${won} won</h3>` + freeChips(g);
  const eng: string[] = [], rest: string[] = [];
  for (let i = 0; i < won; i++) { const p = prizeAt(i); (p.kind === 'engine' ? eng : rest).push(`<div class="row ok"><b class="ico">${p.icon}</b><div class="grow"><div class="line"><span>${esc(p.name)}</span><span>🌟 ${p.at}</span></div><small>${esc(p.text)}</small></div></div>`); }
  if (eng.length) h += `<h3>🚂 Your engine roundhouse</h3>` + eng.join('');
  if (rest.length) h += `<h3>🏛 Buildings won</h3>` + rest.join('');
  h += `<h3>✨ Still to win</h3>`;
  for (let i = won; i < won + 4; i++) { const p = prizeAt(i); h += `<div class="row"><b class="ico">${p.icon}</b><div class="grow"><div class="line"><span>${esc(p.name)}</span><span>🌟 ${st} / ${p.at}</span></div><small>${esc(p.text)}</small></div></div>`; }
  return h;
}

/** The card for a star (or several) just earned. */
export function starCardHtml(g: Game, s: StarNews): string {
  const one = s.isl >= 0, name = one ? (s.isl === g.world.home ? 'Ashford Isle' : islandName(g, s.isl)) : '';
  let h = `<div class="find"><span class="rar" style="border-color:#ffd24a;color:#ffd24a">🌟 ${one ? 'STAR EARNED' : 'ISLAND STARS'}</span><b class="fbig">⭐</b>`;
  if (one) {
    const m = starsOn(g, s.isl), of = goalsOf(g, s.isl).length;
    h += `<h2>${esc(s.title)}</h2><small>${esc(name)} · ${starRow(bits(m), of)}</small></div>`;
  } else h += `<h2>Your railway has earned ${s.total} stars</h2><small>Every island now has goals: each one reached earns a star</small></div>`;
  if (s.prizes.length) {
    h += `<h3>🎁 ${s.prizes.length === 1 ? 'Prize won' : `${s.prizes.length} prizes won`}</h3>`;
    if (s.prizes.length <= 3) for (const i of s.prizes) h += `<div class="gift">${esc(prizeLine(i))}</div>`;
    else h += `<div class="chips">${s.prizes.map(i => { const p = prizeAt(i); return `<span class="chip2">${p.icon} ${esc(p.name)}</span>`; }).join(' ')}</div><small>What each one does is on the 🎁 Prizes page of the story card</small>`;
    if (s.prizes.some(i => prizeAt(i).kind === 'free')) h += `<div class="note">🏛 Free buildings wait on any town's 🏛 Town projects page: pick where they go</div>`;
  }
  h += nextPrize(g);
  h += `<div class="pair"><button class="act" data-act="atlas">🌟 Open the Atlas</button><button class="act alt" data-act="close">🚂 Carry on</button></div>`;
  return h;
}
