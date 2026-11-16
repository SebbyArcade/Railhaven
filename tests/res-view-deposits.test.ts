import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { viewMarks } from '../src/ui/mapviews.ts';
import type { Game } from '../src/state.ts';

// His report (2026-11-16, Resources view): "Coal: build a Coal Mine here" and its purple ring still showed on deposits
// that already had a Coal Mine on them, on top of the mine's own stock label. A mine's deposit sits under its building
// row, not on the square its label uses, so deposits now count as used when any building stands on them.
const live = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16f.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };

describe('Resources view: deposits with a building on them', () => {
  it('shows no "build here" label for a deposit a mine already stands on', () => {
    const g = live(), marks = viewMarks(g, 'res');
    const mined = (g.s.buildings ?? []).filter(b => b.dep !== undefined);
    expect(mined.length).toBeGreaterThan(3);
    for (const b of mined) {
      const d = g.s.sites.find(s => s.id === b.dep)!;
      expect(marks.some(m => m.x === d.x && m.y === d.y && m.text.includes(': build'))).toBe(false);
    }
    // the mines themselves still show their stock, and free deposits still show
    for (const b of mined) expect(marks.some(m => m.x === b.x && m.y === b.y && !m.text.includes(': build'))).toBe(true);
  });
});
