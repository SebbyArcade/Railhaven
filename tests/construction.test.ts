import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, buildingUp, BUILD_SHOW, nearestSpot } from '../src/buildings/industries.ts';
import { tickProduction } from '../src/economy/production.ts';
import { hearScene, QUIET_ZOOM } from '../src/audio/scene.ts';
import { cueMemo, cues } from '../src/audio/cues.ts';
import { TILE } from '../src/world/terrain.ts';

const view = { w: 412, h: 860 };
function camp(seed = 4242) {
  const g = newGame(seed), a = g.s.sites[0]!;
  const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
  if (typeof b === 'string') throw new Error(b);
  trackChanged(g);
  const c = g.s.camera; c.x = (b.x + 2) * TILE; c.y = (b.y + 1) * TILE; c.z = 1.8;
  return { g, b };
}

describe('builders put up a new building', () => {
  it('plays for 5 seconds from the moment it is built', () => {
    const { g, b } = camp();
    expect(b.built).toBe(g.s.t);
    expect(buildingUp(g, b)).toBe(0);
    g.s.t += BUILD_SHOW / 2; expect(buildingUp(g, b)).toBeCloseTo(0.5);
    g.s.t += BUILD_SHOW / 2; expect(buildingUp(g, b)).toBeNull();
    delete b.built; g.s.t -= BUILD_SHOW; expect(buildingUp(g, b)).toBeNull(); // old saves: no scene
  });

  it('works from the first moment: the scene does not slow it down', () => {
    const one = camp(), two = camp();
    delete two.b.built;
    for (let i = 0; i < 40; i++) { for (const x of [one, two]) { x.g.s.t += 0.1; tickProduction(x.g, 0.1); } }
    expect(one.b.stock).toBe(two.b.stock);
  });

  it('sounds like builders while it goes up, then like the building, with a ding when done', () => {
    const { g, b } = camp(), m = cueMemo(g);
    let sc = hearScene(g, view);
    expect(sc.sources.find(h => h.id === `c${b.id}`)?.kind).toBe('build');
    expect(sc.sources.some(h => h.id === `b${b.id}`)).toBe(false);
    g.s.camera.z = QUIET_ZOOM; // zoomed out: still heard, a little (the player's own work)
    expect(hearScene(g, view).sources.find(h => h.kind === 'build')!.vol).toBeGreaterThanOrEqual(0.4);
    g.s.camera.z = 1.8;
    expect(cues(g, view, m).map(c => c.kind)).not.toContain('built');
    g.s.t += BUILD_SHOW + 0.1;
    sc = hearScene(g, view);
    expect(sc.sources.some(h => h.kind === 'build')).toBe(false);
    expect(cues(g, view, m).map(c => c.kind)).toContain('built');
    expect(cues(g, view, m).map(c => c.kind)).not.toContain('built'); // once
  });
});
