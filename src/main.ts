import { destName } from './economy/shipping.ts';
import { Sound } from './audio/sound.ts';
import { hearScene } from './audio/scene.ts';
import { cueMemo, cues, type CueMemo } from './audio/cues.ts';
import { breaksChanged, newGame, trackChanged } from './game.ts';
import { BREAK_TEXT, breakRail, tickBreaks } from './track/breaks.ts';
import { tickEvents } from './world/events.ts';
import { bodyPoint } from './trains/train.ts';
import { hallAt, hallsOf } from './buildings/stations.ts';
import { type View, toSquare, toWorld } from './render/camera.ts';
import { Renderer } from './render/renderer.ts';
import { loadFrom, onSave, readSave, saveCode, saveJson, saveTo } from './save/save.ts';
import { addSlot, copySlot, deleteSlot, openSlot, readIndex, renameSlot, touchActive } from './save/slots.ts';
import { homeHtml, isHomePage } from './ui/home.ts';
import { mapThumb } from './render/thumb.ts';
import { canInstall, installApp, isInstalled, servedOnline, setupPwa } from './ui/pwa.ts';
import { canFull, isFull, showFullBtn, toggleFull } from './ui/fullscreen.ts';
import { checkMedals, loadProfile, saveProfile } from './progress/achievements.ts';
import { lookOpen, PAINTS, setLooks, THEMES } from './render/looks.ts';
import { xpOf } from './progress/achievements.ts';
import { isRevealed } from './world/fog.ts';
import { TERRAIN_NAMES } from './world/terrain.ts';
import { attachInput } from './ui/input.ts';
import { fmtMoney, toast, updateHud } from './ui/hud.ts';
import { MODE_HINT, type Mode, Tools } from './ui/tools.ts';
import { setClosed } from './buildings/closing.ts';
import { GOODS, type Good, INDUSTRIES, info, inputsOf, type IndustryKind, isFactory, lockedText, priceOf } from './buildings/industries.ts';
import { tickProduction } from './economy/production.ts';
import type { Game } from './state.ts';
import { footprint } from './buildings/industries.ts';
import { type Card, cardHtml } from './ui/cards.ts';
import { sendExpedition } from './world/expedition.ts';
import { buyPark, buyProject, type ParkKind, parksOf, projectOf } from './buildings/parks.ts';
import { type MapView, VIEWS } from './ui/mapviews.ts';
import { gameReport } from './ui/report.ts';
import { SEASONS, seasonOf } from './world/season.ts';
import { buyFleet, FLEET, type FleetKey, fleetLvl, refundOf, removeBuilding, rushBySea, rushFee, rushMore, rushOf, sellOffer, sellStock, startRush, stopRush, upgradeBuilding } from './economy/upgrades.ts';
import { foundTown, sizeName, tickTowns, upgradeTown } from './economy/towns.ts';
import { checkArrivals } from './progress/arrivals.ts';
import { buyTrainAt, buyTrainFor, fleetByIsland, bringTrainFrom, cancelMove, sellTrain, shipTrainTo, tickTrains, trainRefund, trainToSell } from './economy/dispatch.ts';
import { moneyTip, type Tip } from './economy/advice.ts';
import { buyShip, buyShipUp, SHIP_UP, type ShipUpKey, seaLanes, shipPlace, shipUpLvl } from './ships/ships.ts';
import { CLAIM_TEXT, POI, poisOf } from './world/explore.ts';
import { buyFishing, FISHING } from './economy/upgrades.ts';
import { checkStuck } from './economy/nofail.ts';
import { ashford, missionsOf, msOf, recommendedBuild, swapMission } from './progress/missions.ts';
import { missionPill } from './ui/story.ts';
import { gameHtml } from './ui/gamecard.ts';
import { decodeLegacy, importLegacy, isLegacy } from './save/legacy.ts';
import { LESSONS, lessonOn, lessonText, skipLessons } from './progress/lessons.ts';
import { toScreen } from './render/camera.ts';
import { yardSquares, isLinked } from './buildings/industries.ts';
import { orderDone } from './economy/towns.ts';
import { townLinked } from './economy/towns.ts';
import { islandOfB } from './ships/docks.ts';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const hud = document.getElementById('hud')!;
const $ = (id: string) => document.getElementById(id)!;

const params = new URLSearchParams(location.search);
/** a new game in the browser starts Mira's lessons */
const freshGame = (seed?: number) => { const g = newGame(seed); g.s.tut = 0; return g; };
// save slots: the playing game stays under the usual key, the list of games beside it (made from this browser's game the first time)
const slotsOk = (() => { try { readIndex(localStorage); return true; } catch { return false; } })();
let game: Game = (!params.has('new') && !params.has('seed') && loadFrom(localStorage)) || freshGame(params.has('seed') ? +params.get('seed')! : undefined);
if (slotsOk && (params.has('new') || params.has('seed') || !readIndex(localStorage).list.length)) { const why = addSlot(localStorage, saveJson(game), game); if (why) { game = loadFrom(localStorage) ?? game; } }
// achievements: kept in the player's profile across all games, checked with every save (every 5 seconds)
const profile = (() => { try { return loadProfile(localStorage); } catch { return loadProfile({ getItem: () => null }); } })();
setLooks(profile.paint, profile.theme);
const keepProfile = () => { try { saveProfile(localStorage, profile); } catch { /* the medals stay for this visit */ } };
onSave((st, g) => {
  if (st !== localStorage) return;
  if (slotsOk) try { touchActive(localStorage, g); } catch { /* storage full: the game itself is saved */ }
  const o = profile.orders, got = checkMedals(g, profile);
  if (got.length > 2) (g.news ??= []).push(`🏅 ${got.length} medals earned · +${got.reduce((a, m) => a + m.xp, 0)} XP: see 🏠 Home → Achievements`);
  else for (const m of got) (g.news ??= []).push(`🏅 Medal: ${m.icon} ${m.name} · +${m.xp} XP`);
  if (got.length || profile.orders !== o || !profile.seeds.includes(g.s.seed)) keepProfile();
});
/** the playing game's small map picture, made when the home screen opens or the game is put aside */
const snapPic = () => { if (slotsOk) try { touchActive(localStorage, game, mapThumb(game)); } catch { /* no picture */ } };
const tools = new Tools(() => game);
let renderer = new Renderer(game, tools);
/** run the game rules for some seconds at once (screenshot checks and the bot) */
function step(secs: number) { for (let k = 0; k < secs * 20; k++) { const dt = 0.05; game.s.t += dt; game.sys.tick(dt); tickProduction(game, dt); tickTowns(game, dt); tickTrains(game, dt); if (Math.floor(game.s.t / 5) !== Math.floor((game.s.t - dt) / 5)) checkStuck(game); if (+tickBreaks(game) + +tickEvents(game, dt)) breaksChanged(game); } }
(window as any).railhaven = { get game() { return game; }, get renderer() { return renderer; }, get sound() { return sound; }, hear: () => hearScene(game, view), trainAt: (id: number) => { const t = game.s.trains.find(t => t.id === id); return t?.trail.length ? bodyPoint(game.net, t, 0) : null; }, tools, step, openCard: (c: Card | null) => openCard(c), breakRail: (i: number) => { const b = breakRail(game, i); breaksChanged(game); return b; } };

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

/** true when a tap on this square opens a card: a seen town, plot, building, station hall or the engine shed */
const opensCard = (i: number) => {
  const n = game.world.n, x = i % n, y = (i / n) | 0;
  if (!isRevealed(game, i)) return false;
  if (game.s.shed && game.s.shed.x === x && game.s.shed.y === y) return true;
  if (game.s.buildings?.some(b => footprint(n, b).includes(i))) return true;
  if (hallAt(hallsOf(game.track, n, game.s.sites, game.world.terr), i)?.town) return true;
  return game.s.sites.some(s => (s.kind === 'town' || s.kind === 'plot') && Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1);
};

