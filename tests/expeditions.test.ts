import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { generateWorld, MAP_N, RING_W } from '../src/world/terrain.ts';
import { expeditionError, expeditionPrice, sendExpedition } from '../src/world/expedition.ts';
import { isDock, linkedDocks } from '../src/ships/docks.ts';
import { stepPoint } from '../src/trains/train.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { cardHtml } from '../src/ui/cards.ts';

describe('🗺 expeditions grow the map by a ring of new islands', () => {
  it('keeps the first map and earlier rings exactly: same squares, same island numbers and names', () => {
    const w0 = generateWorld(4242, MAP_N, 2), w1 = generateWorld(4242, MAP_N, 2, 1), w2 = generateWorld(4242, MAP_N, 2, 2);
    expect(w1.n).toBe(MAP_N + 2 * RING_W); expect(w2.n).toBe(MAP_N + 4 * RING_W);
    let diff = 0;
    for (let y = 0; y < MAP_N; y++) for (let x = 0; x < MAP_N; x++) if (w0.terr[y * MAP_N + x] !== w2.terr[(y + 2 * RING_W) * w2.n + x + 2 * RING_W]) diff++;
    expect(diff).toBe(0);
    // ring 1's land is the same in the two-ring map
    for (let y = 0; y < w1.n; y++) for (let x = 0; x < w1.n; x++) if (w1.terr[y * w1.n + x] !== w2.terr[(y + RING_W) * w2.n + x + RING_W]) diff++;
    expect(diff).toBe(0);
    const named = (w: typeof w0) => w.islands.map(i => i.name ?? '');
    expect(named(w1).slice(0, w0.islands.length)).toEqual(named(w0));
    expect(named(w2).slice(0, w1.islands.length)).toEqual(named(w1));
    expect(w1.islands.filter(i => i.name).length - w0.islands.filter(i => i.name).length).toBeGreaterThanOrEqual(4);
    expect(w2.home).toBe(w0.home); expect(w2.cx).toBe(w0.cx + 2 * RING_W);
  });

  it('on his save: a level 3 dock sends it for $60k then $120k, nothing built moves, trains run on', async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const d = linkedDocks(g)[0]!; d.lvl = 2; g.s.money = 500000;
    expect(expeditionError(g, d)).toContain('level 3 dock');
    d.lvl = 3; expect(expeditionPrice(g)).toBe(60000);
    const sites = g.s.sites.length, n0 = g.world.n, ashford = { ...g.s.sites[0]! };
    const heads = g.s.trains.map(t => stepPoint(g.net, t.trail.at(-1)!, t.headS));
    const bld = g.s.buildings!.map(b => [b.id, b.x, b.y] as const);
    const r = sendExpedition(g, d); if (typeof r === 'string') throw new Error(r);
    const g2 = r.g;
    expect(g2.s.money).toBe(440000); expect(g2.world.n).toBe(n0 + 2 * RING_W); expect(g2.s.rings).toBe(1);
    expect(r.islands.length).toBeGreaterThanOrEqual(4); expect(r.towns).toBe(r.islands.length);
    expect(g2.s.sites.length).toBeGreaterThan(sites);
    expect(g2.s.sites[0]!.x).toBe(ashford.x + RING_W);
    for (const [id, x, y] of bld) { const b = g2.s.buildings!.find(o => o.id === id)!; expect([b.x, b.y]).toEqual([x + RING_W, y + RING_W]); }
    g2.s.trains.forEach((t, k) => { const p = stepPoint(g2.net, t.trail.at(-1)!, t.headS); expect(Math.hypot(p.x - heads[k]!.x - RING_W * 32, p.y - heads[k]!.y - RING_W * 32)).toBeLessThan(8); });
    // new towns sit on the new islands, outside the first map
    for (const t of r.fresh) expect(t.x < RING_W || t.y < RING_W || t.x >= n0 + RING_W || t.y >= n0 + RING_W).toBe(true);
    for (let k = 0; k < 600; k++) { const dt = 0.05; g2.s.t += dt; g2.sys.tick(dt); tickTrains(g2, dt); }
    const d2 = g2.s.buildings!.find(b => b.id === d.id)!;
    expect(isDock(d2)).toBe(true); expect(expeditionPrice(g2)).toBe(120000);
    expect(cardHtml(g2, { kind: 'bld', id: d2.id, page: 'exp' } as never)).toContain('Send an expedition · $120,000');
  });
});
