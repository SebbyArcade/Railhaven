# Railhaven

A mobile-browser railway game: build track out from the capital, Ashford, link towns, feed their growing orders,
and explore an endless archipelago by rail and sea. Owner and designer: Sébastien (GitHub `SebbyArcade`).
He plays on a Razr fold phone (folded and unfolded) in Chrome and in the Claude app.

This repo is a clean rebuild of the old single-file prototype (kept read-only in `legacy/`). The old game's
rules are the spec; `legacy/CHANGES.md` records why each rule exists. `docs/PARITY.md` tracks which old
features are rebuilt.

## Working rules

- **No game changes without Sébastien's approval.** Propose first. Every change is a pull request with a
  short list of what changed, test results and a playable preview. His merge is the approval.
- Keep fixes narrow and list every change separately in the PR.
- Bug fixes: test on his saves (`tests/saves/`) plus a short bot run (10-20 game minutes). Long bot runs
  only for balance questions.
- Never restyle terrain or art without asking. Colourful, icon-led cards (coloured emoji, chips, bars),
  not grey text walls. Minimal scrolling: tabs and tiles with Back pages over long lists.
- Write in plain words in the UI. No jargon, no ids.

## Design rules (don't break these)

- **Track** starts from Ashford; every new square must attach to the existing network. Painted square by
  square in Build → Build rails (no auto-routing), with cost shown and a confirm. A drag paints only when it
  starts on the network or a painted square, otherwise it pans.
- **Real rails**: trains always sit on drawn rails. They never turn on the spot or slide sideways; at a dead
  end they reverse. They queue, never overlap. Turnouts are smooth and gradual like real life. Station halls
  are entered only at their ends.
- **Buildings** have yards: a 2x4 footprint with in/out loading tracks (more tracks with levels). All
  industries are player-built; only towns have preset locations. Mines (stone, coal, iron) sit in mountains.
  Placement is permissive; a refusal always shows the exact reason and what the player can do instead.
  Never silently retarget a tap.
- **Endless map**: islands to discover, more towns, growing requirements. Islands are a frontier reached by
  sea: bridges are short and expensive and can't join two islands; open sea needs docks and ships.
  Iron and oil only on outer islands.
- **No-fail**: the player can never get stuck or go broke for good. No bank loans.
- **Economy**: no passive income. Money comes only from deliveries and selling. No automatic purchases
  (the game never buys trains, ships or buildings by itself; it is not an idle game).
- **Towns** grow on a ladder of orders (Hamlet → Village → Town → City → Metropolis → Megacity → endless).
  Growth needs the player to tap upgrade. Railway level comes from orders filled and unlocks factories,
  docks and landmarks.
- **Trains run themselves**: each building ships to the nearest place that needs its goods; the player
  manages track, buildings, fleet upgrades and rushes, not per-train routes.
- **Controls**: one finger pans, two fingers pinch. Selecting a building never zooms. Tapping a toolbar
  button again closes it. Open cards and confirm bars refresh live as money and goods change.
- **Art**: a miniature model village built up slowly: small hand-made details (houses, fences, people,
  smoke, platforms, crates) drawn in code.

## Architecture

```
src/
  core/      seeded random, noise, maths, events
  world/     map generation, islands, fog, scouting       (no drawing)
  track/     painted squares -> rail pieces, routing, signals (no drawing)
  trains/    train movement along rail pieces                (no drawing)
  buildings/ towns, industries, factories, docks, yards       (no drawing)
  economy/   production, shipping plan, pay, orders, levels  (no drawing)
  ships/     docks, sea lanes, ships                         (no drawing)
  progress/  missions, story, island goals                   (no drawing)
  save/      versioned save format, legacy importer
  render/    everything that draws on the canvas
  ui/        cards, HUD, toolbar, touch input
tests/       vitest rule tests, layout scenarios, save tests
tools/       bot player, screenshot checks
legacy/      the old game, read-only reference
```

- Game rules never touch the DOM or canvas, so they run in tests and the bot without a screen.
- Rendering only reads state. Trains and track drawing both use the same rail geometry from `track/`.
- State is plain JSON-able data in one `Game` object; derived caches are rebuilt from it.
- The map is deterministic from the seed (same terrain as the old game for the same seed).

## Commands

- `npm run dev` runs the game locally (add `-- --host` to open it on a phone on the same Wi-Fi).
- `npm test` runs all tests. `npm run typecheck` checks types. `npm run build` makes `dist/index.html`,
  one self-contained file that can be published as the playable artifact.
- Playwright: use the preinstalled Chromium (`/opt/pw-browsers/chromium`) in cloud sessions.
