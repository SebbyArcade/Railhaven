import { type World, TILE } from '../world/terrain.ts';
import { type ArtCtx, drawSquare, seaDepthMap } from './terrainArt.ts';

const CHUNK = 16;          // squares per chunk side
const CHUNK_SCALE = 2;     // pixels per world unit when baked (sharp up to zoom 2 on DPR 1, fine on phones)
const MAX_CHUNKS = 64;
const OVERVIEW_PX = 4;     // pixels per square in the far-zoom overview

type Canvasish = HTMLCanvasElement | OffscreenCanvas;
const makeCanvas = (w: number, h: number): Canvasish =>
  typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });

/** Bakes the still terrain into chunk images so a frame only copies pictures. */
export class TerrainCache {
  private chunks = new Map<number, Canvasish>();
  private overview: Canvasish | null = null;
  private art: ArtCtx;
  season = 0;

  constructor(private w: World, hasTrack: (i: number) => boolean, stump?: (i: number) => number) {
    this.art = { w, se: 0, depth: seaDepthMap(w), hasTrack, stump };
  }

  /** Forget baked images touching these squares (terrain or track changed). */
  invalidate(squares?: Iterable<number>) {
    this.overview = null;
    if (!squares) { this.chunks.clear(); return; }
    const per = Math.ceil(this.w.n / CHUNK);
    for (const i of squares) {
      const x = i % this.w.n, y = (i / this.w.n) | 0;
      this.chunks.delete(Math.floor(y / CHUNK) * per + Math.floor(x / CHUNK));
    }
  }

  setSeason(se: number) { if (se !== this.season) { this.season = this.art.se = se; this.invalidate(); } }

  private bake(cx: number, cy: number): Canvasish {
    const size = CHUNK * TILE * CHUNK_SCALE, cv = makeCanvas(size, size);
    const c = cv.getContext('2d') as CanvasRenderingContext2D;
    c.scale(CHUNK_SCALE, CHUNK_SCALE);
    const n = this.w.n;
    for (let y = cy * CHUNK; y < Math.min(n, cy * CHUNK + CHUNK); y++)
      for (let x = cx * CHUNK; x < Math.min(n, cx * CHUNK + CHUNK); x++) {
        // trees and peaks overhang their square, so draw each square in place in row order
        drawSquare(c, this.art, x, y, (x - cx * CHUNK) * TILE, (y - cy * CHUNK) * TILE, true);
      }
    return cv;
  }

  private bakeOverview(): Canvasish {
    const n = this.w.n, cv = makeCanvas(n * OVERVIEW_PX, n * OVERVIEW_PX), c = cv.getContext('2d') as CanvasRenderingContext2D;
    c.scale(OVERVIEW_PX / TILE, OVERVIEW_PX / TILE);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) drawSquare(c, this.art, x, y, x * TILE, y * TILE, false);
    return cv;
  }

  /** Draw the terrain covering squares x0..x1, y0..y1 (context already in world units). */
  draw(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, zoom: number) {
    if (zoom < 0.6) {
      if (!this.overview) this.overview = this.bakeOverview();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.overview as CanvasImageSource, 0, 0, this.w.n * TILE, this.w.n * TILE);
      return;
    }
    const per = Math.ceil(this.w.n / CHUNK);
    const cx0 = Math.max(0, Math.floor(x0 / CHUNK)), cy0 = Math.max(0, Math.floor(y0 / CHUNK));
    const cx1 = Math.min(per - 1, Math.floor(x1 / CHUNK)), cy1 = Math.min(per - 1, Math.floor(y1 / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cy * per + cx;
      let cv = this.chunks.get(key);
      if (!cv) {
        cv = this.bake(cx, cy);
        if (this.chunks.size >= MAX_CHUNKS) this.chunks.delete(this.chunks.keys().next().value!);
      } else this.chunks.delete(key);
      this.chunks.set(key, cv); // most recently used last
      ctx.drawImage(cv as CanvasImageSource, cx * CHUNK * TILE, cy * CHUNK * TILE, CHUNK * TILE, CHUNK * TILE);
    }
  }
}
