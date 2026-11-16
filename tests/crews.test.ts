import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickEvents } from '../src/world/events.ts';
import { breakRail, tickBreaks } from '../src/track/breaks.ts';
import { runPoint, runTime, runValid } from '../src/world/crews.ts';
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
    run(g, b.fire!.doneAt - g.s.t - 0.5); expect(b.fire).toBeTruthy();
    run(g, 1); expect(b.fire).toBeUndefined();
    expect(g.s.crews?.length).toBe(1);
    const back = g.s.crews![0]!;
    expect(onTrack(g, runPoint(g, back, g.s.t + runTime(back) / 2)!)).toBe(true);
    run(g, runTime(back) + 2); expect(g.s.crews?.length ?? 0).toBe(0);
  });

  it('the repair crew pumps its handcar along the rails from the engine shed to the break', () => {
    const g = live();
    const br = breakRail(g, 87 * g.world.n + 98)!; // on the line north of Ashford, toward the quarry
    expect(br.run && runValid(g, br.run)).toBe(true);
    expect(br.crewAt).toBeCloseTo(br.run!.t0 + runTime(br.run!), 3);
    expect(onTrack(g, runPoint(g, br.run!, (br.run!.t0 + br.crewAt) / 2)!)).toBe(true);
  });
});
