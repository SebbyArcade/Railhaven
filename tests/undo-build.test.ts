import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { bestPlacement, nearestSpot, yardSquares } from '../src/buildings/industries.ts';
import { Tools } from '../src/ui/tools.ts';

(globalThis as any).document ??= { getElementById: () => ({ style: {} }) };
(globalThis as any).window ??= { setTimeout: () => 0 };

describe('↶ Undo a building', () => {
  it('takes its yard track away too, and gives all the money back', () => {
    const g = newGame(4242), a = g.s.sites[0]!, tools = new Tools(() => g);
    const spot = nearestSpot(g, 'farm', a.x, a.y)!, p = bestPlacement(g, 'farm', spot.x, spot.y).place!;
    const track0 = JSON.stringify([...g.track].sort((x, y) => x[0] - y[0])), m0 = g.s.money;
    tools.mode = 'build'; tools.buildKind = 'farm'; tools.preview = p; tools.previewErr = '';
    tools.confirm();
    const b = g.s.buildings!.at(-1)!; expect(b.kind).toBe('farm');
    expect(yardSquares(g.world.n, b).every(i => g.track.has(i))).toBe(true);
    expect(tools.canUndo()).toBe(true);
    tools.undo();
    expect(g.s.buildings!.length).toBe(0);
    expect(g.s.money).toBe(m0);
    expect(JSON.stringify([...g.track].sort((x, y) => x[0] - y[0]))).toBe(track0); // no loading track left behind
  });

  it('is not offered when the building uncovered fog, or once new track is laid', () => {
    const g = newGame(4242), a = g.s.sites[0]!, tools = new Tools(() => g);
    const spot = nearestSpot(g, 'farm', a.x, a.y)!, p = bestPlacement(g, 'farm', spot.x, spot.y).place!;
    g.s.fog[0] = 0; g.terrainDirty = () => { g.s.fog[0] = 255; }; // the build lifts some fog (as a dock charting the sea does)
    tools.mode = 'build'; tools.buildKind = 'farm'; tools.preview = p; tools.previewErr = '';
    tools.confirm(); expect(g.s.buildings!.length).toBe(1); expect(tools.canUndo()).toBe(false);
    // a fresh build, then new track: no Undo for the building any more
    const g2 = newGame(4242), t2 = new Tools(() => g2), s2 = nearestSpot(g2, 'farm', a.x, a.y)!, p2 = bestPlacement(g2, 'farm', s2.x, s2.y).place!;
    t2.mode = 'build'; t2.buildKind = 'farm'; t2.preview = p2; t2.previewErr = ''; t2.confirm(); expect(t2.canUndo()).toBe(true);
    t2.mode = 'rail'; t2.plan = { path: [a.y * g2.world.n + a.x, a.y * g2.world.n + a.x + 1] }; t2.confirm();
    expect(t2.undoBuilding()).toBe(null);
  });
});
