import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { breaksChanged } from '../src/game.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { tickBreaks } from '../src/track/breaks.ts';
import { tickEvents } from '../src/world/events.ts';
import type { Game } from '../src/state.ts';

// Playtest 2026-11-16 (bot, 6-hour games): near Ashford 8-9 trains locked up for good, each waiting on another
// (trains heading into a full dead-end station filled both tracks of its approach, so the trains inside could not
// come out). The games earned nothing for hours. Now one train in the way backs off and the stuck one goes first.
const load = (f: string) => { const raw = fs.readFileSync(f, 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };
const run = (g: Game, s: number) => {
  for (let k = 0; k < s * 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); if (+tickBreaks(g) + +tickEvents(g, dt)) breaksChanged(g); }
};
const overlap = (g: Game) => {
  const at = new Map<number, number>();
  for (const t of g.s.trains) for (const s of t.trail) { const o = at.get(s.piece); if (o !== undefined && o !== t.id) return `trains ${o} and ${t.id}`; at.set(s.piece, t.id); }
  return '';
};

describe('trains never lock up for good', () => {
  for (const f of ['tests/saves/bot-seed1-gridlock.json', 'tests/saves/bot-seed5-gridlock.json']) {
    it(`${f.split('/').pop()}: the locked trains get moving and deliver again`, () => {
      const g = load(f);
      const earned = g.s.earned ?? 0;
      const where = new Map(g.s.trains.map(t => [t.id, t.trail.map(s => s.piece).join()]));
      let worst = '';
      for (let m = 0; m < 8; m++) { run(g, 60); worst ||= overlap(g); }
      expect(worst).toBe('');
      expect((g.s.earned ?? 0) - earned).toBeGreaterThan(100);
      const moved = g.s.trains.filter(t => where.get(t.id) !== t.trail.map(s => s.piece).join()).length;
      expect(moved).toBeGreaterThanOrEqual(g.s.trains.length - 1);
    }, 120_000);
  }
});
