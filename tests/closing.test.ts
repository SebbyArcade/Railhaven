import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { destinationsOf, shipPlan } from '../src/economy/shipping.ts';
import { isFactory, isLinked } from '../src/buildings/industries.ts';
import { barriersDown, closedPieces, setClosed, yardTrackSquares } from '../src/buildings/closing.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { tickBreaks } from '../src/track/breaks.ts';
import { breaksChanged } from '../src/game.ts';
import { cardHtml } from '../src/ui/cards.ts';
import type { Game } from '../src/state.ts';

const load = async () => importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8'))).g;
function run(g: Game, secs: number) {
  for (let k = 0; k < secs * 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); if (tickBreaks(g)) breaksChanged(g); }
}

describe('⛔ closing a building', () => {
  it('a closed camp makes nothing, sends nothing, and its barriers keep trains out until it opens', async () => {
    const g = await load();
    const b = (g.s.buildings ?? []).find(x => x.kind !== 'dock' && !isFactory(x.kind) && isLinked(g, x) && shipPlan(g).has(x.id))!;
    expect(b).toBeTruthy();
    expect(setClosed(b, true)).toBe('');
    expect(shipPlan(g).has(b.id)).toBe(false);
    const stock = b.stock; g.s.breaks = [];
    run(g, 90);
    expect(b.stock).toBeLessThanOrEqual(stock); // made nothing
    expect(g.s.trains.some(t => t.job?.src === b.id && t.job.phase === 'toLoad')).toBe(false);
    expect(barriersDown(g, b)).toBe(true); // the last train has left: barriers down
    const ys = yardTrackSquares(g, b);
    expect(g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]!.squares.some(i => ys.has(i))))).toBe(false);
    const blocked = closedPieces(g); expect(blocked.size).toBeGreaterThan(0);
    for (const p of blocked) expect(g.sys.blocked.has(p)).toBe(true);
    // no train waits at the barrier for it
    for (const t of g.s.trains) if (t.dest !== undefined) expect(ys.has(t.dest)).toBe(false);
    expect(cardHtml(g, { kind: 'bld', id: b.id })).toContain('Closed');
    // open again: barriers up, it sends again
    expect(setClosed(b, false)).toBe('');
    run(g, 2);
    expect(barriersDown(g, b)).toBe(false);
    for (const p of blocked) expect(g.sys.blocked.has(p)).toBe(false);
    expect(shipPlan(g).has(b.id)).toBe(true);
  });

  it('a closed factory takes nothing in: loads on their way go on to a town', async () => {
    const g = await load();
    const f = (g.s.buildings ?? []).find(x => isFactory(x.kind) && isLinked(g, x))!;
    expect(f).toBeTruthy();
    const feeders = (g.s.buildings ?? []).filter(x => x !== f && destinationsOf(g, x).some(d => d.to.kind === 'bld' && d.to.id === f.id));
    setClosed(f, true);
    for (const x of feeders) expect(destinationsOf(g, x).some(d => d.to.kind === 'bld' && d.to.id === f.id)).toBe(false);
    const inb = JSON.stringify(f.inbuf ?? {}); g.s.breaks = [];
    run(g, 60);
    expect(JSON.stringify(f.inbuf ?? {})).toBe(inb);
    expect(g.s.trains.some(t => t.job?.to.kind === 'bld' && t.job.to.id === f.id)).toBe(false);
  });

  it('docks stay open', async () => {
    const g = await load();
    const d = (g.s.buildings ?? []).find(x => x.kind === 'dock');
    if (d) expect(setClosed(d, true)).toContain('Docks');
  });
});
