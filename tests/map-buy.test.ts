import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { buildingSquares } from '../src/buildings/industries.ts';
import { mapAt, mappedShare, MAP_R } from '../src/world/maps.ts';
import { drawMaps } from '../src/render/explore.ts';
import { isRevealed } from '../src/world/fog.ts';
import { trackChanged } from '../src/game.ts';

const load = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16d.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };

// his bug report 9 (2026-11-16): the map circle near a dock was huge and much bigger than near a town; bought areas
// weren't shown; random round clearings appeared after building a dock on an island
describe('area maps and island surveys', () => {
  it('a map circle is the same, smaller size near a town and near a dock', () => {
    const g = load(), n = g.world.n;
    const town = g.s.sites.find(s => s.name === 'Kelpstone')!, dock = g.s.buildings!.find(b => b.kind === 'dock')!, m = buildingSquares(n, dock)[1]!;
    const a = mapAt(g, town.x, town.y + 5), b = mapAt(g, m % n + 3, ((m / n) | 0));
    expect(typeof a).not.toBe('string'); expect(typeof b).not.toBe('string');
    expect((a as { r: number }).r).toBe(MAP_R); expect((b as { r: number }).r).toBe(MAP_R);
    expect(MAP_R).toBeLessThanOrEqual(20);
  });

  it('says how much of a circle is already mapped', () => {
    const g = load(), old = g.s.maps![0]!;
    expect(mappedShare(g, old.x, old.y, MAP_R)).toBe(1);
    expect(mappedShare(g, old.x + old.r + MAP_R + 2, old.y, MAP_R)).toBe(0);
  });

  it('a landing crew marks iron and oil without clearing holes in the fog', () => {
    const g = load(), n = g.world.n, home = g.world.home;
    trackChanged(g); // settle what loading uncovered first (buildings clear the land around their yards, which can find a landmark)
    // put the outer islands' iron and oil back in the fog, as before the landing crew came
    const deps = g.s.sites.filter(s => s.kind === 'dep' && (s.res === 'iron' || s.res === 'oil') && g.world.islandOf[s.y * n + s.x] !== home);
    expect(deps.length).toBeGreaterThan(0);
    for (const s of deps) { s.hidden = true; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const k = (s.y + dy) * n + s.x + dx; g.s.fog[k >> 3]! &= ~(1 << (k & 7)); } }
    const fog0 = g.s.fog.slice();
    trackChanged(g);
    const shown = deps.filter(s => !s.hidden);
    expect(shown.length).toBeGreaterThan(0); // the crew found them
    expect([...g.s.fog]).toEqual([...fog0]); // and left the fog as it was
  });

  // his bug report 10 (2026-11-16): empty white rings over unexplored fog (every coal and stone deposit was drawn).
  // Then (2026-11-16, "Spoiler in fog"): an oil barrel a landing crew surveyed showed deep in the fog. Nothing under
  // the fog gets its own icon now: only the ? of a map he bought
  it('nothing under the fog is marked except the ? of a bought map', () => {
    const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16e.json', 'utf8');
    const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game, n = g.world.n;
    const fogged = g.s.sites.filter(s => s.kind === 'dep' && !isRevealed(g, s.y * n + s.x));
    expect(fogged.length).toBeGreaterThan(0);
    for (const s of fogged) if (s.res === 'iron' || s.res === 'oil') s.hidden = false; // as if a landing crew surveyed them
    expect(fogged.some(s => (s.res === 'iron' || s.res === 'oil') && !s.hidden)).toBe(true);
    const texts: string[] = [], ctx = new Proxy({}, { get: (_o, k) => k === 'fillText' ? (t: string) => texts.push(t) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: () => true }) as unknown as CanvasRenderingContext2D;
    g.s.maps = []; drawMaps(ctx, g, undefined, 0, 1);
    expect(texts.every(t => t === '?')).toBe(true); // an explorer's camp he took over may mark ?; never a barrel or magnet
    const before = texts.length;
    g.s.maps = [{ x: fogged[0]!.x, y: fogged[0]!.y, r: MAP_R }]; drawMaps(ctx, g, undefined, 0, 1);
    expect(texts.length).toBeGreaterThanOrEqual(before);
    expect(texts.every(t => t === '?')).toBe(true);
  });
});
