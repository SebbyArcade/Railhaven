import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, nearestSpot } from '../src/buildings/industries.ts';
import { breakRail } from '../src/track/breaks.ts';
import { hearScene, QUIET_ZOOM } from '../src/audio/scene.ts';
import { TILE } from '../src/world/terrain.ts';

const view = { w: 412, h: 860 };

describe('sound follows the screen', () => {
  it('hears a building on screen, a repair crew and a storm, and nothing when zoomed out', () => {
    const g = newGame(4242), a = g.s.sites[0]!;
    const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    trackChanged(g);
    const c = g.s.camera; c.x = (b.x + 2) * TILE; c.y = (b.y + 1) * TILE; c.z = 1.8;
    const sc = hearScene(g, view);
    const camp = sc.sources.find(h => h.id === `b${b.id}`);
    expect(camp?.kind).toBe('wood');
    expect(camp!.vol).toBeGreaterThan(0.3);
    expect(Math.abs(camp!.pan)).toBeLessThanOrEqual(0.7);
    expect(sc.sources.some(h => h.kind === 'town')).toBe(false); // Ashford has no track yet
    // panned far away: the camp fades out
    c.x += 60 * TILE;
    expect(hearScene(g, view).sources.some(h => h.id === `b${b.id}`)).toBe(false);
    c.x -= 60 * TILE;
    // zoomed out: no effects at all (the music keeps playing)
    c.z = QUIET_ZOOM;
    const far = hearScene(g, view);
    expect(far.near).toBe(0);
    expect(far.sources).toHaveLength(0);
    expect(far.sea + far.forest + far.grass + far.hills).toBe(0);
    // a washout with its repair crew at work
    c.z = 1.8;
    const sq = [...g.track.keys()][0];
    expect(sq).toBeDefined();
    if (sq !== undefined) {
      const br = breakRail(g, sq);
      expect(br).not.toBeNull();
      if (br) {
        br.kind = 'washout'; c.x = (sq % g.world.n + 0.5) * TILE; c.y = (((sq / g.world.n) | 0) + 0.5) * TILE;
        g.s.t = br.crewAt + 1;
        const st = hearScene(g, view);
        expect(st.sources.some(h => h.kind === 'repair')).toBe(true);
        expect(st.storm).toBeGreaterThan(0.5);
      }
    }
  });
});
