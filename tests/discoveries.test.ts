import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { isRevealed, reveal } from '../src/world/fog.ts';
import { checkPois, frontierPois, FRONTIER, kindMul, linkEstimate, makePois, morePois, poisOf, scoutStarts, scoutStepError, sendScout, tickScouts } from '../src/world/explore.ts';
import { rumours } from '../src/world/maps.ts';
import { checkArrivals } from '../src/progress/arrivals.ts';
import { cardHtml } from '../src/ui/cards.ts';
import { sendExpedition } from '../src/world/expedition.ts';
import { dockAndLanding } from './sea.ts';

const islOf = (g: ReturnType<typeof newGame>, p: { x: number; y: number }) => g.world.islandOf[p.y * g.world.n + p.x]!;

describe('frontier landmarks on islands across the sea', () => {
  it('old mine shafts and explorer camps stand only off Ashford Isle, the same for the same seed', () => {
    const g = newGame(4242), ps = poisOf(g), f = ps.filter(p => FRONTIER.includes(p.kind));
    expect(f.some(p => p.kind === 'shaft')).toBe(true); expect(f.some(p => p.kind === 'camp')).toBe(true);
    expect(f.every(p => islOf(g, p) !== g.world.home)).toBe(true);
    expect(poisOf(newGame(4242)).map(p => [p.kind, p.x, p.y])).toEqual(ps.map(p => [p.kind, p.x, p.y]));
    expect(new Set(ps.map(p => p.id)).size).toBe(ps.length); // ids stay unique
  });

  it('an older game keeps every landmark it had and gains the frontier ones once', () => {
    const g = newGame(4242), old = makePois(g); old.push(...morePois(g, old));
    g.s.pois = old.map(p => ({ ...p })); g.s.poiV = 2;
    const before = JSON.stringify(g.s.pois), all = poisOf(g);
    expect(JSON.stringify(all.slice(0, old.length))).toBe(before);
    expect(all.length).toBeGreaterThan(old.length); expect(g.s.poiV).toBe(3);
    expect(poisOf(g).length).toBe(all.length); // only once
    expect(frontierPois(g, all)).toEqual([]); // every island already has its frontier finds
  });

  it('an old mine shaft that is yours makes mines and quarries nearby 10% faster', () => {
    const g = newGame(4242), s = poisOf(g).find(p => p.kind === 'shaft')!;
    expect(kindMul(g, 'coal', s.x + 3, s.y)).toBe(1);
    s.got = true;
    expect(kindMul(g, 'coal', s.x + 3, s.y)).toBeCloseTo(1.1); expect(kindMul(g, 'gems', s.x, s.y + 5)).toBeCloseTo(1.1);
    expect(kindMul(g, 'farm', s.x + 3, s.y)).toBe(1); expect(kindMul(g, 'coal', s.x + 20, s.y)).toBe(1);
  });

  it("an explorer's camp taken over marks everything still hidden on its island with a ?", () => {
    const g = newGame(4242), n = g.world.n;
    const c = poisOf(g).find(p => p.kind === 'camp' && g.s.sites.some(s => s.kind === 'town' && islOf(g, s) === islOf(g, p)))!;
    expect(c).toBeDefined();
    const k = islOf(g, c), town = g.s.sites.find(s => s.kind === 'town' && islOf(g, s) === k)!;
    expect(isRevealed(g, town.y * n + town.x)).toBeFalsy();
    expect(rumours(g).some(f => f.x === town.x && f.y === town.y)).toBe(false);
    reveal(g, c.x, c.y, 1); g.linked = new Set([...(g.linked ?? []), (c.y + 1) * n + c.x]); checkPois(g);
    expect(c.got).toBe(true);
    if (!isRevealed(g, town.y * n + town.x)) expect(rumours(g).some(f => f.x === town.x && f.y === town.y)).toBe(true);
    expect(isRevealed(g, (c.y + 6) * n + c.x)).toBeTruthy(); // the land round the camp is uncovered
  });
});

