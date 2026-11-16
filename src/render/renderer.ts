import { drawParks } from './parks.ts';
import { hallOf } from '../buildings/stations.ts';
import type { Game } from '../state.ts';
import { dockRange, seaDist } from '../ships/docks.ts';
import { isRevealed } from '../world/fog.ts';
import { TILE } from '../world/terrain.ts';
import { type View, toWorld } from './camera.ts';
import { drawFog } from './fog.ts';
import { drawSites } from './sites.ts';
import { drawHall } from './stations.ts';
import { drawBreak, drawShed } from './shed.ts';
import { drawBuilding, drawBuildingTags, drawQuay } from './buildings.ts';
import { drawFields } from './fields.ts';
import { shedSquare } from '../buildings/shed.ts';
import { hallsOf } from '../buildings/stations.ts';
import { landDistance, straitCoasts } from '../track/rules.ts';
import { buildingSquares, footprint, type IndustryKind, isLinked, outputOf, yardSquares, yardSet } from '../buildings/industries.ts';
import { buildNoGo, railNoGo } from '../buildings/nogo.ts';
import { turnSquares } from '../ui/tools.ts';
import { townLinked } from '../economy/towns.ts';
import { joinGap } from '../track/joins.ts';
import { TerrainCache } from './terrainCache.ts';
import { drawWaterLive } from './terrainArt.ts';
import { drawTrack } from './track.ts';
import { drawTrains } from './trains.ts';
import { drawLightning, drawMishaps, drawStorm } from './events.ts';
import { drawSeaRoutes, drawShips } from './ships.ts';
import { drawExplore, drawPoiZones, drawScouting, drawMaps } from './explore.ts';
import { islandSpec, SPEC_TEXT } from '../world/specialty.ts';
import type { Tools } from '../ui/tools.ts';
import { bodyPoint } from '../trains/train.ts';
import { type Plan, shipPlan } from '../economy/shipping.ts';
import { drawAlerts, drawDockTags, drawMakeTags, drawRushTags, drawShipArrow, drawTownBadges, drawWaitBadges, MAKE_ZOOM } from './orders.ts';
import { stuckList, waitingForTrain } from '../ui/orders.ts';
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
  /** the station halls drawn last frame (screenshot checks find them here) */
  halls: import("../buildings/stations.ts").Hall[] = [];
  private plan: Plan = Object.assign(new Map(), { docks: new Map() });
  private planAt = -9;
  private alerts = new Set<number>();
  private waits = new Set<number>();
  private rates = new Map<number, number>();
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
    for (const b of g.s.buildings ?? []) if (b.kind === 'dock' && vis(b.y * n + b.x) && isRevealed(g, b.y * n + b.x)) drawQuay(ctx, g, b); // under the rails
    drawTrack(ctx, g.net, p => p.squares.some(vis), cam.z, p => {
      let k = 0; for (const q of p.squares) if (!g.world.terr[q]) k = Math.max(k, landDistance(g, q));
      return Math.min(3, k);
    });
    const halls = hallsOf(g.track, n, g.s.sites, g.world.terr, yardSet(g)); this.halls = halls;
    for (const h of halls) if (vis(h.squares[1]) && isRevealed(g, h.squares[1])) drawHall(ctx, g.s.seed, h, cam.z, tm);
    drawParks(ctx, g, x0, y0, x1, y1, cam.z, tm);
    drawSites(ctx, g, x0, y0, x1, y1, cam.z, tm, halls);
    for (const b of g.s.buildings ?? []) if (vis(b.y * n + b.x) && isRevealed(g, b.y * n + b.x)) drawFields(ctx, g, b, tm, cam.z);
    for (const b of g.s.buildings ?? []) if (vis(b.y * n + b.x) && isRevealed(g, b.y * n + b.x)) drawBuilding(ctx, g, b, tm, cam.z);
    for (const b of g.s.breaks ?? []) if (vis(b.square)) drawBreak(ctx, g, b, tm);
    drawTrains(ctx, g.net, g.s.trains, tm);
    drawShed(ctx, g, tm); // after trains: a train on the siding runs in under its roof
    this.drawTunnels(ctx, x0, y0, x1, y1); // after trains: they run into the hillside
    drawMishaps(ctx, g, tm, vis);
    for (const b of g.s.buildings ?? []) if (vis(b.y * n + b.x) && isRevealed(g, b.y * n + b.x)) drawBuildingTags(ctx, g, b, tm, cam.z); // names and stock over the trains
    // 🚢 the Ships card shows every sea route; a ship's card shows its way ahead
    if (this.tools?.card?.kind === 'ships') drawSeaRoutes(ctx, g, tm, cam.z);
    else if (this.tools?.card?.kind === 'ship') { const id = this.tools.card.id, s = g.s.ships?.find(x => x.id === id); if (s) drawSeaRoutes(ctx, g, tm, cam.z, s); }
    drawShips(ctx, g, tm, (x, y) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 2 && y <= y1 + 2 && !!isRevealed(g, Math.round(y) * n + Math.round(x)), cam.z);
    drawExplore(ctx, g, this.tools, tm, (x, y) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 2 && y <= y1 + 2, cam.z);
    if (tm - this.planAt > 1) { this.planAt = tm; this.plan = shipPlan(g); this.alerts = new Set(stuckList(g, this.plan).filter(x => x.bld !== undefined).map(x => x.bld!)); this.waits = new Set([...waitingForTrain(g, this.plan)].filter(i => !this.alerts.has(i))); this.rates = new Map((g.s.buildings ?? []).map(b => [b.id, outputOf(g, b)])); } // the plan changes slowly: once a second is plenty
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
    if (!this.tools?.view && cam.z < MAKE_ZOOM) { drawMakeTags(ctx, g, this.rates, this.alerts, this.waits, cam.z, (x, y) => x >= x0 - 4 && x <= x1 + 4 && y >= y0 - 4 && y <= y1 + 4); drawDockTags(ctx, g, cam.z); drawRushTags(ctx, g, cam.z, tm); }
    else if (!this.tools?.view) { drawAlerts(ctx, g, this.alerts, cam.z, tm); drawWaitBadges(ctx, g, this.waits, cam.z); drawDockTags(ctx, g, cam.z); drawRushTags(ctx, g, cam.z, tm); }
    this.drawNoGo(ctx, tm, x0, y0, x1, y1);
    this.drawStraits(ctx, tm, x0, y0, x1, y1);
    this.drawOverlay(ctx, tm);
    drawStorm(ctx, g, tm);
    drawLightning(ctx, g, tm); // lightning lights only its storm cloud, under the fog
    drawFog(ctx, g, x0, y0, x1, y1, cam.z, tm);
    drawScouting(ctx, g, this.tools, tm, cam.z); // scout routes run into the fog: draw them over it
    drawPoiZones(ctx, g, this.tools, tm, (x, y) => x >= x0 - 12 && x <= x1 + 12 && y >= y0 - 12 && y <= y1 + 12, cam.z); // landmark take-over squares and reach, over the fog
    drawMaps(ctx, g, this.tools, tm, cam.z);
    this.drawIslandNames(ctx, cam.z);
    ctx.restore();
    if (seasonOf(g.s.t) === 3) this.drawSnow(ctx, view, tm);
    const v = this.tools?.view; if (v) drawView(ctx, g, v, view, this.views.get(g, v, tm), tm, this.arrows);
  }

  /**
   * ⛰ Tunnels: track on a mountain square is under the hillside, so the mountain is drawn again over the rails and any
   * train inside, with a stone portal where the line runs in from open ground.
   */
  private drawTunnels(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    const g = this.g, n = g.world.n, M = 4;
    for (let y = Math.max(1, y0); y <= Math.min(n - 2, y1); y++) for (let x = Math.max(1, x0); x <= Math.min(n - 2, x1); x++) {
      const i = y * n + x, sq = g.track.get(i); if (!sq || g.world.terr[i] !== M) continue;
      this.terrain.drawSquareAt(ctx, x, y);
    }
    // a faint dashed line over the hill shows where the tunnel runs, like on a map
    ctx.save(); ctx.strokeStyle = 'rgba(40,30,22,.45)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineCap = 'round';
    for (let y = Math.max(1, y0); y <= Math.min(n - 2, y1); y++) for (let x = Math.max(1, x0); x <= Math.min(n - 2, x1); x++) {
      const i = y * n + x, sq = g.track.get(i); if (!sq || g.world.terr[i] !== M) continue;
      const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
      for (let d = 0; d < 4; d++) if (sq.links & (1 << d)) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + [1, 0, -1, 0][d]! * TILE / 2, cy + [0, 1, 0, -1][d]! * TILE / 2); ctx.stroke(); }
    }
    ctx.restore();
    for (let y = Math.max(1, y0); y <= Math.min(n - 2, y1); y++) for (let x = Math.max(1, x0); x <= Math.min(n - 2, x1); x++) {
      const i = y * n + x, sq = g.track.get(i); if (!sq || g.world.terr[i] !== M) continue;
      for (let d = 0; d < 4; d++) {
        if (!(sq.links & (1 << d))) continue;
        const j = (y + [0, 1, 0, -1][d]!) * n + x + [1, 0, -1, 0][d]!; if (g.world.terr[j] === M) continue;
        const half = sq.dbl || g.track.get(j)?.dbl ? 17 : 10; // a wider bore for double track
        ctx.save(); ctx.translate((x + 0.5) * TILE, (y + 0.5) * TILE); ctx.rotate(d * Math.PI / 2); ctx.translate(TILE / 2 - 3, 0);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-2, -half - 3, 6, half * 2 + 6);                  // shadow on the hillside
        ctx.fillStyle = '#a59e92'; ctx.fillRect(-3, -half - 3, 5, half * 2 + 6);                         // the stone face
        ctx.strokeStyle = 'rgba(60,54,46,.45)'; ctx.lineWidth = 0.4;
        for (let k = -half - 1; k < half + 3; k += 3) { ctx.beginPath(); ctx.moveTo(-3, k); ctx.lineTo(2, k); ctx.stroke(); }
        ctx.fillStyle = '#17130f'; ctx.fillRect(-3, -half + 1, 3.5, half * 2 - 2);                       // the dark bore
        ctx.fillStyle = '#8a8276'; ctx.fillRect(-4, -half - 3, 1.6, half * 2 + 6);                       // the parapet edge
        ctx.restore();
      }
    }
  }

  private railed = { size: -1, set: new Set<number>() };
  /** Rails mode: a dashed red-orange line on coasts that face another island across a narrow gap, named once per island in view. */
  private drawStraits(ctx: CanvasRenderingContext2D, tm: number, x0: number, y0: number, x1: number, y1: number) {
    const t = this.tools, g = this.g, n = g.world.n;
    if (t?.mode !== 'rail' && t?.mode !== 'double') return;
    const k = Math.max(1, 1 / g.s.camera.z), labels = new Map<number, { x: number; y: number; c: number }>();
    if (this.railed.size !== g.track.size) { const s = new Set<number>(); for (const i of g.track.keys()) s.add(g.world.islandOf[i]!); this.railed = { size: g.track.size, set: s }; }
    const railed = this.railed.set;
    ctx.save(); ctx.strokeStyle = `rgba(255,120,80,${0.65 + 0.2 * Math.sin(tm * 3)})`; ctx.lineWidth = 2.2 * k; ctx.setLineDash([5 * k, 4 * k]); ctx.lineCap = 'round';
    ctx.beginPath();
    for (const e of straitCoasts(g)) {
      const x = e.i % n, y = (e.i / n) | 0;
      if (x < x0 || x > x1 || y < y0 || y > y1 || !isRevealed(g, e.i)) continue;
      const X = x * TILE, Y = y * TILE;
      if (e.d === 0) { ctx.moveTo(X + TILE, Y); ctx.lineTo(X + TILE, Y + TILE); }
      else if (e.d === 1) { ctx.moveTo(X, Y + TILE); ctx.lineTo(X + TILE, Y + TILE); }
      else if (e.d === 2) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + TILE); }
      else { ctx.moveTo(X, Y); ctx.lineTo(X + TILE, Y); }
      if (railed.has(e.isl)) continue; // name only the islands the railway hasn't reached
      const l = labels.get(e.isl) ?? { x: 0, y: 0, c: 0 }; l.x += x; l.y += y; l.c++; labels.set(e.isl, l);
    }
    ctx.stroke(); ctx.restore();
    ctx.font = `700 ${11 * k}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [isl, l] of labels) {
      const name = g.world.islands[isl]?.name ?? 'Small island', X = (l.x / l.c + 0.5) * TILE, Y = (l.y / l.c + 0.5) * TILE;
      const text = `🏝 ${name}`, w = ctx.measureText(text).width + 12 * k, h = 17 * k;
      ctx.fillStyle = 'rgba(20,16,12,.8)'; ctx.beginPath(); ctx.roundRect(X - w / 2, Y - h / 2, w, h, 7 * k); ctx.fill(); ctx.fillStyle = '#ffb08a'; ctx.fillText(text, X, Y + 0.5 * k);
    }
  }

  private noGo = { key: '', at: -9, set: [] as number[] };
  /** Rails and Build mode: a faint red tint on every square in view where the player can't build. */
  private drawNoGo(ctx: CanvasRenderingContext2D, tm: number, x0: number, y0: number, x1: number, y1: number) {
    const t = this.tools, g = this.g, n = g.world.n;
    const k = t?.mode === 'rail' || t?.mode === 'double' ? 'rail' : t?.mode === 'build' && t.buildKind ? t.buildKind : '';
    if (!k) return;
    const key = `${k}/${x0},${y0},${x1},${y1}/${g.track.size}/${g.s.buildings?.length ?? 0}/${g.s.parks?.length ?? 0}`;
    if (key !== this.noGo.key || tm - this.noGo.at > 1) { // the fog and buildings change slowly: once a second is plenty
      const set: number[] = [];
      for (let y = Math.max(0, y0); y <= Math.min(n - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(n - 1, x1); x++) {
        const i = y * n + x; if (k === 'rail' ? railNoGo(g, i) : buildNoGo(g, k as IndustryKind, i)) set.push(i);
      }
      this.noGo = { key, at: tm, set };
    }
    ctx.fillStyle = 'rgba(225,60,40,.17)'; ctx.strokeStyle = 'rgba(225,60,40,.22)'; ctx.lineWidth = 1;
    for (const i of this.noGo.set) { const x = (i % n) * TILE, y = ((i / n) | 0) * TILE; ctx.fillRect(x, y, TILE, TILE); ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1); }
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
        // a faint picture of what will stand there: the loading track's rails and the building itself
        const P = t.preview, ys = yardSquares(n, P);
        ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2;
        const a0 = ys[0]!, a1 = ys.at(-1)!, ax = (a0 % n + 0.5) * TILE, ay = (((a0 / n) | 0) + 0.5) * TILE, bx = (a1 % n + 0.5) * TILE, by = (((a1 / n) | 0) + 0.5) * TILE;
        const ex = P.horizontal ? TILE / 2 : 0, ey = P.horizontal ? 0 : TILE / 2, ox = P.horizontal ? 0 : 4, oy = P.horizontal ? 4 : 0;
        for (const o of [-1, 1]) { ctx.beginPath(); ctx.moveTo(ax - ex + ox * o, ay - ey + oy * o); ctx.lineTo(bx + ex + ox * o, by + ey + oy * o); ctx.stroke(); }
        ctx.lineWidth = 1.2; for (let k = 0; k <= 16; k++) { const f = k / 16, x = ax - ex + (bx + ex - ax + ex) * f, y = ay - ey + (by + ey - ay + ey) * f; ctx.beginPath(); ctx.moveTo(x - ox * 1.6, y - oy * 1.6); ctx.lineTo(x + ox * 1.6, y + oy * 1.6); ctx.stroke(); }
        ctx.globalAlpha = 0.5; drawBuilding(ctx, this.g, { id: -1, kind: this.tools!.buildKind ?? 'wood', x: P.x, y: P.y, horizontal: P.horizontal, side: P.side, lvl: 1, stock: 0, ...(P.len ? { len: P.len } : {}) }, tm, this.g.s.camera.z);
        ctx.restore();
        // where the railway joins: in line with the loading track, at either end
        const pulse = 0.55 + 0.45 * Math.sin(tm * 4), z = this.g.s.camera.z, f = 1.6 / z;
        const ends = [[a0, -1], [a1, 1]] as const;
        for (const [e, d] of ends) {
          const X = (e % n + 0.5) * TILE + (P.horizontal ? d * TILE * 0.95 : 0), Y = (((e / n) | 0) + 0.5) * TILE + (P.horizontal ? 0 : d * TILE * 0.95);
          ctx.save(); ctx.translate(X, Y); ctx.rotate((P.horizontal ? 0 : Math.PI / 2) + (d < 0 ? 0 : Math.PI));
          ctx.globalAlpha = pulse; ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.moveTo(-9 * f, -6 * f); ctx.lineTo(3 * f, 0); ctx.lineTo(-9 * f, 6 * f); ctx.closePath(); ctx.fill(); ctx.restore();
        }
        if (!bad0) { // a label beside the loading track, on the side away from the building
          const m1 = ys[1]!, m2 = ys[2]!, k = 1 / z, off = -P.side * (TILE / 2 + 10 * k);
          let X = ((m1 % n) + (m2 % n)) / 2 * TILE + TILE / 2 + (P.horizontal ? 0 : off); const Y = (((m1 / n) | 0) + ((m2 / n) | 0)) / 2 * TILE + TILE / 2 + (P.horizontal ? off : 0);
          const text = '🛤 loading track · your rails join it at either end ▸';
          ctx.font = `700 ${11 * k}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const w = ctx.measureText(text).width + 12 * k, h = 17 * k;
          if (!P.horizontal) X += -P.side * (w / 2 - 10 * k);
          ctx.fillStyle = 'rgba(20,16,12,.85)'; ctx.beginPath(); ctx.roundRect(X - w / 2, Y - h / 2, w, h, 7 * k); ctx.fill(); ctx.fillStyle = '#bfe4ff'; ctx.fillText(text, X, Y + 0.5 * k);
        }
        // a drag handle in the middle of the building row
        const bs = buildingSquares(n, t.preview), m = bs[0]!, m2 = bs.at(-1)!, hx = ((m % n) + (m2 % n)) / 2 * TILE + TILE / 2, hy = (((m / n) | 0) + ((m2 / n) | 0)) / 2 * TILE + TILE / 2;
        ctx.fillStyle = 'rgba(28,22,16,.75)'; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✥', hx, hy + 0.5);
        // ⟳ turn arrows just off each corner: tap one to turn the building a quarter turn
        const k = Math.max(1, 1.2 / this.g.s.camera.z), r = 9 * k;
        for (const c of turnSquares(n, t.preview)) {
          const X = (c % n + 0.5) * TILE, Y = (((c / n) | 0) + 0.5) * TILE;
          ctx.fillStyle = 'rgba(40,90,150,.92)'; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2 * k; ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8 * k; ctx.beginPath(); ctx.arc(X, Y, r * 0.5, -Math.PI * 0.9, Math.PI * 0.5); ctx.stroke();
          const ax = X, ay = Y + r * 0.5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ax + 3 * k, ay); ctx.lineTo(ax - 1.5 * k, ay - 3 * k); ctx.lineTo(ax - 1.5 * k, ay + 3 * k); ctx.fill();
        }
      }
    }
    if (t.mode === 'rail' && (!t.plan || t.plan.path.length <= 1)) this.drawRailGuide(ctx, tm, box);
    if (t.card?.kind === 'ship') { // the open ship: a gold ring
      const sh = this.g.s.ships?.find(x => x.id === t.card!.id);
      if (sh) { const p = shipPlace(this.g, sh); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((p.x + 0.5) * TILE, (p.y + 0.5) * TILE, 16 + Math.sin(tm * 5), 0, 7); ctx.stroke(); }
    }
    if (t.selected !== null) {
      const tr = this.g.s.trains.find(x => x.id === t.selected);
      if (tr) { const p = bodyPoint(this.g.net, tr, 8); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 14 + Math.sin(tm * 5), 0, 7); ctx.stroke(); }
    }
  }

  /** Rails mode: where track can start (Ashford at first), where it joins each town not on the railway, and the ends of loose yards. */
  private drawRailGuide(ctx: CanvasRenderingContext2D, tm: number, box: (i: number, fill: string, stroke: string) => void) {
    const g = this.g, n = g.world.n, p = 0.5 + 0.5 * Math.sin(tm * 4), k = 1 / g.s.camera.z;
    const pill = (X: number, Y: number, text: string, col: string) => {
      ctx.font = `700 ${11 * k}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(text).width + 12 * k, h = 17 * k;
      ctx.fillStyle = 'rgba(20,16,12,.85)'; ctx.beginPath(); ctx.roundRect(X - w / 2, Y - h / 2, w, h, 7 * k); ctx.fill(); ctx.fillStyle = col; ctx.fillText(text, X, Y + 0.5 * k);
    };
    const glow = (i: number) => box(i, `rgba(255,214,120,${0.12 + 0.2 * p})`, `rgba(255,214,120,${0.6 + 0.4 * p})`);
    if (!g.track.size) { // the first track starts on Ashford
      const a = g.s.sites[0]!; glow(a.y * n + a.x);
      pill((a.x + 0.5) * TILE, (a.y - 0.6) * TILE, '🛤 Start here: drag from Ashford outward', '#ffd27a');
      return;
    }
    // an arrow on square i pointing toward square j (where track may come in)
    const arrow = (i: number, j: number) => {
      const X = (i % n + 0.5) * TILE, Y = ((i / n | 0) + 0.5) * TILE, a = Math.atan2((j / n | 0) - (i / n | 0), j % n - i % n);
      ctx.save(); ctx.translate(X, Y); ctx.rotate(a); ctx.fillStyle = `rgba(255,214,120,${0.7 + 0.3 * p})`; ctx.strokeStyle = 'rgba(40,28,10,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -7); ctx.lineTo(-2, 0); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    };
    const open = (i: number) => { const t = g.world.terr[i]; return t !== undefined && t !== 0 && t !== 4; }; // not sea or mountain
    for (const s of g.s.sites) { // towns found but not on the railway: show where track may come in
      if (s.kind !== 'town' || !isRevealed(g, s.y * n + s.x) || townLinked(g, s)) continue;
      const c = s.y * n + s.x, h = hallOf(g.track, n, s, g.world.terr, yardSet(g));
      if (h) { // a station already stands there: join one of its ends
        for (const [e, inner] of [[h.approaches[0], h.squares[0]], [h.approaches[1], h.squares[2]]] as const) if (open(e) || g.track.has(e)) { glow(e); arrow(e, inner); }
        pill((s.x + 0.5) * TILE, (s.y - 1.4) * TILE, `🛤 Join ${s.name ?? 'the town'}'s station at an arrow`, '#ffd27a');
        continue;
      }
      const gap = joinGap(g, s);
      if (gap) { // your track comes close: the gold squares (drawn with the town badges) are the way in, nothing else
        const top = Math.min(s.y, ...gap.squares.map(i => (i / n) | 0));
        pill((s.x + 0.5) * TILE, (top - 0.45) * TILE, `🛤 Join ${s.name ?? 'the town'}: lay track over the gold squares`, '#ffd27a');
        continue;
      }
      glow(c);
      for (const j of [c + 1, c - 1, c + n, c - n]) if (open(j) && !g.track.has(j)) arrow(j, c);
      ctx.setLineDash([5 * k, 4 * k]); ctx.strokeStyle = `rgba(255,214,120,${0.5 + 0.4 * p})`; ctx.lineWidth = 2 * k;
      ctx.beginPath(); ctx.arc((s.x + 0.5) * TILE, (s.y + 0.5) * TILE, TILE * 1.6, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      pill((s.x + 0.5) * TILE, (s.y - 1.4) * TILE, `🛤 Join ${s.name ?? 'the town'}: lay track to an arrow`, '#ffd27a');
    }
    for (const b of g.s.buildings ?? []) { // loose buildings: the two squares just past their loading track
      if (b.kind === 'dock' || isLinked(g, b)) continue;
      const ys = yardSquares(n, b), st = b.horizontal ? 1 : n;
      for (const e of [ys[0]! - st, ys.at(-1)! + st]) if (!g.track.has(e)) glow(e);
      const m = ys[1]!; pill((m % n + 1) * TILE, ((m / n) | 0) * TILE - 6 * k, '🛤 join at either end of the loading track', '#bfe4ff');
    }
  }

  /** Winter flakes: each with its own random start, speed, size, sway and wind; a new random spot each time it falls. */
  private flakes: { x: number; y: number; sp: number; r: number; sw: number; sf: number; ph: number; wind: number; a: number }[] = [];
  private drawSnow(ctx: CanvasRenderingContext2D, view: View, tm: number) {
    const want = Math.round(view.w * view.h / 3500), H = view.h + 20;
    while (this.flakes.length < want) this.flakes.push({ x: Math.random(), y: Math.random(), sp: 14 + Math.random() * 26, r: 0.6 + Math.random() * 1.4, sw: 4 + Math.random() * 14, sf: 0.4 + Math.random() * 1.2, ph: Math.random() * 7, wind: (Math.random() - 0.3) * 8, a: 0.45 + Math.random() * 0.45 });
    for (let k = 0; k < want; k++) {
      const f = this.flakes[k]!, fall = f.y * H + tm * f.sp, lap = Math.floor(fall / H);
      // each time it starts again at the top it gets a fresh random column, so no flake keeps to one line
      const h = Math.sin((k + 1) * 12.9898 + lap * 78.233) * 43758.5453, rx = h - Math.floor(h);
      const y = fall - lap * H - 10, x = (((f.x + rx) * view.w + tm * f.wind + Math.sin(tm * f.sf + f.ph) * f.sw) % view.w + view.w) % view.w;
      ctx.fillStyle = `rgba(255,255,255,${f.a})`; ctx.beginPath(); ctx.arc(x, y, f.r, 0, 7); ctx.fill();
    }
  }

  private islandAt = -1; private islandInfo = new Map<number, { towns: number; linked: number; trains: number; ships: number }>();
  /** Per island: towns found and on the railway, trains and ships there (counted once a second). */
  private islandStats() {
    const g = this.g, n = g.world.n, now = performance.now();
    if (now - this.islandAt < 1000) return this.islandInfo;
    this.islandAt = now; const m = this.islandInfo; m.clear();
    const get = (k: number) => { let o = m.get(k); if (!o) m.set(k, o = { towns: 0, linked: 0, trains: 0, ships: 0 }); return o; };
    for (const s of g.s.sites) if (s.kind === 'town' && isRevealed(g, s.y * n + s.x)) { const o = get(g.world.islandOf[s.y * n + s.x]!); o.towns++; if (townLinked(g, s)) o.linked++; }
    for (const t of g.s.trains) { const sq = t.trail.length ? g.net.pieces[t.trail.at(-1)!.piece]?.squares[0] : undefined; if (sq !== undefined) get(g.world.islandOf[sq]!).trains++; }
    for (const s of g.s.ships ?? []) { const d = g.s.buildings?.find(b => b.id === s.at); if (d) get(g.world.islandOf[d.y * n + d.x]!).ships++; }
    return m;
  }

  private drawIslandNames(ctx: CanvasRenderingContext2D, z: number) {
    if (z >= 0.8) return;
    const g = this.g, n = g.world.n, info = this.islandStats();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    g.world.islands.forEach((o, k) => {
      if (!o.name || !isRevealed(g, Math.round(o.cy) * n + Math.round(o.cx))) return;
      const X = (o.cx + 0.5) * TILE, Y = (o.cy + 0.5) * TILE - TILE * (k === g.world.home ? 6 : 1.5), f = Math.round(15 / z);
      ctx.font = `italic 700 ${f}px Georgia,serif`; ctx.lineWidth = 4 / z; ctx.strokeStyle = 'rgba(20,18,14,.75)';
      ctx.strokeText(o.name, X, Y); ctx.fillStyle = k === g.world.home ? 'rgba(255,226,160,.95)' : 'rgba(200,215,235,.85)'; ctx.fillText(o.name, X, Y);
      const sp = islandSpec(g, k); let yy = Y + f * 0.9;
      if (sp) { const t = `★ ${SPEC_TEXT[sp]}`; ctx.font = `600 ${Math.round(f * 0.6)}px system-ui`; ctx.strokeText(t, X, yy); ctx.fillStyle = 'rgba(255,214,120,.9)'; ctx.fillText(t, X, yy); yy += f * 0.85; }
      const st = info.get(k); if (!st) return;
      const t = st.linked ? `🏘 ${st.linked}/${st.towns} towns · 🚂 ${st.trains}${st.ships ? ` · 🚢 ${st.ships}` : ''}` : st.towns ? `⛵ not reached yet · ${st.towns} town${st.towns === 1 ? '' : 's'} found` : '';
      if (!t) return;
      ctx.font = `600 ${Math.round(f * 0.6)}px system-ui`; const w = ctx.measureText(t).width + f * 0.8, h = f * 0.95;
      ctx.fillStyle = 'rgba(20,16,12,.8)'; ctx.beginPath(); ctx.roundRect(X - w / 2, yy - h / 2, w, h, h / 2); ctx.fill();
      ctx.fillStyle = st.linked ? '#e8f4ff' : '#c8d2dc'; ctx.fillText(t, X, yy + f * 0.03);
    });
  }
}
