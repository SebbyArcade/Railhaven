import type { Game } from '../state.ts';
import { isRevealed } from '../world/fog.ts';
import { TILE } from '../world/terrain.ts';
import { type View, toWorld } from './camera.ts';
import { drawFog } from './fog.ts';
import { drawSites } from './sites.ts';
import { drawHall } from './stations.ts';
import { hallsOf } from '../buildings/stations.ts';
import { TerrainCache } from './terrainCache.ts';
import { drawWaterLive } from './terrainArt.ts';
import { drawTrack } from './track.ts';
import { drawTrains } from './trains.ts';
import type { Tools } from '../ui/tools.ts';
import { bodyPoint } from '../trains/train.ts';

/** Draws one frame. Reads the game, never changes it. */
export class Renderer {
  readonly terrain: TerrainCache;
  constructor(private g: Game, private tools?: Tools) {
    this.terrain = new TerrainCache(g.world, i => g.track.has(i));
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
    this.terrain.draw(ctx, x0, y0, x1, y1, cam.z);
    if (cam.z >= 0.6) {
      for (let y = Math.max(0, y0); y <= Math.min(n - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(n - 1, x1); x++)
        if (g.world.terr[y * n + x] === 0 && isRevealed(g, y * n + x)) drawWaterLive(ctx, g.world, x, y, tm);
    }
    const vis = (sq: number) => { const x = sq % n, y = (sq / n) | 0; return x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1; };
    drawTrack(ctx, g.net, p => p.squares.some(vis), cam.z);
    const halls = hallsOf(g.track, n, g.s.sites);
    for (const h of halls) if (vis(h.squares[1]) && isRevealed(g, h.squares[1])) drawHall(ctx, g.s.seed, h, cam.z);
    drawSites(ctx, g, x0, y0, x1, y1, cam.z, tm, halls);
    drawTrains(ctx, g.net, g.s.trains, tm);
    this.drawOverlay(ctx, tm);
    drawFog(ctx, g, x0, y0, x1, y1, cam.z, tm);
    this.drawIslandNames(ctx, cam.z);
    ctx.restore();
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
    if (t.mode === 'rail' && !t.plan) { // show where track may start
      const a = this.g.s.sites[0]!, p = 0.5 + 0.5 * Math.sin(tm * 4);
      if (!this.g.track.size) box(a.y * n + a.x, `rgba(255,214,120,${0.15 + 0.2 * p})`, 'rgba(255,214,120,.9)');
    }
    if (t.selected !== null) {
      const tr = this.g.s.trains.find(x => x.id === t.selected);
      if (tr) { const p = bodyPoint(this.g.net, tr, 8); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 14 + Math.sin(tm * 5), 0, 7); ctx.stroke(); }
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
    });
  }
}
