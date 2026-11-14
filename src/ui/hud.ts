import type { Game } from '../state.ts';

export const fmtMoney = (n: number) => '$' + Math.floor(n).toLocaleString('en-US');

/** Top bar: money and game clock. More arrives with the economy (stage 3). */
export function updateHud(el: HTMLElement, g: Game) {
  const m = Math.floor(g.s.t / 60), s = Math.floor(g.s.t % 60);
  el.innerHTML = `<span class="chip money">💰 ${fmtMoney(g.s.money)}</span><span class="chip">⏱ ${m}:${String(s).padStart(2, '0')}</span>`;
}

let toastTimer = 0;
export function toast(text: string) {
  const el = document.getElementById('toast')!;
  el.textContent = text; el.style.opacity = '1';
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => (el.style.opacity = '0'), 2600);
}
