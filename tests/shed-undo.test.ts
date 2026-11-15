import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan, undoStroke } from '../src/track/paint.ts';
import { DX, DY } from '../src/core/grid.ts';
import { shedSiding } from '../src/buildings/shed.ts';
import type { Game } from '../src/state.ts';

/** Ashford with a straight line east and the engine shed beside it. */
function lineGame(): Game {
  const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
  const q = startPlan(g, a.y * n + a.x)!; for (let k = 1; k <= 8; k++) extendPlan(g, q, a.y * n + a.x + k);
  if (typeof buildPlan(g, q) === 'string') throw new Error('no line'); trackChanged(g);
  if (!g.s.shed) throw new Error('no shed');
  return g;
}
const sidingOk = (g: Game) => { const s = shedSiding(g)!; return g.track.get(s.shed)?.links === 1 << g.s.shed!.side; };

describe('the engine shed stays put', () => {
  it('track laid round the side and behind the shed does not move it', () => {
    const g = lineGame(), n = g.world.n, s0 = { ...g.s.shed! }, d = s0.side;
    const line = (s0.y + 2 * DY[d]) * n + s0.x + 2 * DX[d], across = DX[d] !== 0 ? n : 1, start = line + across * 2;
    const back = (s0.y - DY[d]) * n + s0.x - DX[d];
    const p = startPlan(g, start)!; extendPlan(g, p, start - (DX[d] + DY[d] * n) * 3); extendPlan(g, p, back - across); extendPlan(g, p, back);
    expect(p.path.at(-1)).toBe(back);
    const b = buildPlan(g, p); expect(typeof b).not.toBe('string'); trackChanged(g);
    expect(g.s.shed).toEqual(s0);
    expect(sidingOk(g)).toBe(true);
  });

  it('Undo puts the shed back where it stood when the new track pushed it away', () => {
    const g = lineGame(), n = g.world.n, s0 = { ...g.s.shed! }, sd = shedSiding(g)!, d = s0.side;
    const track0 = JSON.stringify([...g.track].sort((p, q) => p[0] - q[0]));
    // a stroke that runs into the shed's own square from behind: the shed has to move
    const across = DX[d] !== 0 ? n : 1, start = sd.line + across * 2, back = sd.shed - (DX[d] + DY[d] * n);
    const p = startPlan(g, start)!; extendPlan(g, p, start - (DX[d] + DY[d] * n) * 3); extendPlan(g, p, back - across); extendPlan(g, p, back); extendPlan(g, p, sd.shed);
    expect(p.path.at(-1)).toBe(sd.shed);
    const b = buildPlan(g, p); if (typeof b === 'string') throw new Error(b); trackChanged(g);
    expect(g.s.shed).not.toEqual(s0);
    undoStroke(g, b); trackChanged(g);
    expect(g.s.shed).toEqual(s0);
    expect(sidingOk(g)).toBe(true);
    expect(JSON.stringify([...g.track].sort((p, q) => p[0] - q[0]))).toBe(track0);
  });
});
