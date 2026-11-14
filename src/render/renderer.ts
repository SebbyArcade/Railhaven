import type { Game } from '../state.ts';
import { isRevealed } from '../world/fog.ts';
import { TILE } from '../world/terrain.ts';
import { type View, toWorld } from './camera.ts';
import { drawFog } from './fog.ts';
import { drawSites } from './sites.ts';
import { TerrainCache } from './terrainCache.ts';
import { drawWaterLive } from './terrainArt.ts';

/** Draws one frame. Reads the game, never changes it. */
export class Renderer {
  readonly terrain: TerrainCache;
  constructor(private g: Game) {
    this.terrain = new TerrainCache(g.world, () => false);
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
    drawSites(ctx, g, x0, y0, x1, y1, cam.z, tm);
    drawFog(ctx, g, x0, y0, x1, y1, cam.z, tm);
    this.drawIslandNames(ctx, cam.z);
    ctx.restore();
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
