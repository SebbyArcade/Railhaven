import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { placeTrain } from '../src/trains/train.ts';
import { tickEvents } from '../src/world/events.ts';
import { breakRail, tickBreaks } from '../src/track/breaks.ts';
import { crewRun, moveCrews, railPath, runDist, runPoint, runTime, runValid } from '../src/world/crews.ts';
import { TILE } from '../src/world/terrain.ts';
import type { Game } from '../src/state.ts';

// Sébastien (2026-11-15): the fire crew should travel on the rails to the fire, climb out and work, like the rail repair crew.
const live = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-15d.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };
const onTrack = (g: Game, p: { x: number; y: number }) => g.track.has(Math.floor(p.y / TILE) * g.world.n + Math.floor(p.x / TILE));
const run = (g: Game, secs: number) => { for (let s = 0; s < secs * 20; s++) { g.s.t += 0.05; tickBreaks(g); tickEvents(g, 0.05); } };

describe('crews ride the rails', () => {
  it('the fire crew rides from a station to the burning building, works, then rides home', () => {
    const g = live();
    g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: g.s.t };
    tickEvents(g, 0.05);
    const b = (g.s.buildings ?? []).find(x => x.fire)!;
    expect(b).toBeTruthy();
    const r = b.fire!.run!;
    expect(r && runValid(g, r)).toBe(true);
    expect(b.fire!.crewAt).toBeCloseTo(r.t0 + runTime(r), 3); // the fire waits for the crew to get there by rail
    // on the way it is always on the track, and it gets nearer
    const mid = runPoint(g, r, (r.t0 + b.fire!.crewAt) / 2)!;
    expect(onTrack(g, mid)).toBe(true);
    expect(mid.arrived).toBe(false);
    expect(runPoint(g, r, b.fire!.crewAt)!.arrived).toBe(true);
    // the fire burns until the crew has worked on it, then the crew rides home and is gone once back
    // (trains stand still in this test, so the crew may wait for them on the way and the fire's times move on with it)
    for (let k = 0; k < 600 && b.fire; k++) { expect(b.fire.crewAt).toBeCloseTo(r.t0 + runTime(r), 3); run(g, 0.5); }
    expect(b.fire).toBeUndefined();
    expect(g.s.crews?.length).toBe(1);
    const back = g.s.crews![0]!;
    expect(onTrack(g, runPoint(g, back, g.s.t + runTime(back) / 2)!)).toBe(true);
    for (let k = 0; k < 600 && g.s.crews?.length; k++) run(g, 0.5);
    expect(g.s.crews?.length ?? 0).toBe(0);
  });

  it('the repair crew pumps its handcar along the rails from the engine shed to the break', () => {
    const g = live();
    const br = breakRail(g, 87 * g.world.n + 98)!; // on the line north of Ashford, toward the quarry
    expect(br.run && runValid(g, br.run)).toBe(true);
    expect(br.crewAt).toBeCloseTo(br.run!.t0 + runTime(br.run!), 3);
    expect(onTrack(g, runPoint(g, br.run!, (br.run!.t0 + br.crewAt) / 2)!)).toBe(true);
  });
});

