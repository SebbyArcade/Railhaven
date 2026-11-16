/** Full screen: one button on the map toggles it in and out (Chrome's Fullscreen API). */
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: (o?: FullscreenOptions) => void };
const doc = () => document as FsDoc;

/** the page is full screen right now (the API, or an installed app that opens full screen) */
export const isFull = () => !!(doc().fullscreenElement ?? doc().webkitFullscreenElement);
/** the browser lets this page go full screen (false inside the Claude app, which shows the game in a frame) */
export const canFull = () => !!(doc().fullscreenEnabled ?? doc().webkitFullscreenEnabled);
/** opened from the home screen icon in full-screen mode: there is nothing to toggle */
export const appFull = () => matchMedia('(display-mode: fullscreen)').matches && !isFull();

export const BLOCKED = 'Full screen is blocked inside the Claude app. Open the game in Chrome (or add it to your home screen) to play full screen';

/** Go full screen, or back. Calls fail(reason) when the browser says no. */
export function toggleFull(fail: (why: string) => void): void {
  if (isFull()) { const d = doc(); void (d.exitFullscreen ? d.exitFullscreen().catch(() => {}) : d.webkitExitFullscreen?.()); return; }
  if (!canFull()) { fail(BLOCKED); return; }
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => fail('Full screen did not open: tap ⛶ again'));
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else fail(BLOCKED);
  } catch { fail('Full screen did not open: tap ⛶ again'); }
}

const ICON_IN = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2 7V2h5M13 2h5v5M18 13v5h-5M7 18H2v-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_OUT = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M7 2v5H2M18 7h-5V2M13 18v-5h5M2 13h5v5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Draw the map button for the current state: corners out to go full screen, corners in to come back. */
export function showFullBtn(btn: HTMLElement): void {
  const on = isFull();
  btn.style.display = appFull() ? 'none' : '';
  btn.innerHTML = on ? ICON_OUT : ICON_IN;
  btn.classList.toggle('on', on);
  btn.classList.toggle('blocked', !on && !canFull());
  btn.title = on ? 'Leave full screen' : canFull() ? 'Full screen' : 'Full screen needs Chrome';
  btn.setAttribute('aria-label', btn.title);
}
