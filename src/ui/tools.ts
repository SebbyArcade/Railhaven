import { shipPlace } from '../ships/ships.ts';
import type { Game } from '../state.ts';
import { MAX_SCOUTS, scoutCost, scoutStarts, scoutStepError, sendScout } from '../world/explore.ts';
import { trackChanged } from '../game.ts';
import { type BuiltStroke, buildPlan, extendPlan, isAnchor, type PaintPlan, planCost, planError, startPlan, undoStroke } from '../track/paint.ts';
import { removeSquare } from '../track/edit.ts';
import { TRACK_COST } from '../track/rules.ts';
import { buyTrain, trainPrice } from '../economy/dispatch.ts';
import { bodyPoint, trainLength } from '../trains/train.ts';
import { fmtMoney, toast } from './hud.ts';
import type { Card } from './cards.ts';
import { badSquares, bestPlacement, build, footprint, INDUSTRIES, type IndustryKind, isLinked, placeError, placementsAt, priceOf, shareAt, harmOf, harmText, nearestSpot, noSpotText, lockedText } from '../buildings/industries.ts';

type Placement = ReturnType<typeof placementsAt>[number];

export type Mode = 'pan' | 'rail' | 'double' | 'remove' | 'train' | 'build' | 'scout';

export const MODE_HINT: Record<Mode, string> = {
  pan: '',
  rail: '🛤 Drag from your track (or Ashford), or tap the track then tap where the line should go: it runs straight, turning once. ✓ Build when done.',
  double: '═ Tap or drag along your track to make it double. Trains keep left, so two can pass.',
  remove: '✂ Tap a track square to remove it.',
  train: '🚂 Trains roll out of the engine shed and run themselves: each takes the best waiting load where it is needed.',
  build: '🏗 Drag the outline where you want it: blue squares are its loading tracks, green its building. ⟳ Turn rotates it.',
  scout: '🔭 Tap a glowing town (scouts on foot) or dock (a boat), then drag or tap to draw the route into the fog.',
};

/** The build tools: what the player is doing, and the confirm bar it needs. */
export class Tools {
  mode: Mode = 'pan';
  plan: PaintPlan | null = null;
  dbl = new Set<number>();
  removeAt: number | null = null;
  selected: number | null = null;
  /** the open card (town, building or train), shown on the map too */
  card: Card | null = null;
  /** the map view shown (👁 Map), or none */
  view: import('./mapviews.ts').MapView | null = null;
  flash: { square: number; until: number } | null = null;
  /** lesson ring: the square to tap next */
  ring: number | null = null;
  /** the last stroke built, while it can still be undone */
  lastStroke: BuiltStroke | null = null;
  /** Build mode: the kind chosen, squares that glow, and the spot being previewed */
  buildKind: IndustryKind | null = null;
  glow = new Set<number>();
  private glowKey = '';
  /** the building being placed: a 2×4 outline the player drags around (red when it can't go there) */
  preview: Placement | null = null;
  previewErr = '';
  /** the outline squares that can't be used (drawn red; the rest keep their colours) */
  previewBad = new Set<number>();
  private dragOff: [number, number] | null = null;
  /** Scout mode: the route being drawn (from a town on foot, or a dock by boat) */
  scout: { path: number[]; boat: boolean; name: string } | null = null;

  constructor(private g: () => Game) {}

  setMode(m: Mode) {
    this.mode = this.mode === m ? 'pan' : m; // tapping a tool again closes it
    this.cancel();
  }

  cancel() { this.scout = null; this.plan = null; this.dbl.clear(); this.removeAt = null; this.preview = null; this.previewErr = ''; this.dragOff = null; if (this.mode !== 'build') this.buildKind = null; }