attachInput(canvas, () => game.s.camera, () => view, () => game.world.n * 32, {
  dragStart(sx, sy) { const i = squareAt(sx, sy); return i >= 0 && tools.dragStart(i); },
  dragMove(sx, sy) { const i = squareAt(sx, sy); if (i >= 0) tools.dragOver(i); },
  tap(sx, sy) {
    if (tools.view) { const a = renderer.arrows.find(o => Math.hypot(o.sx - sx, o.sy - sy) < 24); if (a) { game.s.camera.x = (a.m.x + 0.5) * 32; game.s.camera.y = (a.m.y + 0.5) * 32; return; } }
    const i = squareAt(sx, sy); if (i < 0) return;
    if (tools.mode === 'pan') { const [wx, wy] = toWorld(game.s.camera, view, sx, sy); if (tools.tapWorld(wx, wy)) { renderCard(); return; } }
    if (tools.mode === 'map' && opensCard(i)) { tools.mapPv = null; tools.mode = 'pan'; tools.cancel(); } // a town or building opens its card, never moves the map circle (he tapped Gullhaven and got the map purchase)
    if (tools.tapSquare(i)) return;
    const n = game.world.n, x = i % n, y = (i / n) | 0;
    if (!isRevealed(game, i)) { toast('Unexplored fog: 🔭 Scout from a town or dock on your railway, or lay track toward it'); return; }
    const poi = poisOf(game).find(p => p.seen && Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1 && !(p.kind === 'wreck' && p.got));
    if (poi) { tools.poiSel = { id: poi.id, until: performance.now() + 5000 }; toast(`${POI[poi.kind].icon} ${POI[poi.kind].name}: ${poi.got ? 'yours · ' : poi.kind === 'wreck' ? '' : `${CLAIM_TEXT} to take it over · `}${POI[poi.kind].perk}`); return; }
    const br = game.s.breaks?.find(b => b.square === i);
    if (br) { const s = Math.ceil(br.crewAt - game.s.t); toast(`${BREAK_TEXT[br.kind]}: trains go round or wait. ${s > 0 ? `Repair crew arrives in ${s} s` : `Repair crew at work, ${Math.ceil(br.doneAt - game.s.t)} s left`}`); return; }
    if (game.s.shed && game.s.shed.x === x && game.s.shed.y === y) { openCard({ kind: 'shed', id: 0 }); return; }
    const site = hallAt(hallsOf(game.track, n, game.s.sites, game.world.terr), i)?.town ?? game.s.sites.find(s => Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1);
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
  if (tools.card?.kind === 'game' && tools.card.page === 'paste' && cardEl.querySelector('#pasteCode')) return; // keep what is being typed
  if (tools.card?.kind === 'game' && tools.card.page === 'stats' && cardEl.querySelector('#stats')) return; // keep the report selectable
  if (tools.card?.kind === 'map' && cardEl.style.display === 'block' && cardEl.querySelector('#mapQ')) return; // nothing on it changes: keep the search being typed
  if (tools.card?.kind === 'game' && tools.card.page === 'move' && myCode && (cardEl.querySelector('#myCode') as HTMLTextAreaElement | null)?.value === myCode) return; // keep the code selectable
  if (tools.card?.kind === 'game' && cardEl.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT') return; // keep a name or map number being typed
  const home = tools.card?.kind === 'game' && isHomePage(tools.card.page);
  cardEl.classList.toggle('home', home);
  const html = tools.card && (tools.card.kind === 'game' ? (home ? homeHtml(tools.card.page, readIndex(localStorage), tools.card.id, delArmed?.id === tools.card.id && performance.now() < delArmed.until, profile, game, { online: servedOnline(), installed: isInstalled() }) : gameHtml(tools.card.page === 'settings' ? '' : tools.card.page, !!oldSave(), importReport, myCode, tools.card.page === 'stats' ? gameReport(game) : null, sound.settings, { online: servedOnline(), installed: isInstalled(), offer: canInstall(), full: isFull(), canFull: canFull() }, !game.s.tipsOff)) : cardHtml(game, tools.card, tools.view));
  if (!html) { tools.card = null; cardEl.style.display = 'none'; return; }
  cardEl.innerHTML = `<button class="x" data-act="close">✕</button>${html}`; cardEl.style.display = 'block';
  if (performance.now() - newArmed < 3000) { const nb = cardEl.querySelector<HTMLButtonElement>('button[data-act="newmap"]'); if (nb) { nb.classList.add('sure'); nb.textContent = '⚠ Tap again to start a new map'; } }
  if (armed && performance.now() < armed.until) { // the first Remove tap: ask again
    const b = cardEl.querySelector<HTMLButtonElement>(`button[data-act="remove"][data-id="${armed.id}"]`);
    if (b) { b.classList.add('sure'); b.textContent = '⚠ Tap again to remove it'; }
  }
}
let armed: { id: number; until: number } | null = null, delArmed: { id: number; until: number } | null = null, sellArmed: { id: number; until: number } | null = null;
cardEl.onclick = e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  if (b.dataset.act === 'close') { closeCard(); return; }
  if (b.dataset.act === 'newmap') {
    // the artifact frame blocks confirm(), so ask with a second tap instead
    if (performance.now() - newArmed > 3000) { newArmed = performance.now(); b.textContent = '⚠ Tap again to start a new map'; b.classList.add('sure'); return; }
    newArmed = 0; startGame(freshGame()); return; // (no longer offered: new games start from Your games)
  }
  if (b.dataset.act === 'loadfile') { filePick.click(); return; }
  if (b.dataset.act === 'install') { void installApp().then(ok => { if (!ok) { if (tools.card?.kind === 'game' && !tools.card.page) tools.card.page = 'app'; else toast('In Chrome: ⋮ menu → Install app'); } renderCard(); }); return; }
  if (b.dataset.act === 'mgroup') { openCard({ kind: 'game', id: +b.dataset.id!, page: 'mgroup' }); return; }
  if (b.dataset.act === 'look') {
    const paint = b.dataset.kind === 'paint', l = (paint ? PAINTS : THEMES).find(x => x.k === b.dataset.k); if (!l) return;
    if (!lookOpen(l, xpOf(profile), profile.medals)) { toast('medal' in l && l.medal ? `🔒 ${l.name}: build the Royal Exhibition Hall in Ashford to win it` : `🔒 ${l.name} unlocks at ${l.xp} XP: earn medals to get there`); return; }
    if (paint) profile.paint = l.k; else profile.theme = l.k;
    setLooks(profile.paint, profile.theme); keepProfile(); toast(`🎨 ${l.name}`); renderCard(); return;
  }
  if (b.dataset.act === 'slotpage') { delArmed = null; openCard({ kind: 'game', id: +b.dataset.id!, page: 'slot' }); return; }
  if (b.dataset.act === 'play') { const id = +b.dataset.id!; if (id === readIndex(localStorage).active) { closeCard(); return; } saveTo(localStorage, game); snapPic(); const g = openSlot(localStorage, id); if (typeof g === 'string') { toast(g); return; } startGame(g, false); toast('▶ ' + (readIndex(localStorage).list.find(m => m.id === id)?.name ?? 'Your game'), 2500); return; }
  if (b.dataset.act === 'rename') { const why = renameSlot(localStorage, +b.dataset.id!, cardEl.querySelector<HTMLInputElement>('#slotName')?.value ?? ''); (document.activeElement as HTMLElement | null)?.blur(); toast(why || '✏ Name saved'); renderCard(); return; }
  if (b.dataset.act === 'copyslot') { saveTo(localStorage, game); const why = copySlot(localStorage, +b.dataset.id!); toast(why || '📄 Copied: the copy is in Your games'); if (!why) openCard({ kind: 'game', id: 0, page: 'games' }); return; }
  if (b.dataset.act === 'delslot') {
    const id = +b.dataset.id!;
    if (!delArmed || delArmed.id !== id || performance.now() > delArmed.until) { delArmed = { id, until: performance.now() + 4000 }; renderCard(); return; }
    delArmed = null; saveTo(localStorage, game);
    const r = deleteSlot(localStorage, id);
    if (typeof r === 'string') { toast(r); return; }
    if (r.ok === 'switch') startGame(r.g, false);
    if (r.ok === 'empty') { const g = freshGame(); addSlot(localStorage, saveJson(g), g); startGame(g, false); }
    toast('🗑 Game deleted'); openCard({ kind: 'game', id: 0, page: 'games' }); return;
  }
  if (b.dataset.act === 'newgame') {
    let seed: number | undefined;
    if (b.dataset.seed) { const v = (cardEl.querySelector<HTMLInputElement>('#seedIn')?.value ?? '').replace(/\D/g, ''); if (!v) { toast('Type a map number first, or start on a random map'); return; } seed = +v; }
    saveTo(localStorage, game); snapPic();
    const g = freshGame(seed); const why = addSlot(localStorage, saveJson(g), g);
    if (why) { toast(why); return; }
    startGame(g, false); return;
  }
  if (b.dataset.act === 'open') { // from the Orders board: show the place on the map and open its card
    const kind = b.dataset.kind as 'town' | 'bld' | 'train' | 'ship', id = +b.dataset.id!, c = game.s.camera;
    const sh = kind === 'ship' ? game.s.ships?.find(x => x.id === id) : undefined;
    const at = kind === 'town' ? game.s.sites.find(s => s.id === id) : kind === 'bld' ? game.s.buildings?.find(x => x.id === id) : sh ? shipPlace(game, sh) : null;
    if (at) { c.x = (at.x + 0.5) * 32; c.y = (at.y + 0.5) * 32; }
    openCard({ kind, id, ...(b.dataset.page ? { page: b.dataset.page } : {}) } as Card); return;
  }
  if (b.dataset.act === 'dbljam') { // 🚦 from the Orders board: Double mode with the held-up stretch already chosen
    const sq = (b.dataset.sq ?? '').split(',').map(Number).filter(i => game.track.has(i)); closeCard();
    tools.mode = 'double'; tools.cancel(); for (const i of sq) tools.dbl.add(i);
    if (sq.length) { const n = game.world.n, c = game.s.camera; c.x = ((sq[0]! % n) + 0.5) * 32; c.y = (Math.floor(sq[0]! / n) + 0.5) * 32; }
    toast('═ The held-up stretch is marked: check it and tap ✓ Double, or tap squares to change it'); return;
  }
  if (b.dataset.act === 'lookxy') { const x = +b.dataset.x!, y = +b.dataset.y!; closeCard(); lookAt(x, y); tools.flash = { square: y * game.world.n + x, until: performance.now() + 2500 }; return; }
  if (b.dataset.act === 'report') { openCard({ kind: 'scout', id: +b.dataset.id! }); return; }
  if (b.dataset.act === 'reports') { openCard({ kind: 'scout', id: 0 }); return; }
  if (b.dataset.act === 'isle') { openCard({ kind: 'isle', id: +b.dataset.id! }); return; }
  if (b.dataset.act === 'lookpoi') { const p = poisOf(game).find(x => x.id === +b.dataset.id!); closeCard(); if (p) { lookAt(p.x, p.y); tools.flash = { square: p.y * game.world.n + p.x, until: performance.now() + 2500 }; } return; }
  if (b.dataset.act === 'areamap') { const why = tools.openMap(+b.dataset.x!, +b.dataset.y!); if (why) { toast(why); return; } closeCard(); const c = game.s.camera; c.x = (+b.dataset.x! + 0.5) * 32; c.y = (+b.dataset.y! + 0.5) * 32; c.z = Math.max(0.1, Math.min(c.z, 0.9 * Math.min(view.w, view.h) / (2 * (tools.mapPv?.r ?? 45) * 32))); return; }
  if (b.dataset.act === 'view') { setView((b.dataset.v || null) as MapView | null); closeCard(); return; }
  if (b.dataset.act === 'pin') { // 📌 choose where a building sends its goods ('' = automatic)
    const t = game.s.buildings?.find(x => x.id === +b.dataset.id!); if (!t) return;
    if (b.dataset.kind) { t.pin = { kind: b.dataset.kind as 'town' | 'bld', id: +b.dataset.to! }; toast(`📌 The ${info(t.kind).name} now sends to ${destName(game, t.pin)}`); }
    else { delete t.pin; toast('🔄 It sends automatically again'); }
    openCard({ kind: 'bld', id: t.id }); return;
  }
  if (b.dataset.act === 'snd') { const k = b.dataset.k as 'music' | 'sfx'; sound.unlock(); sound.set(k, !sound.settings[k]); if (sound.settings[k]) sound.set('muted', false); showMute(); renderCard(); return; }
  if (b.dataset.act === 'unmute') { sound.unlock(); sound.set('muted', false); showMute(); renderCard(); return; }
  if (b.dataset.act === 'vol') { const k = b.dataset.k as 'musicVol' | 'sfxVol'; sound.unlock(); sound.volume(k, +b.dataset.v!); showMute(); renderCard(); return; }
  if (b.dataset.act === 'full') { toggleFull(why => toast(why, 4000)); return; }
  if (b.dataset.act === 'copycode') { void saveCode(game).then(async c => { myCode = c; renderCard(); try { await navigator.clipboard.writeText(c); toast('📋 Code copied: paste it in 🏠 Home → ⚙ Settings on the other side'); } catch { toast('Press on the code below, Select all, then Copy'); } }); return; }
  if (b.dataset.act === 'copystats') { const t = cardEl.querySelector<HTMLTextAreaElement>('#stats'); if (t) { t.value = gameReport(game); void navigator.clipboard.writeText(t.value).then(() => toast('📋 Report copied: paste it in the chat'), () => { t.select(); toast('Press on the report, Select all, then Copy'); }); } return; }
  if (b.dataset.act === 'savefile') { void saveCode(game).then(c => saveFile(c)); return; }
  if (b.dataset.act === 'tips') { game.s.tipsOff = !game.s.tipsOff; toast(game.s.tipsOff ? '💡 Tips off: turn them back on here any time' : '💡 Tips on: they show up when money runs low'); renderCard(); return; }
  if (b.dataset.act === 'bugreport') { // the game and a report in one file, to attach in the chat (and copied too)
    void saveCode(game).then(async c => {
      const text = `🐞 Railhaven bug report\n\nWhat went wrong: (write it in the chat)\n\n${gameReport(game)}\n\n--- save code (paste in ⚙ Settings → 📋 Paste a code) ---\n${c}\n`;
      try { await navigator.clipboard.writeText(text); } catch { /* the file is enough */ }
      await saveFile(text, 'railhaven-bug-report.txt', '🐞 Saved railhaven-bug-report.txt (and copied): attach it in the chat and say what went wrong');
    });
    return;
  }
  if (b.dataset.act === 'buyon') { // 🚂 Your trains: one more train for this island
    const isl = +b.dataset.isl!, p = fleetByIsland(game).find(f => f.island === isl)?.price ?? 0, t = buyTrainFor(game, isl);
    if (typeof t === 'string') { toast(t); return; }
    toast(t.ferry ? `🚂 Train ${t.id} bought for ${fmtMoney(p)}: it leaves the engine shed for the dock, and a boat takes it over` : `🚂 Train ${t.id} bought for ${fmtMoney(p)}: it looks for a load by itself`); renderCard(); return;
  }
  if (b.dataset.act === 'sellon') { // 🚂 Your trains: sell one train on this island (one with no work first)
    const isl = +b.dataset.isl!, t = trainToSell(game, isl); if (!t) { toast('No train here to sell'); return; }
    if (!sellArmed || sellArmed.id !== -1 - isl || performance.now() > sellArmed.until) { sellArmed = { id: -1 - isl, until: performance.now() + 4000 }; b.innerHTML = `⚠ Tap again: sell Train ${t.id} · +${fmtMoney(trainRefund(game))}`; b.classList.add('sure'); return; }
    sellArmed = null; const v = trainRefund(game), why = sellTrain(game, t);
    if (why === 'later') { toast(`💰 Train ${t.id} is sold: it goes once it has delivered its load`); renderCard(); return; }
    if (why) { toast(why); return; }
    toast(`💰 Train ${t.id} sold · +${fmtMoney(v)}`); renderCard(); return;
  }
  if (b.dataset.act === 'selltrain') {
    const t = game.s.trains.find(x => x.id === +b.dataset.id!); if (!t) return;
    if (!sellArmed || sellArmed.id !== t.id || performance.now() > sellArmed.until) { sellArmed = { id: t.id, until: performance.now() + 4000 }; b.innerHTML = `⚠ Tap again to sell Train ${t.id} for ${fmtMoney(trainRefund(game))}`; b.classList.add('sure'); return; }
    sellArmed = null; const v = trainRefund(game), why = sellTrain(game, t);
    if (why === 'later') { toast(`💰 Train ${t.id} is sold: it goes once it has delivered its load`); renderCard(); return; }
    if (why) { toast(why); return; }
    tools.selected = null; closeCard(); toast(`💰 Train ${t.id} sold · +${fmtMoney(v)}`); return;
  }
  if (b.dataset.act === 'loadold') { const t = oldSave(); if (t) void bringOver(t); return; }
  if (b.dataset.act === 'loadpaste') { const t = (cardEl.querySelector('#pasteCode') as HTMLTextAreaElement | null)?.value ?? ''; if (t.trim()) void bringOver(t); else toast('Paste the code first'); return; }
  if (b.dataset.go !== undefined) { goMission(+b.dataset.go); return; }
  if (b.dataset.act === 'swap') { const why = swapMission(game, +b.dataset.m!); toast(why || `🎯 New mission: ${msOf(game).main?.title}`); renderCard(); return; }
  const bld = game.s.buildings?.find(x => x.id === +(b.dataset.id ?? -1));
  if (b.dataset.act === 'page' && tools.card) { openCard({ ...tools.card, page: b.dataset.page || undefined } as Card); return; }
  if (b.dataset.act === 'expedition' && bld) {
    // a big spend that grows the map for good: ask with a second tap (the artifact frame blocks confirm())
    if (!expArmed || performance.now() - expArmed > 4000) { expArmed = performance.now(); b.textContent = '⚠ Tap again to send it: the map grows for good'; b.classList.add('sure'); return; }
    expArmed = 0;
    const r = sendExpedition(game, bld); if (typeof r === 'string') { toast(r); return; }
    startGame(r.g, false);
    const near = r.fresh.filter(t => t.kind === 'town').sort((p, q) => Math.hypot(p.x - bld.x, p.y - bld.y) - Math.hypot(q.x - bld.x, q.y - bld.y))[0]; // the nearest new town
    if (near) Object.assign(game.s.camera, { x: near.x * 32 + 16, y: near.y * 32 + 16, z: 0.6 });
    const msg = `🗺 The expedition is back! ${r.islands.length} new islands charted: ${r.islands.join(', ')}. ${r.towns} towns wait to be linked.`;
    setTimeout(() => toast(msg, 7000), 800); // after the new map's own notes
    return;
  }
  if (b.dataset.act === 'fish' && bld) { const why = buyFishing(game, bld); toast(why || `🎣 ${FISHING[(bld.fish ?? 1) - 1]!.name} at the dock`); renderCard(); return; }
  if (b.dataset.act === 'ship' && bld) { const s = buyShip(game, bld); toast(typeof s === 'string' ? s : '🚢 A cargo ship is ready at the dock: it sails where goods wait'); renderCard(); return; }
  if (b.dataset.act === 'bringfrom' && bld) { const t = bringTrainFrom(game, bld, +b.dataset.to!); toast(typeof t !== 'string' ? `⛴ Train ${t.id} came over by boat and is looking for a load` : t === 'later' ? '⛴ Booked: the train sails over as soon as it has delivered its load' : t); renderCard(); return; }
  if (b.dataset.act === 'unmove' && bld) { const t = game.s.trains.find(x => x.id === +b.dataset.to!); if (t) { cancelMove(game, t); toast(`Train ${t.id} stays where it is: crossing fee paid back`); } renderCard(); return; }
  if (b.dataset.act === 'shipover' && bld) { const t = shipTrainTo(game, bld); toast(typeof t === 'string' ? t : `⛴ Train ${t.id} came over by boat and is looking for a load`); renderCard(); return; }
  if (b.dataset.act === 'trainat' && bld) { const t = buyTrainAt(game, bld); if (typeof t === 'string') toast(t); else { toast(`🚂 Train ${t.id} leaves the engine shed for the dock: a boat takes it over from there`); } renderCard(); return; }
  if (b.dataset.act === 'lvl' && bld) { const why = upgradeBuilding(game, bld); toast(why || `⬆ ${info(bld.kind).name} is now level ${bld.lvl}${(bld.tracks ?? 2) > 2 ? ` · ${bld.tracks} loading tracks` : ''}`); if (!why) { trackChanged(game); game.terrainDirty?.(footprint(game.world.n, bld)); } renderCard(); return; }
  if (b.dataset.act === 'shut' && bld) { const on = !bld.closed, why = setClosed(bld, on); toast(why || (on ? `⛔ ${INDUSTRIES[bld.kind].name} closed: barriers come down once the last train leaves` : `✅ ${INDUSTRIES[bld.kind].name} open again`)); renderCard(); return; }
  if (b.dataset.act === 'sell' && bld) { const o = sellOffer(bld), why = sellStock(game, bld); toast(why || `💸 Sold ${o.n} for ${fmtMoney(o.pay)}`); renderCard(); return; }
  if (b.dataset.act === 'remove' && bld) {
    if (!armed || armed.id !== bld.id || performance.now() > armed.until) { armed = { id: bld.id, until: performance.now() + 4000 }; renderCard(); return; }
    armed = null; const r = refundOf(bld), why = removeBuilding(game, bld);
    if (why) { toast(why); renderCard(); return; }
    trackChanged(game); game.terrainDirty?.(footprint(game.world.n, bld)); closeCard();
    toast(`🗑 ${info(bld.kind).name} removed · +${fmtMoney(r)} back`); return;
  }
  if (b.dataset.act === 'rush') { // ⭐ start a rush (paid now) or stop one (the part not delivered comes back)
    const to = { kind: b.dataset.kind as 'town' | 'bld', id: +b.dataset.id! }, k = b.dataset.good as Good;
    if (rushOf(game, to, k)) { const back = stopRush(game, to, k); toast(back ? `⭐ Rush stopped: ${fmtMoney(back)} back for the part not delivered` : '⭐ Rush stopped'); renderCard(); return; }
    const fee = rushFee(game, to, k), why = startRush(game, to, k);
    toast(why || `⭐ Rushing ${GOODS[k].name.toLowerCase()} for ${fmtMoney(fee)}: its makers send here first${rushBySea(game, to, k) ? ', by ship from another island' : ''}`); renderCard(); return;
  }
  if (b.dataset.act === 'rushamt') { // ＋20 / −20 on a factory rush
    const to = { kind: b.dataset.kind as 'town' | 'bld', id: +b.dataset.id! }, k = b.dataset.good as Good, d = +b.dataset.d!, r = rushMore(game, to, k, d);
    toast(typeof r === 'string' ? r : r >= 0 ? `⭐ ${d} more · ${fmtMoney(r)}` : `⭐ ${-d} fewer · ${fmtMoney(-r)} back`); renderCard(); return;
  }
  if (b.dataset.act === 'railto') { // 🔌 from the Orders board: Rails mode at a building that isn't joined yet
    closeCard(); lookAt(+b.dataset.x!, +b.dataset.y!); tools.setMode('rail'); toast('🛤 Drag track from your line to one end of its yard'); return;
  }
  if (b.dataset.act === 'builddock') { closeCard(); startBuild('dock'); return; }
  if (b.dataset.act === 'shipup') { const k = b.dataset.k as ShipUpKey, why = buyShipUp(game, k); toast(why || `${SHIP_UP[k].icon} ${SHIP_UP[k].name}: ${SHIP_UP[k].text(shipUpLvl(game, k))}`); renderCard(); return; }
  if (b.dataset.act === 'fleet') { const k = b.dataset.k as FleetKey, isl = b.dataset.isl !== undefined ? +b.dataset.isl : game.world.home, why = buyFleet(game, k, isl); toast(why || `${FLEET[k].icon} ${FLEET[k].name}: ${FLEET[k].text(fleetLvl(game, k, isl))}`); renderCard(); return; }
  if (b.dataset.act === 'found') {
    const p = game.s.sites.find(s => s.id === +b.dataset.id!)!, name = p.name;
    const why = foundTown(game, p);
    if (why) { toast(why); renderCard(); return; }
    toast(`🏘 ${name} founded! Lay track onto it to link it`); openCard({ kind: 'town', id: p.id }); return;
  }
  if (b.dataset.act === 'park' || b.dataset.act === 'project') {
    const t = game.s.sites.find(s => s.id === Number(b.dataset.id)); if (!t) return;
    const why = b.dataset.act === 'park' ? buyPark(game, t) : buyProject(game, t, b.dataset.k as ParkKind);
    if (why) { toast(why); return; }
    const p = game.s.parks!.at(-1)!, P = projectOf(p.k);
    game.taken = undefined; game.terrainDirty?.([p.y * game.world.n + p.x]);
    toast(P ? `${P.icon} ${P.name} opened in ${t.name}: ${P.text[0]!.toLowerCase() + P.text.slice(1)}` : `🌳 Park opened in ${t.name}: its orders are now ${parksOf(game, t).length * 5}% smaller`, 3500);
    renderCard(); return;
  }
  if (b.dataset.act === 'upgrade') {
    const t = game.s.sites.find(s => s.id === +b.dataset.id!)!, L = (t.lvl ?? 0) + 1;
    const why = upgradeTown(game, t); toast(why || `⬆ ${t.name} is now a ${sizeName(L)}! New order on its card`); renderCard();
  }
};

// Missions: the pill under the top bar opens the story card; Go › shows where to act
const pill = $('mission');
let skipArmed = 0;
pill.onclick = e => {
  const b = (e.target as HTMLElement).closest('button');
  if (lessonOn(game)) {
    if (b?.dataset.show !== undefined) { showLesson(); return; }
    if (b?.dataset.skip !== undefined) {
      if (performance.now() - skipArmed > 3000) { skipArmed = performance.now(); toast('Tap Skip again to skip the lessons'); return; }
      skipLessons(game); toast('Lessons skipped: Mira has missions for you under the top bar'); return;
    }
    game.s.lesMin = !game.s.lesMin; pill.innerHTML = lessonHtml(); return;
  }
  if (b?.dataset.go !== undefined) { goMission(+b.dataset.go); return; }
  if (tools.card?.kind === 'story') closeCard(); else openCard({ kind: 'story', id: 0 });
};
const lookAt = (x: number, y: number) => { const c = game.s.camera; c.x = (x + 0.5) * 32; c.y = (y + 0.5) * 32; };

// 💡 Money tips: when money runs low, why and one thing to do (Settings switches them off)
const tipEl = $('tip');
let tipNow: Tip | null = null, tipAsk = false, tipHideUntil = 0;
function updateTip() {
  const show = !tipAsk && tools.mode === 'pan' && !tools.card && !menuOpen && game.s.t >= tipHideUntil;
  tipNow = show ? moneyTip(game) : null;
  const h = tipAsk ? `<b class="tic">💡</b><span class="tt">Turn tips off? You can turn them back on in 🏠 Home → ⚙ Settings.</span><button class="off" data-tipoff>Turn off</button><button data-tipone>Just this one</button>`
    : tipNow ? `<b class="tic">💡</b><span class="tt">${tipNow.text.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`)}</span><button data-tipgo>Go ›</button><button class="x" data-tipx aria-label="Hide tip">✕</button>` : '';
  if (tipEl.innerHTML !== h) tipEl.innerHTML = h;
  tipEl.style.display = h ? 'flex' : 'none';
}
tipEl.onclick = e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  if (b.dataset.tipx !== undefined) { tipAsk = true; updateTip(); return; }
  if (b.dataset.tipoff !== undefined) { game.s.tipsOff = true; tipAsk = false; updateTip(); toast('💡 Tips off'); return; }
  if (b.dataset.tipone !== undefined) { tipAsk = false; tipHideUntil = game.s.t + 300; updateTip(); return; } // back in five game minutes if still needed
  if (b.dataset.tipgo !== undefined && tipNow) {
    const go = tipNow.go;
    if (go.kind === 'build') startBuild(go.what);
    else if (go.kind === 'bld') { const x = game.s.buildings?.find(q => q.id === go.id); if (x) { lookAt(x.x, x.y); openCard({ kind: 'bld', id: x.id }); } }
    else if (go.kind === 'train') { const p = (window as any).railhaven.trainAt(go.id); if (p) { game.s.camera.x = p.x; game.s.camera.y = p.y; } tools.selected = go.id; openCard({ kind: 'train', id: go.id }); }
    else openCard({ kind: 'orders', id: 0 });
    updateTip();
  }
};

function startBuild(k: IndustryKind) {
  const lock = lockedText(game, k);
  if (lock) { toast(`${lock}: fill more town orders to raise your Railway level`); return; }
  menuOpen = false;
  const spot = tools.chooseBuild(k);
  if (!spot) return;
  // the nearest spot is off screen: bring it into view (the camera moves, nothing is built)
  const c = game.s.camera, [sx, sy] = [(spot.x + 0.5) * 32, (spot.y + 0.5) * 32];
  if (Math.abs(sx - c.x) * c.z > view.w * 0.4 || Math.abs(sy - c.y) * c.z > view.h * 0.3) { c.x = sx; c.y = sy; toast('The nearest spot that fits is glowing here'); }
}
/** Go › on a mission: open the place it is about, or start the build it asks for. */
function goMission(i: number) {
  const m = missionsOf(game)[i]; if (!m) return;
  closeCard(); menuOpen = false; tools.mode = 'pan'; tools.cancel();
  const site = m.site !== undefined ? game.s.sites.find(s => s.id === m.site) : undefined, n = game.world.n;
  if (m.ty === 'build') { startBuild(m.k!); return; }
  if (m.ty === 'find') {
    const from = game.s.sites.filter(t => t.kind === 'town' && townLinked(game, t)).sort((p, q) => Math.hypot(p.x - site!.x, p.y - site!.y) - Math.hypot(q.x - site!.x, q.y - site!.y))[0] ?? ashford(game);
    lookAt(Math.round((from.x * 2 + site!.x) / 3), Math.round((from.y * 2 + site!.y) / 3));
    tools.setMode('scout'); toast(`🔭 Tap ${from.name}, then draw the scout's route into the fog`); return;
  }
  if (m.ty === 'reach') {
    const isl = game.world.islands[m.isl!]!;
    if (isRevealed(game, isl.cy * n + isl.cx)) { lookAt(isl.cx, isl.cy); startBuild('dock'); return; }
    const d = (game.s.buildings ?? []).find(b => b.kind === 'dock' && islandOfB(game, b) === game.world.home);
    if (d) { lookAt(d.x, d.y); openCard({ kind: 'bld', id: d.id, page: 'isl' }); }
    toast(`🌫 ${isl.name} is still in the fog: send a scout boat from your dock to find its shore`); return;
  }
  if (m.ty === 'fish') { const b = game.s.buildings?.find(x => x.id === m.bld); if (b) { lookAt(b.x, b.y); openCard({ kind: 'bld', id: b.id, page: 'fish' }); } return; }
  if (site) { lookAt(site.x, site.y); if (m.ty === 'order') openCard({ kind: 'town', id: site.id }); else toast(`🛤 ${m.how}`); }
}

