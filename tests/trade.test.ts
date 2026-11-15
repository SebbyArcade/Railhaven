import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { capitalOf, isCapital, madeOn, regions, seaNeighbours, tickTrade, tradeDelivered, tradeOf, tradeRoom, tradeWhy } from '../src/economy/trade.ts';
import { deliverToTown } from '../src/economy/towns.ts';
import { cardHtml } from '../src/ui/cards.ts';
import { ordersHtml } from '../src/ui/orders.ts';
import { newGame } from '../src/game.ts';
import type { Game } from '../src/state.ts';

const his = async () => importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8'))).g as Game;

describe('👑 regional capitals and 🤝 trade orders', () => {
  it('a new game has one region and no trade orders', () => {
    const g = newGame(4242); tickTrade(g);
    expect(g.s.trade).toBeUndefined();
  });

  it('on his save: every island with a town on the railway has a capital (Ashford at home) and a trade order for a good only another island makes', async () => {
    const g = await his(); tickTrade(g);
    const R = regions(g); expect(R.size).toBeGreaterThanOrEqual(3);
    expect(capitalOf(g, g.world.home)).toBe(g.s.sites[0]);
    let orders = 0;
    for (const [k, towns] of R) {
      const c = capitalOf(g, k)!; expect(isCapital(g, c)).toBe(true);
      if (k !== g.world.home) expect(towns).toContain(c); // the capital is one of the island's own towns
      const o = g.s.trade?.[k]; if (!o) continue;
      orders++;
      expect(o.need).toBe(40); expect(o.got).toBe(0); expect(o.n).toBe(1);
      expect(madeOn(g, k).has(o.good)).toBe(false); // never something the capital's island makes
      expect(madeOn(g, o.from).has(o.good)).toBe(true);
      expect(seaNeighbours(g, k).has(o.from)).toBe(true); // a ship route joins the two
    }
    expect(orders).toBeGreaterThanOrEqual(3);
    // the capital stays the capital
    const caps = { ...g.s.caps }; tickTrade(g); expect(g.s.caps).toEqual(caps);
  });

  it('goods unloaded at a capital fill the trade order after its own order; filling it starts a bigger round', async () => {
    const g = await his(); tickTrade(g);
    const k = Number(Object.keys(g.s.trade!)[0]), c = capitalOf(g, k)!, o = tradeOf(g, c)!;
    const room = tradeRoom(g, c, o.good); expect(room).toBe(40);
    const p = deliverToTown(g, c, o.good, 50, room);
    expect(p.order + p.trade + p.steady + p.surplus).toBe(50);
    expect(p.trade).toBe(Math.min(40, 50 - p.order));
    const reward = tradeDelivered(g, c, p.trade);
    if (p.trade === 40) {
      expect(reward).toBe(2500);
      expect(tradeOf(g, c)).toBeUndefined();
      tickTrade(g);
      const o2 = g.s.trade![k]!; expect(o2.n).toBe(2); expect(o2.need).toBe(60); expect(o2.got).toBe(0);
    }
  });

  it('the capital card and the Orders board show the trade order, with a reason when nothing can come', async () => {
    const g = await his(); tickTrade(g);
    const k = Number(Object.keys(g.s.trade!)[0]), c = capitalOf(g, k)!;
    const card = cardHtml(g, { kind: 'town', id: c.id })!;
    expect(card).toContain('👑 Capital of');
    expect(card).toContain('🤝 Trade order 1');
    expect(ordersHtml(g)).toContain('🤝 Trade between islands');
    // with no ships at all the reason says so
    g.s.ships = [];
    expect(tradeWhy(g, c, g.s.trade![k]!)).toContain('No cargo ship');
  });
});
