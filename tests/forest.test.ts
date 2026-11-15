import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, forestOf, nearestSpot, shareAt } from '../src/buildings/industries.ts';
import { REGROW, TREE_WOOD, tickProduction } from '../src/economy/production.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { linkB } from './sea.ts';

describe('forests run out and grow back', () => {
  it('a lumber camp cuts its forest square by square; stumps grow back', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
    const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    trackChanged(g);
    const p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, a.y * n + a.x + 1); buildPlan(g, p); trackChanged(g);
    expect(linkB(g, b)).toBe(true);
    const f0 = forestOf(g, b).length;
    expect(f0).toBeGreaterThan(0);
    // run it, emptying its stock so it keeps cutting
    let made = 0;
    for (let k = 0; k < 20 * 200; k++) { g.s.t += 0.05; tickProduction(g, 0.05); made += b.stock; b.stock = 0; }
    const stumps = Object.keys(g.s.stumps ?? {}).length;
    expect(stumps).toBe(Math.floor(made / TREE_WOOD));
    expect(forestOf(g, b).length).toBe(f0 - stumps);
    // they all grow back in time
    for (let k = 0; k < 20 * (REGROW + 5); k++) { g.s.t += 0.05; tickProduction(g, 0); }
    expect(Object.keys(g.s.stumps ?? {}).length).toBe(0);
    expect(shareAt(g, b)).toBeGreaterThan(0);
  });
});
