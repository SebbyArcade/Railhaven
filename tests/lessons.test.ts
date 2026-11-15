import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, nearestSpot } from '../src/buildings/industries.ts';
import { LESSONS, lessonOn, skipLessons, tickLessons } from '../src/progress/lessons.ts';
import { msOf, tickMissions } from '../src/progress/missions.ts';
import { linkB } from './sea.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';

describe("Mira's lessons", () => {
  it('nine lessons; the bot and old games have none', () => {
    expect(LESSONS.length).toBe(9);
    const g = newGame(4242); expect(lessonOn(g)).toBe(false);
    tickMissions(g); expect(msOf(g).main).toBeTruthy();
  });

  it('lessons move on as each step is done, and missions wait until they are over', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!; g.s.tut = 0;
    tickMissions(g); expect(msOf(g).main).toBeFalsy(); expect(msOf(g).act).toBe(1);
    const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    trackChanged(g);
    expect(tickLessons(g)).toBe(true); expect(g.s.tut).toBe(1);
    expect(g.s.lesAt).toBe(g.s.t);
    // a stub of line from Ashford, then join the camp
    const p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, a.y * n + a.x + 1); buildPlan(g, p); trackChanged(g);
    expect(linkB(g, b)).toBe(true);
    tickLessons(g); expect(g.s.tut).toBe(2);
    skipLessons(g); expect(lessonOn(g)).toBe(false);
    tickMissions(g); expect(msOf(g).main).toBeTruthy();
  });
});
