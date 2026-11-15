import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, nearestSpot } from '../src/buildings/industries.ts';
import { mapHtml, viewMarks, VIEWS } from '../src/ui/mapviews.ts';

describe('map views', () => {
  it('label problems, demand, resources and places to explore', () => {
    const g = newGame(4242), a = g.s.sites[0]!;
    const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    trackChanged(g);
    const prob = viewMarks(g, 'prob');
    expect(prob.some(m => m.icon === '🔌' && m.x === b.x && m.y === b.y && !m.text.includes('<'))).toBe(true);
    expect(viewMarks(g, 'res').some(m => m.text.includes('not on the railway'))).toBe(true);
    for (const v of VIEWS) expect(() => viewMarks(g, v.k)).not.toThrow();
    const h = mapHtml(g, 'res');
    expect(h).toContain('vchip on" data-act="view" data-v="res"');
    expect(h).toContain('Lumber Camp near Ashford');
    expect(h).toContain('data-kind="town"');
  });
});
