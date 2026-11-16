import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { isRevealed } from '../src/world/fog.ts';
import { BOAT_SQ, boatRoute, checkPois, makePois, poisOf, ruinsMul, salvageAt, type Scout, scoutCost, scoutStarts, scoutStepError, sendScout, tickScouts } from '../src/world/explore.ts';
import { emptyFog } from '../src/world/fog.ts';
import { chartSea, dockRange, linkedDocks, seaDist } from '../src/ships/docks.ts';
import { loadFrom } from '../src/save/save.ts';
import { bestPlacement } from '../src/buildings/industries.ts';
import fs from 'node:fs';
import { dockAndLanding } from './sea.ts';

describe('scouting', () => {
  it('a scout walks a drawn route from a town on the railway and uncovers the land', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
    const p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, a.y * n + a.x - 3); buildPlan(g, p); trackChanged(g);
    const st = scoutStarts(g).find(s => !s.boat)!; expect(st.sq).toBe(a.y * n + a.x);
    // a route north into the fog
    const path = [st.sq]; for (let k = 1; k <= 20; k++) { const i = st.sq - k * n; if (scoutStepError(g, path, i, false)) break; path.push(i); }
    expect(path.length).toBeGreaterThan(10);
    const far = path.at(-1)! - 2 * n; expect(isRevealed(g, far)).toBeFalsy();
    const money = g.s.money, s = sendScout(g, path, false);
    expect(typeof s).not.toBe('string');
    expect(g.s.money).toBe(money - scoutCost(path.length - 1, false));
    for (let k = 0; k < 20 * 30 && g.s.scouts?.length; k++) tickScouts(g, 0.05);
    expect(g.s.scouts?.length ?? 0).toBe(0);
    if (g.world.terr[far]) expect(isRevealed(g, far)).toBeTruthy();
    // the route can't step onto water it can see, or go square-skipping
    expect(scoutStepError(g, [st.sq], st.sq + 2, false)).toMatch(/square by square/);
    expect(scoutCost(10, true)).toBe(10 * BOAT_SQ); expect(scoutCost(50, true)).toBe(3000); expect(scoutCost(25, false)).toBe(1800);
  });

  it('a boat that meets land under the fog turns back and pays back 90% of the unused route', () => {
    const { g, dock } = dockAndLanding(4242), n = g.world.n;
    const st = scoutStarts(g).find(s => s.boat)!; expect(st).toBeDefined();
    void dock;
    // fake a short route whose 3rd square is land, hidden in the fog, ending on land (no way round to it)
    let land = -1; for (let i = 0; i < n * n && land < 0; i++) if (g.world.terr[i] && g.world.terr[i + 1] && !g.world.terr[i - 1] && !g.world.terr[i - 2] && !g.world.terr[i - 3]) land = i;
    const path = [land - 3, land - 2, land - 1, land, land + 1];
    for (const i of path) { const x = i % n, y = (i / n) | 0; g.s.fog[(y * n + x) >> 3] = (g.s.fog[(y * n + x) >> 3] ?? 0) & ~(1 << ((y * n + x) & 7)); }
    const before = g.s.money, s = sendScout(g, path, true); expect(typeof s).not.toBe('string');
    for (let k = 0; k < 20 * 10 && g.s.scouts?.length; k++) tickScouts(g, 0.05);
    const paid = scoutCost(4, true), back = Math.round((paid - scoutCost(2, true)) * 0.9);
    expect(g.s.money).toBe(before - paid + back);
  });
});

describe('boat scouts find their own way', () => {
  it('a tapped sea square gets a route over water, never over land it can see', () => {
    const { g } = dockAndLanding(4242), n = g.world.n;
    const st = scoutStarts(g).find(s => s.boat)!;
    // a revealed sea square some way off
    const d = new Map<number, number>([[st.sq, 0]]), q = [st.sq];
    for (let h = 0; h < q.length; h++) { const i = q[h]!; for (const j of [i + 1, i - 1, i + n, i - n]) if (!d.has(j) && !g.world.terr[j] && isRevealed(g, j)) { d.set(j, d.get(i)! + 1); q.push(j); } }
    const far = [...d].filter(([, v]) => v >= 15 && v <= 30).map(([i]) => i)[0]!; expect(far).toBeDefined();
    const way = boatRoute(g, st.sq, far, 50)!;
    expect(way.at(-1)).toBe(far);
    expect(way.length).toBe(d.get(far));
    for (const i of way) expect(!g.world.terr[i] || !isRevealed(g, i)).toBe(true);
    let prev = st.sq; for (const i of way) { expect(Math.abs((i % n) - (prev % n)) + Math.abs(((i / n) | 0) - ((prev / n) | 0))).toBe(1); prev = i; }
    // capped: a short budget stops part way
    expect(boatRoute(g, st.sq, far, 5)!.length).toBe(5);
  });

  it('a boat that meets land under the fog sails round it and pays only for the extra squares', () => {
    const { g } = dockAndLanding(4242), n = g.world.n;
    // a lone square of land with open water two squares all round it
    let land = -1;
    for (let i = 4 * n; i < n * n - 4 * n && land < 0; i++) {
      if (!g.world.terr[i]) continue;
      const ring: number[] = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx || dy) ring.push(i + dy * n + dx);
      if (ring.every(j => !g.world.terr[j])) land = i;
    }
    expect(land).toBeGreaterThan(0);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const k = land + dy * n + dx; g.s.fog[k >> 3]! &= ~(1 << (k & 7)); }
    const path = [land - 2, land - 1, land, land + 1, land + 2], before = g.s.money;
    const s = sendScout(g, path, true) as Scout; expect(typeof s).not.toBe('string');
    for (let k = 0; k < 20 * 20 && g.s.scouts?.length; k++) tickScouts(g, 0.05);
    expect(g.s.scouts?.length ?? 0).toBe(0);
    const r = g.s.reports!.at(-1)!;
    expect(r.end).toBe(land + 2); // it got where it was sent
    expect(r.back ?? 0).toBe(0);
    expect(r.steps).toBe(6); // 4 squares straight, 6 round the islet
    expect(g.s.money).toBe(before - 6 * BOAT_SQ);
  });
});

