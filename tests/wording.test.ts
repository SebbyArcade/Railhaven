import { describe, expect, it } from 'vitest';
import { aName, INDUSTRIES } from '../src/buildings/industries.ts';

describe('building names in sentences', () => {
  it('uses "an" before a vowel and "a" otherwise', () => {
    expect(aName(INDUSTRIES.iron.name)).toBe('an Iron Mine');
    expect(aName(INDUSTRIES.oil.name, true)).toBe('An Oil Well');
    expect(aName('Sawmill')).toBe('a Sawmill');
    expect(aName('Sawmill', true)).toBe('A Sawmill');
  });
});

describe('goods that only come from outer islands', () => {
  // Playtest 2026-11-16 (bot, seed 3, 6 h): 7 towns waited on steel for 3 hours while the hint said the Steel Mill
  // was short of iron: "bring more in", though Ashford Isle has no iron at all
  it('says where iron comes from instead of "bring more in"', async () => {
    const fs = await import('node:fs');
    const { loadFrom } = await import('../src/save/save.ts');
    const { stuckList } = await import('../src/ui/orders.ts');
    const { cardHtml } = await import('../src/ui/cards.ts');
    const raw = fs.readFileSync('tests/saves/bot-seed3-steel-waits.json', 'utf8');
    const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)!;
    const line = stuckList(g).find(s => s.icon === '🐢' && s.text.includes('steel'))!;
    expect(line.text).toMatch(/short of 🧲 iron: iron only comes from outer islands: land on one that has it \(⚓ Dock in Build\), then build an Iron Mine there/);
    expect(line.text).not.toMatch(/bring more in/);
    const mill = g.s.buildings!.find(b => b.kind === 'mill')!;
    expect(cardHtml(g, { kind: 'bld', id: mill.id })).toMatch(/🏝 Iron only comes from outer islands/);
  });
});
