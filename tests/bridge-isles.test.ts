import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { build, placeError, placementsAt, yardSquares, type Building, type IndustryKind } from '../src/buildings/industries.ts';
import { buyTrainFor, fleetByIsland } from '../src/economy/dispatch.ts';
import { buyFleet, fleetLvl, rushBySea, rushFee, rushUnitPrice, RUSH_SEA } from '../src/economy/upgrades.ts';
import { islandOfB, railIsleName } from '../src/ships/docks.ts';
import { railIsle, sameRail } from '../src/track/isles.ts';
import type { Game } from '../src/state.ts';
import { lay, linkB } from './sea.ts';
import { reveal } from '../src/world/fog.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';

/** Straight crossings from Ashford Isle to another named island over 1-3 squares of shallow water: [land A, ...water, land B]. */
function homeStrait(g: Game): number[] | undefined {
  const w = g.world, n = w.n;
  for (let y = 2; y < n - 2; y++) for (let x = 2; x < n - 2; x++) {
    const a = y * n + x; if (!w.terr[a] || w.islandOf[a] !== w.home) continue;
    for (const st of [1, n, -1, -n]) {
      const line = [a]; let j = a + st;
      while (line.length <= 4 && !w.terr[j] && !w.deep[j]) { line.push(j); j += st; }
      const kb = w.islandOf[j]!;
      if (line.length > 1 && line.length <= 4 && w.terr[j] && kb !== w.home && w.islands[kb]?.name) return [...line, j];
    }
  }
}

function buildNear(g: Game, kind: IndustryKind, isl: number, c: number): Building | null {
  const n = g.world.n, cx = c % n, cy = (c / n) | 0, spots: { q: ReturnType<typeof placementsAt>[number]; d: number }[] = [];
  for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 20; x <= cx + 20; x++) {
    if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) continue;
    for (const q of placementsAt(kind, x, y)) if (g.world.islandOf[yardSquares(n, q)[0]!] === isl && !placeError(g, q)) spots.push({ q, d: Math.hypot(x - cx, y - cy) });
  }
  spots.sort((p, q) => p.d - q.d);
  for (const s of spots.slice(0, 60)) {
    if (placeError(g, s.q)) continue;
    const b = build(g, s.q); if (typeof b === 'string') continue; trackChanged(g);
    if (linkB(g, b)) return b;
  }
  return null;
}

/** Seed 4242: Ashford Isle and a sister island a short strait away, joined by a 🌉 strait bridge. */
function bridged() {
  const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!; g.s.money = 1e7; g.s.rlv = 6;
  reveal(g, n / 2, n / 2, n);
  const p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, a.y * n + a.x + 3); buildPlan(g, p); trackChanged(g);
  (g.s.parks ??= []).push({ town: g.s.sites[0]!.id, x: -9, y: -9, k: 'bridgeworks' });
  const line = homeStrait(g)!; expect(line).toBeTruthy();
  const far = g.world.islandOf[line.at(-1)!]!;
  return { g, line, far };
}

describe('🌉 islands joined by a strait bridge are one railway', () => {
  it('a bridge joins the two islands; without it they stay apart', () => {
    const { g, line, far } = bridged();
    expect(sameRail(g, g.world.home, far)).toBe(false);
    expect(lay(g, line[0]!)).toBe(true);
    expect(sameRail(g, g.world.home, far)).toBe(false);
    expect(lay(g, line.at(-1)!)).toBe(true);
    expect(sameRail(g, g.world.home, far)).toBe(true);
    expect(railIsle(g, far)).toBe(g.world.home);
    expect(railIsleName(g, far)).toBe(`Ashford Isle and ${g.world.islands[far]!.name}`);
  });

  it('⭐ a rush for goods made across the bridge comes by train: no 🚢, no sea price', () => {
    const { g, line, far } = bridged();
    expect(lay(g, line.at(-1)!)).toBe(true);
    const camp = buildNear(g, 'wood', far, line.at(-1)!)!;
    expect(camp).not.toBeNull(); expect(islandOfB(g, camp)).toBe(far);
    const town = { kind: 'town' as const, id: g.s.sites[0]!.id };
    expect(rushBySea(g, town, 'wood')).toBe(false);
    // and the price is the rail one: dearer by RUSH_SEA only when it really comes by ship
    const rail = rushUnitPrice(g, town, 'wood');
    expect(rushFee(g, town, 'wood')).toBeGreaterThan(0);
    expect(RUSH_SEA).toBeGreaterThan(1);
    expect(rail).toBeLessThan(rail * RUSH_SEA);
  });

  it('🚂 trains for the sister island come from the engine shed by rail and share Ashford Isle\'s upgrades', () => {
    const { g, line, far } = bridged();
    expect(lay(g, line.at(-1)!)).toBe(true);
    const fleets = fleetByIsland(g);
    expect(fleets.some(f => f.island === far)).toBe(false);
    expect(fleets.find(f => f.island === g.world.home)!.buyAt).toBe('shed');
    const t = buyTrainFor(g, far);
    expect(typeof t).not.toBe('string');
    expect((t as { ferry?: unknown }).ferry).toBeUndefined();
    expect(buyFleet(g, 'wag', far)).toBe('');
    expect(fleetLvl(g, 'wag', g.world.home)).toBe(1);
    expect(fleetLvl(g, 'wag', far)).toBe(1);
  });
});

describe('🌉 his save: Gull Rock bridged to Cobble Key', () => {
  it("Fernley Haven's stone and wood rushes come by rail once the strait bridge is built, and the two islands share their trains", async () => {
    const fs = await import('node:fs'), { loadFrom } = await import('../src/save/save.ts');
    const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16g.json', 'utf8');
    const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)!, n = g.world.n;
    const fh = g.s.sites.find(s => s.name === 'Fernley Haven')!, to = { kind: 'town' as const, id: fh.id };
    expect(rushBySea(g, to, 'stone')).toBe(true); // nothing on Gull Rock makes stone, and no bridge yet
    g.s.money = 1e6; g.s.rlv = Math.max(6, g.s.rlv ?? 0);
    (g.s.parks ??= []).push({ town: g.s.sites[0]!.id, x: -9, y: -9, k: 'bridgeworks' });
    const pts = [[60, 141], [59, 141], [58, 141], [57, 141], [56, 141], [55, 141], [54, 141], [53, 141], [52, 141]];
    const p = startPlan(g, pts[0]![1]! * n + pts[0]![0]!)!; for (const [x, y] of pts.slice(1)) extendPlan(g, p, y! * n + x!);
    expect(typeof buildPlan(g, p)).not.toBe('string'); trackChanged(g);
    expect(rushBySea(g, to, 'stone')).toBe(false);
    expect(rushBySea(g, to, 'wood')).toBe(false);
    const names = fleetByIsland(g).map(f => f.name);
    expect(names).toContain('Cobble Key and Gull Rock');
    expect(names).not.toContain('Gull Rock');
  });
});
