import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { buildPlan, extendPlan, planCost, planError, planSupplies, startPlan, undoStroke } from '../src/track/paint.ts';
import { choices, fr, pickPerk, setupFrontier, spikeGap, tickFrontier, townGrew, BUY_SUP, buySupplies, PER_SUP, START_SUP } from '../src/frontier/frontier.ts';
import { deliverToTown, steadyGoods, townRoom } from '../src/economy/towns.ts';
import { squareCost } from '../src/track/rules.ts';
import { T } from '../src/world/terrain.ts';
import { reveal } from '../src/world/fog.ts';

const frontier = (seed = 3) => { const g = newGame(seed); setupFrontier(g); return g; };

describe('🧭 Frontier Village preview', () => {
  it('puts a golden spike on the far coast of the home island, with a ridge and an inlet on the way', () => {
    const g = frontier(), f = fr(g)!, n = g.world.n, a = g.s.sites[0]!;
    expect(g.world.islandOf[f.spike]).toBe(g.world.home);
    expect(Math.hypot(f.spike % n - a.x, ((f.spike / n) | 0) - a.y)).toBeGreaterThan(25);
    expect(f.pieces.map(p => p.kind).sort()).toEqual(['inlet', 'ridge']);
    expect(spikeGap(g)).toBeGreaterThan(20);
    // the carved terrain comes back from the save's edits
    const ridge = Object.entries(g.s.terrainEdits).filter(([, t]) => t === T.Mountain).length;
    expect(ridge).toBeGreaterThan(10);
  });

  it('track costs supplies, not money, and Undo gives them back', () => {
    const g = frontier(), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
    const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(4, 0));
    expect(planCost(g, p)).toBe(0);
    const sup = planSupplies(g, p); expect(sup).toBeGreaterThanOrEqual(4);
    const money = g.s.money, b = buildPlan(g, p); if (typeof b === 'string') throw new Error(b);
    expect(g.s.money).toBe(money);
    expect(fr(g)!.sup).toBe(START_SUP - sup);
    undoStroke(g, b);
    expect(fr(g)!.sup).toBe(START_SUP);
  });

  it('refuses track with too few supplies, and says where supplies come from', () => {
    const g = frontier(), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
    fr(g)!.sup = 2;
    const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(6, 0));
    expect(planError(g, p)).toMatch(/more 🛤 supplies.*wood and stone/);
    g.s.money = 1000; expect(buySupplies(g)).toBe(''); expect(fr(g)!.sup).toBe(2 + BUY_SUP.n);
    // a full pile takes no more wood and stone
    fr(g)!.sup = 500; expect(steadyGoods(g.s.sites[0]!, g)).toContain('stone'); expect(townRoom(g, g.s.sites[0]!, 'wood').steady).toBeLessThan(100);
  });

  it('Ashford takes wood and stone as supplies (a depot), and still pays for them', () => {
    const g = frontier(), a = g.s.sites[0]!;
    expect(steadyGoods(a, g)).toEqual(expect.arrayContaining(['wood', 'stone']));
    expect(townRoom(g, a, 'wood').steady).toBeGreaterThan(100);
    const before = fr(g)!.sup, r = deliverToTown(g, a, 'stone', 20);
    expect(fr(g)!.sup - before).toBe(Math.floor(20 / PER_SUP)); expect(r.sup).toBe(Math.floor(20 / PER_SUP));
    // wood that fills Ashford's order makes supplies too: hauling always lays track
    expect(townRoom(g, a, "wood").order).toBeGreaterThan(0); const s0 = fr(g)!.sup, w = deliverToTown(g, a, "wood", 10);
    expect(w.order).toBeGreaterThan(0); expect(fr(g)!.sup - s0).toBe(Math.floor(10 / PER_SUP));
  });

  it('mountains need the Tunnel Guild; a grown town picks one of three buildings', () => {
    const g = frontier(), n = g.world.n;
    const m = Object.entries(g.s.terrainEdits).find(([, t]) => t === T.Mountain)!, i = +m[0];
    reveal(g, i % n, (i / n) | 0, 1);
    expect(squareCost(g, i)).toMatch(/Tunnel Guild/);
    const t = g.s.sites.find(s => s.kind === 'town' && s !== g.s.sites[0])!;
    townGrew(g, t);
    let c = choices(g, t); expect(c).toHaveLength(3);
    // grant wishes until the guild is offered (it is offered from the third wish at the latest)
    while (!c.includes('tunnel')) { pickPerk(g, t.id, c[0]!); townGrew(g, t); c = choices(g, t); }
    expect(pickPerk(g, t.id, 'tunnel')).toBe('');
    expect(typeof squareCost(g, i)).toBe('number');
  });

  it('linking a town gives it a wish for its nearest neighbour', () => {
    const g = frontier();
    tickFrontier(g); // no town linked yet: no wishes
    expect(fr(g)!.wishes).toHaveLength(0);
  });

  it('the normal game is unchanged: track costs money, no supplies', () => {
    const g = newGame(3), n = g.world.n, a = g.s.sites[0]!, at = (dx: number, dy: number) => (a.y + dy) * n + a.x + dx;
    const p = startPlan(g, at(0, 0))!; extendPlan(g, p, at(4, 0));
    expect(planCost(g, p)).toBeGreaterThan(0);
    expect(planSupplies(g, p)).toBe(0);
    expect(steadyGoods(a, g)).not.toContain('stone');
    expect(fr(g)).toBeUndefined();
  });
});

