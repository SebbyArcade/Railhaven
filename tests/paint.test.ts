import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan, undoStroke } from '../src/track/paint.ts';

describe('painting track', () => {
  it('starts only from Ashford or the network, and a stroke can be undone for a full refund', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
    expect(startPlan(g, at(3, 3))).toBeNull();
    const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(4, 0));
    expect(p.path.length).toBe(5);
    const money = g.s.money, b = buildPlan(g, p);
    if (typeof b === 'string') throw new Error(b);
    expect(b.revealed).toBe(0);
    expect(g.track.size).toBe(5);
    undoStroke(g, b);
    expect(g.track.size).toBe(0);
    expect(g.s.money).toBe(money);
  });

  it('track uncovers the land around it (such strokes are not undoable)', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
    const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(8, 0));
    const b = buildPlan(g, p);
    if (typeof b === 'string') throw new Error(b);
    expect(b.revealed).toBeGreaterThan(0);
  });
});
