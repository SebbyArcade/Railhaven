import { breaksChanged, newGame, trackChanged } from './game.ts';
import { BREAK_TEXT, breakRail, tickBreaks } from './track/breaks.ts';
import { hallAt, hallsOf } from './buildings/stations.ts';
import { type View, toSquare, toWorld } from './render/camera.ts';
import { Renderer } from './render/renderer.ts';
import { loadFrom, saveTo } from './save/save.ts';
import { isRevealed } from './world/fog.ts';
import { TERRAIN_NAMES } from './world/terrain.ts';
import { attachInput } from './ui/input.ts';
import { fmtMoney, toast, updateHud } from './ui/hud.ts';
import { MODE_HINT, type Mode, Tools } from './ui/tools.ts';
import { GOODS, type Good, INDUSTRIES, info, type IndustryKind, isFactory, lockedText, priceOf } from './buildings/industries.ts';
import { tickProduction } from './economy/production.ts';
import type { Game } from './state.ts';
import { footprint } from './buildings/industries.ts';
import { type Card, cardHtml } from './ui/cards.ts';
import { buyFleet, FLEET, type FleetKey, fleetLvl, refundOf, removeBuilding, rushOf, sellOffer, sellStock, toggleRush, upgradeBuilding } from './economy/upgrades.ts';
import { foundTown, sizeName, tickTowns, upgradeTown } from './economy/towns.ts';
import { buyTrainAt, tickTrains } from './economy/dispatch.ts';
import { buyShip } from './ships/ships.ts';
import { POI, poisOf } from './world/explore.ts';
import { buyFishing, FISHING } from './economy/upgrades.ts';
import { checkStuck } from './economy/nofail.ts';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = document.getElementById('hud')!;
const $ = (id: string) => document.getElementById(id)!;

const params = new URLSearchParams(location.search);
let game: Game = (!params.has('new') && loadFrom(localStorage)) || newGame(params.has('seed') ? +params.get('seed')! : undefined);
const tools = new Tools(() => game);
let renderer = new Renderer(game, tools);
/** run the game rules for some seconds at once (screenshot checks and the bot) */
function step(secs: number) { for (let k = 0; k < secs * 20; k++) { const dt = 0.05; game.s.t += dt; game.sys.tick(dt); tickProduction(game, dt); tickTowns(game, dt); tickTrains(game, dt); if (Math.floor(game.s.t / 5) !== Math.floor((game.s.t - dt) / 5)) checkStuck(game); if (tickBreaks(game)) breaksChanged(game); } }
(window as any).railhaven = { get game() { return game; }, tools, step, openCard: (c: Card | null) => openCard(c), breakRail: (i: number) => { const b = breakRail(game, i); breaksChanged(game); return b; } };

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
    if (tools.mode === 'pan') { const [wx, wy] = toWorld(game.s.camera, view, sx, sy); if (tools.tapWorld(wx, wy)) { renderCard(); return; } }
    if (tools.tapSquare(i)) return;
    const n = game.world.n, x = i % n, y = (i / n) | 0;
    if (!isRevealed(game, i)) { toast('Unexplored fog: 🔭 Scout from a town or dock on your railway, or lay track toward it'); return; }
    const poi = poisOf(game).find(p => p.seen && Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1 && !(p.kind === 'wreck' && p.got));
    if (poi) { toast(`${POI[poi.kind].icon} ${POI[poi.kind].name}: ${poi.got ? 'yours · ' : poi.kind === 'wreck' ? '' : 'bring track within 2 squares to take it over · '}${POI[poi.kind].perk}`); return; }
    const br = game.s.breaks?.find(b => b.square === i);
    if (br) { const s = Math.ceil(br.crewAt - game.s.t); toast(`${BREAK_TEXT[br.kind]}: trains go round or wait. ${s > 0 ? `Repair crew arrives in ${s} s` : `Repair crew at work, ${Math.ceil(br.doneAt - game.s.t)} s left`}`); return; }
    if (game.s.shed && game.s.shed.x === x && game.s.shed.y === y) { openCard({ kind: 'shed', id: 0 }); return; }
    const site = hallAt(hallsOf(game.track, n, game.s.sites), i)?.town ?? game.s.sites.find(s => Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1);
    const bld = game.s.buildings?.find(b => footprint(n, b).includes(i));
    if (bld) { openCard({ kind: 'bld', id: bld.id }); return; }
    if (site?.kind === 'town') { openCard({ kind: 'town', id: site.id }); return; }
    if (site?.kind === 'plot') { openCard({ kind: 'plot', id: site.id }); return; }
    if (tools.card) { closeCard(); return; }
    if (site) toast(`⛏ ${site.res} deposit`);
    else toast(TERRAIN_NAMES[game.world.terr[i]!]!);
  },
});