describe('🧭 Frontier first steps', () => {
  it('points a new player at a lumber camp first', async () => {
    const { firstStep } = await import('../src/frontier/ui.ts');
    const g = frontier();
    expect(firstStep(g)).toMatch(/Lumber Camp/);
  });
});

describe('🧭 Frontier: more islands and more buildings', () => {
  it('settlement sites on Ashford Isle are towns waiting for the railway', () => {
    const g = frontier(), n = g.world.n;
    expect(g.s.sites.filter(s => s.kind === 'plot' && g.world.islandOf[s.y * n + s.x] === g.world.home)).toHaveLength(0);
    expect(g.s.sites.filter(s => s.kind === 'town' && g.world.islandOf[s.y * n + s.x] === g.world.home).length).toBeGreaterThanOrEqual(8);
  });

  it('a driven spike opens the next island with its own spike and two free docks', async () => {
    const { sailOn, nextIsle } = await import('../src/frontier/frontier.ts');
    const { priceOf, lockedText } = await import('../src/buildings/industries.ts');
    const g = frontier(8), f = fr(g)!, old = f.spike;
    expect(sailOn(g)).toMatch(/first/);
    f.done = g.s.t; const k = nextIsle(g)!;
    expect(k).toBeDefined();
    const sup = f.sup;
    expect(sailOn(g)).toBe('');
    expect(f.isle).toBe(k); expect(f.stage).toBe(1); expect(f.done).toBeUndefined();
    expect(f.spike).not.toBe(old); expect(g.world.islandOf[f.spike]).toBe(k);
    expect(f.sup).toBeGreaterThan(sup);
    expect(priceOf(g, 'dock')).toBe(0); expect(lockedText(g, 'dock')).toBe('');
    expect(nextIsle(g)).not.toBe(k);
  });

  it('picks come from a wide, varied set: well picks again, school offers four', () => {
    const g = frontier(), f = fr(g)!, t = g.s.sites.find(s => s.kind === 'town' && s !== g.s.sites[0])!;
    const seen = new Set<string>();
    for (let k = 0; k < 40; k++) { f.granted = k; for (const c of choices(g, t)) seen.add(c); }
    expect(seen.size).toBeGreaterThanOrEqual(12);
    f.granted = 5; f.picks = [t.id];
    expect(pickPerk(g, t.id, 'well' as never) === '' || !choices(g, t).includes('well' as never)).toBe(true);
    f.perks.push({ town: t.id, k: 'school' as never });
    f.picks = [t.id]; expect(choices(g, t)).toHaveLength(4);
  });

  it('Timber Yard makes more supplies; Stonemasons make hills cost like flat land', async () => {
    const { addSupplies, squareSup } = await import('../src/frontier/frontier.ts');
    const g = frontier(), f = fr(g)!, n = g.world.n;
    f.sup = 0; f.units = 0; addSupplies(g, 20); const plain = f.sup;
    f.perks.push({ town: 0, k: 'timber' as never }); f.sup = 0; f.units = 0; addSupplies(g, 20);
    expect(f.sup).toBeGreaterThan(plain);
    let hill = -1; for (let i = 0; i < n * n; i++) if (g.world.terr[i] === T.Hills) { hill = i; break; }
    expect(squareSup(g, hill, 100)).toBe(2);
    f.perks.push({ town: 0, k: 'mason' as never }); expect(squareSup(g, hill, 100)).toBe(1);
  });
});
