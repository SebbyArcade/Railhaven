import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { BLDS, choices, cl, growNeed, pickBld, setupLines, steps, visit } from '../src/lines/lines.ts';
import { orderOf, orderProgress, upgradeTown } from '../src/economy/towns.ts';
import { lockedText } from '../src/buildings/industries.ts';

describe('🚉 City Lines', () => {
  it('sets up a Grand Line of 4 islands, each farther out, ending at Kingsport', () => {
    const g = newGame(4242); setupLines(g); const c = cl(g)!, a = g.s.sites[0]!;
    expect(c.isles.length).toBe(4);
    expect(g.s.sites.find(s => s.id === c.caps.at(-1))!.name).toBe('Kingsport');
    const far = c.isles.map(k => Math.hypot(g.world.islands[k]!.cx - a.x, g.world.islands[k]!.cy - a.y));
    for (let i = 1; i < far.length; i++) expect(far[i]!).toBeGreaterThan(far[i - 1]!);
    expect(steps(g).length).toBe(8);
  });
  it('has no goods orders or industries, only docks', () => {
    const g = newGame(4242); setupLines(g);
    expect(orderOf(g, g.s.sites[0]!)).toEqual({});
    expect(lockedText(g, 'dock')).toBe('');
    expect(lockedText(g, 'lumber')).not.toBe('');
  });
  it('visitors grow a city, and growing gives a pick of 3 different buildings', () => {
    const g = newGame(4242); setupLines(g); const [a, b] = g.s.sites.filter(s => s.kind === 'town');
    g.s.money = 1e6; visit(g, b!, a!, growNeed(0));
    expect(orderProgress(g, a!)).toBe(1);
    expect(upgradeTown(g, a!)).toBe('');
    expect(a!.lvl).toBe(1); expect(cl(g)!.picks).toEqual([a!.id]);
    const ch = choices(g, a!); expect(new Set(ch).size).toBe(3);
    expect(pickBld(g, a!.id, ch[0]!)).toBe('');
    expect(cl(g)!.blds).toEqual([{ town: a!.id, k: ch[0] }]); expect(BLDS[ch[0]!]).toBeTruthy();
  });
});