// Cards: town, building and train; redrawn every second while open so numbers stay live
const cardEl = $('card');
function openCard(c: Card | null) { tools.card = c; tools.selected = c?.kind === 'train' ? c.id : null; renderCard(); }
function closeCard() { tools.card = null; tools.selected = null; renderCard(); }
function renderCard() {
  const html = tools.card && cardHtml(game, tools.card);
  if (!html) { tools.card = null; cardEl.style.display = 'none'; return; }
  cardEl.innerHTML = `<button class="x" data-act="close">✕</button>${html}`; cardEl.style.display = 'block';
  if (armed && performance.now() < armed.until) { // the first Remove tap: ask again
    const b = cardEl.querySelector<HTMLButtonElement>(`button[data-act="remove"][data-id="${armed.id}"]`);
    if (b) { b.classList.add('sure'); b.textContent = '⚠ Tap again to remove it'; }
  }
}
let armed: { id: number; until: number } | null = null;
cardEl.onclick = e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  if (b.dataset.act === 'close') { closeCard(); return; }
  const bld = game.s.buildings?.find(x => x.id === +(b.dataset.id ?? -1));
  if (b.dataset.act === 'page' && tools.card) { openCard({ ...tools.card, page: b.dataset.page || undefined } as Card); return; }
  if (b.dataset.act === 'fish' && bld) { const why = buyFishing(game, bld); toast(why || `🎣 ${FISHING[(bld.fish ?? 1) - 1]!.name} at the dock`); renderCard(); return; }
  if (b.dataset.act === 'ship' && bld) { const s = buyShip(game, bld); toast(typeof s === 'string' ? s : '🚢 A cargo ship is ready at the dock: it sails where goods wait'); renderCard(); return; }
  if (b.dataset.act === 'trainat' && bld) { const t = buyTrainAt(game, bld); if (typeof t === 'string') toast(t); else { toast(`🚂 Train ${t.id} came over by boat and is looking for a load`); } renderCard(); return; }
  if (b.dataset.act === 'lvl' && bld) { const why = upgradeBuilding(game, bld); toast(why || `⬆ ${info(bld.kind).name} is now level ${bld.lvl}`); if (!why && bld.kind === 'dock') trackChanged(game); renderCard(); return; }
  if (b.dataset.act === 'sell' && bld) { const o = sellOffer(bld), why = sellStock(game, bld); toast(why || `💸 Sold ${o.n} for ${fmtMoney(o.pay)}`); renderCard(); return; }
  if (b.dataset.act === 'remove' && bld) {
    if (!armed || armed.id !== bld.id || performance.now() > armed.until) { armed = { id: bld.id, until: performance.now() + 4000 }; renderCard(); return; }
    armed = null; const r = refundOf(bld), why = removeBuilding(game, bld);
    if (why) { toast(why); renderCard(); return; }
    trackChanged(game); game.terrainDirty?.(footprint(game.world.n, bld)); closeCard();
    toast(`🗑 ${info(bld.kind).name} removed · +${fmtMoney(r)} back`); return;
  }
  if (b.dataset.act === 'rush') {
    const to = { kind: b.dataset.kind as 'town' | 'bld', id: +b.dataset.id! }, k = b.dataset.good as Good, on = !!rushOf(game, to, k);
    const why = toggleRush(game, to, k); toast(why || (on ? '⭐ Rush stopped' : `⭐ Rushing ${GOODS[k].name.toLowerCase()}: its makers send here first`)); renderCard(); return;
  }
  if (b.dataset.act === 'fleet') { const k = b.dataset.k as FleetKey, why = buyFleet(game, k); toast(why || `${FLEET[k].icon} ${FLEET[k].name}: ${FLEET[k].text(fleetLvl(game, k))}`); renderCard(); return; }
  if (b.dataset.act === 'found') {
    const p = game.s.sites.find(s => s.id === +b.dataset.id!)!, name = p.name;
    const why = foundTown(game, p);
    if (why) { toast(why); renderCard(); return; }
    toast(`🏘 ${name} founded! Lay track onto it to link it`); openCard({ kind: 'town', id: p.id }); return;
  }
  if (b.dataset.act === 'upgrade') {
    const t = game.s.sites.find(s => s.id === +b.dataset.id!)!, L = (t.lvl ?? 0) + 1;
    const why = upgradeTown(game, t); toast(why || `⬆ ${t.name} is now a ${sizeName(L)}! New order on its card`); renderCard();
  }
};

