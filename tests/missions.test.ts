import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { townLinked } from '../src/economy/towns.ts';
import { build, nearestSpot, bestPlacement } from '../src/buildings/industries.ts';
import { candidates, make, msOf, progress, swapMission, tickMissions } from '../src/progress/missions.ts';
import { reveal } from '../src/world/fog.ts';
import { dockAndLanding } from './sea.ts';
import type { Game } from '../src/state.ts';

const buildNear = (g: Game, k: 'wood' | 'farm') => {
  const a = g.s.sites[0]!, s = nearestSpot(g, k, a.x, a.y)!, b = build(g, bestPlacement(g, k, s.x, s.y).place!);
  if (typeof b === 'string') throw new Error(b); return b;
};

describe('missions with Mira', () => {
  it('a new game starts Act 1 with a main mission and two side missions, the same for the same map', () => {
    const g = newGame(4242); tickMissions(g); tickMissions(g);
    const M = msOf(g);
    expect(M.act).toBe(1); expect(M.actNew).toBe(true); expect(M.actLine).toMatch(/Mira/);
    expect(M.main?.title).toBeTruthy(); expect(M.main?.how).toBeTruthy(); expect(M.main?.mira).toMatch(/Mira|letter/);
    // Ashford starts the railway: it is never a town to link
    expect(candidates(g).some(c => c.id === 'link:' + g.s.sites[0]!.id)).toBe(false);
    const h = newGame(4242); tickMissions(h); expect(msOf(h).main?.id).toBe(M.main!.id);
  });

  it('building what a mission asks pays its reward and picks the next one', () => {
    const g = newGame(4242); tickMissions(g);
    const M = msOf(g), c = candidates(g).find(x => x.id === 'build:wood')!;
    expect(c).toBeDefined();
    M.main = make(g, c, 1, false);
    expect(progress(g, M.main)!.v).toBe(0);
    buildNear(g, 'wood');
    const money = g.s.money, reward = M.main.reward;
    expect(reward).toBe(600); // 400 × level 1 + 200
    tickMissions(g);
    expect(g.s.money).toBe(money + reward);
    expect(M.done.at(-1)!.id).toBe('build:wood');
    expect(M.main?.id).not.toBe('build:wood');
    expect(g.news?.some(s => s.startsWith('✅ Mission done'))).toBe(true);
  });

  it('a town hidden in the fog becomes a find mission, finished when the fog lifts', () => {
    const g = newGame(4242), n = g.world.n;
    const c = candidates(g).find(x => x.ty === 'find')!;
    expect(c).toBeDefined();
    const m = make(g, c, 1, false), t = g.s.sites.find(s => s.id === c.site)!;
    expect(m.title).toMatch(/Find the town (north|south|east|west)/);
    expect(progress(g, m)!.v).toBe(0);
    reveal(g, t.x, t.y, 2); void n;
    expect(progress(g, m)!.v).toBe(1);
    // seen now: linking it is the next step
    expect(candidates(g).some(x => x.id === 'link:' + t.id)).toBe(true);
  });

  it('goods nothing makes come first; locked factories wait for their Railway level', () => {
    const g = newGame(4242), a = g.s.sites[0]!;
    // pretend Ashford is linked and wants planks (Sawmill, Railway level 1)
    const n = g.world.n, p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, a.y * n + a.x - 3); buildPlan(g, p); trackChanged(g);
    expect(townLinked(g, a)).toBe(true);
    a.lvl = 2; a.got = {};
    const cs = candidates(g);
    expect(cs.some(c => c.k === 'sawmill')).toBe(false); // locked at level 0
    g.s.rlv = 1;
    const top = candidates(g).filter(c => c.pr === 3);
    expect(top.some(c => c.id === 'build:sawmill' || c.id === 'build:wood')).toBe(true);
    expect(top.find(c => c.id === 'build:sawmill' || c.id === 'build:wood')!.why).toMatch(/planks|wood/);
  });

  it('islands across the sea ask for a dock first, then a landing reaches them', () => {
    const g = newGame(4242); g.s.rlv = 1;
    const cs = candidates(g);
    expect(cs.some(c => c.ty === 'reach')).toBe(false); // no dock yet
    expect(cs.find(c => c.id === 'build:dock')?.why).toBeTruthy();
    const { g: h } = dockAndLanding(4242); h.s.rlv = 1;
    const reach = candidates(h).filter(c => c.ty === 'reach');
    for (const r of reach) { const m = make(h, r, 1, false); expect(m.title).toMatch(/^Reach /); expect(m.mira).toMatch(/Mira/); }
  });

  it('swapping a mission costs a quarter of its reward', () => {
    const g = newGame(7); tickMissions(g);
    const M = msOf(g), first = M.main!, money = g.s.money;
    const why = swapMission(g, 0);
    if (why) { expect(why).toMatch(/Nothing else/); return; }
    expect(g.s.money).toBe(money - Math.round(first.reward * 0.25 / 100) * 100);
    expect(M.main!.id).not.toBe(first.id);
  });
});
