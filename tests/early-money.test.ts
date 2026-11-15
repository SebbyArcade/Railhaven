import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { sellTrain, tickTrains, trainRefund } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { checkGrant, moneyTip, neededStep, sampleNet } from '../src/economy/advice.ts';
import { cardHtml } from '../src/ui/cards.ts';
import type { Game } from '../src/state.ts';

const his = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-15.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };
const run = (g: Game, secs: number) => { for (let s = 0; s < secs; s++) { for (let k = 0; k < 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); } if (s % 5 === 0) checkStuck(g); } };

describe('💡 early money (his 2026-11-15 save: wheat order full, no Sawmill money)', () => {
  it('names the building the open order needs: the cheapest maker of a wanted good nobody makes', () => {
    const g = his(), s = neededStep(g)!;
    expect(['coal', 'sawmill', 'brickworks']).toContain(s.kind);
    expect(s.town.name).toBe('Ashford');
    expect(s.price).toBeGreaterThan(g.s.money);
  });

  it('a tip says why money is low and what to do, and can be switched off', () => {
    const g = his(); run(g, 240);
    const t = moneyTip(g)!;
    expect(t).not.toBeNull();
    expect(t.text).toMatch(/Ashford has all the 🌾 wheat/);
    g.s.tipsOff = true; expect(moneyTip(g)).toBeNull();
  });

  it('the board pays for the needed building when it is far out of reach, at most once every ten minutes', () => {
    const g = his(); g.s.money = 50;
    for (const b of g.s.buildings!) b.stock = 0; // nothing to sell
    for (let k = 0; k < 40; k++) { g.s.t += 5; sampleNet(g); } // three minutes of no income
    const step = neededStep(g)!, got = checkGrant(g);
    expect(got).toBeGreaterThanOrEqual(step.price - 50);
    expect(g.s.money).toBeGreaterThanOrEqual(step.price);
    expect(g.news?.at(-1)).toContain('railway board');
    g.s.money = 50; for (let k = 0; k < 40; k++) { g.s.t += 5; sampleNet(g); }
    expect(checkGrant(g)).toBe(0); // not again so soon
  });
});

describe('💰 selling a train', () => {
  it('an empty train is sold at once for half its price; a loaded one goes after its delivery', () => {
    const g = his(), n = g.s.trains.length;
    const empty = g.s.trains.find(t => !t.cargo && t.job?.phase !== 'loading');
    if (empty) {
      const m = g.s.money, v = trainRefund(g);
      expect(sellTrain(g, empty)).toBe('');
      expect(g.s.trains.length).toBe(n - 1); expect(g.s.money).toBe(m + v); expect(v).toBe(500);
    }
    const loaded = g.s.trains[0]!; loaded.cargo = { good: 'farm', n: 20, d: 8 };
    expect(sellTrain(g, loaded)).toBe('later');
    expect(cardHtml(g, { kind: 'train', id: loaded.id })).toContain('Sold: it goes as soon as');
    loaded.cargo = undefined; loaded.job = undefined;
    const before = g.s.trains.length; tickTrains(g, 0.05);
    expect(g.s.trains.length).toBe(before - 1);
    expect(g.news?.some(m => m.includes(`Train ${loaded.id} delivered its load and was sold`))).toBe(true);
  });

  it('the train card offers it', () => {
    const g = his(), t = g.s.trains[0]!;
    expect(cardHtml(g, { kind: 'train', id: t.id })).toContain('💰 Sell this train');
  });
});

describe('🚩 settlement sites', () => {
  it('the card lists the three steps and how far the money is', () => {
    const g = his(), p = g.s.sites.find(s => s.kind === 'plot')!;
    const h = cardHtml(g, { kind: 'plot', id: p.id })!;
    expect(h).toContain('Found the town'); expect(h).toContain('Lay track into its station'); expect(h).toContain('more');
  });
});