describe('docks chart their whole reach', () => {
  it('every sea square a dock reaches comes out of the fog, and docks charted before chart the rest once', () => {
    const { g, dock } = dockAndLanding(4242), n = g.world.n;
    g.s.fog = emptyFog(n); dock.chart = dockRange(dock); dock.chartAll = undefined; // a dock from before: 75% charted
    expect(chartSea(g, dock)).toBeGreaterThan(0);
    const d = seaDist(g, dock), R = dockRange(dock);
    let water = 0, hidden = 0;
    for (let i = 0; i < n * n; i++) { const v = d[i]!; if (v < 0 || v > R) continue; water++; if (!isRevealed(g, i)) hidden++; }
    expect(water).toBeGreaterThan(100); expect(hidden).toBe(0);
    expect(dock.chartAll).toBe(true);
    expect(chartSea(g, dock)).toBe(0); // only once
  });
});

describe('on his save', () => {
  it('docks from before chart the rest of their reach on load, so Emberfell gets a landing spot', () => {
    const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16g.json', 'utf8');
    const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)!, n = g.world.n;
    for (const b of linkedDocks(g)) expect(b.chartAll).toBe(true);
    const k = g.world.islands.findIndex(i => i.name === 'Emberfell'); expect(k).toBeGreaterThan(0);
    let fits = false;
    for (let i = 0; i < n * n && !fits; i++) if (g.world.islandOf[i] === k && g.world.terr[i] && [i + 1, i - 1, i + n, i - n].some(j => g.world.ocean[j])) fits = !!bestPlacement(g, 'dock', i % n, (i / n) | 0).place;
    expect(fits).toBe(true);
  });
});

describe('landmarks and wrecks', () => {
  it('are placed from the seed, one lighthouse per named outer island', () => {
    const g = newGame(4242), a = makePois(g), b = makePois(newGame(4242));
    expect(a).toEqual(b);
    const named = g.world.islands.filter((o, k) => o.name && k !== g.world.home).length;
    expect(a.filter(p => p.kind === 'lighthouse').length).toBeGreaterThanOrEqual(named * 0.8);
    expect(a.some(p => p.kind === 'wreck')).toBe(true);
  });

  it('track within 2 squares takes a landmark over; old ruins boost industries nearby', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
    const ruin = poisOf(g).find(p => p.kind === 'ruins' && g.world.islandOf[p.y * n + p.x] === g.world.home)!;
    expect(ruin).toBeDefined();
    expect(ruinsMul(g, ruin.x, ruin.y)).toBe(1);
    // pretend the line reaches next to it
    g.linked = new Set([...(g.linked ?? []), (ruin.y + 1) * n + ruin.x]);
    g.s.fog.fill(255); checkPois(g);
    expect(ruin.got).toBe(true);
    expect(ruinsMul(g, ruin.x + 3, ruin.y)).toBe(1.1);
    // he asked (2026-11-16): any part of a building in the circle counts, not just its corner square
    const far = (ruin.y + 9) * n + ruin.x, edge = (ruin.y + 6) * n + ruin.x;
    expect(ruinsMul(g, ruin.x, ruin.y + 9)).toBe(1);
    expect(ruinsMul(g, ruin.x, ruin.y + 9, [far, edge])).toBe(1.1);
    expect((g.news ?? []).some(m => m.includes('Old ruins is yours'))).toBe(true);
    void a;
  });

  it('track at the corner of the dashed square (2 squares out diagonally) counts; 3 squares out does not', () => {
    const g = newGame(4242), n = g.world.n;
    const hut = poisOf(g).find(p => p.kind === 'ruins' && g.world.islandOf[p.y * n + p.x] === g.world.home)!;
    g.s.fog.fill(255);
    g.linked = new Set([(hut.y + 3) * n + hut.x + 3]); checkPois(g);
    expect(hut.got).toBeFalsy();
    g.linked = new Set([(hut.y + 2) * n + hut.x + 2]); checkPois(g);
    expect(hut.got).toBe(true);
  });

  it('a ship or boat passing a wreck salvages it once', () => {
    const g = newGame(4242), w = poisOf(g).find(p => p.kind === 'wreck')!;
    const m = g.s.money;
    expect(salvageAt(g, w.x + 1, w.y)).toBe(w.pay);
    expect(g.s.money).toBe(m + w.pay!);
    expect(salvageAt(g, w.x, w.y)).toBe(0);
  });
});
