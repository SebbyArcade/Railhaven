import type { Game } from '../state.ts';
import { INDUSTRIES, isFactory, outputOf } from '../buildings/industries.ts';
import { shipPlan } from './shipping.ts';
import { trainPrice } from './dispatch.ts';
import { sellOffer } from './upgrades.ts';
import { checkGrant, sampleNet } from './advice.ts';

/**
 * No-fail: the player can never be stuck or broke for good. When nothing is earning (no train carrying or heading
 * for a load), there is nothing worth selling, and money is below what the next useful step costs (a train, or a
 * farm plus a train for a player with none), the railway board tops money up to that step. At most once every
 * three minutes; never a loan, never paid back.
 */
export const RESCUE_GAP = 180;

/** What the next useful step costs: a train if there are buildings to serve, else a cheap farm, track and a train. */
export function nextStepCost(g: Game): number {
  const hasBuilding = (g.s.buildings ?? []).length > 0, hasTrain = g.s.trains.length > 0;
  if (hasBuilding && hasTrain) return 600; // some track to join things up
  return (hasTrain ? 0 : trainPrice(g)) + (hasBuilding ? 0 : INDUSTRIES.farm.price) + 400;
}

/** Called every few seconds: returns the amount granted (0 if the player isn't stuck). */
export function checkStuck(g: Game): number {
  sampleNet(g);
  const grant = checkGrant(g); if (grant) return grant;
  if (g.s.t - (g.s.rescueAt ?? -1e9) < RESCUE_GAP) return 0;
  if (g.s.trains.some(t => t.job || t.cargo)) return 0; // something is earning
  if (g.s.trains.length) { // or will soon: a working camp, farm or mine with somewhere to send its goods
    const plan = shipPlan(g);
    if ((g.s.buildings ?? []).some(b => !isFactory(b.kind) && plan.has(b.id) && outputOf(g, b) > 0)) return 0;
  }
  const need = nextStepCost(g), sell = (g.s.buildings ?? []).reduce((a, b) => a + sellOffer(b).pay, 0);
  if (g.s.money + sell >= need) return 0;
  const add = Math.ceil((need - g.s.money) / 100) * 100;
  g.s.money += add; g.s.rescueAt = g.s.t;
  (g.news ??= []).push(`🆘 The railway board gives you ${'$' + add.toLocaleString('en-US')} so you can keep building. It's a gift, not a loan`);
  return add;
}
