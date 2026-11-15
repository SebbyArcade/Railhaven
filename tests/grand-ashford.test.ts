import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { buyProject, projectError, rewardMul } from '../src/buildings/parks.ts';
import { buyTrain, LOAD_TIME, loadTime } from '../src/economy/dispatch.ts';
import { MEDALS, emptyProfile } from '../src/progress/achievements.ts';
import { lookOpen, PAINTS } from '../src/render/looks.ts';
import { cardHtml } from '../src/ui/cards.ts';
import type { Game } from '../src/state.ts';

function linked(): Game {
  const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
  const q = startPlan(g, a.y * n + a.x)!; for (let k = 1; k <= 6; k++) extendPlan(g, q, a.y * n + a.x + k);
  if (typeof buildPlan(g, q) === 'string') throw new Error('no line'); trackChanged(g);
  return g;
}

describe('👑 Grand Ashford landmarks', () => {
  it('need Railway level 6/7/8 and a big Ashford, and cost $50k, $100k, $200k', () => {
    const g = linked(), a = g.s.sites[0]!; g.s.money = 1e6; a.lvl = 4;
    g.s.rlv = 5; expect(projectError(g, a, 'grandstation')).toContain('Railway level 6');
    g.s.rlv = 6; expect(projectError(g, a, 'cathedral')).toContain('Railway level 7');
    g.s.rlv = 7; expect(projectError(g, a, 'exhibition')).toContain('Railway level 8');
    g.s.rlv = 8;
    for (const [k, p] of [['grandstation', 50000], ['cathedral', 100000], ['exhibition', 200000]] as const) {
      const m = g.s.money; expect(buyProject(g, a, k)).toBe(''); expect(m - g.s.money).toBe(p);
    }
    expect(projectError(g, g.s.sites.find(s => s.kind === 'town' && s !== a)!, 'cathedral')).toContain('Only Ashford');
  });

  it('🚉 Grand Station: trains load and unload 25% faster on Ashford Isle', () => {
    const g = linked(), a = g.s.sites[0]!; g.s.money = 1e6; a.lvl = 4; g.s.rlv = 8;
    const t = buyTrain(g); if (typeof t === 'string') throw new Error(t);
    expect(loadTime(g, t)).toBe(LOAD_TIME);
    expect(buyProject(g, a, 'grandstation')).toBe('');
    expect(loadTime(g, t)).toBe(LOAD_TIME * 0.75);
  });

  it('⛪ Cathedral: order rewards 5% bigger, shown on the town card', () => {
    const g = linked(), a = g.s.sites[0]!; g.s.money = 1e6; a.lvl = 4; g.s.rlv = 8;
    expect(rewardMul(g)).toBe(1);
    expect(buyProject(g, a, 'cathedral')).toBe('');
    expect(rewardMul(g)).toBe(1.05);
    expect(cardHtml(g, { kind: 'town', id: a.id })).toContain('⛪ Cathedral +5%');
  });

  it('🏛 Royal Exhibition Hall wins its medal, which opens the Royal Mail paint', () => {
    const g = linked(), a = g.s.sites[0]!; g.s.money = 1e6; a.lvl = 4; g.s.rlv = 8;
    const m = MEDALS.find(x => x.id === 'exhibition')!, p = emptyProfile(), paint = PAINTS.find(x => x.k === 'royalmail')!;
    expect(m.prog(g, p)).toEqual([0, 1]); expect(lookOpen(paint, 99999, p.medals)).toBe(false);
    expect(buyProject(g, a, 'exhibition')).toBe('');
    expect(m.prog(g, p)).toEqual([1, 1]);
    p.medals.exhibition = 1; expect(lookOpen(paint, 0, p.medals)).toBe(true);
  });
});
