import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, nearestSpot } from '../src/buildings/industries.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { ordersHtml, stuckList } from '../src/ui/orders.ts';
import { linkB } from './sea.ts';

describe('the Orders board', () => {
  it('names what needs the player, and stops once it is done', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
    const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    trackChanged(g);
    expect(stuckList(g).some(x => x.icon === '🔌' && x.text.includes('Lumber Camp'))).toBe(true);
    const p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, a.y * n + a.x + 1); buildPlan(g, p); trackChanged(g);
    expect(linkB(g, b)).toBe(true);
    expect(stuckList(g).some(x => x.icon === '🔌')).toBe(false);
    const h = ordersHtml(g);
    expect(h).toContain('Ashford');
    expect(h).toContain('Railway level 0');
  });
});
