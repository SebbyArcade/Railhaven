# Rebuild parity checklist

Everything the old game (live v275b + real-rails preview v283) does, grouped by stage. Sébastien chose to rebuild
**everything** before switching the live link. Tick a line when it works in the new game and has a test where
that makes sense. Details for each line: `legacy/CHANGES.md` (search the version) and `legacy/preview/`.

## Stage 0: repo and safety net
- [x] TypeScript + Vite project, single-file build
- [x] CLAUDE.md with design rules
- [x] Old game kept in `legacy/` (live source, v283 preview source, playable v283 build, CHANGES.md)
- [ ] GitHub Actions: typecheck, tests, build on every pull request
- [ ] Sébastien's saves copied to `tests/saves/`

## Stage 1: map and camera
- [x] Same terrain as the old game for the same seed (tested bit for bit)
- [x] Islands found and named, home island = Ashford Isle, open land within 8 squares of Ashford
- [x] Seeded towns, settlement sites and deposits (iron and oil only on outer islands)
- [x] Fog, start reveal radius 9
- [x] One finger pans, two fingers pinch, wheel zoom, zoom 0.1 to 3.4, default 1.8
- [x] Terrain art from the old game (grass, shores, trees, mountains, moving water), cached in chunks
- [x] Save every 5 s and when hidden; versioned save format with migrations
- [ ] Seasons (colours per season)
- [ ] Island name pills and info when zoomed out (v211)
- [ ] Endless seas: rings of new islands when most are linked (planned, never built in the old game)

## Stage 2: real rails and trains
- [x] Track painting in Build → Build rails: square by square, attaches to network, cost + confirm, drag pans unless it starts on the network
- [ ] Track costs by terrain; mountains need tunnels; no track through fog; undo except fog-revealing strokes (done except tunnels; track uncovers 3 squares around it)
- [ ] Rail model: straights, wide smooth curves, gradual turnouts, crossings, double track, crossovers (done: straights, wide curves, double track, fans, gentle turnouts; to do: crossings, double-track turnouts)
- [x] Station halls (2 platform lanes, entered only at the ends, building per town size)
- [x] Trains on rail pieces: no spin, reverse at dead ends, queue at signals, easing (plus: parked trains move aside, trains step aside when the way is blocked)
- [ ] Bridges: trestle/stone/steel truss by depth, $500/$1,500/$3,500 per square, upkeep, never join two islands, max 3 from land / 8 long (done except upkeep, which comes with the economy)
- [ ] Remove track square, route-cut warning, broken rail events + repair handcar (done except the route-cut warning, which needs buildings)
- [x] Engine shed with stalls beside the line (spare trains parked inside come with buying trains in stage 3)

## Stage 3: core loop
- [ ] Industries: lumber camp (forest, trees deplete and regrow), wheat farm (fields), coal/stone/iron mines in mountains, oil well, fishing (docks) (done: all but fishing; to do: trees deplete and regrow)
- [ ] 2x4 yards with in/out loading tracks, more tracks by level, building art grows by level (done: yards with two loading tracks, art per kind; to do: more tracks by level)
- [ ] Factories (Sawmill, Brickworks, Gristmill, Steel Mill, Refinery, Cannery, Textile Mill...), 1 raw → 1 product, unlock by Railway level
- [ ] Towns: order ladder Hamlet → Village → Town → City → Metropolis → Megacity → endless; tap to upgrade; steady buying after orders
- [ ] Shipping plan: each building ships to the nearest place that needs it, arrows on the map, pins
- [ ] Pay per unit grows with distance (PAY .41), no passive income, train upkeep
- [ ] Railway level from orders filled (to level 10), unlocks
- [ ] Engine shed: buy trains (price curve), fleet upgrades (wagons, engines, tenders, repairs, wagon types, diesel), per island
- [ ] Rush a good (max 3, fee 30%)
- [ ] Remove building (half refund), sell stock, building prices rise per extra of a kind
- [ ] No-fail safety net

## Stage 4: islands and sea
- [ ] Scouting: drawn routes from towns/docks, pay per square, refunds, boats over sea
- [ ] Docks/landings, dock upgrades (berths, storage, cranes, warehouse), fishing boats, shellfish
- [ ] Ships: buy at docks, roaming, sea lanes only over mapped water, storms, ferrying trains
- [ ] Island specialties (+50%), resources per island, regional capitals, trade orders, long-haul imports
- [ ] Landmarks (old halt, lookout, falls, lighthouse, ranger hut, ruins) with small perks; shipwrecks; maps to buy
- [ ] Town parks/projects, town specialties
- [ ] Adaptive missions with Mira, opening story, guided lessons

## Stage 5: extras, save import, art
- [ ] Legacy save importer (localStorage `railhaven90` and RAILHAVEN2 codes/files) tested on every save in `tests/saves/`
- [ ] Move my game: export/import codes and files
- [ ] Cards: town (status + tiles), industry, factory, dock, train, ship; Orders board; Stuck list; alerts (❗)
- [ ] Map views: Problems, Demand, Resources, Fuel range, Exploration
- [ ] Hints (💡), Recommended build, discovery cards, toasts queue, game report
- [ ] Miniature art at today's level: towns (street grid, gardens, station buildings), industries, factories, docks, shed, trains (steam + cargo wagons), ships, people, smoke
- [ ] Pause when hidden / idle, full-screen button, side sheet on wide screens
