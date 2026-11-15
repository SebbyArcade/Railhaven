import type { Game } from '../state.ts';
import { dockRange, seaDist } from '../ships/docks.ts';
import { isRevealed } from '../world/fog.ts';
import { TILE } from '../world/terrain.ts';
import { type View, toWorld } from './camera.ts';
import { drawFog } from './fog.ts';
import { drawSites } from './sites.ts';
import { drawHall } from './stations.ts';
import { drawBreak, drawShed } from './shed.ts';
import { drawBuilding } from './buildings.ts';
import { drawFields } from './fields.ts';
import { shedSquare } from '../buildings/shed.ts';
import { hallsOf } from '../buildings/stations.ts';
import { landDistance } from '../track/rules.ts';
import { buildingSquares, footprint, yardSquares } from '../buildings/industries.ts';
import { TerrainCache } from './terrainCache.ts';
import { drawWaterLive } from './terrainArt.ts';
import { drawTrack } from './track.ts';
import { drawTrains } from './trains.ts';
import { drawShips } from './ships.ts';
import { drawExplore } from './explore.ts';
import { islandSpec, SPEC_TEXT } from '../world/specialty.ts';
import type { Tools } from '../ui/tools.ts';
import { bodyPoint } from '../trains/train.ts';
import { type Plan, shipPlan } from '../economy/shipping.ts';
import { drawAlerts, drawShipArrow, drawTownBadges } from './orders.ts';
import { stuckList } from '../ui/orders.ts';
import { drawView, ViewCache } from './views.ts';
import { seasonOf } from '../world/season.ts';
import { stumpPhase } from '../economy/production.ts';
import { shipPlace } from '../ships/ships.ts';

/** Squares under a building (trees are cleared there). */
function builtOn(g: Game, i: number): boolean {
  const n = g.world.n;
  return (g.s.buildings ?? []).some(b => footprint(n, b).includes(i));
}

/** Draws one frame. Reads the game, never changes it. */
export class Renderer {
  readonly terrain: TerrainCache;
  private plan: Plan = Object.assign(new Map(), { docks: new Map() });
  private planAt = -9;
  private alerts = new Set<number>();
  private views = new ViewCache();
  /** the map view's edge arrows on screen, so a tap on one can go there */
  readonly arrows: { sx: number; sy: number; m: import('../ui/mapviews.ts').Mark }[] = [];
  constructor(private g: Game, private tools?: Tools) {
    this.terrain = new TerrainCache(g.world, i => g.track.has(i) || i === shedSquare(g) || builtOn(g, i), i => stumpPhase(g, i));
    g.terrainDirty = sq => this.terrain.invalidate(sq);
  }

