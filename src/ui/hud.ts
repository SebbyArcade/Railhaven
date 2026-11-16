import { levelNow, RLV } from '../economy/dispatch.ts';
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
  // three chips that stay in place (only their text changes), so a tap on one always lands on it
  if (el.children.length !== 3) el.innerHTML = `<span class="chip money"></span><span class="chip"></span><span class="chip tap" data-orders="1"></span>`;
  const [m, i, l] = el.children as unknown as HTMLElement[];
  const set = (e: HTMLElement, t: string) => { if (e.textContent !== t) e.textContent = t; };
  set(m!, `💰 ${fmtMoney(g.s.money)}`);
  set(i!, `${inc < 0 ? '📉 −' : '📈 +'}${fmtMoney(Math.abs(inc))}/min`); i!.className = `chip ${inc < 0 ? 'neg' : 'pos'}`;
  set(l!, `⭐ Level ${L} · 📋 ${o}${next ? '/' + next : ''}${next !== undefined && o >= next && levelNow(g).blocked ? ' · ⛵' : ''}`); // ⛵: the next level waits for another island
}

let toastTimer = 0;
/** A short note at the top. With `go`, it carries a Go › button (only the button takes taps: the rest lets them through to the map). */
export function toast(text: string, ms = 2600, go?: () => void) {
  const el = document.getElementById('toast')!;
  el.textContent = text; el.style.opacity = '1';
  el.className = go ? 'go' : '';
  const hide = () => { el.style.opacity = '0'; el.className = ''; };
  if (go) {
    const b = document.createElement('button'); b.textContent = 'Go ›';
    b.onclick = e => { e.stopPropagation(); clearTimeout(toastTimer); hide(); go(); };
    el.append(b);
  }
  clearTimeout(toastTimer); toastTimer = window.setTimeout(hide, ms);
}
