/**
 * Installable web app: register the offline copy and catch Chrome's install offer, when the game is served from its
 * own web address. Opened from a file or inside the Claude app, none of this runs and the game works as before.
 */
let offer: { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> } | null = null;
let installed = false;

export const servedOnline = () => (location.protocol === 'https:' || location.hostname === 'localhost') && window.top === window.self;
export const isInstalled = () => installed || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
export const canInstall = () => !!offer && !isInstalled();

export function setupPwa(onChange: () => void) {
  if (!servedOnline()) return;
  try { if ('serviceWorker' in navigator) void navigator.serviceWorker.register('sw.js').catch(() => { /* no offline copy, the game still runs */ }); } catch { /* blocked here */ }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); offer = e as unknown as typeof offer; onChange(); });
  addEventListener('appinstalled', () => { installed = true; offer = null; onChange(); });
}

/** Show Chrome's install prompt. Returns false when Chrome has no offer (then the menu's Install app or Add to home screen works). */
export async function installApp(): Promise<boolean> {
  if (!offer) return false;
  const o = offer; offer = null;
  await o.prompt(); const r = await o.userChoice;
  if (r.outcome === 'accepted') installed = true;
  return true;
}