// Sébastien (2026-11-16): trains ran straight through the fire engine and the repair handcar. Now a crew car on the
// rails holds its stretch like a train: trains stop behind it, and the crew never runs into a train either.
describe('trains and crews share the rails', () => {
  function line() {
    const g = newGame(4242); g.s.money = 1e6; g.s.fog.fill(255);
    const n = g.world.n, a = g.s.sites[0]!, at = (k: number) => a.y * n + a.x - k; // a straight line west of Ashford
    const p = startPlan(g, at(0))!; extendPlan(g, p, at(18));
    if (typeof buildPlan(g, p) === 'string') throw new Error('build');
    trackChanged(g);
    const id = g.net.bySquare.get(at(3))!.find(i => g.net.pieces[i]!.squares.length === 1)!;
    const pc = g.net.pieces[id]!, t = placeTrain(g.net, 1, { piece: id, dir: pc.ta[0] > 0 ? 1 : -1 }, 2);
    g.s.trains.push(t); g.sys.rebuildHolds();
    let far = 8; while (g.track.has(at(far + 1))) far++;
    return { g, at, t, far };
  }
  const tick = (g: Game, secs: number, each?: () => void) => { for (let k = 0; k < secs * 20; k++) { g.s.t += 0.05; g.sys.tick(0.05); moveCrews(g, 0.05); each?.(); } };
  const crewPieces = (g: Game, r: ReturnType<typeof crewRun>) => { const d = runDist(r!, g.s.t), out: number[] = []; let s = 0; for (const k of r!.path) { const p = g.net.pieces[k >> 1]!; if (s + p.len >= d - 6 && s <= d + 6) out.push(p.id); s += p.len; } return out; };

  it('a train catching up with a crew car stops behind it and never runs through it', () => {
    const { g, at, t, far } = line();
    const r = crewRun(g, 'repair', railPath(g, [at(6)], [at(far)]), g.s.t)!; // a handcar riding home ahead of the train
    (g.s.crews ??= []).push(r);
    expect(g.sys.sendTo(t, at(far))).toBe(true);
    let behind = 0;
    tick(g, 40, () => {
      if (g.s.crews?.includes(r) && r.off === undefined && runDist(r, g.s.t) < r.len) { // (once home the car is put away)
        const body = new Set(t.trail.map(s => s.piece));
        expect(crewPieces(g, r).some(p => body.has(p))).toBe(false);
        if (Math.abs(t.v) < 1 && t.plan.length) behind++;
      }
    });
    expect(behind).toBeGreaterThan(0); // it had to wait for the slower handcar
    expect(t.dest).toBeUndefined(); // and still got there
    expect(g.net.pieces[t.trail.at(-1)!.piece]!.squares).toContain(at(far));
  });

  it('a crew meeting a train head-on lifts its car off the rails, lets it by and gets back on (no deadlock)', () => {
    const { g, at, t, far } = line();
    const r = crewRun(g, 'repair', railPath(g, [at(far - 1)], [at(1)]), g.s.t)!; // riding west toward the train
    (g.s.crews ??= []).push(r);
    expect(g.sys.sendTo(t, at(far))).toBe(true); // the train heads east, at the crew
    let wasOff = false, backOn = false;
    tick(g, 60, () => {
      if (r.off !== undefined) wasOff = true; else if (wasOff) backOn = true;
      if (g.s.crews?.includes(r) && r.off === undefined && runDist(r, g.s.t) < r.len) { const body = new Set(t.trail.map(s => s.piece)); expect(crewPieces(g, r).some(p => body.has(p))).toBe(false); }
    });
    expect(wasOff).toBe(true);
    expect(backOn).toBe(true);
    expect(g.net.pieces[t.trail.at(-1)!.piece]!.squares).toContain(at(far)); // the train got through
    expect(g.s.crews?.includes(r) ? runDist(r, g.s.t) : r.len).toBe(r.len); // and so did the crew
  });

  it('a fire crew held up by a train arrives later, and the fire lasts as long after it arrives', () => {
    const g = live();
    g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: g.s.t };
    tickEvents(g, 0.05);
    const b = (g.s.buildings ?? []).find(x => x.fire)!, f = b.fire!, work = f.doneAt - f.crewAt, at0 = f.crewAt;
    // park a train's hold right across the crew's way
    const mid = f.run!.path[Math.floor(f.run!.path.length / 2)]! >> 1;
    g.sys.holder.set(mid, 999);
    for (let k = 0; k < 20 * 30; k++) { g.s.t += 0.05; moveCrews(g, 0.05); g.sys.holder.set(mid, 999); }
    expect(f.crewAt).toBeGreaterThan(at0);
    expect(f.doneAt - f.crewAt).toBeCloseTo(work, 3);
  });
});
