import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { buildPlan, extendPlan, planCost, planError, planSupplies, startPlan, undoStroke } from '../src/track/paint.ts';
import { choices, fr, pickPerk, setupFrontier, spikeGap, tickFrontier, townGrew, BUY_SUP, buySupplies, START_SUP } from '../src/frontier/frontier.ts';
import { deliverToTown, steadyGoods, townRoom } from '../src/economy/towns.ts';
import { squareCost } from '../src/track/rules.ts';
import { T } from '../src/world/terrain.ts';
import { reveal } from '../src/world/fog.ts';

const frontier = (seed = 3) => { const g = newGame(seed); setupFrontier(g); return g; };

describe('🧭 Frontier Village preview', () => {
  it('puts a golden spike on the far coast of the home island, with a ridge and an inlet on the way', () => {
    const g = frontier(), f = fr(g)!, n = g.world.n, a = g.s.sites[0]!;
    expect(g.world.islandOf[f.spike]).toBe(g.world.home);
    expect(Math.hypot(f.spike % n - a.x, ((f.spike / n) | 0) - a.y)).toBeGreaterThan(25);
    expect(f.pieces.map(p => p.kind).sort()).toEqual(['inlet', 'ridge']);
    expect(spikeGap(g)).toBeGreaterThan(20);
    // the carved terrain comes back from the save's edits
    const ridge = Object.entries(g.s.terrainEdits).filter(([, t]) => t === T.Mountain).length;
    expect(ridge).toBeGreaterThan(10);
  });

  it('track costs supplies, not money, and Undo gives them back', () => {
    const g = frontier(), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
    const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(4, 0));
    expect(planCost(g, p)).toBe(0);
    const sup = planSupplies(g, p); expect(sup).toBeGreaterThanOrEqual(4);
    const money = g.s.money, b = buildPlan(g, p); if (typeof b === 'string') throw new Error(b);
    expect(g.s.money).toBe(money);
    expect(fr(g)!.sup).toBe(START_SUP - sup);
    undoStroke(g, b);
    expect(fr(g)!.sup).toBe(START_SUP);
  });

  it('refuses track with too few supplies, and says where supplies come from', () => {
    const g = frontier(), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
    fr(g)!.sup = 2;
    const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(6, 0));
    expect(planError(g, p)).toMatch(/more 🛤 supplies.*wood and stone/);
    g.s.money = 1000; expect(buySupplies(g)).toBe(''); expect(fr(g)!.sup).toBe(2 + BUY_SUP.n);
    // a full pile takes no more wood and stone
    fr(g)!.sup = 500; expect(steadyGoods(g.s.sites[0]!, g)).toContain('stone'); expect(townRoom(g, g.s.sites[0]!, 'wood').steady).toBeLessThan(100);
  });

  it('Ashford takes wood and stone as supplies (a depot), and still pays for them', () => {
    const g = frontier(), a = g.s.sites[0]!;
    expect(steadyGoods(a, g)).toEqual(expect.arrayContaining(['wood', 'stone']));
    expect(townRoom(g, a, 'wood').steady).toBeGreaterThan(100);
    const before = fr(g)!.sup, r = deliverToTown(g, a, 'stone', 20);
    expect(fr(g)!.sup - before).toBe(Math.floor((20 - r.order) / 4));
  });

  it('mountains need the Tunnel Guild; a grown town picks one of three buildings', () => {
    const g = frontier(), n = g.world.n;
    const m = Object.entries(g.s.terrainEdits).find(([, t]) => t === T.Mountain)!, i = +m[0];
    reveal(g, i % n, (i / n) | 0, 1);
    expect(squareCost(g, i)).toMatch(/Tunnel Guild/);
    const t = g.s.sites.find(s => s.kind === 'town' && s !== g.s.sites[0])!;
    townGrew(g, t);
    let c = choices(g, t); expect(c).toHaveLength(3);
    // grant wishes until the guild is offered (it is offered from the third wish at the latest)
    while (!c.includes('tunnel')) { pickPerk(g, t.id, c[0]!); townGrew(g, t); c = choices(g, t); }
    expect(pickPerk(g, t.id, 'tunnel')).toBe('');
    expect(typeof squareCost(g, i)).toBe('number');
  });

  it('linking a town gives it a wish for its nearest neighbour', () => {
    const g = frontier();
    tickFrontier(g); // no town linked yet: no wishes
    expect(fr(g)!.wishes).toHaveLength(0);
  });

  it('the normal game is unchanged: track costs money, no supplies', () => {
    const g = newGame(3), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
    const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(4, 0));
    expect(planCost(g, p)).toBeGreaterThan(0);
    expect(planSupplies(g, p)).toBe(0);
    expect(steadyGoods(a, g)).not.toContain('stone');
    expect(fr(g)).toBeUndefined();
  });
});

describe('🧭 Frontier first steps', () => {
  it('points a new player at a lumber camp first', async () => {
    const { firstStep } = await import('../src/frontier/ui.ts');
    const g = frontier();
    expect(firstStep(g)).toMatch(/Lumber Camp/);
  });
});
