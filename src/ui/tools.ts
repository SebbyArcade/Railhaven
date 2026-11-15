import type { Game } from '../state.ts';
import { trackChanged } from '../game.ts';
import { type BuiltStroke, buildPlan, extendPlan, isAnchor, type PaintPlan, planCost, planError, startPlan, undoStroke } from '../track/paint.ts';
import { removeSquare } from '../track/edit.ts';
import { TRACK_COST } from '../track/rules.ts';
import { placeTrain } from '../trains/train.ts';
import { bodyPoint, trainLength } from '../trains/train.ts';
import { fmtMoney, toast } from './hud.ts';

export type Mode = 'pan' | 'rail' | 'double' | 'remove' | 'train';

export const MODE_HINT: Record<Mode, string> = {
  pan: '',
  rail: '🛤 Drag from your track (or Ashford) to paint rails square by square. Tap next to the end to add one square.',
  double: '═ Tap or drag along your track to make it double. Trains keep left, so two can pass.',
  remove: '✂ Tap a track square to remove it.',
  train: '🚂 Tap your track to put a test train there.',
};

/** The build tools: what the player is doing, and the confirm bar it needs. */
export class Tools {
  mode: Mode = 'pan';
  plan: PaintPlan | null = null;
  dbl = new Set<number>();
  removeAt: number | null = null;
  selected: number | null = null;
  flash: { square: number; until: number } | null = null;
  /** the last stroke built, while it can still be undone */
  lastStroke: BuiltStroke | null = null;

  constructor(private g: () => Game) {}

  setMode(m: Mode) {
    this.mode = this.mode === m ? 'pan' : m; // tapping a tool again closes it
    this.cancel();
  }

  cancel() { this.plan = null; this.dbl.clear(); this.removeAt = null; }

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
    if (this.mode === 'remove') { this.removeAt = g.track.has(i) ? i : null; if (!g.track.has(i)) toast('No track here'); return true; }
    if (this.mode === 'train') {
      const ids = g.net.bySquare.get(i);
      if (!ids?.length) { toast('Put the train on your track'); return true; }
      const p = g.net.pieces[ids.find(id => g.net.pieces[id]!.squares.length === 1) ?? ids[0]!]!; // plain track rather than a turnout
      const t = placeTrain(g.net, g.s.nextId++, { piece: p.id, dir: 1 }, 3);
      if (t.trail.some(s => g.sys.holder.has(s.piece))) { toast('Another train is there'); g.s.nextId--; return true; }
      g.s.trains.push(t); g.sys.rebuildHolds(); this.selected = t.id;
      toast('Train placed. Tap anywhere on your track to send it there.');
      this.mode = 'pan';
      return true;
    }
    // pan mode: a selected train goes where you tap on the track
    if (this.selected !== null && g.track.has(i)) {
      const t = g.s.trains.find(x => x.id === this.selected);
      if (t && !g.sys.sendTo(t, i)) toast('No way there on the rails');
      return true;
    }
    return false;
  }

  /** a tap near a train selects it */
  tapWorld(wx: number, wy: number): boolean {
    const g = this.g();
    for (const t of g.s.trains) for (let u = 0; u <= trainLength(t); u += 4) {
      const p = bodyPoint(g.net, t, u);
      if (Math.hypot(p.x - wx, p.y - wy) < 10) { this.selected = this.selected === t.id ? null : t.id; if (this.selected !== null) toast('Train selected: tap your track to send it'); return true; }
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
  bar(): { text: string; ok: string; can: boolean } | null {
    const g = this.g();
    if (this.mode === 'rail' && this.plan && this.plan.path.length > 1) {
      const e = planError(g, this.plan), n = this.plan.path.filter(i => !g.track.has(i)).length;
      return { text: e || `${n} new square${n === 1 ? '' : 's'} · ${fmtMoney(planCost(g, this.plan))}`, ok: '✓ Build', can: !e };
    }
    if (this.mode === 'double' && this.dbl.size) {
      const add = [...this.dbl].filter(i => g.track.has(i) && !g.track.get(i)!.dbl), c = add.length * TRACK_COST.double;
      return { text: `Double ${add.length} square${add.length === 1 ? '' : 's'} · ${fmtMoney(c)}`, ok: '✓ Double', can: add.length > 0 && c <= g.s.money };
    }
    if (this.mode === 'remove' && this.removeAt !== null) return { text: 'Remove this track square?', ok: '✂ Remove', can: true };
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
    } else if (this.mode === 'remove' && this.removeAt !== null) {
      const i = this.removeAt;
      if (g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]!.squares.includes(i)))) { toast('A train is on this track'); return; }
      this.lastStroke = null;
      removeSquare(g.track, g.world.n, i); trackChanged(g); g.terrainDirty?.([i]); this.removeAt = null;
    }
  }
}
