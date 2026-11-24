import { stationsText } from '../track/joins.ts';
import { restoreShed, type Shed } from '../buildings/shed.ts';
import { shipPlace } from '../ships/ships.ts';
import type { Game, Site } from '../state.ts';
import { islandName } from '../ships/docks.ts';
import { boatRoute, MAX_SCOUTS, SCOUT_CAP, scoutCost, scoutStarts, scoutStepError, sendScout } from '../world/explore.ts';
import { trackChanged } from '../game.ts';
import { type BuiltStroke, buildPlan, extendPlan, isAnchor, type PaintPlan, planCost, planError, startPlan, undoStroke, yardStart } from '../track/paint.ts';
import { planSupplies } from '../track/paint.ts';
import { fr } from '../frontier/frontier.ts';
import { removeSquare } from '../track/edit.ts';
import { passingLoop } from '../track/loops.ts';
import { BRIDGE_UPKEEP, TRACK_COST } from '../track/rules.ts';
import { buyTrain, trainPrice } from '../economy/dispatch.ts';
import { bodyPoint, trainLength } from '../trains/train.ts';
import { fmtMoney, toast } from './hud.ts';
import type { Card } from './cards.ts';
import { badSquares, bestPlacement, build, footprint, INDUSTRIES, type IndustryKind, isLinked, placeError, placementsAt, priceOf, islandAtYard, shareAt, harmOf, harmText, nearestSpot, noSpotText, lockedText, linkedSquares, yardSquares, yardLen, DOCK_LEN, yardSet, MINES } from '../buildings/industries.ts';
import { refundOf, removeBuilding } from '../economy/upgrades.ts';
import { townLinked } from '../economy/towns.ts';
import { hallOf } from '../buildings/stations.ts';

/** said when a double-track drag or tap reaches a station platform or a building's loading tracks */
const TWIN_NOTE = '🚉 Stations and buildings already have two tracks: those squares are skipped';
import { placeName } from './orders.ts';
import { buyMap, findsText, mapAt, mapCost, mapFinds, mappedShare, rumours, talkOf } from '../world/maps.ts';
import { isRevealed } from '../world/fog.ts';

type Placement = ReturnType<typeof placementsAt>[number];

export type Mode = 'pan' | 'rail' | 'double' | 'remove' | 'train' | 'build' | 'scout' | 'map';

export const MODE_HINT: Record<Mode, string> = {
  pan: '',
  rail: '🛤 Drag out from your track (Ashford at first), or from a new building\'s gold end square to your track. Join a town along its arrows: across its square, past it, or ending beside it. Your line waits while you scroll. ✓ Build when done.',
  double: '═ Tap single track for a 🔁 passing loop, or drag along your track to double it. Trains keep right like cars: one lane each way. 🚉 Stations and buildings have two tracks already.',
  remove: '✂ Tap track squares to pick them, or drag along your track to pick a run. Tap a picked square again to drop it.',
  train: '🚂 Trains roll out of the engine shed and run themselves: each takes the best waiting load where it is needed.',
  build: '🏗 Drag the picture where you want it. Blue row = loading track: your rails join it in line, at either end (gold arrows). Tap a ⟳ corner to turn it, double-tap it to build. ↶ Undo takes it back.',
  scout: '🔭 Tap a glowing town (scouts on foot: drag or tap their route) or dock (a boat: tap where it should sail, it finds its way over the water). A 🗺 map (on a town card) shows where to look.',
  map: '🗺 Tap open land, sea or fog to move the circle (a town or building opens its card). A map marks hidden towns and landmarks in it with ?. Green circles are already mapped. If it finds nothing, you get half back.',
};

/** The build tools: what the player is doing, and the confirm bar it needs. */
export class Tools {
  mode: Mode = 'pan';
  plan: PaintPlan | null = null;
  dbl = new Set<number>();
  /** the "already two tracks" note was shown during this drag */
  private twinNoted = false;
  /** Remove mode: the track squares picked to remove together */
  rm = new Set<number>();
  /** a remove drag: whether it picks or drops squares, the square it is on, and whether it has left its first square */
  private rmDrag: { add: boolean; at: number; moved: boolean } | null = null;
  /** a drag just picked squares: the tap that ends it is not a toggle */
  private rmSkipTap = false;
  /** what removing the picked squares would cut off, for the picks it was worked out for */
  private rmCutFor = ''; private rmCut = '';
  /** the building just built: Undo takes it back with a full refund (until the next build, or for a minute) */
  lastBuild: { id: number; paid: number; at: number; before: [number, number | null][]; shed?: Shed | null } | null = null;
  /** when the outline was last tapped (a second tap soon after builds it) */
  private outlineTapAt = 0;
  selected: number | null = null;
  /** the open card (town, building or train), shown on the map too */
  card: Card | null = null;
  /** the map view shown (👁 Map), or none */
  view: import('./mapviews.ts').MapView | null = null;
  flash: { square: number; until: number } | null = null;
  /** a landmark just tapped: its gift's reach is drawn for a few seconds */
  poiSel: { id: number; until: number } | null = null;
  /** lesson ring: the square to tap next */
  ring: number | null = null;
  /** the last stroke built, while it can still be undone */
  lastStroke: BuiltStroke | null = null;
  /** Build mode: the kind chosen, squares that glow, and the spot being previewed */
  buildKind: IndustryKind | null = null;
  glow = new Set<number>();
  private glowKey = '';
  /** the building being placed: a 2×4 (dock 2×3) outline the player drags around (red when it can't go there) */
  preview: Placement | null = null;
  previewErr = '';
  /** the outline squares that can't be used (drawn red; the rest keep their colours) */
  previewBad = new Set<number>();
  private dragOff: [number, number] | null = null;
  /** Scout mode: the route being drawn (from a town on foot, or a dock by boat) */
  scout: { path: number[]; boat: boolean; name: string } | null = null;
  /** Map mode: the circle a map would cover */
  mapPv: { x: number; y: number; r: number; near: string } | null = null;
  /** when ✓ Buy was first tapped: a map is bought only on a second tap within MAP_ARM_MS (he bought one by accident) */
  mapArm = 0;
  /** just built: the tool has closed, and for a few seconds the bar offers to carry on (🛤 Keep building) and ↶ Undo */
  again: Again | null = null;

