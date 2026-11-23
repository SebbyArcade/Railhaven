import type { Game } from '../state.ts';
import { ACTS, actOf, type Mission, msOf, progress, reachedIslands, SWAP_SHARE } from '../progress/missions.ts';
import { fmtMoney } from './hud.ts';
import { atlasHtml, prizesHtml } from './atlas.ts';
import { prizeAt, starCount } from '../progress/prizes.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const bar = (f: number, col: string) => `<div class="bar"><i style="width:${Math.round(Math.min(1, Math.max(0, f)) * 100)}%;background:${col}"></i></div>`;

/** Progress in a few words: "12 / 40" for orders, nothing for one-step missions. */
export function progressText(g: Game, m: Mission): { f: number; text: string } {
  const p = progress(g, m) ?? { v: 0, of: 1 };
  return { f: p.v / p.of, text: p.need ? `${p.got} / ${p.need}` : '' };
}

/** The mission pill under the top bar: the main mission and a Go button. */
export function missionPill(g: Game): string {
  const m = msOf(g).main; if (!m) return '';
  const p = progressText(g, m);
  return `<span class="mtext">${starCount(g) ? `<b style="color:#ffd24a">🌟${starCount(g)}</b> ` : ''}🎯 ${esc(m.title)}${p.text ? ` <b>${p.text}</b>` : ''}</span><button data-go="0">Go ›</button>`;
}

/** Story card: the act, the main mission in full, side missions, and tiles for the journal and the islands. */
export function storyHtml(g: Game, page?: string): string {
  const M = msOf(g), act = actOf(g), A = ACTS[act - 1]!, L = g.s.rlv ?? 0;
  const back = `<button class="act back" data-act="page" data-page="">‹ Back</button>`;
  if (page === 'act') {
    return `<div class="actcard"><div class="aic">${A.icon}</div><small class="cap">ACT ${act} · RAILWAY LEVEL ${L}</small><h2>${A.title}</h2><p><i>${esc(M.actLine ?? A.intro[0])}</i></p>`
      + `<small>Your next mission sits under the top bar. It follows your game: tap Go › and it shows you where.</small></div>`
      + `<button class="act" data-act="close">🚂 Let's go</button>`;
  }
  let h = `<div class="head"><b class="big">${A.icon}</b><div><h2>Act ${act} · ${A.title}</h2> <span class="chip2">⭐ Railway level ${L}</span> <span class="chip2">🌟 ${starCount(g)} island star${starCount(g) === 1 ? '' : 's'}</span> <span class="chip2">${M.done.length || !(g.s.orders ?? 0) ? `✅ ${M.done.length} mission${M.done.length === 1 ? '' : 's'} done` : `📋 ${g.s.orders} order${g.s.orders === 1 ? '' : 's'} filled`}</span></div></div>`;
  if (page === 'journal') {
    h += `<h3>📜 Journal</h3>`;
    for (const d of [...M.done].reverse().slice(0, 12)) h += `<div class="row"><b class="ico">✅</b><div class="grow"><div class="line"><span>${esc(d.title)}</span><span>+${fmtMoney(d.reward)}</span></div><small>minute ${d.min}</small></div></div>`;
    if (!M.done.length) h += `<div class="note">📜 Missions you finish are written here${(g.s.orders ?? 0) > 0 ? `. So far your railway has filled ${g.s.orders} town orders` : ""}</div>`;
    return h + back;
  }
  if (page === 'isl') return h + atlasHtml(g) + back;
  if (page === 'prizes') return h + prizesHtml(g) + back;
  h += `<div class="mira">${esc(M.actLine ?? A.intro[0])}</div>`;
  const m = M.main;
  if (m) {
    const p = progressText(g, m), cost = Math.round(m.reward * SWAP_SHARE / 100) * 100;
    h += `<div class="row main"><b class="ico">🎯</b><div class="grow"><div class="line"><span>${esc(m.title)}</span><span>+${fmtMoney(m.reward)}</span></div>${bar(p.f, '#e8a33c')}${p.text ? `<small>${p.text}</small>` : ''}<small>${esc(m.how)}</small><small class="say">${esc(m.mira)}</small></div></div>`;
    h += `<div class="pair"><button class="act" data-go="0">Go ›</button><button class="act alt" data-act="swap" data-m="0" ${g.s.money >= cost ? '' : 'disabled'}>↻ Another · ${fmtMoney(cost)}</button></div>`;
  } else h += `<div class="note">🎯 Mira is looking for your next mission…</div>`;
  if (M.side.length) {
    h += `<h3>✨ Side missions</h3>`;
    M.side.forEach((s, i) => { const p = progressText(g, s); h += `<div class="row side"><div class="grow"><div class="line"><span>${esc(s.title)}${p.text ? ` · ${p.text}` : ''}</span><span>+${fmtMoney(s.reward)}</span></div></div><button class="mini" data-go="${i + 1}">Go ›</button></div>`; });
  }
  h += `<div class="tiles"><button class="tile" data-act="page" data-page="journal">📜 Journal<small>${M.done.length || !(g.s.orders ?? 0) ? `${M.done.length} done` : `📋 ${g.s.orders} order${g.s.orders === 1 ? '' : 's'} filled`}</small></button><button class="tile" data-act="page" data-page="isl">🌟 Atlas<small>${starCount(g)} stars · ${reachedIslands(g).size} island${reachedIslands(g).size === 1 ? '' : 's'}</small></button><button class="tile" data-act="page" data-page="prizes">🎁 Prizes<small>${g.s.prize ?? 0} won · next at 🌟 ${prizeAt(g.s.prize ?? 0).at}</small></button><button class="tile" data-act="reports">🧭 Scout reports<small>${(g.s.reports ?? []).length || 'none yet'}</small></button></div>`;
  return h;
}
