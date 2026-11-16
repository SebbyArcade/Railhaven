import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { bestPlacement, nearestSpot } from '../src/buildings/industries.ts';
import { Tools } from '../src/ui/tools.ts';

(globalThis as any).document ??= { getElementById: () => ({ style: {} }) };
(globalThis as any).window ??= { setTimeout: () => 0 };

/** a straight run of free squares east of Ashford, and a track square to tap that is not on it */
function setup() {
  const g = newGame(4242), a = g.s.sites[0]!, n = g.world.n, tools = new Tools(() => g), A = a.y * n + a.x;
  return { g, n, tools, A, a };
}

describe('Rails: the line being drawn stays put', () => {
  it('a drag that starts on other track pans instead of starting a new line', () => {
    const { g, n, tools, A } = setup();
    tools.mode = 'rail';
    expect(tools.dragStart(A)).toBe(true); for (let k = 1; k <= 4; k++) tools.dragOver(A + k);
    tools.confirm(); // the first stretch: the tool closes
    tools.mode = 'rail';
    expect(tools.dragStart(A + 4)).toBe(true); tools.dragOver(A + 4 + n); tools.dragOver(A + 4 + 2 * n);
    const drawn = [...tools.plan!.path];
    expect(drawn.length).toBe(3);
    expect(g.track.has(A + 2)).toBe(true);
    expect(tools.dragStart(A + 2)).toBe(false); // starts on built track, away from the line's end: pans
    expect(tools.plan!.path).toEqual(drawn);
    expect(tools.dragStart(A + 1 + n)).toBe(false); // right beside built track: still pans
    expect(tools.plan!.path).toEqual(drawn);
    expect(tools.dragStart(A + 4 + 3 * n)).toBe(true); // beside the end: carries the line on
    expect(tools.plan!.path.at(-1)).toBe(A + 4 + 3 * n);
  });

  it('a tap on track runs the line on from its end, never starting a new one', () => {
    const { g, n, tools, A } = setup();
    for (let k = 1; k <= 4; k++) g.track.set(A + k, { links: 5 } as any);
    tools.mode = 'rail';
    tools.tapSquare(A + 4 + 3 * n); // nothing drawn yet: not on the network
    expect(tools.plan).toBe(null);
    tools.tapSquare(A); expect(tools.plan!.path).toEqual([A]);
    tools.tapSquare(A + 2); // other track: the line runs there from its start, it doesn't jump
    expect(tools.plan!.path[0]).toBe(A);
  });
});

describe('Tools close after building', () => {
  it('rails: back to panning, with Keep building that carries on from the end', () => {
    const { g, tools, A } = setup();
    tools.mode = 'rail'; tools.dragStart(A); for (let k = 1; k <= 3; k++) tools.dragOver(A + k);
    tools.confirm();
    expect(g.track.has(A + 3)).toBe(true);
    expect(tools.mode).toBe('pan'); expect(tools.plan).toBe(null);
    expect(tools.bar()?.ok).toBe('🛤 Keep building');
    expect(tools.canUndo()).toBe(true);
    expect(tools.resume()).toBe('');
    expect(tools.mode).toBe('rail'); expect(tools.plan!.path).toEqual([A + 3]);
  });

  it('a building: back to panning, and the bar offers what comes next', () => {
    const { g, tools, a } = setup();
    const spot = nearestSpot(g, 'farm', a.x, a.y)!, p = bestPlacement(g, 'farm', spot.x, spot.y).place!;
    tools.mode = 'build'; tools.buildKind = 'farm'; tools.preview = p; tools.previewErr = '';
    tools.confirm();
    expect(tools.mode).toBe('pan'); expect(tools.buildKind).toBe(null);
    expect(['🏗 Build more', '🛤 Lay its track']).toContain(tools.bar()?.ok);
    expect(tools.canUndo()).toBe(true);
    tools.cancel(); expect(tools.bar()).toBe(null); // ✕ hides the offer
  });
});
