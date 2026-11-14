import { Rng } from '../core/rng.ts';
import type { Resource, Site } from '../state.ts';
import { type World, isLand, T } from './terrain.ts';

export const TOWN_NAMES = ['Ashford', 'Brinemoor', 'Gullhaven', 'Tidewick', 'Marrow Cove', 'Seacombe', 'Ravensholm',
  'Driftmere', 'Kelpstone', 'Harrowgate', 'Windmere', 'Coldharbour', 'Fernley', 'Oakhurst', 'Pebbleford', 'Rookwell',
  'Saltash', 'Thornwick', 'Wrexham Vale', 'Larkspur', 'Millbrook', 'Stonecroft', 'Bramwell', 'Highfold'];

/** Mines sit at the foot of mountains: land touching 2+ mountain squares. */
export function mountainsAround(w: World, x: number, y: number): number {
  let c = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (w.terr[(y + j) * w.n + x + i] === T.Mountain) c++;
  return c;
}
export const isMountainFoot = (w: World, x: number, y: number) => isLand(w, x, y) && w.terr[y * w.n + x] !== T.Mountain && mountainsAround(w, x, y) >= 2;

/**
 * Place towns, settlement sites and deposits for a new game. Seeded, so a seed always gives the same start.
 * Rules carried over: Ashford in the centre, one town 9-15 squares out, three more 16-30 out, towns 11+ apart,
 * a coal seam near Ashford, iron and oil only on outer islands, richer deposits farther out.
 * Returns extra mountain squares added so a ridge is within reach of Ashford.
 */
export function generateSites(w: World): { sites: Site[]; mountains: number[] } {
  const rng = new Rng(w.seed * 7919 + 17);
  const C = w.cx, n = w.n, sites: Site[] = [];
  const add = (s: Omit<Site, 'id'>) => { const site = { id: sites.length, ...s } as Site; sites.push(site); return site; };
  let nameI = 0;
  const nextName = () => {
    const k = nameI++;
    return TOWN_NAMES[k % TOWN_NAMES.length]! + (k >= TOWN_NAMES.length ? ' ' + ['Isle', 'Haven', 'Point', 'Reach'][Math.floor(k / TOWN_NAMES.length) % 4] : '');
  };
  add({ kind: 'town', x: C, y: C, pop: 60, name: nextName() });

  const mountains: number[] = [];
  const nearFoot = () => {
    for (let y = C - 10; y <= C + 10; y++) for (let x = C - 10; x <= C + 10; x++) {
      const d = Math.hypot(x - C, y - C); if (d >= 5 && d <= 10 && isMountainFoot(w, x, y)) return true;
    }
    return false;
  };
  if (!nearFoot()) {
    const a = rng.next() * 6.283, cx = Math.round(C + Math.cos(a) * 9), cy = Math.round(C + Math.sin(a) * 9), px = -Math.sin(a), py = Math.cos(a);
    for (let t = -3; t <= 3; t++) for (const r of [0, 1]) {
      const x = Math.round(cx + px * t + Math.cos(a) * r), y = Math.round(cy + py * t + Math.sin(a) * r), i = y * n + x;
      if (x > 1 && y > 1 && x < n - 2 && y < n - 2 && w.terr[i]! > 0 && w.terr[i] !== T.Mountain) { w.terr[i] = T.Mountain; mountains.push(i); }
    }
  }

  const free = (x: number, y: number) => !sites.some(s => Math.hypot(s.x - x, s.y - y) < 5);
  const apart = (x: number, y: number) => !sites.some(o => (o.kind === 'town' || o.kind === 'plot') && Math.hypot(o.x - x, o.y - y) < 11);
  const homeOnly = (x: number, y: number) => w.islandOf[y * n + x] === w.home;
  const placeRing = (minD: number, maxD: number, ok: (x: number, y: number) => boolean, make: (x: number, y: number) => void) => {
    for (let k = 0; k < 4000; k++) {
      const a = rng.next() * 6.283, d = minD + rng.next() * (maxD - minD);
      const x = Math.round(C + Math.cos(a) * d), y = Math.round(C + Math.sin(a) * d);
      if (!isLand(w, x, y) || w.terr[y * n + x] === T.Mountain || !free(x, y) || !ok(x, y)) continue;
      make(x, y); return true;
    }
    return false;
  };
  const dep = (res: Resource, rich = false) => (x: number, y: number) => add({ kind: 'dep', x, y, res, rich, hidden: res === 'iron' || res === 'oil' });
  const town = (x: number, y: number) => add({ kind: 'town', x, y, pop: 0, name: nextName() });

  // a coal seam near Ashford, then home-island stone and coal
  if (!placeRing(4, 12, (x, y) => homeOnly(x, y) && isMountainFoot(w, x, y), dep('coal'))) placeRing(4, 22, (x, y) => homeOnly(x, y) && isMountainFoot(w, x, y), dep('coal'));
  placeRing(9, 15, (x, y) => homeOnly(x, y) && apart(x, y), town);
  for (let i = 0; i < 3; i++) placeRing(16, 30, (x, y) => homeOnly(x, y) && apart(x, y), town);
  for (const r of ['coal', 'stone', 'coal'] as const) placeRing(8, 31, (x, y) => homeOnly(x, y) && isMountainFoot(w, x, y), dep(r));
  // settlement sites on the home island
  for (const [a, b] of [[12, 22], [16, 31], [18, 31], [20, 31]] as const)
    placeRing(a, b, (x, y) => homeOnly(x, y) && apart(x, y), (x, y) => add({ kind: 'plot', x, y, name: nextName() }));

  // outer islands: one or two settlements each, deposits (iron and oil live only out here), richer far out
  w.islands.forEach((isl, k) => {
    if (k === w.home || !isl.name) return;
    const r = Math.sqrt(isl.size / Math.PI);
    const put = (ok: (x: number, y: number) => boolean, make: (x: number, y: number) => void) => {
      for (let t = 0; t < 400; t++) {
        const x = Math.round(isl.cx + (rng.next() * 2 - 1) * r), y = Math.round(isl.cy + (rng.next() * 2 - 1) * r);
        if (w.islandOf[y * n + x] !== k || !isLand(w, x, y) || w.terr[y * n + x] === T.Mountain || !free(x, y) || !ok(x, y)) continue;
        make(x, y); return true;
      }
      return false;
    };
    for (let i = 0; i < (r >= 7 ? 2 : 1); i++) put(apart, rng.next() < 0.5 ? town : (x, y) => add({ kind: 'plot', x, y, name: nextName() }));
    const far = isl.dist, count = 2 + Math.floor(far / 35);
    for (let i = 0; i < count; i++) {
      const res = rng.pick(['coal', 'iron', 'oil', 'stone', 'iron'] as const);
      put(res === 'oil' ? () => true : (x, y) => isMountainFoot(w, x, y), dep(res, far > 75));
    }
  });
  return { sites, mountains };
}
