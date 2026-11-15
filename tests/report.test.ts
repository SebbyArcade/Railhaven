import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { gameReport } from '../src/ui/report.ts';
import { bottlenecks, stuckList } from '../src/ui/orders.ts';

describe('the game report and bottlenecks', () => {
  it("names towns, buildings and what needs the player on Sébastien's Nov 14 game", async () => {
    const o = await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8'));
    const { g } = importLegacy(o);
    const r = gameReport(g);
    expect(r).toMatch(/^RAILHAVEN GAME REPORT/);
    expect(r).toContain('TOWNS on the railway');
    expect(r).toContain('Brinemoor');
    expect(r).toContain('Steel Mill near');
    expect(r).not.toMatch(/<|&#/);
    // every bottleneck has 2+ towns and a maker on the railway, and shows in the Needs you list
    const bn = bottlenecks(g);
    for (const x of bn) { expect(x.towns.length).toBeGreaterThanOrEqual(2); expect(x.makers.length).toBeGreaterThan(0); }
    expect(stuckList(g).filter(s => s.icon === '🐢').length).toBe(bn.length);
    fs.writeFileSync('shots/report-s14.txt', r);
  });
});