  /** choose what to build: glowing squares show where it fits */
  chooseBuild(k: IndustryKind): { x: number; y: number } | null {
    this.mode = 'build'; this.buildKind = k; this.preview = null; this.glowKey = '';
    const g = this.g(), c = g.s.camera, cx = Math.floor(c.x / 32), cy = Math.floor(c.y / 32);
    const spot = nearestSpot(g, k, cx, cy);
    // the outline appears at once: on the nearest spot that fits, or in the middle of the view (red, with the reason)
    const at = spot ? bestPlacement(g, k, spot.x, spot.y).place : null;
    this.setPreview(at ?? { kind: k, ...placeAround(true, 1, cx, cy) });
    if (!spot) { toast(noSpotText(k)); return null; }
    return spot;
  }

  private setPreview(p: Placement) {
    const g = this.g();
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

  private refuse(square: number, why: string) { this.flash = { square, until: performance.now() + 900 }; toast(why); }

  // ---- painting
  dragStart(i: number): boolean {
    const g = this.g(), n = g.world.n;
    if (this.mode === 'build' && this.preview && footprint(n, this.preview).includes(i)) { // grab the outline
      this.dragOff = [(i % n) - this.preview.x, ((i / n) | 0) - this.preview.y]; return true;
    }
    if (this.mode === 'rail') {
      if (this.plan && this.plan.path.includes(i)) { this.plan.path = this.plan.path.slice(0, this.plan.path.indexOf(i) + 1); return true; }
      const p = startPlan(g, i);
      if (p) { this.plan = p; return true; }
      // a drag that starts just beside the end of the line or the track still paints (fingers are wide)
      const near = this.nearStart(i); if (near === null) return false;
      if (this.plan && this.plan.path.length > 1 && this.plan.path.at(-1) !== near) return false; // keep the line being drawn
      if (!this.plan || this.plan.path.at(-1) !== near) this.plan = { path: [near] };
      this.dragOver(i); return true;
    }
    if (this.mode === 'double') { if (!g.track.has(i)) return false; this.dbl.add(i); return true; }
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
    if (this.mode === 'double' && g.track.has(i)) this.dbl.add(i);
    if (this.mode === 'scout' && this.scout && this.scout.path.at(-1) !== i) this.scoutTo(i);
  }

  tapSquare(i: number): boolean {
    const g = this.g(), n = g.world.n;
    if (this.mode === 'rail') {
      const last = this.plan?.path.at(-1);
      if (last !== undefined && !g.track.has(i)) { this.extendTo(i); return true; } // tap anywhere: the line runs there
      if (isAnchor(g, i)) {
        if (this.plan && this.plan.path.length > 1 && last !== i) { this.extendTo(i); return true; } // joining back onto the track
        this.plan = { path: [i] }; toast('Now tap where the line should go (or drag)'); return true;
      }
      toast('New track must join your network: start from your track or from Ashford'); return true;
    }
    if (this.mode === 'double') { if (g.track.has(i)) { if (this.dbl.has(i)) this.dbl.delete(i); else this.dbl.add(i); } return true; }
    if (this.mode === 'build' && this.buildKind) {
      if (this.preview && footprint(n, this.preview).includes(i)) { this.dragOff = null; return true; } // a tap on the outline itself: leave it
      this.moveTo(i % n, (i / n) | 0);
      return true;
    }
    if (this.mode === 'scout') {
      if (this.scout && this.scout.path.length && !this.scoutStartAt(i)) { this.scoutTo(i); return true; }
      const st = this.scoutStartAt(i);
      if (st) { this.scout = { path: [st.sq], boat: st.boat, name: st.name }; toast(st.boat ? '⛵ Now draw where the boat should sail' : `🚶 Now draw where the scout should walk from ${st.name}`); return true; }
      toast(scoutStarts(g).length ? 'Scouts leave from a glowing town or dock on your railway' : 'Join a town to your railway first: scouts leave from there'); return true;
    }
    if (this.mode === 'remove') { this.removeAt = g.track.has(i) ? i : null; if (!g.track.has(i)) toast('No track here'); return true; }
    if (this.mode === 'train') return true;
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
      const q = { kind: p.kind, ...placeAround(h, side, cx + dx, cy + dy) };
      if (!placeError(g, q)) { this.setPreview(q); return; }
    }
    this.setPreview({ kind: p.kind, ...placeAround(h, side, cx, cy) });
  }

