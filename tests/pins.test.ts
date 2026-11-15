import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { destinationsOf, shipPlan } from '../src/economy/shipping.ts';
import { isFactory, isLinked } from '../src/buildings/industries.ts';
import { cardHtml } from '../src/ui/cards.ts';

describe('pins: the player chooses where a building sends its goods', () => {
  it('a pinned camp sends to the place chosen, and goes back to automatic when unpinned', async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const b = (g.s.buildings ?? []).find(x => x.kind !== 'dock' && !isFactory(x.kind) && isLinked(g, x) && destinationsOf(g, x).length >= 3)!;
    expect(b).toBeTruthy();
    const auto = shipPlan(g).get(b.id)!;
    const other = destinationsOf(g, b).find(x => x.to.kind !== auto.to.kind || x.to.id !== auto.to.id)!;
    b.pin = other.to;
    expect(shipPlan(g).get(b.id)!.to).toEqual(other.to);
    expect(cardHtml(g, { kind: 'bld', id: b.id })).toContain('you chose this');
    expect(cardHtml(g, { kind: 'bld', id: b.id, page: 'pin' })).toContain('📌 Pinned');
    // a pin to a place its trains can't reach is ignored, and the card says so
    b.pin = { kind: 'town', id: -5 };
    expect(shipPlan(g).get(b.id)!.to).toEqual(auto.to);
    delete b.pin;
    expect(shipPlan(g).get(b.id)!.to).toEqual(auto.to);
  });
});