describe('far-sea islands', () => {
  it('islands an expedition finds get landmarks too, frontier ones included', () => {
    const { g, dock } = dockAndLanding(4242); dock.lvl = 3; g.s.money = 1e6; poisOf(g);
    const r = sendExpedition(g, dock); if (typeof r === 'string') throw new Error(r);
    const g2 = r.g, names = new Set(r.islands), ps = poisOf(g2);
    const onNew = ps.filter(p => names.has(g2.world.islands[islOf(g2, p)]?.name ?? ''));
    expect(names.size).toBeGreaterThanOrEqual(4);
    for (const nm of names) expect(onNew.some(p => g2.world.islands[islOf(g2, p)]!.name === nm)).toBe(true); // every new island has landmarks
    expect(onNew.some(p => p.kind === 'ruins')).toBe(true); expect(onNew.some(p => FRONTIER.includes(p.kind))).toBe(true);
    expect(new Set(ps.map(p => p.id)).size).toBe(ps.length);
  });
});

describe('🧭 scout reports', () => {
  it('a scout back home files a report of what it uncovered, with how far each town is from the railway', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
    const p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, a.y * n + a.x - 3); buildPlan(g, p); trackChanged(g);
    g.s.money = 1e6;
    // walk toward the nearest town still in the fog on Ashford Isle
    const t = g.s.sites.filter(s => s.kind === 'town' && s !== a && islOf(g, s) === g.world.home && !isRevealed(g, s.y * n + s.x)).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0]!;
    const st = scoutStarts(g).find(s => !s.boat)!, path = [st.sq];
    let x = a.x, y = a.y;
    while ((x !== t.x || y !== t.y) && path.length < 36) {
      const nx = x + Math.sign(t.x - x), ny = y + Math.sign(t.y - y);
      const tryX = nx !== x && !scoutStepError(g, path, y * n + nx, false), tryY = ny !== y && !scoutStepError(g, path, ny * n + x, false);
      if (tryX && (Math.abs(t.x - x) >= Math.abs(t.y - y) || !tryY)) x = nx; else if (tryY) y = ny; else break;
      path.push(y * n + x);
    }
    const s = sendScout(g, path, false); expect(typeof s).not.toBe('string');
    for (let k = 0; k < 2000 && g.s.scouts?.length; k++) tickScouts(g, 0.05);
    const r = g.s.reports?.at(-1)!;
    expect(r).toBeDefined(); expect(g.reported).toContain(r.id);
    expect(r.from).toBe('Ashford'); expect(r.steps).toBeLessThanOrEqual(path.length - 1); if (r.steps < path.length - 1) expect(r.back).toBeGreaterThan(0);
    if (isRevealed(g, t.y * n + t.x)) {
      expect(r.sites).toContain(t.id);
      const e = r.link?.[t.id]; expect(e).toBeTruthy(); expect(e!.sq).toBeGreaterThan(0); expect(e!.cost).toBeGreaterThan(0);
      expect(cardHtml(g, { kind: 'scout', id: r.id })).toContain(t.name!);
      expect(cardHtml(g, { kind: 'scout', id: r.id })).toContain('Lay track to');
    }
    expect(cardHtml(g, { kind: 'scout', id: 0 })).toContain('Read ›');
  });

  it('the track estimate is 0 on the railway, and none through the fog', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
    const p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, a.y * n + a.x + 3); buildPlan(g, p); trackChanged(g);
    expect(linkEstimate(g, a.x, a.y)).toEqual({ sq: 0, cost: 0 });
    const near = linkEstimate(g, a.x, a.y + 4)!; expect(near.sq).toBeGreaterThanOrEqual(4); expect(near.sq).toBeLessThanOrEqual(6);
    let far = -1; for (let i = 0; i < n * n && far < 0; i++) if (!isRevealed(g, i) && g.world.terr[i]) far = i;
    expect(linkEstimate(g, far % n, (far / n) | 0)).toBeNull();
  });
});

describe('🏝 island arrivals', () => {
  it('an older game notes its islands quietly; a new landing on the railway queues the arrival card', () => {
    const g = newGame(4242), n = g.world.n;
    expect(checkArrivals(g)).toEqual([]); expect(g.s.isles).toEqual([g.world.home]); // quietly
    const k = g.world.islands.findIndex((o, j) => o.name && j !== g.world.home);
    let sq = -1; for (let i = 0; i < n * n && sq < 0; i++) if (g.world.islandOf[i] === k) sq = i;
    g.linked = new Set([...(g.linked ?? []), sq]); // track carried onto it (a strait bridge)
    expect(checkArrivals(g)).toEqual([k]); expect(g.arrived).toEqual([k]); expect(checkArrivals(g)).toEqual([]);
    const h = cardHtml(g, { kind: 'isle', id: k, fresh: true })!;
    expect(h).toContain('NEW ISLAND REACHED'); expect(h).toContain(g.world.islands[k]!.name!);
  });
});