  constructor(private g: () => Game) {}

  setMode(m: Mode) {
    this.mode = this.mode === m ? 'pan' : m; // tapping a tool again closes it
    this.cancel();
  }

  /** the "Keep building" offer, while it is still showing */
  againOn(): Again | null {
    if (this.again && (performance.now() > this.again.until || this.mode !== 'pan')) this.again = null;
    return this.again;
  }

  /** After a build the tool closes (the map pans freely again); the bar offers to carry on for a few seconds. */
  private closeAfter(a: Omit<Again, 'until'>) {
    this.mode = 'pan'; this.cancel();
    this.again = { ...a, until: performance.now() + AGAIN_MS };
  }

  /** 🛤 Keep building: reopen the tool that just closed (rails: no line chosen yet, so a new one can start anywhere on the network).
   *  Returns 'menu' when the build menu should open (main.ts owns it). */
  resume(): 'menu' | '' {
    const a = this.againOn(); if (!a) return '';
    this.again = null;
    if (a.mode === 'menu') return 'menu';
    this.mode = a.mode; this.cancel();
    if (a.mode === 'rail') toast(a.join ? '🛤 Drag between your track and either end of the building\'s loading track' : '🛤 Start anywhere on your track: drag out from it, or tap it then tap where the line goes');
    return '';
  }

  mapArmed() { return this.mapArm > 0 && performance.now() - this.mapArm < MAP_ARM_MS; }

  /** Open Map mode with the circle centred on (x, y): a town or dock on the railway. */
  openMap(x: number, y: number): string {
    const m = mapAt(this.g(), x, y); if (typeof m === 'string') return m;
    this.mode = 'map'; this.cancel(); this.mapPv = m; this.mapArm = 0; return '';
  }

  cancel() { this.again = null; if (this.mode !== 'map') this.mapPv = null; this.scout = null; this.plan = null; this.dbl.clear(); this.rm.clear(); this.rmDrag = null; this.rmSkipTap = false; this.preview = null; this.previewErr = ''; this.dragOff = null; if (this.mode !== 'build') this.buildKind = null; }

