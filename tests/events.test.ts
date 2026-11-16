import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { bodyPoint, placeTrain } from '../src/trains/train.ts';
import { bestPlacement, build, nearestSpot, yardSquares } from '../src/buildings/industries.ts';
import { tickProduction } from '../src/economy/production.ts';
import { EVENTS_START, inStorm, STORM_SLOW, tickEvents, trainSpeedMul } from '../src/world/events.ts';
import { TILE } from '../src/world/terrain.ts';
import { isRevealed } from '../src/world/fog.ts';
import { newsPlace } from '../src/core/news.ts';

function setup() {
  const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
  const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(14, 0));
  if (typeof buildPlan(g, p) === 'string') throw new Error('build');
  trackChanged(g);
  const id = g.net.bySquare.get(at(3, 0))!.find(i => g.net.pieces[i]!.squares.length === 1)!;
  const pc = g.net.pieces[id]!, t = placeTrain(g.net, 1, { piece: id, dir: pc.ta[0] > 0 ? 1 : -1 }, 2);
  g.s.trains.push(t); g.sys.rebuildHolds();
  return { g, at, t };
}
const run = (g: ReturnType<typeof newGame>, sec: number) => { for (let k = 0; k < sec * 20; k++) { g.s.t += 0.05; g.sys.tick(0.05); tickProduction(g, 0.05); tickEvents(g, 0.05); } };

describe('storms, breakdowns and fires', () => {
  it('nothing happens early in a game', () => {
    const { g } = setup();
    run(g, 60);
    expect(g.s.storm).toBeUndefined();
    expect(g.news ?? []).toHaveLength(0);
    expect(g.s.nextEvent!.storm).toBeGreaterThanOrEqual(EVENTS_START);
  });

  it('a broken-down train stops where it is and goes on once the crew has fixed it', () => {
    const { g, at, t } = setup();
    let far = 7; while (g.track.has(at(far + 1, 0))) far++;
    expect(g.sys.sendTo(t, at(far, 0))).toBe(true);
    run(g, 0.5);
    const crewAt = g.s.t + 3; t.broke = { crewAt, doneAt: crewAt + 5 };
    run(g, 2);
    const p0 = bodyPoint(g.net, t, 0);
    run(g, 4);
    expect(t.v).toBe(0);
    const p1 = bodyPoint(g.net, t, 0);
    expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeLessThan(0.01); // never slides
    expect(trainSpeedMul(g, t)).toBe(0);
    g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: 1e9 };
    run(g, 3);
    expect(t.broke).toBeUndefined();
    expect(g.news!.some(m => m.includes('is fixed'))).toBe(true);
    run(g, 1);
    expect(t.dest).toBeDefined();
    expect(Math.abs(t.v)).toBeGreaterThan(0);
  });

  it('a storm slows trains under it, drifts and passes', () => {
    const { g, at, t } = setup();
    g.s.t = EVENTS_START + 61; g.s.nextEvent = { storm: g.s.t, breakdown: 1e9, fire: 1e9 };
    run(g, 0.05);
    const st = g.s.storm!; expect(st).toBeDefined();
    expect(g.news!.some(m => m.startsWith('⛈'))).toBe(true);
    st.x = (at(3, 0) % g.world.n); st.y = Math.floor(at(3, 0) / g.world.n); st.vx = st.vy = 0;
    const p = bodyPoint(g.net, t, 0);
    expect(inStorm(g, p.x / TILE, p.y / TILE)).toBe(true);
    expect(trainSpeedMul(g, t)).toBe(STORM_SLOW);
    g.s.t = st.until - 0.01; run(g, 0.1);
    expect(g.s.storm).toBeUndefined();
    expect(trainSpeedMul(g, t)).toBe(1);
  });

  it('a storm stays over discovered land from start to end, never in the fog (he asked)', () => {
    const { g } = setup(), n = g.world.n;
    let moving = 0;
    for (let k = 0; k < 40; k++) {
      g.s.storm = undefined; g.s.t = EVENTS_START + 61 + k * 37; g.s.nextEvent = { storm: g.s.t, breakdown: 1e9, fire: 1e9 };
      tickEvents(g, 0.01);
      const st = g.s.storm!; expect(st).toBeDefined();
      if (st.vx || st.vy) moving++;
      const life = st.until - g.s.t;
      for (let i = 0; i <= 40; i++) {
        const x = Math.round(st.x + st.vx * life * i / 40), y = Math.round(st.y + st.vy * life * i / 40);
        expect(isRevealed(g, y * n + x)).toBeTruthy();
      }
    }
    expect(moving).toBeGreaterThan(30); // most still drift across
  });

  it('a building on fire makes nothing until the fire crew puts it out, and keeps its stock', () => {
    const g = newGame(4242), a = g.s.sites[0]!;
    const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    trackChanged(g);
    g.linked!.add(yardSquares(g.world.n, b)[0]!); // count it as on the railway (no track needed for this test)
    run(g, 2); const before = b.stock; expect(before).toBeGreaterThan(0); // it works
    b.stock = 10;
    g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: 1e9 };
    b.fire = { crewAt: g.s.t + 2, doneAt: g.s.t + 6 };
    run(g, 4);
    expect(b.stock).toBe(10);
    run(g, 3);
    expect(b.fire).toBeUndefined();
    expect(b.stock).toBeGreaterThan(10); // working again
    expect(g.news!.some(m => m.startsWith('🚒'))).toBe(true);
  });

  it('notes about a place say where it is, for their Go › button', () => {
    const { g, t } = setup();
    g.s.t = EVENTS_START + 61; g.s.nextEvent = { storm: g.s.t, breakdown: 1e9, fire: 1e9 };
    run(g, 0.05);
    const storm = g.news!.find(m => m.startsWith('⛈'))!;
    expect(newsPlace(g, storm)?.kind).toBe('sq');
    expect(newsPlace(g, storm)).toBeUndefined(); // read once
    const crewAt = g.s.t + 1; t.broke = { crewAt, doneAt: crewAt + 1 }; g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: 1e9 };
    run(g, 3);
    expect(newsPlace(g, g.news!.find(m => m.includes('is fixed'))!)).toEqual({ kind: 'train', id: t.id });
    expect(newsPlace(g, '🌤 The storm has passed')).toBeUndefined(); // no place: no button
  });

  it('a fire note leads to the building', () => {
    const g = newGame(4242), a = g.s.sites[0]!;
    const s = nearestSpot(g, 'wood', a.x, a.y)!, b = build(g, bestPlacement(g, 'wood', s.x, s.y).place!);
    if (typeof b === 'string') throw new Error(b);
    trackChanged(g);
    g.linked!.add(yardSquares(g.world.n, b)[0]!);
    g.s.t = EVENTS_START + 61; g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: g.s.t };
    run(g, 0.05);
    const fire = g.news!.find(m => m.startsWith('🔥'))!;
    expect(newsPlace(g, fire)).toEqual({ kind: 'bld', id: b.id });
  });
});
