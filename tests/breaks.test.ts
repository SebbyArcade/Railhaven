import { describe, expect, it } from 'vitest';
import { breaksChanged, newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { breakRail, tickBreaks } from '../src/track/breaks.ts';
import { placeTrain } from '../src/trains/train.ts';
import { shedSiding } from '../src/buildings/shed.ts';
import { buyTrain } from '../src/economy/dispatch.ts';

function setup() {
  const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
  const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(7, 0));
  if (typeof buildPlan(g, p) === 'string') throw new Error('build');
  trackChanged(g);
  return { g, at };
}

describe('engine shed and broken rails', () => {
  it('the engine shed stands near Ashford on its own siding, and moves if track is laid on it', () => {
    const { g } = setup();
    expect(g.s.shed).toBeDefined();
    const sh = g.s.shed!, a = g.s.sites[0]!, n = g.world.n, sd = shedSiding(g)!;
    expect(Math.hypot(sh.x - a.x, sh.y - a.y)).toBeLessThanOrEqual(6);
    // the siding: shed square, middle square, and a turnout on the line, all joined to Ashford
    for (const i of [sd.shed, sd.mid, sd.line]) expect(g.linked!.has(i)).toBe(true);
    expect(g.net.bySquare.get(sd.shed)?.length).toBeGreaterThan(0);
    // a bought train stands on the siding, clear of the line
    g.s.money = 1e5;
    const t = buyTrain(g); if (typeof t === 'string') throw new Error(t);
    const sq = t.trail.flatMap(s => g.net.pieces[s.piece]!.squares);
    expect(sq).toContain(sd.shed); expect(sq).not.toContain(sd.line);
    // paint on from the shed square: allowed; the shed moves and the track stays
    const back = sd.shed - (sd.mid - sd.shed);
    const p = startPlan(g, sd.shed)!; extendPlan(g, p, back);
    expect(typeof buildPlan(g, p)).not.toBe('string'); trackChanged(g);
    expect(g.s.shed && g.s.shed.y * n + g.s.shed.x).not.toBe(sd.shed);
    expect(g.linked!.has(back)).toBe(true);
  });

  it('a train waits at a broken rail and goes on once the crew has fixed it', () => {
    const { g, at } = setup();
    const id = g.net.bySquare.get(at(3, 0))!.find(i => g.net.pieces[i]!.squares.length === 1)!;
    const p = g.net.pieces[id]!, t = placeTrain(g.net, 1, { piece: id, dir: p.ta[0] > 0 ? 1 : -1 }, 2);
    g.s.trains.push(t); g.sys.rebuildHolds();
    expect(g.sys.sendTo(t, at(7, 0))).toBe(true);
    const b = breakRail(g, at(5, 0))!; expect(b).not.toBeNull(); breaksChanged(g);
    const step = (sec: number) => { for (let k = 0; k < sec * 30; k++) { g.s.t += 1 / 30; g.sys.tick(1 / 30); if (tickBreaks(g)) breaksChanged(g); } };
    step(8);
    const head = () => g.net.pieces[t.trail.at(-1)!.piece]!.squares;
    expect(head()).not.toContain(at(5, 0)); // stopped short of the break
    expect(t.dest).toBe(at(7, 0)); // still wants to go
    g.s.t = b.doneAt; step(10);
    expect(g.s.breaks!.length).toBe(0);
    expect(t.dest).toBeUndefined();
    expect(head()).toContain(at(7, 0));
  });
});