  /** choose what to build: glowing squares show where it fits */
  /**
   * Start placing a building. With a view (picked from the Build menu) the outline stays where the player is
   * looking: on the nearest spot that fits inside the view, else on the nearest deposit of its kind in view (red,
   * with the exact reason), else in the middle (red). A fit further away is only named in `away`, never jumped to.
   * Without a view (Go › / Show me) it goes to the nearest spot that fits.
   */
  chooseBuild(k: IndustryKind, view?: { hw: number; hh: number }): { spot: { x: number; y: number }; away?: string } | null {
    this.mode = 'build'; this.buildKind = k; this.preview = null; this.glowKey = '';
    const g = this.g(), c = g.s.camera, cx = Math.floor(c.x / 32), cy = Math.floor(c.y / 32), n = g.world.n;
    const inView = (x: number, y: number) => !view || (Math.abs(x + 0.5 - c.x / 32) <= view.hw && Math.abs(y + 0.5 - c.y / 32) <= view.hh);
    const spot = nearestSpot(g, k, cx, cy);
    if (spot && inView(spot.x, spot.y)) { this.setPreview(bestPlacement(g, k, spot.x, spot.y).place!); return { spot }; }
    // nothing fits in view: show the outline here anyway, red, with the reason
    const dep = MINES.has(k) ? g.s.sites.filter(s => s.kind === 'dep' && s.res === INDUSTRIES[k].makes && !s.hidden && inView(s.x, s.y))
      .sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy))[0] : undefined;
    if (dep) this.moveTo(dep.x, dep.y);
    else this.setPreview({ kind: k, ...placeAround(true, 1, cx, cy, k === 'dock' ? DOCK_LEN : 4) });
    if (!spot) { toast(noSpotText(k)); return null; }
    let town: Site | undefined, bd = Infinity;
    for (const t of g.s.sites) if (t.kind === 'town' && (t.pop ?? 0) > 0) { const d = Math.hypot(t.x - spot.x, t.y - spot.y); if (d < bd) { bd = d; town = t; } }
    const isl = islandName(g, g.world.islandOf[spot.y * n + spot.x]!);
    return { spot, away: `${town ? `near ${town.name}, ` : ''}${isl === 'Small island' ? 'on a small island' : `on ${isl}`}` };
  }

  private setPreview(p: Placement) {
    const g = this.g();
    if (p.kind === 'dock' && p.len !== DOCK_LEN) p = { ...p, len: DOCK_LEN }; // every new dock is 3 squares long
    else if (p.kind !== 'dock' && p.len !== undefined) { const { len: _, ...q } = p; p = q; }
    this.preview = p;
    this.previewErr = lockedText(g, p.kind) || placeError(g, p);
    this.previewBad = new Set(this.previewErr ? badSquares(g, p) : []);
  }

  /** Move the outline to the nearest spot that fits, from where it is now (only when the player asks). */
  nearestFit(): boolean {
    const g = this.g(), p = this.preview; if (!p) return false;
    const [cx, cy] = centreOf(p), spot = nearestSpot(g, p.kind, Math.round(cx), Math.round(cy));
    const at = spot ? bestPlacement(g, p.kind, spot.x, spot.y).place : null;
    if (!at) { toast(noSpotText(p.kind)); return false; }
    this.setPreview(at); return true;
  }

  /** Move the outline so the tapped square is in its building row (keeping the way it faces if that fits). */
  private moveTo(x: number, y: number) {
    const g = this.g(), k = this.buildKind!, cur = this.preview;
    const same = cur ? placementsAt(k, x, y).filter(p => p.horizontal === cur.horizontal && p.side === cur.side && !placeError(g, p)) : [];
    const best = same[0] ?? bestPlacement(g, k, x, y).place;
    if (best) { this.setPreview(best); return; }
    const h = cur?.horizontal ?? true, side = cur?.side ?? 1;
    // nothing fits here: show it anyway, red, with the tapped square in its building row
    this.setPreview(h ? { kind: k, x: x - 1, y: y - side, horizontal: h, side } : { kind: k, x: x - side, y: y - 1, horizontal: h, side });
  }

  /** recompute the glowing squares around the view (cheap enough to call each frame: cached on what matters) */
  updateGlow(cx: number, cy: number) {
    const g = this.g();
    if (this.mode !== 'build' || !this.buildKind) { this.glow.clear(); return; }
    const key = `${this.buildKind}/${g.track.size}/${g.s.buildings?.length ?? 0}/${cx >> 3}/${cy >> 3}`;
    if (key === this.glowKey) return;
    this.glowKey = key; this.glow.clear();
    const R = 14;
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++)
      if (bestPlacement(g, this.buildKind, x, y).place) this.glow.add(y * g.world.n + x);
  }

  /** The line's end or a track square right next to i (within one square), to start a drag from. */
  private nearStart(i: number): number | null {
    const g = this.g(), n = g.world.n, x = i % n, y = (i / n) | 0, end = this.plan?.path.at(-1);
    let best: number | null = null, bd = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = (y + dy) * n + x + dx, d = Math.abs(dx) + Math.abs(dy) - (j === end ? 0.5 : 0);
      if ((j === end || isAnchor(g, j)) && d < bd) { bd = d; best = j; }
    }
    return best;
  }

  /**
   * Run the line from its end to square i: straight on first, then one turn (the other way round if that is blocked).
   * Stops at the first square that can't take track and says why.
   */
  private extendTo(i: number) {
    const g = this.g(), n = g.world.n, p = this.plan!; const path0 = [...p.path];
    const last = path0.at(-1)!, prev = path0.at(-2), lx = last % n, ly = (last / n) | 0, tx = i % n, ty = (i / n) | 0;
    const goingX = prev === undefined ? Math.abs(tx - lx) >= Math.abs(ty - ly) : Math.abs(prev - last) === 1;
    const corners = goingX ? [ly * n + tx, ty * n + lx] : [ty * n + lx, ly * n + tx];
    let best: { path: number[]; refused?: PaintPlan['refused'] } | null = null;
    for (const c of corners) {
      p.path = [...path0]; p.refused = undefined;
      extendPlan(g, p, c); if (!p.refused) extendPlan(g, p, i);
      const got = { path: [...p.path], refused: p.refused };
      if (!got.refused && got.path.at(-1) === i) { best = got; break; }
      if (!best || got.path.length > best.path.length) best = got;
    }
    p.path = best!.path; p.refused = undefined;
    if (best!.refused) this.refuse(best!.refused.square, best!.refused.why);
  }

  /** a dragged square joins the double-track selection, unless it has two tracks already (said once per drag) */
  private markDouble(i: number) {
    if (!this.g().net.twin?.has(i)) { this.dbl.add(i); return; }
    if (!this.twinNoted) { this.twinNoted = true; toast(TWIN_NOTE, 4000); }
  }

  private refuse(square: number, why: string) { this.flash = { square, until: performance.now() + 900 }; toast(why); }

  // ---- painting
  dragStart(i: number): boolean {
    const g = this.g(), n = g.world.n;
    if (this.mode === 'build' && this.preview && footprint(n, this.preview).includes(i)) { // grab the outline
      this.dragOff = [(i % n) - this.preview.x, ((i / n) | 0) - this.preview.y]; return true;
    }
    if (this.mode === 'rail') {
      const pl = this.plan, end = pl?.path.at(-1);
      if (pl && end !== undefined) { // a line is being drawn: it stays put until ✓ Build or ✕. Only its own end (or its new squares) paints; any other drag pans
        if (i === end || (pl.path.includes(i) && !g.track.has(i))) { pl.path = pl.path.slice(0, pl.path.indexOf(i) + 1); return true; }
        if (Math.abs((i % n) - (end % n)) <= 1 && Math.abs(((i / n) | 0) - ((end / n) | 0)) <= 1) { this.dragOver(i); return true; } // fingers are wide
        return false;
      }
      const p = startPlan(g, i);
      if (p) { this.plan = p; return true; }
      // a drag that starts just beside the end of the line or the track still paints (fingers are wide)
      const near = this.nearStart(i); if (near === null) return false;
      this.plan = { path: [near] };
      this.dragOver(i); return true;
    }
    if (this.mode === 'double') { if (!g.track.has(i)) return false; this.twinNoted = false; this.markDouble(i); return true; }
    if (this.mode === 'remove') { // a drag that starts on track picks squares along it (or drops them, if it starts on a picked one); elsewhere it pans
      if (!g.track.has(i)) return false;
      this.rmDrag = { add: !this.rm.has(i), at: i, moved: false }; this.rmSkipTap = false; return true;
    }
    if (this.mode === 'scout') {
      if (this.scout && this.scout.path.includes(i)) { this.scout.path = this.scout.path.slice(0, this.scout.path.indexOf(i) + 1); return true; }
      const st = this.scoutStartAt(i); if (st) { this.scout = { path: [st.sq], boat: st.boat, name: st.name }; return true; }
      return false;
    }
    return false;
  }

  /** A place scouts can leave from, at or right next to square i. */
  private scoutStartAt(i: number) {
    const g = this.g(), n = g.world.n;
    return scoutStarts(g).find(s => Math.abs((s.sq % n) - (i % n)) <= 1 && Math.abs(((s.sq / n) | 0) - ((i / n) | 0)) <= 1) ?? null;
  }

  /** Run the scout route on to square i: straight steps, across then down (stops at the first square it can't take, and says why). */
  private scoutTo(i: number) {
    const g = this.g(), n = g.world.n, sc = this.scout!;
    if (sc.path.includes(i)) { sc.path = sc.path.slice(0, sc.path.indexOf(i) + 1); return; } // back along the route: shorten it
    if (sc.boat) { // ⛵ a boat finds its own way over the water to the square tapped
      if (isRevealed(g, i) && g.world.terr[i]) { this.refuse(i, 'Boats stay on the water: tap the sea, or a town for scouts on foot'); return; }
      const left = SCOUT_CAP.sea - (sc.path.length - 1);
      if (left <= 0) { this.refuse(i, `A boat goes at most ${SCOUT_CAP.sea} squares in one trip`); return; }
      const way = boatRoute(g, sc.path.at(-1)!, i, left, new Set(sc.path));
      if (!way) { this.refuse(i, 'No way over the water to there that the boat knows of'); return; }
      sc.path.push(...way);
      if (way.at(-1) !== i) toast(`⛵ A boat goes at most ${SCOUT_CAP.sea} squares in one trip: the route stops there`);
      return;
    }
    let cur = sc.path.at(-1)!;
    const tx = i % n, ty = (i / n) | 0;
    while (cur !== i) {
      const cx = cur % n, cy = (cur / n) | 0;
      const nx = cx !== tx ? cur + Math.sign(tx - cx) : cur + Math.sign(ty - cy) * n;
      const e = scoutStepError(g, sc.path, nx, sc.boat);
      if (e) { this.refuse(nx, e); return; }
      sc.path.push(nx); cur = nx;
    }
  }

  dragOver(i: number) {
    const g = this.g(), n = g.world.n;
    if (this.mode === 'build' && this.preview && this.dragOff) {
      const p = { ...this.preview, x: (i % n) - this.dragOff[0], y: ((i / n) | 0) - this.dragOff[1] };
      if (p.x !== this.preview.x || p.y !== this.preview.y) this.setPreview(p);
      return;
    }
    if (this.mode === 'rail' && this.plan) {
      extendPlan(g, this.plan, i);
      if (this.plan.refused) { this.refuse(this.plan.refused.square, this.plan.refused.why); this.plan.refused = undefined; }
    }
    if (this.mode === 'double' && g.track.has(i)) this.markDouble(i);
    if (this.mode === 'remove' && this.rmDrag && i !== this.rmDrag.at) this.rmDragTo(i);
    if (this.mode === 'scout' && this.scout && this.scout.path.at(-1) !== i) this.scoutTo(i);
  }

  /** A remove drag moves on to square i: every track square on the way is picked (or dropped), even if the finger skipped some. */
  private rmDragTo(i: number) {
    const g = this.g(), n = g.world.n, d = this.rmDrag!, ax = d.at % n, ay = (d.at / n) | 0, bx = i % n, by = (i / n) | 0;
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)), mark = (q: number) => { if (!g.track.has(q)) return; if (d.add) this.rm.add(q); else this.rm.delete(q); };
    if (!d.moved) { d.moved = true; this.rmSkipTap = true; mark(d.at); }
    for (let k = 1; k <= steps; k++) mark(Math.round(ay + (by - ay) * k / steps) * n + Math.round(ax + (bx - ax) * k / steps));
    d.at = i;
  }

  /** Towns and buildings that removing the picked squares would cut off the railway ('' when nothing; worked out once per pick). */
  removeCut(): string {
    const key = [...this.rm].join(',');
    if (key !== this.rmCutFor) { this.rmCutFor = key; this.rmCut = this.rm.size ? cutText(this.g(), [...this.rm]) : ''; }
    return this.rmCut;
  }

  /** Switch a four-way square between a flat crossing (lines go straight over) and a junction (trains may turn). Free. */
  private flipCrossing(i: number) {
    const g = this.g(), sq = g.track.get(i)!;
    if (g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]!.squares.includes(i)))) { toast('A train is on this square: try again when it has passed'); return; }
    if (sq.cross) delete sq.cross; else sq.cross = true;
    trackChanged(g); g.terrainDirty?.([i]);
    toast(sq.cross ? '✚ Crossing: trains go straight over here, no turning · tap again to make it a junction' : '🔀 Junction: trains can turn here · tap again to make it a crossing', 3500);
  }

  tapSquare(i: number): boolean {
    const g = this.g(), n = g.world.n;
    if (this.mode === 'rail') {
      const last = this.plan?.path.at(-1);
      // a line is being drawn: a tap anywhere runs it on from its end (it never starts a new line: ✕ does that)
      if (last !== undefined && last !== i) { this.extendTo(i); return true; }
      if (isAnchor(g, i)) {
        if (g.track.get(i)?.links === 15 && (!this.plan || this.plan.path.length <= 1)) { this.plan = null; this.flipCrossing(i); return true; } // a four-way square: crossing ⇄ junction
        if (last === i) return true;
        this.plan = { path: [i] }; toast('Now tap where the line should go (or drag)'); return true;
      }
      const ys = last === undefined ? yardStart(g, i) : null;
      if (ys) { this.plan = { path: ys }; toast('🛤 Line starts at the building: tap or drag on to your track, then ✓ Build'); return true; }
      if (!this.plan && g.s.sites.some(s => s.kind === 'plot' && s.y * n + s.x === i)) return false; // the flag: its card opens
      toast('Start from your track, Ashford, or an end of a new building\'s loading track'); return true;
    }
    if (this.mode === 'double') {
      if (!g.track.has(i)) return true;
      if (g.net.twin?.has(i)) { this.dbl.delete(i); toast(TWIN_NOTE, 4000); return true; }
      if (!this.dbl.size && !g.track.get(i)!.dbl) { // a first tap on single track: a passing loop, long enough for your trains
        const loop = passingLoop(g, i);
        if (typeof loop === 'string') { this.dbl.add(i); toast(`${loop}. This square is marked: tap or drag more squares to double`, 4000); return true; }
        for (const q of loop) if (!g.net.twin?.has(q)) this.dbl.add(q);
        toast(`🔁 Passing loop: ${loop.length} squares. A train waits on one track while another passes on the other. Tap ✓ Double`, 4000); return true;
      }
      if (this.dbl.has(i)) this.dbl.delete(i); else this.dbl.add(i);
      return true;
    }
    if (this.mode === 'build' && this.buildKind) {
      if (this.preview && turnSquares(n, this.preview).includes(i)) { this.turn(); return true; } // a corner arrow: turn it
      if (this.preview && footprint(n, this.preview).includes(i)) { // a tap on the outline: a second tap soon after builds it
        this.dragOff = null; const now = performance.now();
        if (now - this.outlineTapAt < 450 && !this.previewErr) { this.outlineTapAt = 0; this.confirm(); } else this.outlineTapAt = now;
        return true;
      }
      this.moveTo(i % n, (i / n) | 0);
      return true;
    }
    if (this.mode === 'scout') {
      if (this.scout && this.scout.path.length && !this.scoutStartAt(i)) { this.scoutTo(i); return true; }
      const st = this.scoutStartAt(i);
      if (st) { this.scout = { path: [st.sq], boat: st.boat, name: st.name }; toast(st.boat ? `⛵ Now tap the sea where the boat should sail: ${fmtMoney(scoutCost(1, true))} a square` : `🚶 Now draw where the scout should walk from ${st.name}`); return true; }
      toast(scoutStarts(g).length ? 'Scouts leave from a glowing town or dock on your railway' : 'Join a town to your railway first: scouts leave from there'); return true;
    }
    if (this.mode === 'remove') {
      const skip = this.rmSkipTap; this.rmSkipTap = false; this.rmDrag = null;
      if (skip) return true; // the drag already picked its squares
      if (this.rm.has(i)) this.rm.delete(i); else if (g.track.has(i)) this.rm.add(i); else toast('No track here');
      return true;
    }
    if (this.mode === 'train') return true;
    if (this.mode === 'map') { const m = mapAt(g, i % n, (i / n) | 0); if (typeof m === 'string') toast(m); else { this.mapPv = m; this.mapArm = 0; } return true; }
    return false;
  }

  /** Turn the outline a quarter turn about its middle (it may turn red: the bar says why). */
  turn() {
    const p = this.preview; if (!p) return;
    const ways: [boolean, 1 | -1][] = [[true, 1], [false, -1], [true, -1], [false, 1]];
    const k = ways.findIndex(([h, s]) => h === p.horizontal && s === p.side), [h, side] = ways[(k + 1) % 4]!;
    const [cx, cy] = centreOf(p);
    // prefer a nearby spot that fits this way round, so a turn next to an obstacle still works
    const g = this.g();
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = { kind: p.kind, ...placeAround(h, side, cx + dx, cy + dy, yardLen(p)), ...(p.len ? { len: p.len } : {}) };
      if (!placeError(g, q)) { this.setPreview(q); return; }
    }
    this.setPreview({ kind: p.kind, ...placeAround(h, side, cx, cy, yardLen(p)) });
  }

  /** a tap near a train selects it */
  tapWorld(wx: number, wy: number): boolean {
    const g = this.g();
    for (const t of g.s.trains) for (let u = 0; u <= trainLength(t); u += 4) {
      const p = bodyPoint(g.net, t, u);
      if (Math.hypot(p.x - wx, p.y - wy) < 10) { this.selected = this.selected === t.id ? null : t.id; this.card = this.selected === null ? null : { kind: 'train', id: t.id }; return true; }
    }
    const n = g.world.n, sq = Math.floor(wy / 32) * n + Math.floor(wx / 32);
    for (const s of g.s.ships ?? []) { // ships: a tap near the hull opens its card
      // a tap on the dock itself opens the dock, even with a ship moored right beside it (he kept getting the ship)
      if (s.to === undefined) { const d = g.s.buildings?.find(b => b.id === s.at); if (d && footprint(n, d).includes(sq)) continue; }
      const p = shipPlace(g, s);
      if (Math.hypot((p.x + 0.5) * 32 - wx, (p.y + 0.5) * 32 - wy) < 16) { this.selected = null; this.card = this.card?.kind === 'ship' && this.card.id === s.id ? null : { kind: 'ship', id: s.id }; return true; }
    }
    return false;
  }

  /** can the last stroke be undone right now (no train on its new squares)? */
  /** The building Undo would take back, if any. */
  undoBuilding() {
    const g = this.g(), lb = this.lastBuild;
    if (!lb || performance.now() - lb.at > 60000) return null;
    const b = g.s.buildings?.find(x => x.id === lb.id); if (!b) return null;
    const yard = new Set(yardSquares(g.world.n, b));
    if (g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]!.squares.some(q => yard.has(q))) || t.job?.src === b.id)) return null; // a train already uses it
    return b;
  }

  canUndo(): boolean {
    if (this.undoBuilding()) return true;
    const g = this.g(), b = this.lastStroke;
    if (!b || (this.mode !== 'rail' && !this.againOn())) return false;
    const fresh = new Set(b.before.filter(([, o]) => !o).map(([i]) => i));
    return !g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]!.squares.some(q => fresh.has(q))));
  }

  undo() {
    const g = this.g(), ub = this.undoBuilding();
    if (ub) { // take back the building just built, with all its money
      const { paid, before, shed } = this.lastBuild!, err = removeBuilding(g, ub); if (err) { toast(err); return; }
      restoreShed(g, shed); // the shed goes back where it stood if the building moved it
      takeBackYard(g, before);
      g.s.money += paid - refundOf(ub); this.lastBuild = null; this.again = null;
      trackChanged(g); g.terrainDirty?.([...footprint(g.world.n, ub), ...before.map(([i]) => i)]);
      toast(`${INDUSTRIES[ub.kind].icon} ${INDUSTRIES[ub.kind].name} taken back · ${fmtMoney(paid)} back`); return;
    }
    const b = this.lastStroke;
    if (!b) return;
    if (!this.canUndo()) { toast('A train is on that track'); return; }
    undoStroke(g, b); this.lastStroke = null; this.plan = null; this.again = null;
    trackChanged(g); g.terrainDirty?.(b.before.map(([i]) => i));
    toast(`Undone · ${b.sup !== undefined ? `🛤 ${b.sup} supplies` : fmtMoney(b.cost)} back`);
  }

  // ---- the confirm bar
  bar(): { text: string; ok: string; can: boolean; turn?: boolean; near?: boolean; sure?: boolean } | null {
    const g = this.g(), a = this.againOn();
    if (a && !this.card) return { text: a.text, ok: a.ok, can: true };
    if (this.mode === 'rail' && this.plan && this.plan.path.length === 1) return { text: isAnchor(g, this.plan.path[0]!) ? '🛤 Line starts here: drag from it, or tap where it goes' : '🛤 Line starts at the building: run it on to your track', ok: '✓ Build', can: false };
    if (this.mode === 'rail' && this.plan && this.plan.path.length > 1) {
      const e = planError(g, this.plan), n = this.plan.path.filter(i => !g.track.has(i)).length, wet = this.plan.path.filter(i => !g.track.has(i) && g.world.terr[i] === 0).length;
      return { text: e || `${n} new square${n === 1 ? '' : 's'} · ${fr(g) ? `🛤 ${planSupplies(g, this.plan)} of ${fr(g)!.sup} supplies` : fmtMoney(planCost(g, this.plan))}${wet ? ` · 🌉 then ${fmtMoney(wet * BRIDGE_UPKEEP)}/min upkeep` : ''}${harmText(harmOf(g, this.plan.path.filter(i => !g.track.has(i))))}${stationsText(g, this.plan.path)}`, ok: '✓ Build', can: !e };
    }
    if (this.mode === 'double' && this.dbl.size) {
      const add = [...this.dbl].filter(i => g.track.has(i) && !g.track.get(i)!.dbl && !g.net.twin?.has(i)), c = add.length * TRACK_COST.double;
      if (!add.length) return { text: '✓ Already two tracks here: nothing to double', ok: '✓ Double', can: false };
      return { text: `Double ${add.length} square${add.length === 1 ? '' : 's'} · ${fmtMoney(c)}`, ok: '✓ Double', can: c <= g.s.money };
    }
    if (this.mode === 'remove' && this.rm.size) {
      for (const i of [...this.rm]) if (!g.track.has(i)) this.rm.delete(i); // gone since (a building's undo, say)
      const k = this.rm.size, what = k === 1 ? 'this track square' : `these ${k} track squares`, cut = this.removeCut();
      if (!k) return null;
      return cut ? { text: `⚠ Removing ${what} cuts ${cut} off the railway`, ok: '✂ Remove anyway', can: true } : { text: `Remove ${what}?`, ok: k === 1 ? '✂ Remove' : `✂ Remove ${k}`, can: true };
    }
    if (this.mode === 'train') {
      const p = trainPrice(g);
      return { text: g.s.shed ? `🚂 Buy train ${g.s.trains.length + 1} · ${fmtMoney(p)}` : '🏚 Lay a straight bit of line near Ashford: the engine shed goes beside it', ok: '✓ Buy', can: !!g.s.shed && p <= g.s.money };
    }
    if (this.mode === 'scout' && this.scout) {
      const k = this.scout.path.length - 1, c = scoutCost(k, this.scout.boat), out = (g.s.scouts ?? []).length;
      if (!k) return { text: this.scout.boat ? `⛵ Boat from ${this.scout.name}: tap the sea where it should sail · ${fmtMoney(scoutCost(1, true))} a square` : `🚶 Scout from ${this.scout.name}: draw the route`, ok: '✓ Send', can: false };
      return { text: this.scout.boat ? `⛵ ${k} squares · ${fmtMoney(c)} · ${fmtMoney(scoutCost(1, true))} a square, up to ${SCOUT_CAP.sea}${out ? ` · ${out}/${MAX_SCOUTS} out` : ''}` : `🚶 ${k} squares · ${fmtMoney(c)} · next square +${fmtMoney(scoutCost(k + 1, false) - c)}${out ? ` · ${out}/${MAX_SCOUTS} out` : ''}`, ok: '✓ Send', can: c <= g.s.money && out < MAX_SCOUTS };
    }
    if (this.mode === 'map' && this.mapPv) {
      const m = this.mapPv, c = mapCost(g), have = new Set(rumours(g).map(f => f.y * g.world.n + f.x));
      const k = mapFinds(g, m.x, m.y, m.r).filter(f => !have.has(f.y * g.world.n + f.x)).length, sh = Math.round(mappedShare(g, m.x, m.y, m.r) * 100);
      return { text: `🗺 Map of this circle near ${m.near} · 💬 Travellers say: ${talkOf(k)}${sh >= 5 ? ` · ✅ ${sh}% already mapped` : ''}`, ok: this.mapArmed() ? `⚠ Tap again to buy · ${fmtMoney(c)}` : `✓ Buy · ${fmtMoney(c)}`, can: c <= g.s.money, sure: this.mapArmed() };
    }
    if (this.mode === 'build' && this.preview && this.previewErr) {
      return { text: `⚠ ${this.previewErr}`, ok: '✓ Build', can: false, turn: true, near: !lockedText(g, this.preview.kind) };
    }
    if (this.mode === 'build' && this.preview) {
      const k = this.preview.kind, price = priceOf(g, k, islandAtYard(g, this.preview)), out = Math.round(INDUSTRIES[k].rate * shareAt(g, this.preview) * 60);
      return { text: `${INDUSTRIES[k].icon} ${INDUSTRIES[k].name} · ${fmtMoney(price)} · ${k === 'dock' ? 'ships goods by sea' : `makes ${out}/min`}${harmText(harmOf(g, footprint(g.world.n, this.preview)))}`, ok: '✓ Build', can: price <= g.s.money, turn: true };
    }
    return null;
  }

  confirm() {
    const g = this.g(), shed = g.s.shed && `${g.s.shed.x},${g.s.shed.y}`;
    this.doConfirm();
    const now = g.s.shed && `${g.s.shed.x},${g.s.shed.y}`;
    if (shed && now !== shed) toast(now ? '🏚 The engine shed moved beside the line' : '🏚 The engine shed needs a straight bit of line near Ashford');
  }

  private doConfirm() {
    const g = this.g();
    if (this.mode === 'rail' && this.plan) {
      const fresh = this.plan.path.filter(i => !g.track.has(i)).length;
      const b = buildPlan(g, this.plan); if (typeof b === 'string') { toast(b); return; }
      this.lastBuild = null; // new track: a building can no longer be taken back
      this.lastStroke = b.revealed ? null : b;
      if (b.revealed) toast('New land uncovered! (Track that uncovers land can\'t be undone)');
      trackChanged(g); g.terrainDirty?.(this.plan.path);
      this.closeAfter({ mode: 'rail', text: `✅ ${fresh ? `${fresh} square${fresh === 1 ? '' : 's'} built` : 'Track joined'}`, ok: '🛤 Keep building' });
    } else if (this.mode === 'double') {
      const add = [...this.dbl].filter(i => g.track.has(i) && !g.track.get(i)!.dbl && !g.net.twin?.has(i)), c = add.length * TRACK_COST.double;
      if (c > g.s.money) { toast('Not enough money'); return; }
      g.s.money -= c; for (const i of add) g.track.get(i)!.dbl = true; this.lastStroke = null; this.lastBuild = null;
      trackChanged(g); this.dbl.clear();
      this.closeAfter({ mode: 'double', text: `✅ ${add.length} square${add.length === 1 ? '' : 's'} doubled`, ok: '═ Double more' });
    } else if (this.mode === 'build' && this.preview) {
      const fog0 = g.s.fog.slice(), m0 = g.s.money, ys = yardSquares(g.world.n, this.preview), st = this.preview.horizontal ? 1 : g.world.n;
      const before = [ys[0]! - st, ...ys, ys.at(-1)! + st].map(i => [i, g.track.get(i)?.links ?? null] as [number, number | null]); // the yard's squares and the squares past its ends, as they were
      const shed0 = g.s.shed ? { ...g.s.shed } : null;
      const b = build(g, this.preview); if (typeof b === 'string') { toast(b); return; }
      this.lastBuild = { id: b.id, paid: m0 - g.s.money, at: performance.now(), before, shed: shed0 };
      trackChanged(g); g.terrainDirty?.(footprint(g.world.n, b));
      const linked = isLinked(g, b), name = `${INDUSTRIES[b.kind].icon} ${INDUSTRIES[b.kind].name}`;
      const next: Omit<Again, 'until'> = linked ? { mode: 'menu', text: `✅ ${name} built`, ok: '🏗 Build more' } : { mode: 'rail', join: true, text: `✅ ${name} built · now join it to your railway`, ok: '🛤 Lay its track' };
      this.preview = null; this.previewErr = ''; this.glowKey = '';
      if (!g.s.fog.every((v, k) => v === fog0[k])) { this.lastBuild = null; toast(`${name} built: it uncovered new land, so it can't be undone`, 3500); this.closeAfter(next); return; }
      toast(linked ? `${name} built · ↶ Undo if it's the wrong spot` : `${INDUSTRIES[b.kind].icon} Built! Now lay track between your railway and one end of its yard, from either side · ↶ Undo if it's the wrong spot`);
      this.closeAfter(next);
    } else if (this.mode === 'train') {
      const t = buyTrain(g); if (typeof t === 'string') { toast(t); return; }
      this.selected = t.id; toast(`🚂 Train ${t.id} is out of the shed and looking for a load`);
    } else if (this.mode === 'scout' && this.scout) {
      const s = sendScout(g, this.scout.path, this.scout.boat); if (typeof s === 'string') { toast(s); return; }
      toast(s.boat ? '⛵ The boat sets sail' : '🚶 The scout sets off'); this.scout = null;
    } else if (this.mode === 'map' && this.mapPv) {
      if (!this.mapArmed()) { this.mapArm = performance.now(); return; } // first tap: ask again (the artifact frame blocks confirm())
      this.mapArm = 0;
      const r = buyMap(g, this.mapPv.x, this.mapPv.y); if (typeof r === 'string') { toast(r); return; }
      toast(r.finds.length ? `🗺 The map shows ${findsText(r.finds)}: each is a ? in the fog. Scout it (🔭) or lay track there` : `🗺 Nothing hides in this circle · ${fmtMoney(r.refund)} back. Try another spot`, 5000);
      this.mapPv = null; this.mode = 'pan';
    } else if (this.mode === 'remove' && this.rm.size) {
      const sq = [...this.rm].filter(i => g.track.has(i));
      const busy = sq.filter(i => g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]!.squares.includes(i))));
      if (busy.length) { // nothing is removed while a train stands on any of it: the picks stay, so it can be tried again
        this.flash = { square: busy[0]!, until: performance.now() + 900 };
        toast(sq.length === 1 ? 'A train is on this track' : `A train is on ${busy.length === 1 ? 'one' : busy.length} of these squares: try again when it has passed, or tap ${busy.length === 1 ? 'it' : 'them'} to leave ${busy.length === 1 ? 'it' : 'them'} out`, 4000);
        return;
      }
      this.lastStroke = null; this.lastBuild = null;
      const near = new Set<number>(); // the picked squares and their neighbours (removing a square can drop a dead-end neighbour too)
      for (const i of sq) { near.add(i); for (const j of [i + 1, i - 1, i + g.world.n, i - g.world.n]) near.add(j); removeSquare(g.track, g.world.n, i); }
      trackChanged(g); g.terrainDirty?.([...near]); this.rm.clear();
      if (sq.length > 1) toast(`✂ ${sq.length} track squares removed`);
    }
  }
}