// Build menu: colourful tiles, one per industry
const menu = $('buildMenu');
let menuOpen = false;
function renderMenu() {
  const kinds = (Object.keys(INDUSTRIES) as IndustryKind[]).filter(k => k !== 'iron' && k !== 'oil' || game.s.sites.some(s => s.kind === 'dep' && s.res === k && !s.hidden));
  const tile = (k: IndustryKind) => {
    const d = info(k), p = priceOf(game, k), lock = lockedText(game, k);
    return `<button data-k="${k}" class="${tools.buildKind === k ? 'on' : ''}${lock ? ' locked' : ''}"><b>${d.icon}</b>${d.name}<small>${lock ? '🔒 Level ' + d.unlock : fmtMoney(p)}</small></button>`;
  };
  menu.innerHTML = kinds.filter(k => !isFactory(k) && k !== 'dock').map(tile).join('') + `<div class="mhead">🏭 Factories: turn raw goods into products</div>` + kinds.filter(isFactory).map(tile).join('')
    + `<div class="mhead">⚓ Sea: docks reach other islands</div>` + tile('dock');
}
menu.onclick = e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  const lock = lockedText(game, b.dataset.k as IndustryKind);
  if (lock) { toast(`${lock}: fill more town orders to raise your Railway level`); return; }
  const spot = tools.chooseBuild(b.dataset.k as IndustryKind); menuOpen = false;
  if (!spot) return;
  // the nearest spot is off screen: bring it into view (the camera moves, nothing is built)
  const c = game.s.camera, [sx, sy] = [(spot.x + 0.5) * 32, (spot.y + 0.5) * 32];
  if (Math.abs(sx - c.x) * c.z > view.w * 0.4 || Math.abs(sy - c.y) * c.z > view.h * 0.3) { c.x = sx; c.y = sy; toast('The nearest spot that fits is glowing here'); }
};
$('buildBtn').onclick = () => {
  if (tools.mode === 'build' || menuOpen) { menuOpen = false; tools.setMode('pan'); tools.mode = 'pan'; tools.buildKind = null; return; }
  tools.mode = 'pan'; tools.cancel(); menuOpen = true; renderMenu();
};
// toolbar: tapping a tool again closes it
for (const b of document.querySelectorAll<HTMLButtonElement>('#bar [data-mode]')) b.onclick = () => { menuOpen = false; tools.setMode(b.dataset.mode as Mode); };
let newArmed = 0;
$('newGame').onclick = () => {
  // the artifact frame blocks confirm(), so ask with a second tap instead
  if (performance.now() - newArmed > 3000) { newArmed = performance.now(); toast('Tap New again to start a new map'); return; }
  newArmed = 0;
  game = newGame(); tools.cancel(); closeCard(); renderer = new Renderer(game, tools); saveTo(localStorage, game);
};
$('ok').onclick = () => tools.confirm();
$('undo').onclick = () => tools.undo();
$('turn').onclick = () => tools.turn();
$('near').onclick = () => { if (tools.nearestFit() && tools.preview) { const c = game.s.camera, sx = (tools.preview.x + 1.5) * 32, sy = (tools.preview.y + 1.5) * 32; if (Math.abs(sx - c.x) * c.z > view.w * 0.4 || Math.abs(sy - c.y) * c.z > view.h * 0.3) { c.x = sx; c.y = sy; } } };
$('cancel').onclick = () => { tools.cancel(); };

function updateUi() {
  for (const b of document.querySelectorAll<HTMLButtonElement>('#bar [data-mode]')) b.classList.toggle('on', b.dataset.mode === tools.mode);
  $('buildBtn').classList.toggle('on', tools.mode === 'build' || menuOpen);
  menu.style.display = menuOpen ? 'grid' : 'none';
  if (menuOpen && Math.floor(performance.now() / 1000) !== lastMenu) { lastMenu = Math.floor(performance.now() / 1000); renderMenu(); } // prices refresh live
  tools.updateGlow(Math.floor(game.s.camera.x / 32), Math.floor(game.s.camera.y / 32));
  const hint = MODE_HINT[tools.mode]; $('hint').textContent = hint; $('hint').style.display = hint ? 'block' : 'none';
  $('undo').style.display = tools.canUndo() ? 'block' : 'none';
  const bar = tools.bar(), cb = $('confirm');
  cb.style.display = bar ? 'flex' : 'none';
  $('turn').style.display = bar?.turn ? 'block' : 'none';
  $('near').style.display = bar?.near ? 'block' : 'none';
  cb.classList.toggle('two', !!bar?.near);
  if (bar) { $('ctext').textContent = bar.text; ($('ok') as HTMLButtonElement).disabled = !bar.can; $('ok').textContent = bar.ok; }
}

let last = performance.now(), saveT = 0, lastMenu = 0, lastCard = 0, newsAt = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!document.hidden) { game.s.t += dt; game.sys.tick(dt); tickProduction(game, dt); tickTowns(game, dt); tickTrains(game, dt); if (Math.floor(game.s.t / 5) !== Math.floor((game.s.t - dt) / 5)) checkStuck(game); if (tickBreaks(game)) breaksChanged(game); }
  if (game.news?.length && now > newsAt) { toast(game.news.shift()!, 4000); newsAt = now + 4200; }
  if (Math.floor(now / 1000) !== lastCard) { lastCard = Math.floor(now / 1000); renderCard(); }
  saveT += dt; if (saveT > 5) { saveT = 0; saveTo(localStorage, game); }
  renderer.draw(ctx, view, dpr, now / 1000);
  updateHud(hud, game);
  updateUi();
  requestAnimationFrame(frame);
}
addEventListener('visibilitychange', () => { if (document.hidden) saveTo(localStorage, game); });
requestAnimationFrame(frame);
