import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { buyMap, mapAt, mapCost, mapFinds, mapPlaces, MAP_FAR, MAP_R, rumours } from '../src/world/maps.ts';

describe('🗺 area maps', () => {
  it('mark what hides in the fog with ?, cost more each time, and pay half back when they find nothing', async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const n = g.world.n; g.s.maps = []; g.s.money = 100000;
    const p = mapPlaces(g).find(x => !x.dock)!; expect(p).toBeTruthy();
    let far = -1; for (let i = 0; i < n * n && far < 0; i++) if (mapPlaces(g).every(q => Math.hypot(q.x - i % n, q.y - ((i / n) | 0)) > MAP_FAR)) far = i;
    expect(far).toBeGreaterThanOrEqual(0); expect(mapAt(g, far % n, (far / n) | 0)).toContain('Too far'); // too far from the railway
    expect(typeof mapAt(g, -1, 5)).toBe('string');
    const at = mapAt(g, p.x, p.y); expect(typeof at).toBe('object'); if (typeof at === 'string') return; expect(at.r).toBe(MAP_R);
    // hide a town near the seller in the fog: the map must find it
    const t = g.s.sites.find(s => s.kind === 'town' && Math.hypot(s.x - p.x, s.y - p.y) < MAP_R && Math.hypot(s.x - p.x, s.y - p.y) > 3)!;
    const fogOff = (i: number) => { g.s.fog[i >> 3]! &= ~(1 << (i & 7)); }, fogOn = (i: number) => { g.s.fog[i >> 3]! |= 1 << (i & 7); };
    fogOff(t.y * n + t.x);
    expect(mapFinds(g, p.x, p.y, MAP_R).some(f => f.x === t.x && f.y === t.y)).toBe(true);
    expect(rumours(g).length).toBe(0); // nothing shows before buying
    const c1 = mapCost(g), m0 = g.s.money, r = buyMap(g, p.x, p.y);
    if (typeof r === 'string') throw new Error(r);
    expect(r.refund).toBe(0); expect(g.s.money).toBe(m0 - c1);
    expect(rumours(g).some(f => f.x === t.x && f.y === t.y && f.what === 'town')).toBe(true);
    fogOn(t.y * n + t.x); expect(rumours(g).some(f => f.x === t.x && f.y === t.y)).toBe(false); // the ? goes when the fog lifts there
    // the second map costs half as much again; a map over land with nothing hidden pays half back
    const c2 = mapCost(g); expect(c2).toBe(Math.round(c1 * 1.5 / 100) * 100);
    g.s.fog.fill(255); const m1 = g.s.money, r2 = buyMap(g, p.x, p.y);
    if (typeof r2 === 'string') throw new Error(r2);
    expect(r2.finds.length).toBe(0); expect(g.s.money).toBe(m1 - c2 + Math.round(c2 / 2));
    // not enough money: no map
    g.s.money = 10; expect(typeof buyMap(g, p.x, p.y)).toBe('string'); expect(g.s.maps!.length).toBe(2);
  });
});
