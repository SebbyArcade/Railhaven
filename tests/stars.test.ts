import fs from 'node:fs';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { loadGame, newGame } from '../src/game.ts';
import { deserialize, serialize } from '../src/save/save.ts';
import { goalsOf, starKey, tickStars } from '../src/progress/stars.ts';
import { perks, PRIZES, prizeAt, prizesFor, starCount } from '../src/progress/prizes.ts';
import { buyProject, parkSpot, projectError } from '../src/buildings/parks.ts';
import { expressMul, trainCap } from '../src/economy/upgrades.ts';
import { cardHtml } from '../src/ui/cards.ts';
import { stepOf } from '../src/economy/towns.ts';

const SAVE = 'tests/saves/save-seb-2026-11-21-report20.txt';
const read = () => { const t = fs.readFileSync(SAVE, 'utf8').trim(); return deserialize(zlib.gunzipSync(Buffer.from(t.slice(11), 'base64')).toString('utf8')); };
const isle = (g: ReturnType<typeof loadGame>, name: string) => g.world.islands.findIndex(i => i.name === name);

describe('🌟 island stars and prizes', () => {
  it('a new game has goals on Ashford Isle and no stars yet (nothing added to the save)', () => {
    const g = newGame(7);
    const gl = goalsOf(g, g.world.home);
    expect(gl.map(o => o.title)).toEqual(['Link 3 towns to Ashford', 'Grow Ashford into a City', 'Link every town on Ashford Isle']);
    expect(tickStars(g)).toEqual([]);
    expect(g.s.stars).toBeUndefined(); expect(starCount(g)).toBe(0);
    expect(perks(g)).toEqual({ spd: 1, cap: 1, load: 1, ship: 1, run: 1 });
  });

  it('his save earns the stars it already deserves at once, on one card, with every prize up to that total', () => {
    const g = loadGame(read());
    const cards = tickStars(g);
    expect(cards).toHaveLength(1); expect(cards[0]!.isl).toBe(-1);
    const n = starCount(g);
    expect(n).toBeGreaterThanOrEqual(20); expect(cards[0]!.total).toBe(n);
    expect(g.s.prize).toBe(prizesFor(n)); expect(cards[0]!.prizes).toEqual([...Array(prizesFor(n)).keys()]);
    expect(g.s.free?.clock).toBe(1); expect(g.s.free?.fair).toBeGreaterThanOrEqual(1);
    // every home goal is done on a 4.6-hour save, and a reached island with all its towns linked has that star
    expect(g.s.stars!.home).toBe(7);
    const wst = isle(g, 'Westerly'); expect(goalsOf(g, wst).filter(o => o.earned).map(o => o.title)).toContain('Link every town on Westerly');
    expect(tickStars(g)).toEqual([]); // nothing new the next time
    // the card shows the total and the prizes
    g.starNow = cards[0]!;
    const h = cardHtml(g, { kind: 'star', id: 0 })!;
    expect(h).toContain(`earned ${n} stars`); expect(h).toContain('The Kestrel'); expect(h).toContain('Open the Atlas');
    // stars, prizes and free builds are saved
    const g2 = loadGame(deserialize(serialize(g.s)));
    expect(starCount(g2)).toBe(n); expect(g2.s.free).toEqual(g.s.free); expect(perks(g2)).toEqual(perks(g));
  });

  it('one goal reached gives one card for that island, and its prize when the total reaches one', () => {
    const g = loadGame(read()); tickStars(g); g.starQ = [];
    const k = isle(g, 'Cinder Isle'), towns = g.s.sites.filter(s => s.kind === 'town' && g.world.islandOf[s.y * g.world.n + s.x] === k);
    const before = starCount(g), next = prizeAt(g.s.prize!);
    const best = towns.sort((a, b) => stepOf(b) - stepOf(a))[0]!; best.lvl = 3;
    const cards = tickStars(g);
    expect(cards).toHaveLength(1); expect(cards[0]!.isl).toBe(k); expect(cards[0]!.title).toBe('Grow a town on Cinder Isle into a City');
    expect(starCount(g)).toBe(before + 1);
    expect(cards[0]!.prizes.length).toBe(before + 1 >= next.at ? 1 : 0);
    // a star is kept for good, even if the goal slips back
    best.lvl = 1; expect(goalsOf(g, k).find(o => o.title.startsWith('Grow'))!.earned).toBe(true);
    expect(g.s.stars![starKey(g, k)]).toBeGreaterThan(0);
  });

  it('prize engines help every train: faster, bigger loads', () => {
    const g = newGame(11), v0 = expressMul(g), c0 = trainCap(g);
    g.s.prize = PRIZES.findIndex(p => p.name === 'The Big Hauler') + 1; // The Kestrel and The Big Hauler won
    expect(expressMul(g)).toBeCloseTo(v0 * 1.05); expect(trainCap(g)).toBe(Math.round(c0 * 1.1));
    expect(perks(g).load).toBeCloseTo(0.85);
  });

  it('prize buildings are free, and the Fairground can only be won, never bought', () => {
    const g = loadGame(read()); g.s.money = 1e6;
    const t = g.s.sites.find(s => s.kind === 'town' && stepOf(s) >= 3 && s !== g.s.sites[0] && (parkSpot(g, s) ? 1 : 0) && !g.s.parks?.some(p => p.town === s.id && p.k === 'clock'))!;
    expect(projectError(g, t, 'fair')).toContain('prize');
    g.s.free = { fair: 1, clock: 1 };
    const m = g.s.money;
    expect(buyProject(g, t, 'fair')).toBe(''); expect(g.s.money).toBe(m); expect(g.s.free.fair).toBe(0);
    expect(g.s.parks!.at(-1)!.k).toBe('fair');
    expect(buyProject(g, t, 'clock')).toBe(''); expect(g.s.money).toBe(m); expect(g.s.free.clock).toBe(0);
    expect(cardHtml(g, { kind: 'town', id: t.id, page: 'projects' })).toContain('Fairground');
  });

  it('past the list a prize comes every 5 stars', () => {
    const last = PRIZES.at(-1)!.at;
    expect(prizeAt(PRIZES.length).at).toBe(last + 5); expect(prizeAt(PRIZES.length + 1).at).toBe(last + 10);
    expect(prizesFor(0)).toBe(0); expect(prizesFor(1)).toBe(1); expect(prizesFor(last + 12)).toBe(PRIZES.length + 2);
  });

  it('the Atlas and island cards list goals and stars', () => {
    const g = loadGame(read()); tickStars(g);
    const atlas = cardHtml(g, { kind: 'story', id: 0, page: 'isl' })!;
    expect(atlas).toContain('Atlas'); expect(atlas).toContain('Next prize'); expect(atlas).toContain('Westerly');
    expect(cardHtml(g, { kind: 'story', id: 0, page: 'prizes' })).toContain('engine roundhouse');
    expect(cardHtml(g, { kind: 'isle', id: isle(g, 'Mossy Key') })).toContain('Island goals');
  });
});
