import { describe, expect, it } from 'vitest';
import { breaksChanged, newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { breakRail, tickBreaks } from '../src/track/breaks.ts';
import { placeTrain } from '../src/trains/train.ts';

function setup() {
  const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
  const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(7, 0));
  if (typeof buildPlan(g, p) === 'string') throw new Error('build');
  trackChanged(g);
  return { g, at };
}

describe('engine shed and broken rails', () => {
  it('the engine shed stands beside the line near Ashford, and moves if track is laid on it', () => {
    const { g } = setup();
    expect(g.s.shed).toBeDefined();
    const sh = g.s.shed!, a = g.s.sites[0]!;
    expect(Math.hypot(sh.x - a.x, sh.y - a.y)).toBeLessThanOrEqual(6);
    expect(g.track.has(sh.y * g.world.n + sh.x)).toBe(false);
    const n = g.world.n, line = g.track.get((sh.y + [0, 1, 0, -1][sh.side]!) * n + sh.x + [1, 0, -1, 0][sh.side]!);
    expect(line).toBeDefined();
    // paint a branch straight through the shed's square: allowed, and the shed moves
    const i = sh.y * n + sh.x, j = (sh.y + [0, 1, 0, -1][sh.side]!) * n + sh.x + [1, 0, -1, 0][sh.side]!;
    const p = startPlan(g, j)!; extendPlan(g, p, i);
    expect(typeof buildPlan(g, p)).not.toBe('string'); trackChanged(g);
    expect(g.s.shed && g.s.shed.y * n + g.s.shed.x).not.toBe(i);
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