  draw(ctx: CanvasRenderingContext2D, view: View, dpr: number, tm: number) {
    const g = this.g, cam = g.s.camera, n = g.world.n;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#15130f'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.translate(view.w / 2, view.h / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    const [wx0, wy0] = toWorld(cam, view, 0, 0), [wx1, wy1] = toWorld(cam, view, view.w, view.h);
    const x0 = Math.floor(wx0 / TILE) - 1, y0 = Math.floor(wy0 / TILE) - 1, x1 = Math.ceil(wx1 / TILE) + 1, y1 = Math.ceil(wy1 / TILE) + 1;
    this.terrain.setSeason(seasonOf(g.s.t));
    this.terrain.draw(ctx, x0, y0, x1, y1, cam.z);
    if (cam.z >= 0.6) {
      for (let y = Math.max(0, y0); y <= Math.min(n - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(n - 1, x1); x++)
        if (g.world.terr[y * n + x] === 0 && isRevealed(g, y * n + x)) drawWaterLive(ctx, g.world, x, y, tm);
    }
    const vis = (sq: number) => { const x = sq % n, y = (sq / n) | 0; return x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1; };
    drawTrack(ctx, g.net, p => p.squares.some(vis), cam.z, p => {
      let k = 0; for (const q of p.squares) if (!g.world.terr[q]) k = Math.max(k, landDistance(g, q));
      return Math.min(3, k);
    });
    const halls = hallsOf(g.track, n, g.s.sites);
    for (const h of halls) if (vis(h.squares[1]) && isRevealed(g, h.squares[1])) drawHall(ctx, g.s.seed, h, cam.z);
    drawSites(ctx, g, x0, y0, x1, y1, cam.z, tm, halls);
    for (const b of g.s.buildings ?? []) if (vis(b.y * n + b.x) && isRevealed(g, b.y * n + b.x)) drawFields(ctx, g, b, tm, cam.z);
    for (const b of g.s.buildings ?? []) if (vis(b.y * n + b.x) && isRevealed(g, b.y * n + b.x)) drawBuilding(ctx, g, b, tm, cam.z);
    for (const b of g.s.breaks ?? []) if (vis(b.square)) drawBreak(ctx, g, b, tm);
    drawTrains(ctx, g.net, g.s.trains, tm);
    drawShed(ctx, g, tm); // after trains: a train on the siding runs in under its roof
    drawShips(ctx, g, tm, (x, y) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 2 && y <= y1 + 2 && !!isRevealed(g, Math.round(y) * n + Math.round(x)));
    drawExplore(ctx, g, this.tools, tm, (x, y) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 2 && y <= y1 + 2, cam.z);
    if (tm - this.planAt > 1) { this.planAt = tm; this.plan = shipPlan(g); this.alerts = new Set(stuckList(g, this.plan).filter(x => x.bld !== undefined).map(x => x.bld!)); } // the plan changes slowly: once a second is plenty
    if (this.tools?.card?.kind === 'bld') drawShipArrow(ctx, g, this.plan, this.tools.card.id, tm);
    // an open dock card shows the sea it reaches
    const open = this.tools?.card?.kind === 'bld' ? g.s.buildings?.find(b => b.id === this.tools!.card!.id) : undefined;
    if (open?.kind === 'dock') {
      const d = seaDist(g, open), R = dockRange(open), p = 0.5 + 0.5 * Math.sin(tm * 2);
      for (let y = Math.max(0, y0); y <= Math.min(n - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(n - 1, x1); x++) {
        const v = d[y * n + x]!; if (v < 0 || v > R) continue;
        ctx.fillStyle = v > R - 2 ? `rgba(255,255,255,${0.25 + 0.2 * p})` : 'rgba(140,210,255,.14)'; ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    drawTownBadges(ctx, g, this.plan, cam.z, tm);
    if (!this.tools?.view) drawAlerts(ctx, g, this.alerts, cam.z, tm);
    this.drawOverlay(ctx, tm);
    drawFog(ctx, g, x0, y0, x1, y1, cam.z, tm);
    this.drawIslandNames(ctx, cam.z);
    ctx.restore();
    if (seasonOf(g.s.t) === 3) this.drawSnow(ctx, view, tm);
    const v = this.tools?.view; if (v) drawView(ctx, g, v, view, this.views.get(g, v, tm), tm, this.arrows);
  }

  private drawOverlay(ctx: CanvasRenderingContext2D, tm: number) {
    const t = this.tools; if (!t) return;
    const n = this.g.world.n, box = (i: number, fill: string, stroke: string) => {
      const x = (i % n) * TILE, y = ((i / n) | 0) * TILE;
      ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    };
    if (t.plan) for (const i of t.plan.path) box(i, this.g.track.has(i) ? 'rgba(255,214,120,.18)' : 'rgba(120,230,140,.28)', 'rgba(150,255,170,.85)');
    for (const i of t.dbl) box(i, 'rgba(120,190,255,.25)', 'rgba(150,210,255,.9)');
    if (t.removeAt !== null) box(t.removeAt, 'rgba(255,90,70,.3)', 'rgba(255,120,100,.95)');
    if (t.flash && performance.now() < t.flash.until) box(t.flash.square, 'rgba(255,60,40,.35)', 'rgba(255,80,60,1)');
    if (t.ring !== null) { // the lesson's gold ring
      const p = 0.5 + 0.5 * Math.sin(tm * 5), x = (t.ring % n + 0.5) * TILE, y = (((t.ring / n) | 0) + 0.5) * TILE;
      ctx.strokeStyle = `rgba(255,210,122,${0.6 + 0.4 * p})`; ctx.lineWidth = 3 + 2 * p; ctx.beginPath(); ctx.arc(x, y, TILE * (0.7 + 0.15 * p), 0, 7); ctx.stroke();
    }
    if (t.mode === 'build') {
      const p = 0.5 + 0.5 * Math.sin(tm * 3.5);
      for (const i of t.glow) { const x = (i % n) * TILE, y = ((i / n) | 0) * TILE; ctx.fillStyle = `rgba(255,214,120,${0.1 + 0.14 * p})`; ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6); }
      if (t.preview) { // the outline: loading tracks blue, building green; red where it can't go
        const bad0 = !!t.previewErr, red = (i: number) => bad0 && (t.previewBad.size === 0 || t.previewBad.has(i));
        for (const i of yardSquares(n, t.preview)) { const bad = red(i); box(i, bad ? 'rgba(255,90,70,.4)' : 'rgba(150,210,255,.3)', bad ? 'rgba(255,120,100,.95)' : 'rgba(170,220,255,.95)'); }
        for (const i of buildingSquares(n, t.preview)) { const bad = red(i); box(i, bad ? 'rgba(255,90,70,.45)' : 'rgba(120,230,140,.32)', bad ? 'rgba(255,120,100,.95)' : 'rgba(150,255,170,.95)'); }
        // a drag handle in the middle of the building row
        const bs = buildingSquares(n, t.preview), m = bs[1]!, m2 = bs[2]!, hx = ((m % n) + (m2 % n)) / 2 * TILE + TILE / 2, hy = (((m / n) | 0) + ((m2 / n) | 0)) / 2 * TILE + TILE / 2;
        ctx.fillStyle = 'rgba(28,22,16,.75)'; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✥', hx, hy + 0.5);
      }
    }
    if (t.mode === 'rail' && !t.plan) { // show where track may start
      const a = this.g.s.sites[0]!, p = 0.5 + 0.5 * Math.sin(tm * 4);
      if (!this.g.track.size) box(a.y * n + a.x, `rgba(255,214,120,${0.15 + 0.2 * p})`, 'rgba(255,214,120,.9)');
    }
    if (t.card?.kind === 'ship') { // the open ship: a gold ring
      const sh = this.g.s.ships?.find(x => x.id === t.card!.id);
      if (sh) { const p = shipPlace(this.g, sh); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((p.x + 0.5) * TILE, (p.y + 0.5) * TILE, 16 + Math.sin(tm * 5), 0, 7); ctx.stroke(); }
    }
    if (t.selected !== null) {
      const tr = this.g.s.trains.find(x => x.id === t.selected);
      if (tr) { const p = bodyPoint(this.g.net, tr, 8); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 14 + Math.sin(tm * 5), 0, 7); ctx.stroke(); }
    }
  }

  /** Winter: a few soft flakes drifting down the screen. */
  private drawSnow(ctx: CanvasRenderingContext2D, view: View, tm: number) {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let k = 0; k < 70; k++) {
      const sx = (k * 137.5) % view.w, sp = 18 + (k % 7) * 5;
      const y = ((tm * sp + k * 61.7) % (view.h + 20)) - 10, x = (sx + Math.sin(tm * 0.8 + k) * 12 + view.w) % view.w;
      ctx.beginPath(); ctx.arc(x, y, 0.8 + (k % 3) * 0.5, 0, 7); ctx.fill();
    }
  }

  private drawIslandNames(ctx: CanvasRenderingContext2D, z: number) {
    if (z >= 0.8) return;
    const g = this.g, n = g.world.n;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    g.world.islands.forEach((o, k) => {
      if (!o.name || !isRevealed(g, Math.round(o.cy) * n + Math.round(o.cx))) return;
      const X = (o.cx + 0.5) * TILE, Y = (o.cy + 0.5) * TILE - TILE * (k === g.world.home ? 6 : 1.5), f = Math.round(15 / z);
      ctx.font = `italic 700 ${f}px Georgia,serif`; ctx.lineWidth = 4 / z; ctx.strokeStyle = 'rgba(20,18,14,.75)';
      ctx.strokeText(o.name, X, Y); ctx.fillStyle = k === g.world.home ? 'rgba(255,226,160,.95)' : 'rgba(200,215,235,.85)'; ctx.fillText(o.name, X, Y);
      const sp = islandSpec(g, k); if (sp) { const t = `★ ${SPEC_TEXT[sp]}`; ctx.font = `600 ${Math.round(f * 0.6)}px system-ui`; ctx.strokeText(t, X, Y + f * 0.9); ctx.fillStyle = 'rgba(255,214,120,.9)'; ctx.fillText(t, X, Y + f * 0.9); }
    });
  }
}
