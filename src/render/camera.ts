import { TILE } from '../world/terrain.ts';

export interface Camera { x: number; y: number; z: number }
export interface View { w: number; h: number }

export const ZOOM_MIN = 0.1, ZOOM_MAX = 3.4;

export const toWorld = (c: Camera, v: View, sx: number, sy: number): [number, number] =>
  [(sx - v.w / 2) / c.z + c.x, (sy - v.h / 2) / c.z + c.y];
export const toScreen = (c: Camera, v: View, wx: number, wy: number): [number, number] =>
  [(wx - c.x) * c.z + v.w / 2, (wy - c.y) * c.z + v.h / 2];
export const toSquare = (c: Camera, v: View, sx: number, sy: number): [number, number] => {
  const [wx, wy] = toWorld(c, v, sx, sy); return [Math.floor(wx / TILE), Math.floor(wy / TILE)];
};

/** Zoom keeping the world point under (sx, sy) fixed. */
export function zoomAt(c: Camera, v: View, sx: number, sy: number, z: number) {
  const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  const [wx, wy] = toWorld(c, v, sx, sy);
  c.z = nz;
  c.x = wx - (sx - v.w / 2) / nz;
  c.y = wy - (sy - v.h / 2) / nz;
}

export function clampCamera(c: Camera, n: number) {
  const max = n * TILE;
  c.x = Math.max(0, Math.min(max, c.x));
  c.y = Math.max(0, Math.min(max, c.y));
}