// Lessons: the bar under the money holds the lesson; a gold ring and a hand show exactly what to tap
function lessonHtml(): string {
  const n = game.s.tut!, L = LESSONS[n]!, nice = game.s.lesAt !== undefined && game.s.t - game.s.lesAt < 3;
  if (game.s.lesMin) return `<span class="mtext">🎓 Lesson ${n + 1}/${LESSONS.length} · ${L.title} ▾</span><button data-show>Show me ›</button>`;
  return `<div class="les"><b class="lic">${L.icon}</b><div class="lbody">${nice ? '<div class="nice">✓ Nice! Next lesson</div>' : ''}<small class="cap">LESSON ${n + 1} OF ${LESSONS.length} ▴</small><b class="lt">${L.title}</b><i>${L.mira}</i><div>${lessonText(game, L)}</div>`
    + `<div class="lbtn"><button data-show>Show me ›</button><button class="skip" data-skip>Skip lessons</button></div></div></div>`;
}
const unlinked = (k: (b: import('./buildings/industries.ts').Building) => boolean) => game.s.buildings?.find(b => k(b) && !isLinked(game, b));
/** the yard end nearest the railway: where the track should reach */
function yardEnd(b: import('./buildings/industries.ts').Building) {
  const n = game.world.n, a = game.s.sites[0]!, ys = yardSquares(n, b);
  // the square just past each end of the loading track: the line comes in through it
  const out = [ys[0]! - (b.horizontal ? 1 : n), ys.at(-1)! + (b.horizontal ? 1 : n)];
  return out.sort((p, q) => Math.hypot(p % n - a.x, ((p / n) | 0) - a.y) - Math.hypot(q % n - a.x, ((q / n) | 0) - a.y))[0]!;
}
const kindFor = (n: number) => n === 0 ? 'wood' : n === 3 ? 'farm' : n === 7 ? 'sawmill' : null;
function nearTown() {
  const a = game.s.sites[0]!, n = game.world.n;
  return game.s.sites.filter((t, i) => i > 0 && t.kind === 'town' && !townLinked(game, t) && isRevealed(game, t.y * n + t.x)).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
}
/** What to tap next for this lesson: a button, or a map square. */
function lessonTarget(): { el?: Element | null; sq?: number; tip?: string } | null {
  const n = game.s.tut!, N = game.world.n, a = game.s.sites[0]!, A = a.y * N + a.x;
  const okb = $('ok') as HTMLButtonElement;
  // ✓ is the next tap only when the tool open is the one this lesson uses
  const ready = (m: Mode) => tools.mode === m && $('confirm').style.display !== 'none' && !okb.disabled;
  const k = kindFor(n);
  // the Rails button, or 🛤 Keep building when the tool has just closed after a build
  const railBtn = () => tools.againOn()?.mode === 'rail' ? { el: okb } : { el: document.querySelector('#bar [data-mode="rail"]') };
  const rail = (b: import('./buildings/industries.ts').Building) => ready('rail') ? { el: okb } : tools.mode !== 'rail' ? railBtn() : { sq: yardEnd(b), tip: 'Drag to here, then onto the blue track' };
  const loose = n === 1 ? unlinked(b => b.kind === 'wood') : n === 3 ? unlinked(b => b.kind === 'farm') : n === 8 ? unlinked(b => isFactory(b.kind)) : undefined;
  if (loose) return rail(loose);
  if (k && !(game.s.buildings ?? []).some(b => b.kind === k)) {
    if (tools.mode === 'build' && tools.buildKind === k) return ready('build') ? { el: okb } : tools.previewErr && $('near').style.display !== 'none' ? { el: $('near') } : null;
    if (menuOpen) return { el: menu.querySelector(`[data-k="${k}"]`) };
    return { el: $('buildBtn') };
  }
  if (n === 2 && !game.s.shed) return ready('rail') ? { el: okb } : tools.mode !== 'rail' ? railBtn() : null;
  if (n === 2) return ready('train') ? { el: okb } : tools.mode !== 'train' ? { el: document.querySelector('#bar [data-mode="train"]') } : null;
  if (n === 4) {
    if (tools.card?.kind === 'town' && tools.card.id === a.id) return orderDone(game, a) ? { el: cardEl.querySelector('[data-act="upgrade"]') } : null;
    return { sq: A, tip: 'Tap Ashford' };
  }
  if (n === 5) {
    const t = nearTown();
    if (t) return ready('rail') ? { el: okb } : tools.mode !== 'rail' ? railBtn() : { sq: t.y * N + t.x, tip: `Lay track into ${t.name}` };
    if (tools.mode !== 'scout') return { el: document.querySelector('#bar [data-mode="scout"]') };
    if (!tools.scout) return { sq: A, tip: 'Tap Ashford' };
    return ready('scout') ? { el: okb } : null;
  }
  return null;
}
/** Show me ›: do the first step for the player (open the right tool, bring the place into view); never builds or buys. */
function showLesson() {
  const n = game.s.tut!, a = game.s.sites[0]!, k = kindFor(n);
  closeCard(); menuOpen = false; tools.mode = 'pan'; tools.cancel();
  const loose = n === 1 ? unlinked(b => b.kind === 'wood') : n === 3 ? unlinked(b => b.kind === 'farm') : n === 8 ? unlinked(b => isFactory(b.kind)) : undefined;
  if (loose) { const e = yardEnd(loose), N = game.world.n; lookAt(Math.round(((e % N) + a.x) / 2), Math.round((((e / N) | 0) + a.y) / 2)); tools.mode = 'rail'; toast('👇 Drag from your line to the ringed square and on onto the blue loading track, then ✓ Build'); return; }
  if (k && !(game.s.buildings ?? []).some(b => b.kind === k)) { startBuild(k); toast('👇 The outline sits on a spot that fits: tap ✓ Build'); return; }
  if (n === 2 && !game.s.shed) { lookAt(a.x, a.y); tools.mode = 'rail'; toast('👇 Run a few straight squares of track off your line near Ashford: the engine shed goes beside them'); return; }
  if (n === 2) { tools.mode = 'train'; toast('👇 Tap ✓ Buy'); return; }
  if (n === 4 || n === 6) {
    const t = n === 4 ? a : game.s.sites.filter(s => s.kind === 'town' && (s === a || townLinked(game, s)) && !orderDone(game, s))[0] ?? a;
    lookAt(t.x, t.y); openCard({ kind: 'town', id: t.id }); return;
  }
  if (n === 5) {
    const t = nearTown();
    if (t) { lookAt(Math.round((t.x + a.x) / 2), Math.round((t.y + a.y) / 2)); tools.mode = 'rail'; toast(`👇 Drag track from your line into ${t.name}'s station`); return; }
    lookAt(a.x, a.y); tools.mode = 'scout'; toast('👇 Tap Ashford, then draw the route into the fog'); return;
  }
  const f = game.s.buildings?.find(b => isFactory(b.kind));
  if (f) { lookAt(f.x, f.y); openCard({ kind: 'bld', id: f.id }); }
}
const ptr = $('tutPtr');
let ringEl: Element | null = null;
function updateLesson() {
  const on = lessonOn(game);
  pill.classList.toggle('lesson', on);
  $('toast').style.top = on ? pill.getBoundingClientRect().bottom + 8 + 'px' : '';
  let t: ReturnType<typeof lessonTarget> = null;
  if (on) { const h = lessonHtml(); if (pill.innerHTML !== h) pill.innerHTML = h; pill.style.display = 'flex'; if (tools.card?.kind !== 'story') t = lessonTarget(); }
  if (ringEl !== (t?.el ?? null)) { ringEl?.classList.remove('tutHi'); ringEl = t?.el ?? null; ringEl?.classList.add('tutHi'); }
  tools.ring = t?.sq ?? null;
  let x = 0, y = 0, up = false;
  if (t?.el) { const r = t.el.getBoundingClientRect(); if (!r.width) { ptr.style.display = 'none'; return; } x = r.left + r.width / 2; up = r.top < 160; y = up ? r.bottom + 6 : r.top - 6; }
  else if (t?.sq !== undefined) { const N = game.world.n; [x, y] = toScreen(game.s.camera, view, (t.sq % N + 0.5) * 32, (((t.sq / N) | 0) + 0.5) * 32); y -= 22 * game.s.camera.z; if (x < 0 || y < 0 || x > view.w || y > view.h) { ptr.style.display = 'none'; return; } }
  else { ptr.style.display = 'none'; return; }
  ptr.className = up ? 'up' : ''; ptr.innerHTML = up ? `<span>👆</span>${t.tip ?? ''}` : `${t.tip ?? ''}<span>👇</span>`;
  ptr.style.display = 'block'; ptr.style.left = x + 'px'; ptr.style.top = (up ? y : y - ptr.offsetHeight) + 'px';
}

