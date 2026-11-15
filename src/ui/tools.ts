import type { Game } from '../state.ts';
import { trackChanged } from '../game.ts';
import { type BuiltStroke, buildPlan, extendPlan, isAnchor, type PaintPlan, planCost, planError, startPlan, undoStroke } from '../track/paint.ts';
import { removeSquare } from '../track/edit.ts';
import { TRACK_COST } from '../track/rules.ts';
import { buyTrain, trainPrice } from '../economy/dispatch.ts';
import { bodyPoint, trainLength } from '../trains/train.ts';
import { fmtMoney, toast } from './hud.ts';
import type { Card } from './cards.ts';
import { bestPlacement, build, footprint, INDUSTRIES, type IndustryKind, isLinked, placeError, placementsAt, priceOf, shareAt, harmOf, harmText, nearestSpot, noSpotText } from '../buildings/industries.ts';

type Placement = ReturnType<typeof placementsAt>[number];

export type Mode = 'pan' | 'rail' | 'double' | 'remove' | 'train' | 'build';

export const MODE_HINT: Record<Mode, string> = {
  pan: '',
  rail: '🛤 Drag from your track (or Ashford) to paint rails square by square. Tap next to the end to add one square.',
  double: '═ Tap or drag along your track to make it double. Trains keep left, so two can pass.',
  remove: '✂ Tap a track square to remove it.',
  train: '🚂 Trains roll out of the engine shed and run themselves: each takes the best waiting load where it is needed.',
  build: '🏗 Pick what to build, then tap a glowing spot. ⟳ Turn changes which way it faces.',
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
  flash: { square: number; until: number } | null = null;
  /** the last stroke built, while it can still be undone */
  lastStroke: BuiltStroke | null = null;
  /** Build mode: the kind chosen, squares that glow, and the spot being previewed */
  buildKind: IndustryKind | null = null;
  glow = new Set<number>();
  private glowKey = '';
  preview: Placement | null = null;
  private previewAt = -1;

  constructor(private g: () => Game) {}

  setMode(m: Mode) {
    this.mode = this.mode === m ? 'pan' : m; // tapping a tool again closes it
    this.cancel();
  }

  cancel() { this.plan = null; this.dbl.clear(); this.removeAt = null; this.preview = null; this.previewAt = -1; if (this.mode !== 'build') this.buildKind = null; }

  /** choose what to build: glowing squares show where it fits */
  chooseBuild(k: IndustryKind): { x: number; y: number } | null {
    this.mode = 'build'; this.buildKind = k; this.preview = null; this.glowKey = '';
    const g = this.g(), c = g.s.camera, cx = Math.floor(c.x / 32), cy = Math.floor(c.y / 32);
    const spot = nearestSpot(g, k, cx, cy);
    if (!spot) { toast(noSpotText(k)); return null; }
    return spot;
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

  private refuse(square: number, why: string) { this.flash = { square, until: performance.now() + 900 }; toast(why); }

  // ---- painting
  dragStart(i: number): boolean {
    const g = this.g();
    if (this.mode === 'rail') {
      if (this.plan && this.plan.path.includes(i)) { this.plan.path = this.plan.path.slice(0, this.plan.path.indexOf(i) + 1); return true; }
      const p = startPlan(g, i); if (!p) return false;
      this.plan = p; return true;
    }
    if (this.mode === 'double') { if (!g.track.has(i)) return false; this.dbl.add(i); return true; }
    return false;
  }

  dragOver(i: number) {
    const g = this.g();
    if (this.mode === 'rail' && this.plan) {
      extendPlan(g, this.plan, i);
      if (this.plan.refused) { this.refuse(this.plan.refused.square, this.plan.refused.why); this.plan.refused = undefined; }
    }
    if (this.mode === 'double' && g.track.has(i)) this.dbl.add(i);
  }

  tapSquare(i: number): boolean {
    const g = this.g(), n = g.world.n;
    if (this.mode === 'rail') {
      const last = this.plan?.path.at(-1);
      if (last !== undefined && Math.abs((last % n) - (i % n)) + Math.abs(((last / n) | 0) - ((i / n) | 0)) === 1) { this.dragOver(i); return true; }
      if (isAnchor(g, i)) { this.plan = { path: [i] }; toast('Now drag or tap next to it to lay track'); return true; }
      toast('New track must join your network: start from your track or from Ashford'); return true;
    }
    if (this.mode === 'double') { if (g.track.has(i)) { if (this.dbl.has(i)) this.dbl.delete(i); else this.dbl.add(i); } return true; }
    if (this.mode === 'build' && this.buildKind) {
      const x = i % n, y = (i / n) | 0;
      if (this.previewAt === i && this.preview) { this.turn(); return true; } // tap again: turn it
      const b = bestPlacement(g, this.buildKind, x, y);
      if (!b.place) { this.refuse(i, b.why); return true; }
      this.preview = b.place; this.previewAt = i;
      return true;
    }
    if (this.mode === 'remove') { this.removeAt = g.track.has(i) ? i : null; if (!g.track.has(i)) toast('No track here'); return true; }
    if (this.mode === 'train') return true;
    return false;
  }

  /** Turn the building being placed to the next way that fits on the same spot. */
  turn() {
    const g = this.g(), n = g.world.n, i = this.previewAt;
    if (!this.buildKind || !this.preview || i < 0) return;
    const all = placementsAt(this.buildKind, i % n, (i / n) | 0).filter(p => !placeError(g, p));
    // ways that differ: direction and side (shifting along the row is not a turn)
    const ways = all.filter((p, k) => all.findIndex(q => q.horizontal === p.horizontal && q.side === p.side) === k);
    if (ways.length < 2) { toast('Only one way fits on this spot: try a more open spot to turn it'); return; }
    const cur = ways.findIndex(p => p.horizontal === this.preview!.horizontal && p.side === this.preview!.side);
    this.preview = ways[(cur + 1) % ways.length]!;
  }

  /** a tap near a train selects it */
  tapWorld(wx: number, wy: number): boolean {
    const g = this.g();
    for (const t of g.s.trains) for (let u = 0; u <= trainLength(t); u += 4) {
      const p = bodyPoint(g.net, t, u);
      if (Math.hypot(p.x - wx, p.y - wy) < 10) { this.selected = this.selected === t.id ? null : t.id; this.card = this.selected === null ? null : { kind: 'train', id: t.id }; return true; }
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
  bar(): { text: string; ok: string; can: boolean; turn?: boolean } | null {
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
      this.preview = null; this.previewAt = -1; this.glowKey = '';
    } else if (this.mode === 'train') {
      const t = buyTrain(g); if (typeof t === 'string') { toast(t); return; }
      this.selected = t.id; toast(`🚂 Train ${t.id} is out of the shed and looking for a load`);
    } else if (this.mode === 'remove' && this.removeAt !== null) {
      const i = this.removeAt;
      if (g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]!.squares.includes(i)))) { toast('A train is on this track'); return; }
      this.lastStroke = null;
      removeSquare(g.track, g.world.n, i); trackChanged(g); g.terrainDirty?.([i]); this.removeAt = null;
    }
  }
}
