import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { isRevealed } from '../src/world/fog.ts';
import { checkPois, makePois, poisOf, ruinsMul, salvageAt, scoutCost, scoutStarts, scoutStepError, sendScout, tickScouts } from '../src/world/explore.ts';
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
    expect(scoutCost(10, true)).toBe(Math.round(2 * (100 + 110) * 1.5)); expect(scoutCost(25, false)).toBe(1800);
  });

  it('a boat that meets land under the fog turns back and pays back 90% of the unused route', () => {
    const { g, dock } = dockAndLanding(4242), n = g.world.n;
    const st = scoutStarts(g).find(s => s.boat)!; expect(st).toBeDefined();
    void dock;
    // fake a short route whose 3rd square is land, hidden in the fog
    let land = -1; for (let i = 0; i < n * n && land < 0; i++) if (g.world.terr[i] && !g.world.terr[i - 1] && !g.world.terr[i - 2] && !g.world.terr[i - 3]) land = i;
    const path = [land - 3, land - 2, land - 1, land, land + 1];
    for (const i of path) { const x = i % n, y = (i / n) | 0; g.s.fog[(y * n + x) >> 3] = (g.s.fog[(y * n + x) >> 3] ?? 0) & ~(1 << ((y * n + x) & 7)); }
    const before = g.s.money, s = sendScout(g, path, true); expect(typeof s).not.toBe('string');
    for (let k = 0; k < 20 * 10 && g.s.scouts?.length; k++) tickScouts(g, 0.05);
    const paid = scoutCost(4, true), back = Math.round((paid - scoutCost(2, true)) * 0.9);
    expect(g.s.money).toBe(before - paid + back);
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
