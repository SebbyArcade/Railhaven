# Stage 3 spec: the core loop

Numbers come from the old game as it runs (v283 preview), dumped with `tools/legacy/dump-constants.mjs`
(`legacy/constants-v283.json`) and `tools/legacy/probe.mjs`. Rules come from CLAUDE.md, `legacy/CHANGES.md` and
the old code. Where the rebuild simplifies a rule, it says so under **Rebuild note**.

## Goods

| good | icon | made by | unit value (`rate`) |
|---|---|---|---|
| wood | 🪵 | Lumber Camp (forest) | 5 |
| farm (wheat) | 🌾 | Wheat Farm (grass fields) | 7 |
| stone | 🪨 | Stone Quarry (mountain deposit) | 5 |
| coal | ⚫ | Coal Mine (mountain deposit) | 6 |
| iron | 🧲 | Iron Mine (outer islands) | 9 |
| oil | 🛢 | Oil Well (outer islands) | 12 |
| wool | 🐑 | Sheep Farm (hills) | 10 |
| planks | 🪚 | Sawmill ← wood | 14 |
| bricks | 🧱 | Brickworks ← stone | 14 |
| flour | 🍞 | Gristmill ← wheat | 18 |
| steel | ⚙️ | Steel Mill ← coal + iron | 30 |
| fuel | ⛽ | Refinery ← oil | 45 |
| cloth | 🧵 | Textile Mill ← wool | 24 |
| fish, shellfish, cans | 🐟 🦞 🥫 | docks (stage 4) | 9, 22, 26 |

## Industries

- Player-built only. Build price: camp $600, farm $800, quarry $800, coal $1,000, sheep $900, iron $1,500,
  oil $2,500; each extra of the same kind costs 25% more.
- Placement: Lumber Camp beside forest (output share = forest squares within reach / 6, trees deplete and regrow,
  3× regrowth from level 2); Wheat Farm on grass with fields (share = fields / 6); mines and quarries on a deposit at
  a mountain foot; Sheep Farm on hills with pasture. Placement is permissive; a refusal says why and what to do.
- Output: 1.1 units/s × share at level 1 (oil 0.6), +50% per level (levels 1-3; 4 and 5 unlock at Railway level 4/6).
  Stock cap 80, +40 per level. Island specialty: +50% output and storage (stage 4).
- Sell: a full building can sell 75% of its stock at 60% of value (player's choice only).
- Remove: half refund, mines revert to deposits.

## Yards

- Every industry and factory has a yard: a 2×4 footprint with an in track and an out track (more tracks with
  levels). Trains load on the out track and unload on the in track. Track joins the yard at its ends only.
- **Rebuild note:** the old game drew yards beside a siding; the rebuild makes the yard real track pieces so trains
  physically pull in (same rail model as station halls).

## Towns and orders

- Ladder (one order per step; fill it and the town may grow one size):
  0 Hamlet: wheat 30, wood 20 · reward $600
  1 Village: wheat 60, wood 40, stone 30 · $1,500
  2 Town: wheat 100, coal 50, planks 40, bricks 30 · $3,000
  3 City: wheat 150, flour 60, planks 60, bricks 60, steel 40 · $6,000
  4 Metropolis: flour 150, bricks 120, steel 100, fuel 80 · $12,500
  5+ endless: up to 3 goods the network makes, ×1.25 per step; reward +25% of $12,500 per step.
- Size caps (people): 100, 400, 1,200, 3,000, 8,000, 20,000, then ×1.35 per step.
- Growth needs the player to tap ⬆ Upgrade when the order is filled; upgrade price 250 / 800 / 2,500 / 6,000 / 15,000.
- After an order is filled the town keeps buying goods of steps it climbed: steady demand refills at
  `10 + 0.6·√pop` units per minute and pays 35%.
- Town specialties bend orders (fishing, mining, timber, farm towns: ×0.6-1.5 on some goods).

## Pay

- Delivery to a town: `value × DF(d) × PAY × (open-order units + 0.35 × steady units + 0.175 × surplus units)`.
- Delivery to a factory: `value × DF(d) × PAY × 0.5` per unit it has room for.
- `DF(d) = (max(8, d) / 8) ^ 0.85`, d = rail distance in squares. `PAY = 0.41`.
- No passive income. Money only from deliveries and selling.

## Factories

- Sawmill, Brickworks, Gristmill (Railway level 1), Steel Mill, Refinery (level 2), Textile Mill (level 3),
  Cannery (docks). First factory $2,500.
- Output `0.35 + 0.25 × level` per second while inputs last; input buffer `30 + 20 × level`; levels 1-3.
- Factories are ordinary stops: they take raw goods (paid half) and ship products like an industry.

## Trains run themselves

- Shipping plan: every building sends its good to the nearest place that still needs it (open orders and
  factories first, shared out nearest-first so ten camps don't pile into one factory), else the nearest town that
  buys it. The player can pin a destination. Arrows on the map show where goods go.
- Dispatcher: an idle train takes the best waiting load: value of the load / (distance to it + trip + 8);
  needed loads first; extras only when nothing needed waits.
- Trains: $1,000 each for the first 6, then +$250 (capped at $2,500 before Railway level 3). Load 20.
  Upkeep $0.6/s while moving, nothing while parked; +3% fleet upkeep per train beyond 6. No automatic purchases.
- Fleet upgrades in the Engine shed (per island): bigger wagons ×1.5/2.25/3.25 ($4.5k/12k/30k), stronger
  engines ×1.25/1.5/1.8 ($6k/15k/37.5k), bigger tenders range 30/45/65/100 squares ($3.8k/10.5k/22.5k), repair
  works upkeep −25/−45% ($5k/15k); wagon types: hoppers (coal, iron) $3k, tankers (oil, fuel) $6k, flats (steel) $5k.
- Rush a good: up to 3 at once, 30% fee, trains put it first.

## Railway level

- From orders filled: 2, 6, 12, 20, 30, 42, 56, 72, 90 for levels 1-9 (top level 10). Each level pays
  500 × level and reveals around Ashford. Unlocks: L1 Sawmill, Brickworks, Gristmill, docks · L2 Steel Mill,
  Refinery, bigger ports · L3 deepwater ports · L4 industries level 4 · L5 trains +15% · L6 industries level 5 ·
  L7 +20% cargo · L8 trains +15% · L9 top. Islands needed: 2 at L6, 3 at L8, 4 at L10.

## No-fail

- The player can never be stuck or broke for good: if money is below the cheapest useful step (a train or a camp)
  and nothing is earning, the game offers a free starter (exact rule to be confirmed from the old game: it
  had `S.starter = 40` units of starter goods).

## Start

- $12,000, Ashford Hamlet with pop 60, open land 8 squares round Ashford, fog revealed 9 squares.
