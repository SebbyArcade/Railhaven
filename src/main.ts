import { newGame } from './game.ts';
import { hallAt, hallsOf } from './buildings/stations.ts';
import { type View, toSquare, toWorld } from './render/camera.ts';
import { Renderer } from './render/renderer.ts';
import { loadFrom, saveTo } from './save/save.ts';
import { isRevealed } from './world/fog.ts';
import { TERRAIN_NAMES } from './world/terrain.ts';
import { attachInput } from './ui/input.ts';
import { toast, updateHud } from './ui/hud.ts';
import { MODE_HINT, type Mode, Tools } from './ui/tools.ts';
import type { Game } from './state.ts';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = document.getElementById('hud')!;
const $ = (id: string) => document.getElementById(id)!;

const params = new URLSearchParams(location.search);
let game: Game = (!params.has('new') && loadFrom(localStorage)) || newGame(params.has('seed') ? +params.get('seed')! : undefined);
const tools = new Tools(() => game);
let renderer = new Renderer(game, tools);
(window as any).railhaven = { get game() { return game; }, tools };

const view: View = { w: 0, h: 0 };
let dpr = 1;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  view.w = innerWidth; view.h = innerHeight;
  canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr);
  canvas.style.width = view.w + 'px'; canvas.style.height = view.h + 'px';
}
addEventListener('resize', resize); resize();

const squareAt = (sx: number, sy: number) => {
  const [x, y] = toSquare(game.s.camera, view, sx, sy), n = game.world.n;
  return x < 0 || y < 0 || x >= n || y >= n ? -1 : y * n + x;
};

attachInput(canvas, () => game.s.camera, () => view, () => game.world.n * 32, {
  dragStart(sx, sy) { const i = squareAt(sx, sy); return i >= 0 && tools.dragStart(i); },
  dragMove(sx, sy) { const i = squareAt(sx, sy); if (i >= 0) tools.dragOver(i); },
  tap(sx, sy) {
    const i = squareAt(sx, sy); if (i < 0) return;
    if (tools.mode === 'pan') { const [wx, wy] = toWorld(game.s.camera, view, sx, sy); if (tools.tapWorld(wx, wy)) return; }
    if (tools.tapSquare(i)) return;
    const n = game.world.n, x = i % n, y = (i / n) | 0;
    if (!isRevealed(game, i)) { toast('Unexplored fog. Scouting comes in a later stage.'); return; }
    const site = hallAt(hallsOf(game.track, n, game.s.sites), i)?.town ?? game.s.sites.find(s => Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1);
    if (site) toast(site.kind === 'town' ? `🏘 ${site.name}` : site.kind === 'plot' ? `🚩 Settlement site: ${site.name}` : `⛏ ${site.res} deposit`);
    else toast(TERRAIN_NAMES[game.world.terr[i]!]!);
  },
});

// toolbar: tapping a tool again closes it
for (const b of document.querySelectorAll<HTMLButtonElement>('#bar [data-mode]')) b.onclick = () => { tools.setMode(b.dataset.mode as Mode); };
let newArmed = 0;
$('newGame').onclick = () => {
  // the artifact frame blocks confirm(), so ask with a second tap instead
  if (performance.now() - newArmed > 3000) { newArmed = performance.now(); toast('Tap New again to start a new map'); return; }
  newArmed = 0;
  game = newGame(); tools.cancel(); tools.selected = null; renderer = new Renderer(game, tools); saveTo(localStorage, game);
};
$('ok').onclick = () => tools.confirm();
$('cancel').onclick = () => { tools.cancel(); };

function updateUi() {
  for (const b of document.querySelectorAll<HTMLButtonElement>('#bar [data-mode]')) b.classList.toggle('on', b.dataset.mode === tools.mode);
  const hint = MODE_HINT[tools.mode]; $('hint').textContent = hint; $('hint').style.display = hint ? 'block' : 'none';
  const bar = tools.bar(), cb = $('confirm');
  cb.style.display = bar ? 'flex' : 'none';
  if (bar) { $('ctext').textContent = bar.text; ($('ok') as HTMLButtonElement).disabled = !bar.can; $('ok').textContent = bar.ok; }
}

let last = performance.now(), saveT = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!document.hidden) { game.s.t += dt; game.sys.tick(dt); }
  saveT += dt; if (saveT > 5) { saveT = 0; saveTo(localStorage, game); }
  renderer.draw(ctx, view, dpr, now / 1000);
  updateHud(hud, game);
  updateUi();
  requestAnimationFrame(frame);
}
addEventListener('visibilitychange', () => { if (document.hidden) saveTo(localStorage, game); });
requestAnimationFrame(frame);