/** how long ✓ Buy waits for the second tap that buys a map */
const MAP_ARM_MS = 4000;

/** how long the "Keep building" offer shows after a build */
const AGAIN_MS = 8000;
type Again = { mode: 'rail' | 'double' | 'menu'; join?: boolean; text: string; ok: string; until: number };

/** Towns and buildings that would no longer be on the railway if square i were removed, in words ('' if none). */
export function cutText(g: Game, squares: number | number[]): string {
  const track: typeof g.track = new Map([...g.track].map(([k, v]) => [k, { ...v }])), was = g.linked ?? new Set<number>(); // a copy: removing a square edits its neighbours
  for (const i of typeof squares === 'number' ? [squares] : squares) removeSquare(track, g.world.n, i);
  const after = linkedSquares({ ...g, track } as Game), n = g.world.n, names: string[] = [];
  for (const t of g.s.sites) if (t.kind === 'town' && townLinked(g, t)) { const h = hallOf(track, n, t, g.world.terr, yardSet(g)); if (!h || !after.has(h.squares[1])) names.push(t.name ?? 'a town'); }
  for (const b of g.s.buildings ?? []) { const y = yardSquares(n, b)[0]!; if (was.has(y) && !after.has(y)) names.push(`the ${placeName(g, b)}`); }
  if (!names.length) return '';
  return names.length <= 3 ? names.join(names.length === 2 ? ' and ' : ', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/** The four squares just off the outline's corners, where the ⟳ turn arrows are drawn. */
export function turnSquares(n: number, p: { x: number; y: number; horizontal: boolean; side: 1 | -1 }): number[] {
  const f = footprint(n, p), xs = f.map(i => i % n), ys = f.map(i => (i / n) | 0);
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
  return [y0 * n + x0, y0 * n + x1, y1 * n + x0, y1 * n + x1];
}

/** A building's footprint (two rows of four, or of three for a dock) placed so its middle is at (cx, cy), facing the given way. */
function placeAround(horizontal: boolean, side: 1 | -1, cx: number, cy: number, len = 4): { x: number; y: number; horizontal: boolean; side: 1 | -1 } {
  const m = (len - 1) / 2;
  if (horizontal) { const left = Math.round(cx - m), top = Math.round(cy - 0.5); return { x: left, y: side > 0 ? top : top + 1, horizontal, side }; }
  const left = Math.round(cx - 0.5), top = Math.round(cy - m);
  return { x: side > 0 ? left : left + 1, y: top, horizontal, side };
}

/** The middle of a footprint, in squares. */
function centreOf(p: { x: number; y: number; horizontal: boolean; side: 1 | -1; len?: number }): [number, number] {
  const m = (yardLen(p) - 1) / 2;
  if (p.horizontal) return [p.x + m, (p.side > 0 ? p.y : p.y - 1) + 0.5];
  return [(p.side > 0 ? p.x : p.x - 1) + 0.5, p.y + m];
}

/** Undo of a building: its yard track goes again. Squares that were already track get their old rails back; squares
 *  laid only for the yard are removed, along with any rails joined onto them since. */
export function takeBackYard(g: Game, before: [number, number | null][]) {
  const n = g.world.n, gone: number[] = [];
  for (const [i, links] of before) {
    if (links === null) { if (g.track.has(i) && before.some(([j, l]) => j === i && l === null) && isYardOnly(before, i)) { g.track.delete(i); gone.push(i); } }
    else { const t = g.track.get(i); if (t) t.links = links | (t.links & ~yardBits(before, i, n)); }
  }
  for (const i of gone) for (const [d, j] of [[0, i + 1], [1, i + n], [2, i - 1], [3, i - n]] as const) { const t = g.track.get(j); if (t) t.links &= ~(1 << ((d + 2) % 4)); }
}
/** the yard's own squares (not the two squares past its ends) */
const isYardOnly = (before: [number, number | null][], i: number) => before.findIndex(([j]) => j === i) > 0 && before.findIndex(([j]) => j === i) < before.length - 1;
/** links on square i that point to a yard square laid fresh */
function yardBits(before: [number, number | null][], i: number, n: number): number {
  let m = 0; for (const [d, j] of [[0, i + 1], [1, i + n], [2, i - 1], [3, i - n]] as const) if (before.some(([k, l], x) => k === j && l === null && x > 0 && x < before.length - 1)) m |= 1 << d; return m;
}
