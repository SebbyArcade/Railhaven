import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { buyProject, hasTunnels, projectError, projectsFor } from '../src/buildings/parks.ts';
import { squareCost, TRACK_COST } from '../src/track/rules.ts';
import { buildPlan, extendPlan, planCost, planError, startPlan } from '../src/track/paint.ts';
import { railNoGo } from '../src/buildings/nogo.ts';
import { trackChanged } from '../src/game.ts';
import { isRevealed } from '../src/world/fog.ts';

describe('⛰ tunnels: the Foundry in Ashford lets track cross mountains', () => {
  it('mountains refuse track until the Foundry is built, then cost $250 a square', async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const n = g.world.n, ash = g.s.sites[0]!, other = g.s.sites.find(s => s.kind === 'town' && s !== ash)!;
    // a line end or track square with a revealed mountain right beside it
    let from = -1, to = -1;
    for (const i of g.track.keys()) { for (const j of [i + 1, i - 1, i + n, i - n]) if (g.world.terr[j] === 4 && isRevealed(g, j) && !g.track.has(j)) { from = i; to = j; break; } if (to >= 0) break; }
    expect(to).toBeGreaterThan(0);
    expect(squareCost(g, to)).toMatch(/Foundry/);
    expect(railNoGo(g, to)).toBe(true);
    // only Ashford can build it, and only from Railway level 2
    expect(projectsFor(g, other).some(P => P.k === 'foundry')).toBe(false);
    expect(projectError(g, other, 'foundry')).toMatch(/Only Ashford/);
    const rlv = g.s.rlv; g.s.rlv = 1; g.s.money = 1e6;
    expect(projectError(g, ash, 'foundry')).toMatch(/Railway level 2/);
    g.s.rlv = Math.max(2, rlv ?? 0);
    expect(buyProject(g, ash, 'foundry')).toBe('');
    expect(hasTunnels(g)).toBe(true);
    expect(squareCost(g, to)).toBe(TRACK_COST.tunnel);
    expect(railNoGo(g, to)).toBe(false);
    // a stroke into the mountain is built and charged as tunnel
    const p = startPlan(g, from)!; extendPlan(g, p, to);
    expect(p.path.at(-1)).toBe(to);
    expect(planError(g, p)).toBe('');
    expect(planCost(g, p)).toBe(TRACK_COST.tunnel);
    const m = g.s.money; expect(typeof buildPlan(g, p)).not.toBe('string'); trackChanged(g);
    expect(m - g.s.money).toBe(TRACK_COST.tunnel);
    expect(g.track.has(to)).toBe(true);
  });
});
