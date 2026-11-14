import { newGame } from './game.ts';
import { type View, toSquare } from './render/camera.ts';
import { Renderer } from './render/renderer.ts';
import { loadFrom, saveTo } from './save/save.ts';
import { isRevealed } from './world/fog.ts';
import { TERRAIN_NAMES } from './world/terrain.ts';
import { attachInput } from './ui/input.ts';
import { toast, updateHud } from './ui/hud.ts';
import type { Game } from './state.ts';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = document.getElementById('hud')!;

const params = new URLSearchParams(location.search);
let game: Game = (!params.has('new') && loadFrom(localStorage)) || newGame(params.has('seed') ? +params.get('seed')! : undefined);
let renderer = new Renderer(game);
(window as any).railhaven = { get game() { return game; } };

const view: View = { w: 0, h: 0 };
let dpr = 1;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  view.w = innerWidth; view.h = innerHeight;
  canvas.width = Math.round(view.w * dpr); canvas.height = Math.round(view.h * dpr);
  canvas.style.width = view.w + 'px'; canvas.style.height = view.h + 'px';
}
addEventListener('resize', resize); resize();

attachInput(canvas, () => game.s.camera, () => view, () => game.world.n * 32, {
  tap(sx, sy) {
    const [x, y] = toSquare(game.s.camera, view, sx, sy), n = game.world.n;
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    if (!isRevealed(game, y * n + x)) { toast('Unexplored fog. Scouting comes in a later stage.'); return; }
    const site = game.s.sites.find(s => Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1);
    if (site) toast(site.kind === 'town' ? `🏘 ${site.name}` : site.kind === 'plot' ? `🚩 Settlement site: ${site.name}` : `⛏ ${site.res} deposit`);
    else toast(TERRAIN_NAMES[game.world.terr[y * n + x]!]!);
  },
});

document.getElementById('newGame')!.onclick = () => {
  if (!confirm('Start a new map? This replaces the current preview game.')) return;
  game = newGame(); renderer = new Renderer(game); saveTo(localStorage, game);
};

let last = performance.now(), saveT = 0;
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (!document.hidden) game.s.t += dt;
  saveT += dt; if (saveT > 5) { saveT = 0; saveTo(localStorage, game); }
  renderer.draw(ctx, view, dpr, now / 1000);
  updateHud(hud, game);
  requestAnimationFrame(frame);
}
addEventListener('visibilitychange', () => { if (document.hidden) saveTo(localStorage, game); });
requestAnimationFrame(frame);
