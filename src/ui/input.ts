import { type Camera, type View, clampCamera, zoomAt } from '../render/camera.ts';

export interface InputHandlers {
  /** a tap (short press, little movement) at screen coordinates */
  tap(sx: number, sy: number): void;
  /** a one-finger drag starts here: return true to take it (painting) instead of panning */
  dragStart?(sx: number, sy: number): boolean;
  dragMove?(sx: number, sy: number): void;
  dragEnd?(): void;
}

/**
 * Touch and mouse: one finger pans, two fingers pinch, a short press is a tap. The wheel zooms.
 * The canvas blocks the browser's own scrolling and zooming.
 */
export function attachInput(el: HTMLElement, cam: () => Camera, view: () => View, mapSize: () => number, h: InputHandlers) {
  el.style.touchAction = 'none';
  const pts = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number; t: number } | null = null, moved = 0, pinch: { d: number; z: number } | null = null, multi = false, painting = false;
  const rel = (e: PointerEvent | WheelEvent) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    const p = rel(e); pts.set(e.pointerId, p);
    if (pts.size === 1) { down = { ...p, t: performance.now() }; moved = 0; multi = false; painting = !!h.dragStart?.(p.x, p.y); }
    if (pts.size === 2) {
      if (painting) { painting = false; h.dragEnd?.(); }
      multi = true; const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), z: cam().z };
    }
  });
  // while painting near the screen edge, the map slides along so a long line can be drawn in one go
  let last: { x: number; y: number } | null = null, edgeRaf = 0;
  const edgePan = () => {
    edgeRaf = 0; if (!painting || !last || pts.size !== 1) return;
    const r = el.getBoundingClientRect(), m = 48, c = cam();
    const ex = last.x < m ? -1 : last.x > r.width - m ? 1 : 0, ey = last.y < m + 40 ? -1 : last.y > r.height - m - 110 ? 1 : 0;
    if (ex || ey) { c.x += ex * 5 / c.z; c.y += ey * 5 / c.z; clampCamera(c, mapSize()); h.dragMove?.(last.x, last.y); }
    edgeRaf = requestAnimationFrame(edgePan);
  };
  el.addEventListener('pointermove', e => {
    const prev = pts.get(e.pointerId); if (!prev) return;
    const p = rel(e), c = cam();
    if (pts.size === 1 && painting) { moved += Math.hypot(p.x - prev.x, p.y - prev.y); last = p; h.dragMove?.(p.x, p.y); if (!edgeRaf) edgeRaf = requestAnimationFrame(edgePan); }
    else if (pts.size === 1) {
      c.x -= (p.x - prev.x) / c.z; c.y -= (p.y - prev.y) / c.z; moved += Math.hypot(p.x - prev.x, p.y - prev.y);
    } else if (pts.size === 2 && pinch) {
      const mid = () => { const [a, b] = [...pts.values()]; return { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2, d: Math.hypot(a!.x - b!.x, a!.y - b!.y) }; };
      const m0 = mid(); pts.set(e.pointerId, p); const m1 = mid();
      c.x -= (m1.x - m0.x) / c.z; c.y -= (m1.y - m0.y) / c.z;
      zoomAt(c, view(), m1.x, m1.y, pinch.z * (m1.d / Math.max(1, pinch.d)));
    }
    pts.set(e.pointerId, p); clampCamera(c, mapSize());
  });
  const up = (e: PointerEvent) => {
    const had = pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (had && painting && pts.size === 0) { painting = false; h.dragEnd?.(); if (moved < 10) { const p = rel(e); h.tap(p.x, p.y); } }
    else if (had && pts.size === 0 && down && !multi && moved < 10 && performance.now() - down.t < 600) { const p = rel(e); h.tap(p.x, p.y); }
    if (pts.size === 0) down = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; down = null; if (painting) { painting = false; h.dragEnd?.(); } });
  el.addEventListener('wheel', e => { e.preventDefault(); const p = rel(e), c = cam(); zoomAt(c, view(), p.x, p.y, c.z * Math.exp(-e.deltaY * 0.0015)); clampCamera(c, mapSize()); }, { passive: false });
  el.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  // A finger tap ends with the browser's own click at the same spot, sent to whatever is there after the tap was handled.
  // A tap that opens a card put a card button there, which got pressed (he tapped an upgradable town and got the map
  // purchase, 2026-11-16). The canvas works from pointer events only, so its taps never need that click.
  el.addEventListener('touchend', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  el.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') lastTap = { x: e.clientX, y: e.clientY, at: performance.now() }; }, true);
}

/** Where and when the last finger tap on the map ended. */
let lastTap = { x: 0, y: 0, at: -1e9 };
// Backstop for browsers that still send the tap's click: a click right on the spot of a map tap, just after it, is dropped
// unless it lands on the map itself.
addEventListener('click', e => {
  if (e.target instanceof HTMLCanvasElement) return;
  if (performance.now() - lastTap.at < 450 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) { e.stopPropagation(); e.preventDefault(); }
}, true);
