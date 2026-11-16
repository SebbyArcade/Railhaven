import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { stuckList } from '../src/ui/orders.ts';
import type { Game } from '../src/state.ts';

// His bug report (2026-11-16, 65 min): the Lumber Camp and Stone Quarry stood full at 80 with all 9 trains busy, yet
// the hint said they "can't keep up: upgrade it or build another".
const live = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };

describe('a full maker with every train busy asks for a train, not an upgrade', () => {
  it('names the full building and the missing train', () => {
    const g = live(), lines = stuckList(g).filter(s => s.icon === '🐢').map(s => s.text);
    const wood = lines.find(t => t.includes('wood'))!, stone = lines.find(t => t.includes('stone'))!;
    expect(wood).toMatch(/is full, but every train is busy/);
    expect(stone).toMatch(/is full, but every train is busy/);
    expect(lines.join('\n')).not.toMatch(/Lumber Camp near Ashford can't keep up/);
  });
  it('still says "can\'t keep up" once a train is free', () => {
    const g = live(); g.s.trains[0]!.job = undefined;
    expect(stuckList(g).filter(s => s.icon === '🐢').some(s => s.text.includes('every train is busy'))).toBe(false);
  });
});
