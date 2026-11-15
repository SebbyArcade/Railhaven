import { RLV } from '../economy/dispatch.ts';
import type { Game } from '../state.ts';

export const fmtMoney = (n: number) => '$' + Math.floor(n).toLocaleString('en-US');

/** earned minus upkeep, sampled each second for a minute: income is the change (building and buying are not counted) */
const hist: number[] = [];
let histT = -1, lastGame: Game | null = null;

/** Top bar: money, income over the last minute, Railway level and orders filled. */
export function updateHud(el: HTMLElement, g: Game) {
  const sec = Math.floor(g.s.t);
  if (sec < histT || g !== lastGame) { hist.length = 0; histT = -1; lastGame = g; } // a new game or a loaded save
  if (sec !== histT) { histT = sec; hist.push((g.s.earned ?? 0) - (g.s.upkeep ?? 0)); if (hist.length > 61) hist.shift(); }
  const inc = hist.length > 5 ? (hist.at(-1)! - hist[0]!) * 60 / (hist.length - 1) : 0;
  const L = g.s.rlv ?? 0, o = g.s.orders ?? 0, next = RLV[L + 1];
  const html = `<span class="chip money">💰 ${fmtMoney(g.s.money)}</span><span class="chip ${inc < 0 ? 'neg' : 'pos'}">${inc < 0 ? '📉 −' : '📈 +'}${fmtMoney(Math.abs(inc))}/min</span><span class="chip">⭐ Level ${L} · 📋 ${o}${next ? '/' + next : ''}</span>`;
  if (el.innerHTML !== html) el.innerHTML = html;
}

let toastTimer = 0;
export function toast(text: string, ms = 2600) {
  const el = document.getElementById('toast')!;
  el.textContent = text; el.style.opacity = '1';
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => (el.style.opacity = '0'), ms);
}
