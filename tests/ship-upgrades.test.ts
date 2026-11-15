import { describe, expect, it } from 'vitest';
import { tickTrains } from '../src/economy/dispatch.ts';
import { buyShip, buyShipUp, shipCap, shipSpeed, SHIP_SPEED } from '../src/ships/ships.ts';
import { cardHtml } from '../src/ui/cards.ts';
import { dockAndLanding } from './sea.ts';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';

describe('ship upgrades', () => {
  it('need a ship, cost the old prices, and stop at level 3', () => {
    const { g, dock } = dockAndLanding(4242);
    g.s.money = 100000;
    expect(buyShipUp(g, 'hold')).toBe('Buy a cargo ship first');
    buyShip(g, dock);
    const m = g.s.money;
    for (const p of [6000, 12000, 24000]) { const before = g.s.money; expect(buyShipUp(g, 'spd')).toBe(''); expect(before - g.s.money).toBe(p); }
    expect(buyShipUp(g, 'spd')).toBe('Already at the top level');
    expect(g.s.money).toBe(m - 42000);
    expect(shipSpeed(g)).toBeCloseTo(SHIP_SPEED * 2.05);
    g.s.money = 100;
    expect(buyShipUp(g, 'hold')).toBe('Need $5,900 more');
  });

  it('bigger holds carry more in one trip and the cards show both upgrades', () => {
    const { g, dock, landing } = dockAndLanding(4242);
    g.s.money = 100000;
    const s = buyShip(g, dock); if (typeof s === 'string') throw new Error(s);
    buyShipUp(g, 'hold'); buyShipUp(g, 'hold');
    expect(shipCap(g)).toBe(170);
    dock.outq = [{ good: 'wood', n: 150, to: landing.id }];
    for (let k = 0; k < 20 * 400 && !landing.landed?.wood; k++) tickTrains(g, 0.05);
    expect(landing.landed?.wood).toBe(150);
    const card = cardHtml(g, { kind: 'ship', id: s.id })!;
    expect(card).toContain('Faster ships');
    expect(card).toContain('Bigger holds');
    expect(card).toContain('/ 170');
    expect(cardHtml(g, { kind: 'bld', id: dock.id, page: 'sea' })).toContain('data-act="shipup"');
  });

  it('faster ships cross sooner', () => {
    const trip = (lv: number) => {
      const { g, dock, landing } = dockAndLanding(4242);
      g.s.money = 100000; buyShip(g, dock);
      for (let i = 0; i < lv; i++) buyShipUp(g, 'spd');
      dock.outq = [{ good: 'wood', n: 40, to: landing.id }];
      let k = 0; for (; k < 20 * 400 && !landing.landed?.wood; k++) tickTrains(g, 0.05);
      return k;
    };
    expect(trip(3)).toBeLessThan(trip(0) * 0.8);
  });

  it("his old save keeps its ship upgrades (faster 1, holds 2)", async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    expect(g.s.shipU).toEqual({ spd: 1, hold: 2 });
    expect(shipCap(g)).toBe(170);
  });
});