  /** a tap near a train selects it */
  tapWorld(wx: number, wy: number): boolean {
    const g = this.g();
    for (const t of g.s.trains) for (let u = 0; u <= trainLength(t); u += 4) {
      const p = bodyPoint(g.net, t, u);
      if (Math.hypot(p.x - wx, p.y - wy) < 10) { this.selected = this.selected === t.id ? null : t.id; this.card = this.selected === null ? null : { kind: 'train', id: t.id }; return true; }
    }
    for (const s of g.s.ships ?? []) { // ships: a tap near the hull opens its card
      const p = shipPlace(g, s);
      if (Math.hypot((p.x + 0.5) * 32 - wx, (p.y + 0.5) * 32 - wy) < 16) { this.selected = null; this.card = this.card?.kind === 'ship' && this.card.id === s.id ? null : { kind: 'ship', id: s.id }; return true; }
    }
    return false;
  }

  /** can the last stroke be undone right now (no train on its new squares)? */
  canUndo(): boolean {
    const g = this.g(), b = this.lastStroke;
    if (!b || this.mode !== 'rail') return false;
    const fresh = new Set(b.before.filter(([, o]) => !o).map(([i]) => i));
    return !g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]!.squares.some(q => fresh.has(q))));
  }

  undo() {
    const g = this.g(), b = this.lastStroke;
    if (!b) return;
    if (!this.canUndo()) { toast('A train is on that track'); return; }
    undoStroke(g, b); this.lastStroke = null; this.plan = null;
    trackChanged(g); g.terrainDirty?.(b.before.map(([i]) => i));
    toast(`Undone · ${fmtMoney(b.cost)} back`);
  }

  // ---- the confirm bar
  bar(): { text: string; ok: string; can: boolean; turn?: boolean; near?: boolean } | null {
    const g = this.g();
    if (this.mode === 'rail' && this.plan && this.plan.path.length > 1) {
      const e = planError(g, this.plan), n = this.plan.path.filter(i => !g.track.has(i)).length;
      return { text: e || `${n} new square${n === 1 ? '' : 's'} · ${fmtMoney(planCost(g, this.plan))}${harmText(harmOf(g, this.plan.path.filter(i => !g.track.has(i))))}`, ok: '✓ Build', can: !e };
    }
    if (this.mode === 'double' && this.dbl.size) {
      const add = [...this.dbl].filter(i => g.track.has(i) && !g.track.get(i)!.dbl), c = add.length * TRACK_COST.double;
      return { text: `Double ${add.length} square${add.length === 1 ? '' : 's'} · ${fmtMoney(c)}`, ok: '✓ Double', can: add.length > 0 && c <= g.s.money };
    }
    if (this.mode === 'remove' && this.removeAt !== null) return { text: 'Remove this track square?', ok: '✂ Remove', can: true };
    if (this.mode === 'train') {
      const p = trainPrice(g);
      return { text: g.s.shed ? `🚂 Buy train ${g.s.trains.length + 1} · ${fmtMoney(p)}` : '🏚 Lay a straight bit of line near Ashford: the engine shed goes beside it', ok: '✓ Buy', can: !!g.s.shed && p <= g.s.money };
    }
    if (this.mode === 'scout' && this.scout) {
      const k = this.scout.path.length - 1, c = scoutCost(k, this.scout.boat), out = (g.s.scouts ?? []).length;
      if (!k) return { text: `${this.scout.boat ? '⛵ Boat' : '🚶 Scout'} from ${this.scout.name}: draw the route`, ok: '✓ Send', can: false };
      return { text: `${this.scout.boat ? '⛵' : '🚶'} ${k} squares · ${fmtMoney(c)} · next square +${fmtMoney(scoutCost(k + 1, this.scout.boat) - c)}${out ? ` · ${out}/${MAX_SCOUTS} out` : ''}`, ok: '✓ Send', can: c <= g.s.money && out < MAX_SCOUTS };
    }
    if (this.mode === 'build' && this.preview && this.previewErr) {
      return { text: `⚠ ${this.previewErr}`, ok: '✓ Build', can: false, turn: true, near: !lockedText(g, this.preview.kind) };
    }
    if (this.mode === 'build' && this.preview) {
      const k = this.preview.kind, price = priceOf(g, k), out = Math.round(INDUSTRIES[k].rate * shareAt(g, this.preview) * 60);
      return { text: `${INDUSTRIES[k].icon} ${INDUSTRIES[k].name} · ${fmtMoney(price)} · makes ${out}/min${harmText(harmOf(g, footprint(g.world.n, this.preview)))}`, ok: '✓ Build', can: price <= g.s.money, turn: true };
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
      const b = buildPlan(g, this.plan); if (typeof b === 'string') { toast(b); return; }
      this.lastStroke = b.revealed ? null : b;
      if (b.revealed) toast('New land uncovered! (Track that uncovers land can\'t be undone)');
      trackChanged(g); g.terrainDirty?.(this.plan.path);
      this.plan = { path: [this.plan.path.at(-1)!] };
    } else if (this.mode === 'double') {
      const add = [...this.dbl].filter(i => g.track.has(i) && !g.track.get(i)!.dbl), c = add.length * TRACK_COST.double;
      if (c > g.s.money) { toast('Not enough money'); return; }
      g.s.money -= c; for (const i of add) g.track.get(i)!.dbl = true; this.lastStroke = null;
      trackChanged(g); this.dbl.clear();
    } else if (this.mode === 'build' && this.preview) {
      const b = build(g, this.preview); if (typeof b === 'string') { toast(b); return; }
      trackChanged(g); g.terrainDirty?.(footprint(g.world.n, b));
      toast(isLinked(g, b) ? `${INDUSTRIES[b.kind].icon} ${INDUSTRIES[b.kind].name} built` : `${INDUSTRIES[b.kind].icon} Built! Now lay track from your railway to one end of its yard`);
      this.preview = null; this.previewErr = ''; this.glowKey = '';
    } else if (this.mode === 'train') {
      const t = buyTrain(g); if (typeof t === 'string') { toast(t); return; }
      this.selected = t.id; toast(`🚂 Train ${t.id} is out of the shed and looking for a load`);
    } else if (this.mode === 'scout' && this.scout) {
      const s = sendScout(g, this.scout.path, this.scout.boat); if (typeof s === 'string') { toast(s); return; }
      toast(s.boat ? '⛵ The boat sets sail' : '🚶 The scout sets off'); this.scout = null;
    } else if (this.mode === 'remove' && this.removeAt !== null) {
      const i = this.removeAt;
      if (g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]!.squares.includes(i)))) { toast('A train is on this track'); return; }
      this.lastStroke = null;
      removeSquare(g.track, g.world.n, i); trackChanged(g); g.terrainDirty?.([i]); this.removeAt = null;
    }
  }
}

/** A building's footprint (two rows of four) placed so its middle is at (cx, cy), facing the given way. */
function placeAround(horizontal: boolean, side: 1 | -1, cx: number, cy: number): { x: number; y: number; horizontal: boolean; side: 1 | -1 } {
  if (horizontal) { const left = Math.round(cx - 1.5), top = Math.round(cy - 0.5); return { x: left, y: side > 0 ? top : top + 1, horizontal, side }; }
  const left = Math.round(cx - 0.5), top = Math.round(cy - 1.5);
  return { x: side > 0 ? left : left + 1, y: top, horizontal, side };
}

/** The middle of a footprint, in squares. */
function centreOf(p: { x: number; y: number; horizontal: boolean; side: 1 | -1 }): [number, number] {
  if (p.horizontal) return [p.x + 1.5, (p.side > 0 ? p.y : p.y - 1) + 0.5];
  return [(p.side > 0 ? p.x : p.x - 1) + 0.5, p.y + 1.5];
}