// Build menu: colourful tiles, one per industry
const menu = $('buildMenu');
let menuOpen = false;
function renderMenu() {
  // deposits found far out (iron, oil, the far-sea chains) show once one is uncovered; far-sea factories once their expedition went
  const far = (k: IndustryKind) => !!info(k).ring && !isFactory(k) || k === 'iron' || k === 'oil';
  const kinds = (Object.keys(INDUSTRIES) as IndustryKind[]).filter(k => far(k) ? game.s.sites.some(s => s.kind === 'dep' && s.res === k && !s.hidden) : (info(k).ring ?? 0) <= (game.s.rings ?? 0));
  // prices are per island: the island in the middle of the screen (Ashford Isle over the sea)
  const cam = game.s.camera, ci = Math.floor(cam.y / 32) * game.world.n + Math.floor(cam.x / 32), menuIsl = (game.world.islandOf[ci] ?? -1) >= 0 ? game.world.islandOf[ci]! : game.world.home;
  const tile = (k: IndustryKind) => {
    const d = info(k), p = priceOf(game, k, menuIsl), lock = lockedText(game, k);
    // factories show what goes in and what comes out, as icons: 🪵 → planks
    const recipe = isFactory(k) ? `<span class="rcp" title="${inputsOf(k).map(g => GOODS[g].name).join(' + ')} → ${GOODS[d.makes].name}">${inputsOf(k).map(g => GOODS[g].icon).join('+')}→${GOODS[d.makes].icon}</span>` : '';
    return `<button data-k="${k}" class="${tools.buildKind === k ? 'on' : ''}${lock ? ' locked' : ''}"><b>${d.icon}</b>${d.name}<small>${lock ? (d.ring && d.ring > (game.s.rings ?? 0) ? '🔒 🗺 Expedition' : '🔒 Level ' + d.unlock) : fmtMoney(p)}</small>${recipe}</button>`;
  };
  const r = recommendedBuild(game);
  menu.innerHTML = (r ? `<button data-k="${r.k}" class="rec"><b>${info(r.k).icon}</b><span style="font-size:11px;font-weight:800;color:#ffd24a;letter-spacing:.05em">⭐ RECOMMENDED NEXT BUILD${r.mission ? ' · YOUR MISSION' : ''}</span><br>${info(r.k).name} · ${fmtMoney(priceOf(game, r.k, menuIsl))}<small>${r.why}</small></button>` : '')
    + kinds.filter(k => !isFactory(k) && k !== 'dock').map(tile).join('') + `<div class="mhead">🏭 Factories: turn raw goods into products</div>` + kinds.filter(isFactory).map(tile).join('')
    + `<div class="mhead">⚓ Sea: docks reach other islands</div>` + tile('dock');
}
menu.onclick = e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  startBuild(b.dataset.k as IndustryKind);
};
$('buildBtn').onclick = () => {
  if (tools.mode === 'build' || menuOpen) { menuOpen = false; tools.setMode('pan'); tools.mode = 'pan'; tools.buildKind = null; return; }
  tools.mode = 'pan'; tools.cancel(); menuOpen = true; renderMenu();
};
// toolbar: tapping a tool again closes it
for (const b of document.querySelectorAll<HTMLButtonElement>('#bar [data-mode]')) b.onclick = () => {
  menuOpen = false;
  // 🚂 Train: your trains island by island (Buy 1 / Sell 1). The very first train is bought from the shed bar, as the lesson shows
  if (b.dataset.mode === 'train' && game.s.trains.length && game.s.shed) {
    if (tools.card?.kind === 'fleet') { closeCard(); return; }
    tools.setMode('pan'); openCard({ kind: 'fleet', id: 0 }); return;
  }
  tools.setMode(b.dataset.mode as Mode);
};
let newArmed = 0;
// 🗺 Game: a new map, or a game brought over from the old Railhaven
const OLD_KEY = 'railhaven90';
let importReport: string[] | null = null, myCode: string | null = null;
const oldSave = () => { try { return localStorage.getItem(OLD_KEY); } catch { return null; } };
const openHome = () => { menuOpen = false; tools.mode = 'pan'; tools.cancel(); myCode = null; saveTo(localStorage, game); snapPic(); openCard({ kind: 'game', id: 0 }); };
$('newGame').onclick = () => { if (tools.card?.kind === 'game') { closeCard(); return; } openHome(); };
/** Play another game: a new one goes into a new slot (refused when all are taken); one opened from a slot is already in place. */
let expArmed = 0;
function startGame(g: Game, newSlot = true) {
  if (newSlot && slotsOk) { saveTo(localStorage, game); snapPic(); const why = addSlot(localStorage, saveJson(g), g); if (why) { toast('⚠ ' + why, 5000); return false; } }
  game = g; lastSeason = -1; tools.cancel(); closeCard(); renderer = new Renderer(game, tools); saveTo(localStorage, game); return true;
}
async function bringOver(text: string) {
  try {
    toast('🚂 Bringing your game over…', 8000);
    await new Promise(r => setTimeout(r, 30));
    const mine = await readSave(text);
    if (mine) { if (startGame(mine)) toast('✅ Your game is here, in a new slot', 2500); return; }
    const o = await decodeLegacy(text);
    if (!isLegacy(o)) { toast('This save is not from the old Railhaven'); return; }
    const { g, report } = importLegacy(o);
    if (!startGame(g)) return; importReport = report; openCard({ kind: 'game', id: 0, page: 'report' }); toast('✅ Your game is here, in a new slot', 2500);
  } catch (e) { toast('⚠ ' + ((e as Error).message || 'That save could not be read')); }
}
/** Save the code as a file: through Claude's download prompt inside the Claude app, a plain browser download elsewhere. */
async function saveFile(code: string, name = 'railhaven-save.txt', done = '💾 Saved ' + name) {
  const cl = (window as any).claude;
  if (cl?.use) {
    const dl = await Promise.race([cl.use('downloads'), new Promise(r => setTimeout(() => r(null), 3000))]) as any;
    if (dl) {
      try { await dl.save({ filename: name, data: code }); toast(done, 5000); }
      catch (e: any) { if (e?.code !== 'declined') toast('This app can\'t save files here: use 📋 Copy my code instead'); }
      return;
    }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' })); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast(done, 5000);
}
const filePick = document.createElement('input'); filePick.type = 'file'; filePick.accept = '.json,.txt,application/json,text/plain';
filePick.onchange = async () => { const f = filePick.files?.[0]; filePick.value = ''; if (f) await bringOver(await f.text()); };
$('ok').onclick = () => {
  if (tools.mode === 'pan' && tools.againOn()) { if (tools.resume() === 'menu') { closeCard(); menuOpen = true; renderMenu(); } return; } // 🛤 Keep building / 🏗 Build more
  tools.confirm();
};
$('undo').onclick = () => tools.undo();
$('turn').onclick = () => tools.turn();
$('near').onclick = () => { if (tools.nearestFit() && tools.preview) { const c = game.s.camera, sx = (tools.preview.x + 1.5) * 32, sy = (tools.preview.y + 1.5) * 32; if (Math.abs(sx - c.x) * c.z > view.w * 0.4 || Math.abs(sy - c.y) * c.z > view.h * 0.3) { c.x = sx; c.y = sy; } } };
$('cancel').onclick = () => { if (tools.mode === 'map') { tools.mapPv = null; tools.mode = 'pan'; } tools.cancel(); if (tools.mode === 'train') tools.mode = 'pan'; }; // ✕ turns Train off (its bar shows while Train is on) and closes the map circle (he said its ✕ did nothing)

function updateUi() {
  for (const b of document.querySelectorAll<HTMLButtonElement>('#bar [data-mode]')) b.classList.toggle('on', b.dataset.mode === tools.mode || (b.dataset.mode === 'train' && tools.card?.kind === 'fleet'));
  $('buildBtn').classList.toggle('on', tools.mode === 'build' || menuOpen);
  $('mapBtn').classList.toggle('on', tools.card?.kind === 'map' || !!tools.view);
  $('shipsBtn').classList.toggle('on', tools.card?.kind === 'ships');
  const docks = (game.s.buildings ?? []).some(b => b.kind === 'dock') || !!game.s.ships?.length;
  if ($('shipsBtn').style.display !== (docks ? '' : 'none')) $('shipsBtn').style.display = docks ? '' : 'none';
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
  if (bar) { const h = $('hint'), r = h.style.display !== 'none' && h.offsetHeight ? h.getBoundingClientRect() : null; cb.style.bottom = r ? `${Math.round(innerHeight - r.top + 8)}px` : ''; } // sit just above the hint, however many lines it has
  if (bar) { $('ctext').textContent = bar.text; ($('ok') as HTMLButtonElement).disabled = !bar.can; $('ok').textContent = bar.ok; }
}

let lastSeason = -1;
const sound = new Sound(); let soundT = 0, cueOf: Game | null = null, memo: CueMemo | null = null;
const muteBtn = $('mute');
const showMute = () => { const m = sound.settings.muted; muteBtn.textContent = m ? '🔇' : '🔊'; muteBtn.classList.toggle('off', m); muteBtn.title = m ? 'Sound off: tap to turn it on' : 'Tap to silence the game'; };
showMute();
const fullBtn = $('full');
const fullChanged = () => { showFullBtn(fullBtn); if (tools.card?.kind === 'game') renderCard(); };
showFullBtn(fullBtn);
fullBtn.addEventListener('click', e => { e.stopPropagation(); toggleFull(why => toast(why, 4000)); });
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, fullChanged);
muteBtn.addEventListener('click', e => { e.stopPropagation(); sound.unlock(); sound.set('muted', !sound.settings.muted); showMute(); toast(sound.settings.muted ? '🔇 Sound off · tap again to hear the game' : '🔊 Sound on · volume in 🏠 Home → ⚙ Settings', 2200); if (tools.card?.kind === 'game') renderCard(); });
for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, () => sound.unlock(), { capture: true, passive: true });
let last0 = 0, last = performance.now(), saveT = 0, lastMenu = 0, lastCard = 0, newsAt = 0;
function frame(now: number) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; // the first frame time can be a little before load time
  if (idle() && !onHome() && pausedEl.style.display !== 'flex') { pausedEl.style.display = 'flex'; saveTo(localStorage, game); }
  if (!document.hidden && !idle()) { game.s.t += dt; game.sys.tick(dt); tickProduction(game, dt); tickTowns(game, dt); tickTrains(game, dt); if (Math.floor(game.s.t / 5) !== Math.floor((game.s.t - dt) / 5)) checkStuck(game); if (+tickBreaks(game) + +tickEvents(game, dt)) breaksChanged(game); }
  { const se = seasonOf(game.s.t); if (se !== lastSeason) { if (lastSeason >= 0) (game.news ??= []).push(`${SEASONS[se]} has come`); lastSeason = se; } }
  sound.season = seasonOf(game.s.t); sound.pause(document.hidden || idle());
  if (now - soundT > 100) {
    soundT = now; sound.update(hearScene(game, view));
    if (cueOf !== game || !memo) { cueOf = game; memo = cueMemo(game); } else sound.cue(cues(game, view, memo)); // a new or loaded game starts quiet
  }
  if (game.news?.length && now > newsAt && !(tools.card?.kind === 'story' && tools.card.page === 'act')) { toast(game.news.shift()!, 4000); newsAt = now + 4200; }
  if (Math.floor(now / 1000) !== lastCard) {
    lastCard = Math.floor(now / 1000);
    checkArrivals(game); // islands just reached queue their arrival card
    const M = msOf(game); // a new act opens its card once nothing else is open
    if (M.actNew && !tools.card && tools.mode === 'pan' && !menuOpen && !tools.againOn()) { M.actNew = false; openCard({ kind: 'story', id: 0, page: 'act' }); }
    else if ((game.arrived?.length || game.reported?.length) && (lessonOn(game) || onHome())) { game.arrived = []; game.reported = []; }
    else if (game.arrived?.length && !tools.card && tools.mode === 'pan' && !menuOpen && !tools.againOn()) openCard({ kind: 'isle', id: game.arrived.shift()!, fresh: true }); // 🏝 a new island
    else if (game.reported?.length && !tools.card && (tools.mode === 'pan' || tools.mode === 'scout') && !tools.scout && !menuOpen && !tools.againOn()) { // 🧭 a scout is back: its report
      const id = game.reported.pop()!; game.reported = [];
      game.news = (game.news ?? []).filter(m => !/is back: the map is drawn/.test(m));
      openCard({ kind: 'scout', id });
    }
    else if (game.found?.length && (lessonOn(game) || onHome())) game.found = []; // no discovery cards during the lessons
    else if (game.found?.length && !tools.card && tools.mode === 'pan' && !menuOpen && !tools.againOn()) { // a landmark just spotted: its discovery card
      const [id, ...rest] = game.found; game.found = [];
      const names = new Set([id, ...rest].map(i => poisOf(game).find(p => p.id === i)).filter(p => p && p.kind !== 'wreck').map(p => `${POI[p!.kind].name} found`));
      game.news = (game.news ?? []).filter(m => ![...names].some(nm => m.includes(nm))); // the card says it: no toast too
      openCard({ kind: 'find', id: id!, more: rest.length });
    }
    renderCard();
    if (!lessonOn(game)) { const ph = missionPill(game); if (pill.innerHTML !== ph) pill.innerHTML = ph; pill.style.display = ph ? 'flex' : 'none'; }
    updateTip();
  }
  saveT += dt; if (saveT > 5) { saveT = 0; saveTo(localStorage, game); }
  renderer.draw(ctx, view, dpr, now / 1000);
  updateHud(hud, game);
  updateUi();
  if (Math.floor(now / 120) !== Math.floor(last0 / 120)) updateLesson(); last0 = now;
  requestAnimationFrame(frame);
}
addEventListener('visibilitychange', () => { if (document.hidden) saveTo(localStorage, game); });
// 👁 Map: the map views and Go to; tapping it again closes the card
const viewTag = $('viewTag');
function setView(v: MapView | null) {
  tools.view = v; const d = VIEWS.find(x => x.k === v);
  viewTag.style.display = d ? 'flex' : 'none';
  if (d) viewTag.querySelector('span')!.innerHTML = `<b>${d.b}</b><br><small>${d.d}</small>`;
}
viewTag.onclick = e => { if ((e.target as HTMLElement).closest('button')) setView(null); };
// 🚢 Ships: shows once you have a dock; tapping it again closes it
$('shipsBtn').onclick = () => {
  if (tools.card?.kind === 'ships') { closeCard(); return; }
  menuOpen = false; tools.mode = 'pan'; tools.cancel(); openCard({ kind: 'ships', id: 0 });
  // frame every dock on a sea route in the part of the screen the card leaves free
  const ids = new Set(seaLanes(game).flatMap(l => [l.a, l.b])), ds = (game.s.buildings ?? []).filter(b => ids.has(b.id)); if (!ds.length) return;
  const xs = ds.map(b => b.x), ys = ds.map(b => b.y), wide = view.w >= 700, fw = wide ? view.w - 380 : view.w, fh = wide ? view.h : view.h * 0.45, c = game.s.camera;
  c.z = Math.max(0.15, Math.min(1.4, 0.8 * fw / ((Math.max(...xs) - Math.min(...xs) + 6) * 32), 0.8 * fh / ((Math.max(...ys) - Math.min(...ys) + 6) * 32)));
  c.x = ((Math.min(...xs) + Math.max(...xs)) / 2 + 2) * 32 + (wide ? 190 / c.z : 0); c.y = ((Math.min(...ys) + Math.max(...ys)) / 2 + 1) * 32 + (wide ? 0 : (view.h / 2 - fh / 2 - 60) / c.z);
};
$('mapBtn').onclick = () => { if (tools.card?.kind === 'map') { closeCard(); return; } menuOpen = false; tools.mode = 'pan'; tools.cancel(); openCard({ kind: 'map', id: 0 }); };
cardEl.addEventListener('input', e => {
  const q = (e.target as HTMLInputElement); if (q.id !== 'mapQ') return;
  const v = q.value.trim().toLowerCase();
  for (const gr of cardEl.querySelectorAll<HTMLElement>('.ggrp')) {
    let any = false;
    for (const b of gr.querySelectorAll<HTMLElement>('.goto')) { const ok = !v || b.dataset.q!.includes(v); b.style.display = ok ? '' : 'none'; any ||= ok; }
    gr.style.display = any ? '' : 'none';
  }
});
// 📋 the Railway level chip opens the Orders board
hud.onclick = e => { if ((e.target as HTMLElement).closest('[data-orders]')) { if (tools.card?.kind === 'orders') closeCard(); else { menuOpen = false; tools.mode = 'pan'; tools.cancel(); openCard({ kind: 'orders', id: 0 }); } } };
// no money piles up while nobody is playing: after 3 minutes without a touch the game pauses until the next one (Sébastien)
const IDLE_S = 180, pausedEl = $('paused');
let lastTouch = performance.now();
for (const ev of ['pointerdown', 'keydown', 'wheel'] as const) addEventListener(ev, () => { lastTouch = performance.now(); if (pausedEl.style.display === 'flex') pausedEl.style.display = 'none'; }, { capture: true, passive: true });
/** the home screen pauses the game behind it */
const onHome = () => tools.card?.kind === 'game' && isHomePage(tools.card.page);
const idle = () => onHome() || performance.now() - lastTouch > IDLE_S * 1000;
// the game opens on the home screen (automated checks skip it unless they ask for it with ?home)
if (!(navigator.webdriver && !params.has('home')) && !params.has('new') && !params.has('seed')) openHome();
setupPwa(() => renderCard());
requestAnimationFrame(frame);
