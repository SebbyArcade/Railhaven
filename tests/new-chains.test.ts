import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { bestPlacement, inputsOf, INDUSTRIES, type IndustryKind, lockedText } from '../src/buildings/industries.ts';
import { sendExpedition } from '../src/world/expedition.ts';
import { linkedDocks } from '../src/ships/docks.ts';
import { newGame } from '../src/game.ts';
import { orderOfFull } from '../src/economy/towns.ts';
import type { Game } from '../src/state.ts';

describe('new goods: two-input factories at home, one new chain per expedition', () => {
  it('home factories need two goods each and open at Railway levels 3, 4 and 5', () => {
    const g = newGame(4242);
    for (const [k, ins, L] of [['glassworks', ['stone', 'coal'], 3], ['toolworks', ['steel', 'planks'], 4], ['furniture', ['planks', 'cloth'], 5]] as const) {
      expect(inputsOf(k)).toEqual(ins);
      g.s.rlv = L - 1; expect(lockedText(g, k)).toContain(`Railway level ${L}`);
      g.s.rlv = L; expect(lockedText(g, k)).toBe('');
    }
  });

  it('far-sea kinds stay locked until their expedition: jewellery 1, chocolate 2, tyres 3', () => {
    const g = newGame(4242); g.s.rlv = 9;
    for (const [k, ring] of [['gold', 1], ['gems', 1], ['jeweller', 1], ['cocoa', 2], ['chocolate', 2], ['rubber', 3], ['tyreworks', 3]] as const) {
      g.s.rings = ring - 1; expect(lockedText(g, k)).toContain('expedition');
      g.s.rings = ring; expect(lockedText(g, k)).toBe('');
    }
    expect(inputsOf('jeweller')).toEqual(['gold', 'gems']);
    expect(inputsOf('chocolate')).toEqual(['cocoa', 'flour']);
    expect(inputsOf('tyreworks')).toEqual(['rubber', 'steel']);
  });

  it('on his save, each ring brings its own deposits and a mine fits on them', async () => {
    let { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8'))) as { g: Game };
    const d = linkedDocks(g)[0]!; d.lvl = 3;
    g.s.stars = Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['isle' + i, 7])); // 🌟 60 stars: charts for three rings
    const want: Record<number, string[]> = { 1: ['gold', 'gems'], 2: ['cocoa'], 3: ['rubber'] };
    for (let ring = 1; ring <= 3; ring++) {
      g.s.money = 1e7;
      const r = sendExpedition(g, g.s.buildings!.find(b => b.id === d.id)!); if (typeof r === 'string') throw new Error(r);
      g = r.g;
      const deps = r.fresh.filter(s => s.kind === 'dep');
      for (const res of want[ring]!) {
        const mine = deps.filter(s => s.res === res);
        expect(mine.length).toBeGreaterThanOrEqual(2);
        // the deposit is uncovered by scouting; a mine must fit on most of them
        const n = g.world.n; for (const s of mine) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const i = (s.y + dy) * n + s.x + dx; g.s.fog[i >> 3]! |= 1 << (i & 7); }
        const fit = mine.filter(s => bestPlacement(g, res as IndustryKind, s.x, s.y).place).length;
        expect(fit / mine.length).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  it('a big city orders the new products once you make them, in smaller amounts', () => {
    const g = newGame(4242), a = g.s.sites[0]!; a.lvl = 5;
    g.s.buildings = (['farm', 'jeweller'] as IndustryKind[]).map((kind, id) => ({ id: 100 + id, kind, x: 0, y: 0, horizontal: true, side: 1, lvl: 1, stock: 0 }));
    const o = orderOfFull(g, a);
    expect(Object.keys(o)).toContain('jewellery');
    expect(o.jewellery).toBe(25); // 20 at Megacity, a quarter more each step after
    expect(INDUSTRIES.jeweller.makes).toBe('jewellery');
  });
});
