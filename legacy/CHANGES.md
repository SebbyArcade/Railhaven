## v146 (2026-11-02): smallest town size renamed Camp → Hamlet (clashed with Lumber Camp); each size has its own station building (stnBld): wooden halt, village station, brick town station with canopies, stone city terminus with clock tower, grand terminus with two towers and glass roof. Labels lift above bigger stations.

## v145 (2026-11-02): lesson 7 text names the town, the missing good and the building to make it (dynamic getter), so the hand on Build makes sense.

## v144 (2026-11-02): scout mode ends after sending scouts (tap 🧭 Scout again for another team), in tutorial and normal play.

## v143 (2026-11-02): scouting lesson
- Show me in the scout lesson frames Ashford and the fog spot together (zooms out); the spot gets a big 🧭 ring drawn over the fog; off-screen targets show an edge arrow 'It's this way: pinch out with 2 fingers'. Lesson 6 text explains Scout → tap the 🧭 ring in the fog → tap the town → Connect to rail. Fixed NaN camera (local H shadowed screen height).

## v142 (2026-11-02): trains put orders first
- Sébastien's single tutorial train kept hauling wood (already delivered) while Ashford still needed wheat. autoPick now always takes a load an order/factory needs before any extra goods (lower minimum load for needed goods), and if the only needed source hasn't filled yet and no other train is free, it goes there instead of hauling extras.

## v141 (2026-11-02): Tap here pointer
- Sébastien couldn't find the gold ring (it was on Scout). Now a bouncing 👇 'Tap here' pointer sits over the exact button or map square (tutPtr, 120 ms), stronger glow on the ring, toast names the thing to tap, Show me no longer leaves a stray map ring.

## v140 (2026-11-02): lessons 4 and 9 reworded
- Lesson 4: build the farm, then connect it. Lesson 9: 'Watch your Sawmill start' (it is already linked when built); rings 🚂 Trains → Buy a train if no train is free. All 9 lessons played through by following rings (5 waits for the order to fill).

## v139 (2026-11-02): trains stay visible; lesson 6 split
- Trains vanished at Ashford after delivering: auto-mode idle trains had their path reset to one square (not drawn) and the draw loop hid trains without a route. Idle trains now keep their path end; draw/shed spare logic skips the hide in auto mode.
- Lesson 6 split into 'A second town' (ring Scout → ringed fog → town → Connect to rail) and 'Railway level 2' (ring builds whatever the nearest order lacks). 9 lessons now.

## v138 (2026-11-02): guided lessons
- Show me never taps for you: it frames the area and a gold ring walks through each tap in order (🏗 Build → menu item → ringed map square → ✓ Build; 🚂 Trains → Buy a train; tap the building → Connect to rail). lesTarget/lesRing/lesSpot.
- Farm spot: most open grass (8/8 fields in test), 4-10 from Ashford, clear path. Sawmill spot: valid square nearest a Lumber Camp.

## v137 (2026-11-02): lesson rings + better first camp spot
- Every lesson rings the exact button to tap with a pulsing gold ring (LESBTN per lesson, ✓ Build on confirm bar, lesRing every 0.4 s).
- Show me for the first Lumber Camp picks a spot in thick forest 4-10 squares from Ashford, clear of the station track, with no mountain/water on the straight line home.

## v136 (2026-11-02): calmer lessons
- Sébastien found v135 overwhelming (duplicate pop-ups, couldn't minimise). Lessons no longer pop up: only the opening page does. The pinned lesson card is the one place lessons appear; tap to fold to one line (S.lesMin); it flashes green '✓ Nice! Next lesson' and unfolds when a step completes.
- During lessons, notices that repeat a lesson (on the network, first train, etc.) stay quiet. Undo track button sits above the lesson card.

## v135 (2026-11-02): Chapter 1 opening + Mira's lessons
- New game opens on a full Chapter 1 story page (tone, how Railhaven works in 4 lines, chapter goals, Begin).
- Each tutorial step opens as a centred lesson card (icon, title, Mira line, instruction, Show me › does the first tap: opens Build on a ringed spot, opens the card, etc.). Pops only when no panel/confirm/notice is open.
- The pinned tutorial strip is now a large lesson card with Show me ›.

## v134 (2026-11-02): island resources, imports, story rework
- Iron and oil exist only on outer islands (alternating by distance; 2+ deposits each). Ashford Isle: wood, wheat, stone, coal. Old saves: unbuilt home iron/oil deposits move out (resMigrate, S.ires).
- Imports: long-haul trains carry goods an island can't make straight to the town/factory that needs them (impNeeds, lh autoPick). First import of each good gets a story card. Capital card lists imports; tip to buy a long-haul train.
- Story: chapters get titles and Mira's intro/outro (The Old Line, The Iron Coast, Black Gold...). Chapter card always shows the current goal + how + Go ›; tap opens the Story page (goals with Go, reward, islands and their resources, journal). Island chapters add 'Open the Iron Mine/Oil Well'. Reach goal explains dock / range / scout / landing step.
- Bot: iron 605 / oil 189 imported in 60-min runs; seed 4 29 orders level 5.

## v133b (2026-11-02)
- Region specialty = what that island already makes most of (factory goods count double), so trade orders never ask for something nobody there makes (bot games had capitals waiting on fish no island caught). Unstarted orders switch to the new specialty.
- Bot check, 60 min: seed 4 filled 6 trade orders (44 orders total, Railway level 7 vs 29 orders / level 5 before); seed 5 one nearly filled. No errors.

## v133 (2026-11-02, Sébastien chose regional capitals + long-haul)
- Regions: each island with a linked town becomes a region with a 👑 capital (Ashford at home; elsewhere its biggest linked town) and a specialty good from its towns' trades (fish/coal/planks/flour).
- Trade orders: each capital orders another region's specialty (40, then ×1.4 per round; reward $2,500 × round; counts as a filled order). Optional: never blocks a town.
- 🚛 Long-haul trains, bought on a capital card ($3,000 ×1.25 each): 60% speed, 3× cargo, 1.5× upkeep, upgrades Longer rakes / Heavy engines (3 levels). Only they carry trade orders between islands; local trains no longer ship to another island's buyers.

## v132 (2026-11-02, Sébastien: "build all 5" + pause when away + hide ? until bought)
- Pause when away: no ticks while the page is hidden or after 5 min without a touch ('⏸ Paused while you were away' overlay, tap to carry on). Saves when hidden.
- Railway levels 6-10 (30/42/56/72/90 orders): level 4 then 5 buildings, express engines (+15% ×2), longer trains (+20%). Levels 6, 8 and 10 need 2, 3 and 4 islands reached.
- Town specialties from the land: 🎣 fishing, ⛏ mining, 🪵 timber, 🌾 farm. From the next level on, orders scale by specialty, add its signature good (coal/planks/flour) and drop one other.
- Exploration push: hint + one-time 'Time to sail' card when a level needs an island; hint to build a Dock once the home island's towns are all linked; hint to buy a map.
- Full buildings: '📦 Full: nobody needs more X' banner with 💰 Sell (75% of stock, your choice).
- Fog ? rumours hidden until you buy a 🗺 map at a linked town (45 tiles) or dock (70), $1,000 ×1.5 each.
- Order rows say '🚂 On its way' when a train is already bringing the good.

## v131 (2026-11-01)
- Bottlenecks: when 2+ towns wait on a good nobody brings them, the building making it is named on their cards, on its own card and in the 💡 hint ('5 towns wait for steel: upgrade the Steel Mill'), with a one-tap upgrade (or 'short of X' if it lacks inputs).
- Shipping priority: factories and open town orders get raw goods before towns that only keep buying past-order goods.

## v130d (2026-11-01)
- Town order icons: the ring now fills in gold as that good arrives (no more green/red rings that looked like 'done'); a small red dot means no train brings it yet.

## v130c (2026-11-01)
- Build mode: tapping a glowing square next to a building now builds there (the tap used to open any building within 1 square). Engine shed squares no longer glow. Tested every glowing square on two saves for Brickworks, camps, farms and quarries: all build.

## v130b (2026-11-01)
- Squares where a yard building is drawn (beside its siding) no longer glow as buildable: tapping one opened that building instead of building (Sébastien's Brickworks next to the Sawmill). The tap now explains why.

## v130 (2026-10-31)
- 🎣 Fishing docks: every dock can buy Fishing boats ($3k), a Bigger fleet ($6k) and Shellfish traps ($12k, then choose 🐟 or 🦞). Boats bob off the dock. Coastal towns buy fish (shellfish from level Town), and coastal towns on an island with a fishing dock add seafood to their next order.
- 📍 Find button on every town, industry, factory and dock card: centres it above the card and rings it.
- Missing goods on town/factory cards are a checklist: who makes it · track · ⛽ fuel range (with how far and the fix) · where it goes now.
- Junctions stay double when two or more arms are double (Lastlight Docks junction no longer narrows to single and fans back out).
- Double track is clearly optional: in Double track mode single squares show ✚ (can be doubled) and orange where trains queue; tapping a ⏳ mark explains it and offers to double that stretch.

## v129 (2026-10-31)
- Calmer cards: each town/industry/factory card opens with one status banner; extra detail folds under More. Town orders say where each good comes from or why nothing comes (📌 Send here).
- Engine shed split into tabs: Fleet / Upgrades / Goods, per island.
- 👁 Map gets a ⛽ Fuel range view: green = this island's trains reach it, yellow = edge, red = out of range.
- Stuck "nothing brings wood" fixed (in-transit loads counted live).
- Rails: wide corner arcs no longer used next to a town (Marrow Cove station tip), and a lumber camp joined from the side now curves toward the line it continues on (was curving into the dead end).

## v128d · Clear old side-entry track (2026-10-31)
- That square couldn't be tapped (it opened the town card). On load, the game now removes any dead-end track square that touches a station from the side, and shows a toast asking you to redraw it into the station's end.

## v128c · Station side-entry fix (2026-10-31)
- Marrow Cove: Sébastien's track from the south ended on the side of the station hall, right under the town square. The station had shifted one tile east, so that square wasn't covered by the side-entry ban. Trains could still pass through the town square, but no rail was drawn into the hall. The ban now also covers the squares beside the town's own tile, so track has to come in at an end. In his save, removing that square and going around to the west end (2 squares further) draws correctly.
- Removed the stale load toast "Trains now run routes you choose" (left over from before trains ran themselves).

## v128b · Export save (2026-10-31)
- Pasting the save code in chat failed because it was too long. Tech → 💾 Move my game now has 📤 Export as a file (uses the phone's share sheet, otherwise a download), and you can load from a file. Save codes are gzip-compressed (RAILHAVEN2:, about 4× shorter). Old RAILHAVEN1 codes still load.

## v128 · Upgrades per island, slower money, rising building prices (2026-10-31)
- Sébastien: each territory should need its own train upgrades, and money grows too fast ($20k at 11 min: orders $24.6k, levels/gifts $12.6k, deliveries $16.8k).
- Fleet upgrades and wagon types now belong to an island. A train uses the levels of the island its load comes from. The Engine shed has a Territory picker. Hoppers are free on Ashford Isle, because coal orders come early (the bot got stuck without them). Old saves keep their upgrades on Ashford Isle, and wagon types already in use on other islands are free.
- Money: town order rewards halved (600/1.5k/3k/6k/12.5k), Railway level bonus $500×level, chapter reward $2k×n, welcome gifts halved, delivery pay .65 → .55.
- He asked whether buildings should cost more the more you build. Now each extra Lumber Camp/Farm/Quarry/Mine/Well of a kind costs 25% more than the last one. Removing one refunds half of what it cost.
- Bot at 30 min: orders 12/14/12, money $5-10k (v127: 10/11/11 with $7-14k).

## v127b · Remove buildings (2026-10-31)
- Every industry and factory card has a "🗑 Remove building" button (tap twice to confirm). You get half its price back. A mine or well goes back to being a deposit; anything else is removed. Trains working there go back to being free.

## v127 · Open land around Ashford (2026-10-31)
- Sébastien: "A game should never start this way"; the problem was Ashford starting too close to water. He also wants players to still build the first Lumber Camp and Farm themselves.
- Map generation now keeps water and mountains at least 8 tiles from Ashford (they become grass or forest). On 8 test maps, water within 9 tiles was 0-8%, and every map had camp and farm spots in view.
- A new map reveals radius 9 instead of 6, with no "Found Ashford" toast. The original tutorial is unchanged.
- A first try that pre-built a camp and gave a free train was removed at his request. The build now lives in /home/user/rh, and src/build90.sh rebuilds it.

## v126 · Trains run themselves (2026-10-30)
- No more routes or lines. Every building sends its goods to the nearest place that still needs them (an open town order, or a factory with room), shared out nearest-first; otherwise to the nearest town that buys them. A free train takes the best waiting load.
- Dashed arrows on the map show where every building's goods go (toggle in the Engine shed). Tap a building to see "Ships X → Y (why)", pin it somewhere else, or go back to automatic.
- Engine shed: buy/sell trains (with "a load is waiting" / "trains have nothing to do" advice) and fleet upgrades for every train: bigger wagons (20→30→45→65), stronger engines (×1.25/1.5/1.8), bigger tenders (fuel range 30/45/65/100 tiles), repair works (upkeep −25/−45%), and wagon types (hoppers for coal/iron, tankers for oil/fuel, flat wagons for steel).
- Fuel: trains refuel at Ashford, linked towns and ⛽ water towers ($1.2k on any industry or factory).
- A train that reaches a full factory carries on to the nearest town that buys the load.
- Old games convert automatically: lines removed, trains kept, wagon types already in use are free, out-of-range buildings get a free water tower.
- Bot (30 min, orders): 10/11/4/11 vs v124's 6/6/3/8, with fewer trains and lower upkeep.

## v125 (2026-10-30, Sébastien chose "Colored lines (Mini Metro style)" after struggling to organise 44 trains; he enjoys growing the map more than managing trains)
- LINES replace per-train jobs. A line is a coloured run of up to 6 stops (towns, industries, factories). Its trains shuttle end to end; at each stop they drop what that stop wants and pick up what another stop on the line wants. A train can carry several goods at once.
- Fair unloading: a stop with an open order (or a factory with room) gets first claim; a stop that only buys takes what no other stop on the line is waiting for.
- Auto trains (default on, per line): each line estimates how many trains its work needs and takes spares or buys one (only with $2,500 to spare), and parks extras.
- Older games are re-planned on first load: every industry is grouped into a few lines (raw → factory → buyer chains, lines sharing an end town are joined), and the existing trains are shared out. Spare trains can be sold in one tap.
- When a new building joins the network, a card offers "Add to the X line" or "New line to <best buyer>".
- 🚂 Trains opens the Lines board: ＋ New line (tap stops on the map in order), ✨ Re-plan all lines, each line's stops, what it carries, profit and warnings. A line's card: − / ＋ trains, auto on/off, 📍 Show, ✏ Change stops, double its track, delete.
- Every place's card shows "🚆 Lines here" with ＋ Add to a line (ranked by what it would trade) and ＋ New line from here. Old "Send / Bring / Start this line" buttons now put both places on one line.
- Lines are drawn on the map in their colour; trains take their line's colour. Tutorial rewritten for lines (8 steps). Report lists LINES.
- Bot (30 min): seed 1 9 orders vs 6 on v124, seed 2 11 vs 6, seed 3 3 vs 3.

## v124 (2026-10-30, Sébastien: "Uncertain how to build a port")
- ⚓ Port is now in the 🏗 Build menu: "Dock" until you own a linked port, then "Landing". Picking it glows every square where one can go (memoised, since a landing check searches the sea), and a tap opens that square's card with the build button.
- If no track touches the sea yet, the coast is outlined with dashed squares and a toast says to lay track to a coast first. Tapping a dashed square says the same.
- The chapter tip's Go › opens Build → Port and moves the camera to the coast nearest your track (or to the island once you have a dock). The tip text now says "🏗 Build → ⚓ Dock".

## v123 (2026-10-30, Sébastien: a Wheat Farm train to Brinemoor went the long way round)
- Trains always plan the shortest track, but only when a trip starts. A train already on its way kept its old, longer path after new track opened a shortcut. Now, whenever track is built or doubled, each moving train checks for a shorter way from its next square and switches to it (reroute). It never turns back on the line to do so.

## v122 (2026-10-30, Sébastien: tapping the Stone Quarry offered to build another Stone Quarry)
- Buildings are drawn beside their siding, on the next square. A tap on that empty square now opens the building's card (bldAt) in normal, Trains, Tech and Build modes, instead of the empty-ground "build here" card.

## v121 (2026-10-30, Sébastien: "I can't update those single rails into doubles")
- Junctions stay double: a square where a branch joins is drawn and driven as double track when the straight line through it is double on both sides (isDblD, dRaw). Before, every junction square was forced to single, so a doubled line pinched at each branch and doubling it did nothing visible.
- A single branch joins both lanes like a real turnout (two curves into the branch), and trains ease from their lane onto the branch along the curve (laneAt).

## v120 (2026-10-30, Sébastien: double track not connecting to the Lumber Camp, doubled rails around it still drawn single)
- A building's siding counts as double track when it has two rails: level 2+, or any double track running up to it (yardTwo, ydbl). Double lines now run straight through the building on both lanes instead of pinching to one rail at its edges, and trains stay on their lane through it.
- A level-1 building with double track beside it gets the two-rail siding (and room for two trains loading side by side).

## v119 (2026-10-29, Sébastien: "Rail sizes don't work"; a building on a corner left one rail disconnected)
- One rail gauge everywhere: industry and factory sidings now use the main line's gauge, sleepers and rail colour (they were narrower). Two-rail sidings sit 8 px either side like double track, and the building moves out to make room. Trains in a siding use the same ±8 lanes.
- Station entry fans end on the double track's two lanes when the line beyond is double (they pinched to one point, then fanned out again, an hourglass). Trains blend from their line lane to the platform lane along the fan.
- A building on a corner (track joining from the long side of its siding) now draws a curve from that side into the siding, so it no longer looks disconnected.

## v118 (2026-10-29)
- Junction squares always draw a branch that has no train-used turn yet (all its turns show), so a new spur, e.g. to a Lumber Camp, no longer looks disconnected before the first train runs.

## v117 (2026-10-29, Sébastien chose "Rebuild with wide smooth curves")
- Wide curves: a corner square whose track enters and leaves on plain straight squares (same single/double) is drawn as a quarter circle with a radius of a whole square, from the middle of the square before to the middle of the square after. That is twice as wide as before. Double track gets two concentric curves (radius ± 8 px). The straight neighbours stop at their middle (wideAt, wideXY).
- Trains drive the same curve: ptAt maps the 2 path units around the corner onto the wide arc, so bogies, lanes and line-colour stripes all follow it. Line stripes are now sampled along ptAt instead of tile centres.
- Corners next to junctions, stations, industries, other corners (zig-zags) or single/double changes keep the tight one-square curve.

## v116 (2026-10-29, Sébastien: "Still very wrong", zoomed in on the v115 junction)
- Junction squares draw only the turns trains actually take (TURNS, noted from the trains' paths and reset when track changes). Straight-through track is always drawn, so a 4-way square is no longer a star of unused curves.
- Trains in and around a station run exactly on their platform lane, and on the entry fans they follow the drawn curve to the centre line (stOff, stF). Before, they glided sideways after leaving the hall and crossed the next junction off the rails. The offset is per bogie, so cars tilt along the fan.

## v115 (2026-10-29, Sébastien: tracks don't always align; trains struggle on turns and lane changes)
- Junction squares (3+ ways) are drawn and driven as single track; double track fans out in the next square instead (isDblD, railDeg). This removes the tangle of fans and arcs where double track met a junction, and laneAt follows the same rule, so trains match the drawing.
- Trains and wagons are drawn 18% smaller with closer couplings and shorter bogie spacing, so they fit the tight one-square curves instead of cutting across them.

## v114 (2026-10-29, Sébastien: the train passes over the Trains building; should it be a large train shed?)
- The engine house is now an Engine shed beside the line: brick walls, one gabled roof with smoke vents per stall, arched doors, and stall tracks fanning out to the nearest track. Spare trains park inside with their noses showing (3-5 stalls; +n when there are more) and are no longer drawn sitting on the line.
- Track can't be built on the shed's square any more. A shed that already has track over it moves to the nearest free square beside the line near Ashford (shedFix). Town houses keep clear of it.

## v113 (2026-10-29, Sébastien: "a little miniature village/world we are slowly building")
- Towns grow as a little street grid: rows of houses fill outward lot by lot (townLots), each row has its own street (broken where something is in the way), and there are gardens with fences, round trees, lit windows that flicker, chimney smoke, and bigger houses in big towns.
- Tiny people walk up and down station platforms (more in bigger towns) and on industry platforms (folk).
- Model-railway depth of field: the top and bottom of the screen blur softly when zoomed in (tiltShift; a quarter-size blurred copy masked by a gradient; S.tilt=false turns it off).
- The camera starts closer (zoom 1.8) and can zoom in further (max 3.4).

## v112 (2026-10-29, Sébastien: trains float on curves and single/double changes; buildings shouldn't sit on the track; buildings should look upgraded)
- Each car rests on two bogies placed on the rails (bogie, railPt), so long engines and wagons cut across curves and turnouts like real rolling stock. laneAt() gives the exact lane the drawn track uses: 8 px on double, 0 on single, a smooth S across the turnout tile, and the centre arc on curves unless both sides are double.
- Industries and factories now stand beside their track. The site square gets a loading siding with gravel, sleepers, a platform and buffer stops at dead ends, plus crates on the platform for stock (1 per 15). Level 2+ has 2 siding rails with turnouts, and waiting trains park on both. The building is drawn at 80% scale, offset to the side with no track (yardOf, drawYard).
- Buildings grow with level (drawGrowth): an annex at level 2; at level 3 a chimney (factories), silo (farms), log stacks (camps) or headframe (mines and quarries), plus a flag.

## v111 (2026-10-29, Sébastien: trains pile up, don't feel like they load or unload, and trains and wagons need a visual upgrade)
- New train art: a steam locomotive (cab with line-colour trim, round boiler with brass bands, dome, chimney, red buffer beam, headlamp). Wagons show their cargo: hoppers with coal/stone/iron/wheat heaps, a flat with logs, stacked planks or steel beams, an open wagon of bricks, a box van for flour, a tank for oil and fuel. Wagons are lighter brown or grey so empty ones still read as wagons.
- Trains waiting at the same industry queue back along the track (1.45 tiles apart) instead of stacking on one spot (t.qo, eased).
- The lane shift onto double track eases in (t.lo) instead of jumping 8 px, so trains stay on the drawn rails.
- Crates hop from the building into the wagons when loading and from the wagons into the building when unloading (fxCrates). A loading train shows a small fill bar.
- Line colour stripes are thinner and fainter when zoomed in.

## v110 (2026-10-29)
- Every line row (industry Send rows, factory Bring in rows, Lines board) has "⇄ Move a train here", which opens the train chooser. Trains from the same source are listed first, so the stone train to Ashford can switch to the Brickworks in two taps. Sébastien couldn't move his existing stone/coal trains.
- A ⛶ full-screen button under Map, shown only where the browser allows full screen (Chrome yes; the Claude app likely not). The game resizes on enter and exit.
- Wide-screen side sheet now sits lower (max-height 100% - 230 px) to clear the new button.

## v109 (2026-10-29)
- 🔧 Tech → 💾 Move my game: copy a save code (RAILHAVEN1: + base64 of the save) and paste it in another app or browser to continue there; loading takes two taps and replaces the game on that screen (showMove, copyMove, loadMove). The Claude app and Chrome keep separate saves.

## v108 (2026-10-29, Sébastien plays on a Razr fold)
- Wide screens (700 px or more, e.g. an unfolded phone): cards open as a side sheet on the right (max 430 px), the toolbar is centred, and the goal box is narrower. viewBox() gives the map's free area, so fitView, fitSite and 📍 Show centre on the part left of the sheet; focusTile skips its upward nudge on wide screens. Folding and unfolding resize live (tested 412↔860 px).

## v107 (2026-10-29, Sébastien asked for all 5 recommendations)
- Fair sharing: a camp that feeds several lines splits its goods evenly. A line a full load ahead waits up to 25 s, but only while a train from a lagging line is on its way (A.tk counters in arrived).
- Factories: 1 raw good makes 1 product (Sawmill, Brickworks, Flour Mill, Refinery; the Steel Mill stays coal+iron). A single camp can keep a level 1 factory busy.
- Train price: trains 1-6 cost $1,000, then +$250 each, capped at $2,500 before Railway level 3.
- Line colours on the map are now on by default: one coloured stripe per line along its track, offset so shared track shows them side by side. There's a toggle on the Lines board.
- The tutorial continues past the first order: reach Railway level 2, build a Sawmill, bring it wood, send planks out (9 steps). Step 3 text now says ＋ Start this line.
- Bot (60 min): seed 7 reached Railway level 4, 19 orders, 3 islands, $289k deliveries. Seed 3 reached level 3 with 8 orders, a slow map; v106 was slower on the same seed.

## v106 (2026-10-29)
- Factory card rebuilt as plain steps (Sébastien couldn't get wood to his Sawmill and found the card confusing): a status banner (Nothing brings X / Short of X, runs part-time / goods piling up / Running well), ① Bring in with needs ≈N/min vs arriving ≈M/min per input, and for each source camp what it makes, which other lines it also feeds, and "fully used: expand it or build another"; ② Send out with the waiting stock and destination lines.
- When ＋ is greyed out (no spare train and not enough money), the factory card and Lines board say why once, with the next train's price.

## v105 (2026-10-29)
- Every line row has a 📍 Show button: the map frames both ends, pulses them and draws the flow arrow for 6 s (lineShow, lineHi).
- Buildings may now sit right next to each other (e.g. Brickworks beside the Sawmill). Only towns and settlement sites keep a 1-square gap (siteSpot).

## v104 (2026-10-29)
- Train price rises (Sébastien chose the gentle option): trains 1-3 cost $1,000, then +$250 each ($1,250, $1,500 … train 10 = $2,750). COST.train is a getter on the fleet size, so scrapping lowers it. Bot seed 3 at 40 min: Railway level 3, 15 trains, still growing.
- Industries of the same kind get a place label in every card and line: "Lumber Camp · west of Ashford", "· by Brinemoor" (nearest town + compass; #n if still tied). Only shown when you own 2+ of that kind (placeTag in nm).

## v103 (2026-10-29)
- Tapping anywhere on a station hall (its track and platforms, not just the town square) opens that town's card, in normal and Build mode (stnAt).

## v102 (2026-10-29)
- Double track: dragging now follows the track itself round curves and corners (trackBridge), so short curved spurs like a quarry branch can be doubled; tapping a track square in double mode adds it.
- Lines with 2+ trains get "🛤🛤 Double its track · n squares · $" that doubles every single square on that line's route in one tap (lineDbl).

## v101 (2026-10-29)
- Tapping the 🚂 Trains engine house works in Build and Tech mode too (it showed "Pick open, revealed land" in Build mode). In Build mode, tapping any existing town, industry or factory opens its card instead of a placement error.

## v100 — Lines and island chapters (2026-10-29, Sébastien chose "Both")
**Lines instead of hunting single trains**
- A line is one job (load at A, deliver to B). Every place shows its lines with − 🚂 n ＋ and the line's profit. ＋ uses a 💤 spare train first, otherwise buys one; − takes a train off (after its load) and keeps it as a spare.
- 🚂 Trains button opens the Lines board: spare count, "Lines worth starting" (factory inputs and open orders with no train), every line grouped by where it delivers, and a folded "Every train" list for details/upgrades.
- Town cards show the lines under each order good (or "＋ Start this line" from the nearest source); industry and factory cards show the control on each destination / input. The v99 chooser and "Your trains here" list are gone.
- Trains on the same line share one colour on the map (lineCol keyed by route).
**Island chapters**
- Goal bar on top of the hint: "🏁 Ch.1 Ashford Isle 1/3 · next goal". Chapter 1: find and link 4 towns on Ashford Isle, fill 8 orders, Ashford grows into a City. Later chapters: reach the next island (⚓ dock + landing), find and link up to 3 of its towns, fill 2 orders per town there.
- Finishing pays $4,000 × chapter, 1-3 ⭐ by time (25/40 min for chapter 1, 15/30 after), then moves to the nearest unfinished named island. The 💡 hint points at the next island when that is the goal. Game report lists chapter progress.
**Fix**
- The v96 side-entry rule blocked the track planners (bot and "Start track from here") from leaving Ashford sideways; planners now route around station sides, and the rule only applies once a station has track along its line. stnSide is memoised.
- Bot (60 min, 3 seeds): Railway level 5, 8-11 towns linked, islands on 2 of 3.

## v99 (2026-10-29)
- One train chooser for every "send" button (town Get it from / Add a train, industry Send a train, factory Bring it from, factory fix buttons): it shows the job (distance, pay, order), trains already on it, 💤 free trains (Use this train), 🆕 Buy a new train, and ↪ Move a busy train (money-losers first). After choosing it goes back to the card you came from (chooseTrain / pickTrain / chooseBack).
- Train actions look different from building actions: teal filled buttons (tbtn) for anything that sends or moves a train; train rows are cards with the train's line colour down the side (tcard). Gold outline buttons stay for building, track and upgrades.

## v98 (2026-10-29)
- Reassigning trains from where you are (Sébastien kept hunting for trains): every town, industry and factory card now opens with "🚂 Your trains here (n)", each train with its route, profit and ⚠ problem plus 🗺 Change job and Open buttons (folded when more than 4).
- Industry "Send … to" rows get "↪ Move Train N here" when one of this place's trains goes elsewhere; it reassigns and keeps you on the same card (moveTrain).

## v97 (2026-10-29)
- Station no longer jumps sideways when a second line joins a town from the other side (stnTile: track on both opposite sides keeps the hall centred on the town tile). Sébastien saw it at Brinemoor after linking an oil deposit.

## v96 (2026-10-29)
- Station halls can only be entered at their two ends: new track on a tile beside a hall's long side is refused with "Track can only enter <town> station at its two ends, not from the side" (stnSide, checked in railErr and lay). Existing track is left alone.

## v95 (2026-10-29)
- Fixed: "Pick a job" flipped back to the train card after ~3 s. An old 3-second panel refresh in the main loop re-opened the train card (and ignored taps). Removed; livePanel already refreshes every panel.
- Track that uncovers fog, or reaches a landmark (Lookout Hill, Old Halt, Falls), can no longer be undone (it was a free-scouting / free-$2,000 exploit).
- Lookout Hill card now says how many new tiles and places it mapped.
- Idle train card: status says "Parked with no job", lists its best 3 jobs with Take it buttons, and shows its parked cost instead of "Losing money".
- Changing a train's job resets its profit history, so the old route's losses don't show on the new one.
- 💡 hint line has a Go › button that opens the right town/train/factory or moves the map to the rumour; idle trains are the first hint.
- Removed old "1 tie back" wording when removing a track tile.
- Sweep: every panel opened on fresh / early / late saves with no errors; 3 bot runs (60 min) reach Railway level 4-5, no errors.

## v94 (2026-10-26)
- One-finger panning hardened: the map canvas now swallows touch scrolling (touch-action none, non-passive touchstart/touchmove preventDefault, no overscroll), so the app around the game can't take a one-finger swipe. Input code itself was unchanged since the start; two-finger pinch still zooms.

## v93 — Acting on ChatGPT's v92 review (2026-10-26)
**What to do next, said louder**
- Industry and factory panels lead with one ⭐ Best move: the destination whose order still needs the goods and has no train yet, in a green box. Other buyers are listed under it.
- A town growing is now an event: a card reading "🎉 ASHFORD GREW! Camp → Village", the reward, the Railway level progress, the next order and the next useful step. The first three times, then a short message after that.
- The first town linked on a new island sends a request card: "Welcome to Kelpmoor! We need 30 wheat, 20 wood." Every other town sends a short message with its first order.
- When every town on an island is linked you get a stamp: "✓ Kelpmoor connected · 2 towns · 3 deposits · 4 orders filled".
- The 💡 hint line now points at the nearest rumour with its direction when there is nothing closer to do.

**The stuck-factory trap (found in bot testing)**
A train sent from a factory nobody supplies waits forever and still costs money. Now its card offers "🚃 Bring wood from Lumber Camp" straight away, the factory panel warns "⚠ No train brings wood: it cannot make anything", and the hint line leads with it. A 60-minute bot run that had been frozen for 45 minutes at $800 now reaches Railway level 4 with 8 towns.

**Train profit, plainly**
- The train card says "🟢 Profitable: +$84/min" or "🟠 Losing money: −$12/min · Change its job or sell it". The trains list shows the same figure per train.

**Old systems out of sight**
- Removed rail ties everywhere (track costs money only, Undo refunds money, Tech research is $2,500), the passenger and festival wording, the Engine house hints, and the "survey rusty rock" lines. Deposits are visible, so hints say where each building goes.
- The Old Halt landmark now pays $2,000 instead of ties, and Silver Falls gives 30% bigger town order rewards within 12 tiles instead of passenger fares.
- The Game report (Tech → Game report) was rewritten for the new core: orders filled, islands, per-train net income, each town's order progress.

**Balance** (ChatGPT's numbers, tested)
- Trains $1,000 (was $800): buying train number two is now a decision.
- PAY .65 (was .7). .60 made the early game too tight on one seed.
- Bot on 4 seeds, 60 min: Railway level 4–5, 8–13 towns, islands reached on 2 of 4.

## v92 — Calmer map, Stop after this load (2026-10-26)
- The icons under a town show only its open order goods. Bright means a train brings that good; faded with a red dot means no train does yet. Before, every good the town ever bought was shown.
- Deliveries show only the money floater (the goods floater doubled the clutter at busy towns).
- Train card: "⏸ Stop after this load" works while the train is loaded (the old Stop button was disabled then). A stopped train parks where it is.
- ChatGPT review brief rewritten for the new core (chatgpt-review-brief.md).
- Bot check, seed 31, 45 min: 4 islands, 12 towns linked, Railway level 4.

## v91 — Islands within reach, clearer orders (2026-10-26)
- Ports reach farther: Dock 40 tiles (was 24), Harbor 60, Port 90, Deepwater 130. In v90 the nearest island towns were 43+ tiles from any dock, so no bot ever reached another island. Port costs are money only: $4k / $8k / $15k / $30k, landings $2.5k.
- Fix: a town or industry right next to a ferry landing now counts as linked. Before, it stayed unlinked and there was no Connect button, so the player was stuck.
- When an order is filled, a message names the town's new size and its next order.
- 📋 Orders board has a short "❔ How it works" section.
- Port panel: dropped the old train range wording.
- Performance: the hint line and Orders board refresh once a second instead of every frame (they search the rail network).
- Bot, 60–75 min: islands reached on 3 of 4 seeds (up to 6 islands and 13 towns by minute 75), Railway level 5 by 40–50 min.

## v90 — Simple core: one delivery rule, town orders everywhere (2026-10-26)
A rebuild of the core loop after Sébastien said deliveries and routes felt broken and all over the place. New save slot, so old saves are not loaded.
- One rule for every train: load at A what B wants, take it to B, get paid, come back, repeat. No depot, supply lines, 2nd pickups, smart back-hauls, auto-dispatch or coaches.
- Every town has one order, Ashford included: Camp → Village → Town → City → Metropolis → Megacity. A filled order grows the town and pays its reward. Towns keep buying the goods from their earlier orders.
- Factories are normal stops. Bring them raw goods (paid at half price), then send their products to towns. A train waits at a full factory and says why.
- Industry and factory panels have a "Send … to" list: every linked town or factory that wants the goods, with the open order amount, distance and pay per trip. "Send a train" uses an idle train or buys one. A warning shows when the trains already take everything the place makes.
- Town panels list each order good with "Get it from…" (the nearest linked maker), or say what to build.
- 📋 Orders board (top button, or tap the Railway level line): every linked town's order and progress.
- Railway level replaces Ashford level. It rises with orders filled (2 / 6 / 12 / 20) and unlocks factories, ports and landmarks. No upgrade button and no town growth caps.
- Simple train card: job, status, earnings over the last 3 minutes compared with running cost (⚠ when a train earns less than it costs), job list sorted by pay, two upgrades (faster engine, bigger wagons) plus diesel once the Locomotive Works exist.
- Money is the only cost: no rail ties, building materials or depot stock. No train range or tenders. No engine house slots.
- Off for now: passengers, roles, festivals, random events and broken rails, story chapters, geologist survey (all deposits are visible).
- Kept: fog, scouts, rumours, islands and charter grants, landmarks on the map (lookouts, falls…), ports, bridges, double track, map views, Ashford landmarks (Foundry tunnels, Bridge Works…).
- Balance: PAY .7 (hub fees are gone), fleet upkeep grows 3% per train past 6 (was 8% past 4), factories make 36/min at level 1 (was 27).
- New 5-step tutorial: lumber camp, track, Send a train, farm, fill Ashford's first order. After it, a 💡 hint line always names the next useful step.
- Bot (sim-dump.js rewritten for the new rules), 4 seeds × 60 min: Railway level 4 by 30–50 min, level 5 by 40–50 min on 3 of 4 seeds, 6–8 towns linked. No bot reached another island yet.
- Also ships the unpublished v82 work: map landmarks (lookouts, falls…) and the station layout fixes.

## v81 — Exploration stage 2, from ChatGPT's v80 review (2026-10-26)
- Crossing preview: the track confirm bar shows how many water tiles the bridge crosses and their cost. If the track lands on a new island, it names the island, lists its places and deposits, and estimates the charter grant.
- Ferry landings name the island and show its grant estimate. They also say the sea tiles count toward each train's range from Ashford (ChatGPT's "looks reached, then out of range" trap).
- Directional rumours: each "?" now reads like "11 tiles S of Ashford". When the nearest rumours are off-screen, up to 3 compass arrows at the screen edge point to them and show their distance.
- Next frontier card, shown once after the first town joins: find another island by scouting or by building toward a "?". Skipped on saves past story 3. The open objective panel now shows islands reached and the number of rumours.
- The island milestone card has 📍 Show the island and 🧭 Scout it buttons.
- Calmer towns: the population number and need icons show only when zoomed in (zoom 1.15 or more) or when the town is selected.
- Explored-vs-connected wash: the connected band is 5 tiles (was 3), so the start area isn't faded.
- Fixes: the track cost preview now matches what is charged with Bridge Works and Foundry tunnels. Removed dead code in showTrains().
- Balance: PAY .45 → .55 (ChatGPT: deliveries felt thin next to town orders). Sims on seeds 12, 31 and 7, 60 min: level 4 by 30–45 min, $5.1k–6.4k at 60 min.

## v80 — Island journey, stage 1 of the exploration revamp (2026-10-26)
- Every land mass of 40+ tiles has a name (Ashford Isle, Kelpmoor, …). Names show over revealed islands when zoomed out: gold once connected, pale blue while only explored.
- The first time your network reaches a new island you get a milestone card: a charter grant ($1.2k + 25/tile from the centre + $400 per island already reached, capped at 8), 30 ties, a 7-tile reveal around the arrival point, and a hint of how many towns and deposits the island holds. Islands already reached in old saves are recorded silently.
- Rumours: unseen towns, ruins and settlement sites within about 10 tiles of known land show a glowing "?" over the fog. Living towns also show smoke. The labels read "smoke rising…", "old rooftops?" and "open land?".
- New track reveals 3 tiles around it instead of 1, so building the railway is now a way to explore.
- Explored land more than 3 tiles from your network gets a cool, faded wash, so connected land stands out.
- Unchanged: the contract/offer clearing (on purpose since v69).
- Tests: live66, ui61 and ui76 pass; the island milestone was forced on save71 (Kelpmoor +$4,100); rumours checked on a fresh map; bot sims on seeds 31 and 7 for 60 min reach level 4 by minute 30 with no errors.

## v79 — Map views (2026-10-26)
- New 👁 Map button under Jobs. Each tap cycles through Problems, Demand, Resources, then back to the normal map. Each view dims the map and labels what matters.
- ⚠ Problems: queued trains, trains with no route or a parked reason, idle factories with the missing input named, factories that are full, industries no train collects from, and towns no train serves. Busy track tiles show red. Nearby duplicates merge into "N× …".
- 📦 Demand: what each town still needs for its next size, with festival 3× marked, plus the goods Ashford's depot is short of.
- ⛏ Resources: stock bar, stock/cap and output per minute for every industry, inputs → output for factories, and every deposit you have found (★ rich).
- On ChatGPT's review: the line that clears contracts is on purpose (contracts were replaced by town orders in v69 and it tidies old saves).

## v78 (2026-10-26): station lanes without jitter, platform switches
- Trains entering a station hall get a platform lane that stays theirs until they leave, and glide into it (no more jumping between lanes when many trains are there). Extra trains stopped at a station line up along the platform.
- Both ends of every station join the line with switches: the two platform tracks curve into the single line beyond the hall.

## v77 (2026-10-26): real stations, factories no longer starved
- Bug (Sébastien: "delivering bricks and planks for nothing?"): factory trains could only take wood/stone from Ashford above its 50 upgrade reserve, so with wood at 44 the Sawmill got nothing and "Factory goods to Ashford" stayed 0. Factories may now use raw goods down to 10. Sim seed 31: Ashford level 3 at 14 min, level 4 at 23.
- Stations: every town with people gets a station on its line (its own tile, or the track beside it): a hall over ~3 tiles with two tracks on a gravel bed between platforms, canopy posts, and the station building on the side away from the town centre. Houses keep clear of it.
- Trains standing at a station take a platform lane each (side by side, then along the platform) instead of stacking on one spot.

## v76 (2026-10-26): double-track Build button fix
- Bug: the "Double N track squares" confirm bar kept the Build button greyed out from an earlier track plan (e.g. one short of ties) even with plenty of money. It now sets its own state from the doubling cost and refreshes live.

## v75 (2026-10-26): route-cut warning, softer train shadows
- Removing a track tile that leaves a train with no way between its stops now warns first ("⚠ This cuts Train 2's route", lists them) with Remove anyway / Keep it.
- Engine and wagons get soft round shadows so they sit above the rails.

## v74 (2026-10-26): double track, junction merges, auto-dispatch by need, Gemini review round 2
- Track renderer rewritten: every tile is straights + quarter-circle curves between its neighbours, for single and double track alike. Double track is two lanes (±8 px) with a soft gravel bed instead of the grey slab; single track fans into both lanes where it meets double track. Trains keep to the right-hand lane on double track.
- 🤖 Auto-dispatch now picks by need first: goods Ashford is short of (under 75) and open town-order goods count 2.5-3×, goods Ashford is nearly full of count 0.3×. Leaves factory trains and supply lines alone.
- Bug: sea scouts never found wrecks (scouts from a port weren't marked as sea scouts). Fixed; port scouts also sail faster (6 vs 4).
- Ashford never eats its own building materials below 25, so wood isn't drained to 0.
- Track tile sheet: 🔨 Remove this track tile (not under a building, shed or train).
- Tap the depot line at the top to open Ashford from anywhere.
- Train taps are tighter (0.7 tiles) and never steal a tap on or next to a town.
- Floating popups at the same spot stack instead of overlapping; town names get a dark pill.
- The bottom "tap anywhere…" hint hides after the tutorial / first 4 minutes.
- Trailing wagons no longer pop in one by one when a train leaves a station.

## v73 (2026-10-26): rails through towns, smooth junctions
- Junctions: every pair of perpendicular branches is joined by a curve and opposite ones by a straight, so T-junctions and crossings merge smoothly in all directions.
- Towns: houses are no longer drawn over track, so the line runs cleanly through town; a town centre on the line gets platforms on both sides and a small station house.

## v72 (2026-10-26): town roles, sea salvage, one-tap doubling, auto-dispatch, visual fixes
- Town roles from the land around each town: ⚓ Fishing port (wheat/flour orders -40%, wood/planks +40%), ⛏ Mining town (mines/quarries within 8 tiles +30%; wheat/flour +30%, stone -40%), 🌲 Timber town (lumber camps within 8 tiles +30%; wood -40%, stone/bricks +30%), 🌾 Farm town (farms within 8 tiles +30%; wheat -40%, wood/planks +30%), 🏖 Resort (passengers arriving pay 2×). Shown on the map next to the name, on the town card and on boosted industries.
- Sea salvage: 45% of sea scout trips find a wreck (planks, steel, coins, or engine parts = free faster engine). Wrecks stay on the map.
- Train card: "🛤🛤 Double the busy stretch" doubles the queued tiles on its line (plus 2 either side) in one tap.
- Opt-in 🤖 Auto-dispatch per freight train: between loads it switches to its best-paying job (needs 25% more pay, or it's stuck). Setting a route turns it off.
- Visual fixes: evenly spaced ties, no trees under rails, Ashford label no longer doubled, softer grass variation, town centres on track drawn as platforms.
- Sims (4 seeds, 60 min): Ashford level 3 at 17-50 min.

## v71 (2026-10-26): visual pass
- Rail corners are drawn as smooth quarter-circle curves, and trains follow the curve.
- Trains are an engine (dark body, brass bands, cowcatcher, headlight) plus 2-3 wagons that trail along the track: log flatcars, ore hoppers, tank cars, lit passenger coaches, dining car.
- Shores get a sand strip and gentle foam dashes on the water.
- Seasons change the map: spring blossom, golden summer, orange autumn trees, frosted winter with snow-capped trees and falling snow.
- Fog edges are soft clouds instead of a staircase.
- Zoomed out, towns show only name, size and order bar (need icons, population and link badge appear when zoomed in).

## v70 (2026-10-26): fixes from Gemini's review
- A filled order no longer stalls a direct route: towns keep buying every good in their current order at full price (steady demand), not only goods from past orders.
- Factory trains that leave Ashford empty now say why on their card ("Ashford has no spare wood… it keeps 50 of each").
- Lumber camps at level 2+ have foresters: cut trees grow back 3× faster, so a busy camp sustains itself. The camp panel says so.
- Sims (4 seeds, 60 min): Ashford level 3 at 22-40 min.

## v69 (2026-10-26): town orders + direct delivery, contracts removed
- Every town follows a fixed ladder of orders: Camp → Village → Town → City → Metropolis. Each order lists exact goods (start: 30 wheat + 20 wood); filling it levels the town up and pays a reward ($1.2k, $3k, $6k, $12k, $25k).
- Town panel shows the order card with progress, which trains bring each good, and a "Send it from…" button that puts a train on a direct route from the nearest maker. Map shows a progress bar under each town.
- Haul routes can end at any town that orders the good (no need to go through Ashford). Towns keep buying goods from past orders, for steady income.
- Contracts removed. Festivals (each season) make one town's order pay 3×. Jobs lists every town order.
- Ashford keeps 50 of each building material (wood/stone/wheat too), so supply lines can't drain it.
- 💡 gridlock tip for trains stuck behind others.
- Bot serves town orders. 75-min sims (4 seeds): Ashford level 3 at 26-52 min, level 4 at 36-63 min, $6-15k at 75 min.

## v68 (2026-10-26)
- Smarter trains: haul trains leaving Ashford take supplies to a town near their pickup on the way, instead of running empty.
- Trains leave once 75% full (max 10 s wait, was 20 s for a full load); supply lines leave at 60% (max 8 s).
- Coaches on multi-town lines wait at most 3 s per stop and never get stuck at an empty end town, so the return leg runs too.
- 2nd pickup: if Ashford is on the way between the two pickups, the train drops its first load at Ashford as it passes.
- Train card: "💡 Best jobs for this train" lists the 3 best-paying jobs (≈$/min, tiles), one tap to assign.
- 💡 badge over trains (and in the engine house list) with no job, stuck, or on a job worth far less than their best one.

## v67 (2026-10-26)
- Fix (from v65 change): Ashford can again use planks/bricks it needs to grow; the 50-unit reserve now only holds back factory goods from supply lines and from Ashford's extras, not from its own needs.

## v66 (2026-10-26)
- The build / survey / new-track confirm bar now updates live: ✓ Build turns on as soon as you have the money (it only checked when it opened).
- The "fit a bigger tender" offer panel also refreshes live.

## v65 (2026-10-26)
- Ports reach farther: Dock 24, Harbor 40, Port 60, Deepwater 90 tiles (was 14/24/36/52). With the old ranges island towns (40-60 tiles out) were only reachable with a Deepwater port.
- Bug fix: Ashford's depot now really keeps 50 of each factory good (planks, bricks, flour, steel, fuel) for upgrades, as the depot panel says. Supply lines and Ashford's own use took every plank, so Harbor upgrades could never be paid.
- Sim bot (sim-dump.js) now plays the whole game: founds towns on settlement sites, fixes broken rails, buys train upgrades and dining cars, extends coach lines, feeds small towns, saves up for port upgrades, sails scouts out and lands on islands.
- 2-hour sims (8 maps): islands reached on 6/8; max Ashford level on 3/8 by ~85-100 min; money piles up to $77k-219k by 2 h on 6/8 (late-game sinks still too small).

## v64 (2026-10-25)
- Factories are now required to expand: Ashford levels 2-5 need factory goods (planks/bricks, later steel or fuel) delivered to Ashford. Goal line hints which factory to build.
- First factory cheaper ($2,500 + 40 wood + 40 stone); each next one +$2,500.
- Merchant sell price lowered (SELLP 1.2 -> 0.6): selling short-haul goods was a money machine.
- Sim bot (sim-dump.js) now plays like a human: hauls wood/stone, builds factories near Ashford with their own trains, adds coaches (refits a freight train if slots are full), rebuilds ruins, founds towns, scouts fog, builds and upgrades docks.

## v63 (2026-10-25): test-pass fixes
- **Sims:** 4 seeds × 75 min, plus 20 and 50 min saves loaded in the browser at phone size.
  - Money: $1–3k at 10 min, $2–12k at 30, $34–58k at 60, $34–86k at 70.
  - The bot stalls at Ashford level 3 with 10 trains because it never builds factories (engine house level 4 needs planks and bricks). Real play should keep spending.
- **Map badges:** the 🚃/📦/🧳 badges on buildings now sit above the name instead of covering it.
- **Objective card:** starts folded to one line after the tutorial, so the map stays visible. Tap it to open.
- **Jobs button:** shorter ("📜 Jobs 2 +5") so the HUD line isn't cut off.
- **Town status:** a town at its limit says "Full for now" instead of "Growing slowly". A town above its supported size says "Holding at X people" instead of "Full at 180".
- **Wording fixes:**
  - "Depot is out" names the factory ("build a Sawmill", not "build a Planks").
  - The "Ashford needs planks" text now says factories need a freight train.
  - The build menu says farms need 2+ grass squares.
  - Tender upgrades show real range, including the Water Tower bonus.
- **Tech panel:** shows the real landmark status for tunnels, bridges and diesel, instead of always showing 🔒.
- **HUD income:** no longer shows +$0/min right after loading.
## v62 (2026-10-25): live buttons, depot in the HUD, permissive farms
- **Live sheets:** every open sheet (engine house, train card, town, factory, port, build menu, picker, spot, tech) redraws every second. Greyed-out buttons turn on as soon as money or goods arrive.
  - Before this, a button you had tapped kept focus, which stopped the refresh.
  - The refresh pauses for 1.2 s after any touch on the sheet, so taps aren't lost, and the scroll position is kept.
- **Depot in the HUD:** the top bar shows a line with Ashford's depot stock and its cap. The Ashford depot section is open by default.
- **Farms:** need only 2 open grass squares around them, and output still scales with fields. Industries only need to keep one square apart (diagonal distance 2 is fine), so more squares glow.
- **Ports:** must touch real ocean, not an inland lake. Lakes no longer count as open sea, so trestles can bridge them. A landing is only offered when a water route exists.
## v61 (2026-10-25): island world, ports, events, top-5 review fixes
- **World:** 208×208 archipelago (was 64×64). Ashford's home island plus about 20 islands with about 25 ruins and settlement sites and about 50 deposits. Far islands have rich deposits that give +50% output. Open sea (2+ tiles from land) blocks track. Save key is now railhaven4, so old saves restart.
- **Ports (Ashford level 2):** build a Dock on a coast joined to track. Its sea range grows with each level: Dock 14, Harbor 24, Port 36, Deepwater 52 tiles. Upgrades cost up to $40k.
  - Sea scouts sail out from a port.
  - A landing ($3k) can be built on any scouted coast in range. Trains then cross on a ferry lane drawn as a dashed line, and on water they are drawn as boats. Sea tiles count toward train range.
- **Events:** broken rails, bumper harvest (farms ×2), travelling fair (fares ×2), rich seam.
  - A broken rail is a rockslide, washout, fallen tree or heat buckle on a busy line. They start after 10 minutes.
  - Trains wait at a break. A crew fixes it free in 90 s, or tap the 🔧 to repair it for $250.
  - The first break shows a card with a "Show me" button.
- **HUD:** one short line: income · ties · trains (plus alerts). Era, season, population and % explored moved to Jobs → Info. The Jobs button moved to the top right.
- **Tutorial:** the card is docked above the toolbar, and the hint line and duplicate toast are hidden while it shows.
- **Jobs:** split into 🎯 Goals and 📖 Info tabs.
- **Ashford panel:** depot and Landmarks fold. The depot title shows when there is surplus to sell.
- **Late-game spending:**
  - New landmarks: 🕰 Clock Tower ($15k, contract bonus +25%), 🌉 Bridge Works ($18k, water track half price with no ties), 🎡 Exhibition Hall ($30k, towns grow 25% faster), 🚉 Grand Terminal ($50k, +4 train slots).
  - 5th tender size (140 tiles, $12k + steel).
  - Tender sizes now need Ashford levels 1/2/3/4.
  - Tunnels cost $250 per square.
- **Faster start:** each industry's first load pays a $400 opening day bonus. Each newly linked town gives a welcome gift ($600 rising to $2,400) plus 20 ties.
- **Goals name a town:** Ashford level goals show "Link towns (nearest: X)".
- **Sim (2 seeds, 60 min):** $2–4k at 15 min, $12–13k at 30, $72–74k at 60. The bot doesn't buy the new landmarks or ports.
## v60 (2026-10-25) Engine house navigation
- Engine house tabs stay pinned while scrolling and show ⚠ counts for trains needing attention (no job, out of range, no track, stuck).
- Train rows show ⚠; train card shows the problem at the top.
- Train card has a pinned bar: ‹ Engine house, plus ‹ n/N › to step through trains of the same tab.
- Going back returns to the same tab and scroll position.

## v59 (2026-10-25) Sell by choice + panel scrolling
- Sébastien chose "Hauls pay little, sell by choice": HAULP .8 -> .35 (small haul fee), SUPP .35 -> .7 (supply lines pay more), new "💰 Sell surplus" buttons in Ashford's depot (anything above the 50 reserve, at rate x PAY x 1.2, logged as merchant/sales).
- Sim (bot sells all surplus >=100 every 20 s, i.e. an upper bound): 60 min $11-57k, $1.4-3k/min; 30 min $1-7k. sim-early.js bot now sells surplus; logs S.led.
- Panels: ✕ and a ⬆ back-to-top button stay pinned while scrolling. Engine house: buy + upgrade at the top, compact train rows, short "Depot is short" line.

## v58 (2026-10-25)
- Traveling merchant no longer takes half your biggest stock: he offers to buy half of the surplus above the 50 reserve, and you choose Sell or keep.

## v57 (2026-10-25) Contracts as bonuses, slower mid-game, trains per building
- Report v52 (54 min): $74k, ~$4.4k/min; iron train ~$755/drop; contracts felt worthless and cost goods.
- Contract goods are now delivered and paid normally (and supply the town); the contract reward is a bonus on top, sized base + ~2 min of your steady income (S.incR). Finishing one makes the town boom (2x growth, 120 s). Failed: half the bonus scaled by share delivered.
- DF distance exponent 1.1 -> 0.85 (long hauls still pay more per trip, less per tile). PAY .55 -> .45.
- Sim 60 min: $37-64k (was $76-122k).
- Building / town / factory menus list "🚂 Trains here" (tap opens the train card); Ashford links to the engine house when it has many.

## v56 (2026-10-25)
- Supply picker from a town: existing supply lines are listed first with "➕ Add <town> as its 2nd town" (or replace the current 2nd town), fitting the tender in the same tap.

## v55 (2026-10-25) More train slots
- Engine house slots 4/7/10/14/20 (was 3/5/8/12/16); each regional depot adds +2.
- Sim (bot): 45 min money $29-43k, earnings $2.2-5.4k/min (was $3-38k). Watch for money growing too fast.

## v54 (2026-10-25) Factories by train, scout start town
- Factories no longer trade with the depot by themselves (Sébastien chose "both ways by train, same train"). Give a factory a freight train with 🚃 Haul to Ashford: leaving Ashford it loads the raw goods (never more than the factory can still hold, keeps the 50 reserve), unloads them at the factory, waits only for what the factory can make from them, and hauls the products to the depot (paid like a haul). An empty factory sends its train back for inputs.
- Old saves get a one-time notice. Factories show the red 🚃 badge until a train runs them.
- Scout mode: tap a rail-linked town to pick where scouts leave from (its circle turns green, others fade), then tap the fog inside it.

## v53 (2026-10-25) 2nd pickup + map badges
- Freight upgrade "🔗 2nd pickup" ($1,500 + 20 wood): set a second building of the same type on the train card. The train waits only ~4 s at the first, tops up at the second (waits up to 20 s), then hauls to Ashford. Range counts both.
- Map badges on linked places: red 🚃 = no train collects here, orange 📦 = town with no supply line, blue 🧳 = station with no coach. Legend in the engine house. Replaces the old red "!" on full industries.

## v52 (2026-10-25) Popup tidy + product hints
- Engine house / train cards no longer draw straight green flow arrows for every train, and clear the previous building's flow lines.
- Each newly opened menu starts scrolled to the top; menus can be up to 40% of the screen (was 30%).
- "Not enough" messages for planks/bricks/flour/steel/fuel say which factory makes them and how (or when it unlocks).
- Report from v46 (31 min): ~$1.5k/min steady, $21k; bottleneck = 5 train slots, engine house lvl 3 needs planks+bricks, no factories built yet.

## v51 (2026-10-25) Coach picker from a town
- "Send a coach from here": each coach with a line offers "➕ Add <town> to its line", buying the extra-stop and/or tender upgrade in the same tap; shows "Already stops here" or why it cannot.
- Any route that is out of range (freight or coach) now pops an offer to fit the tender and continue, instead of only a toast.
- Coach labels list all their towns.

## v50 (2026-10-25) Range-aware train picker
- Building menu shows its distance from Ashford and how many freight trains reach it.
- Train picker states the range needed, lists trains that reach it first, and offers "🛢 Fit tender and use" (one tap, all tender levels needed) for trains that fall short.
- New-train buttons include the needed tender when the spot is beyond base range.

## v49 (2026-10-25)
- Route lines hidden by default; toggle "🎨 Route lines" at the bottom of the engine house. The tapped train (or the one being routed) always shows its line.

## v48 (2026-10-25)
- Engine house list shows each train's range (and what its job needs).

## v47 (2026-10-25) Double track visibility
- Double track drawn on a wide grey ballast bed with bright rails.
- Squares picked for doubling glow blue (there was no preview before).
- Route colour lines are hidden while painting or doubling track.

## v46 (2026-10-25) Coach lines, engine house tabs, scout choice, contract cards
- Coaches serve several towns: base 2, upgrade "🚉 More towns on its line" up to 5. They go back and forth, dropping off and picking up at each station. Coach upgrades: more towns, faster engine, more seats (+50%), dining car (+25% fares, $2,500 + 20 flour), tender.
- "➕ Add a town" on a coach's card and in its route confirm.
- Engine house has 3 tabs: Passengers, Haul to Ashford, Supply towns (with counts).
- With a train card open (or setting its route), only that train's line colour is drawn.
- Scouting: when several rail-linked towns reach the spot, pick which town they leave from.
- Contracts: a card pops up on completion or timeout explaining what happened to the goods. Failed contracts now pay half the contract rate for what was delivered.
- HUD income now shows steady income (deliveries minus upkeep over the last minute); one-off rewards made it jump (Sébastien saw +$5,209/min vs ~$1.4k real).

## v45 (2026-10-25) Rail-linked scouting, tap trains, faster haul setup
- Scouting only launches from towns linked to Ashford by rail (circles only around those). Tapping fog near an unlinked town explains why.
- Tapping a moving train on the map opens its card (same card as in the engine house).
- Train card: "➕ Add a 2nd town" / "Change 2nd town" for supply lines.
- "Haul to Ashford" (and supply from a town's menu) skips re-tapping Ashford: goes straight to the confirm.
- Fixed a crash-y toast when tapping a wrong 2nd stop on a supply line.

## v44 (2026-10-25) Toolbar toggles
- Tapping a bottom button a second time (Build, Scout, Trains, Tech) closes its menu or mode. Build also closes rail painting.

## v43 (2026-10-25) Scout fix + engine house track
- Bug: scout mode drew reach circles (and allowed scouting) from towns still hidden in the fog. Now only discovered towns count.
- The engine house starts joined to Ashford by a short free track (also added to existing saves).

## v42 (2026-10-25) Engine house building + clearer train menu
- The engine house is its own building on the map, a few tiles from Ashford (tap it, or 🚂 Trains). Tapping Ashford no longer opens the trains menu.
- New engine house panel: slots bar, one card per train (colour, "Train N", job in words like "🪵 Hauls wood · Lumber Camp → Ashford" or "📦 Supplies Kettle Rock from Ashford", status), Buy a train (Freight / Coach), upgrade box, wagon colour legend.
- Tap a card for the train's page: Job (change job), Stats (earned, load, range vs what the job needs, speed), Upgrades (tender, speed, load, diesel) with costs, change type, sell. "‹ Engine house" goes back. The page stays open after buying an upgrade.
- Trains are numbered; idle trains wait at Ashford.

## v41 (2026-10-25) Regional depots, landmarks, diesel, cargo colours
- Wagon colours by cargo replace the cargo bubbles: yellow wheat, brown wood, black coal, red iron, grey stone, purple oil, blue passengers; supply trains show up to 3 stripes. Legend in 🚂 Trains.
- 🏛 Regional depots: a linked City (1,200+) can become a depot for $8,000 + 60 planks + 40 bricks. It shares Ashford's stock; hauls can end there, supply lines can start there, the town feeds itself from the depot, and train range counts from the nearest depot. Industries haul to their nearest depot automatically.
- 🏗 Landmarks in Ashford's panel: 💧 Water Tower (L1, $2k+40🪵+40🪨: +10 range for all trains), 🏛 Station Hall (L2, $4k+60🪨+40 planks: passengers +30% pay, coaches +50% load), ⛰ Foundry (L2, $6k+80 coal+80 iron: tunnels, mountain track $120/tile), 🔶 Locomotive Works (L3, $10k+40 steel+40 planks: diesel).
- 🔶 Diesel: per-train conversion $3k+20 steel: +60% speed, +50% range, +25% upkeep. HUD says Diesel Era once the Works stand.
- Coal, iron, oil and fuel now count as building materials (needed for the Foundry).
- Report lists engine house level, landmarks and depots.

## v40 (2026-10-25) Line colours + cargo icons
- Every train has its own colour: its route is drawn as a thin coloured line along the track (slightly offset when lines share track), the train carries a colour stripe, and the Trains/engine house lists show the colour dot.
- Loaded trains show a bubble with what they carry (good icon, up to two icons for a supply train, 🧳 for passengers).

## v39 (2026-10-25) Engine house + train range
- Sheds removed from the map. All trains live in Ashford's 🏛 engine house (🚂 Trains → Engine house). Levels 1-5 give 3/5/8/12/16 trains and loads of 20-40. Upgrades: $1.5k+30🪵, $3k+40🪵+30🪨, $6k+40 planks+20 bricks, $12k+60 planks+40 bricks+20 steel. Old saves merge their sheds into it.
- Range: each train works only within N track tiles of Ashford (20 → 35 → 55 → 90). 🛢 Bigger tender upgrade per train: $1.2k+20🪵, $2.5k+30🪵+20🪨, $5k+30 planks. Out-of-range places don't glow when setting a route and are refused with the distance; old routes beyond range park with a message.
- Tutorial drops the shed step (5 steps).

## v38 (2026-10-25) From Sébastien's first hub report
- Ashford was starving for wheat while supply lines and a big contract emptied the depot. Now Ashford feeds itself first: the building reserve doesn't block a need it is short of, and supply trains leave 30 of anything Ashford is short of.
- A red "!" on any linked mine/farm/camp that is full and has no train hauling it (his two iron mines sat full).

## v37 (2026-10-25) CAPITAL HUB revamp (Sébastien chose option A)
- Ashford has a **depot** holding every good (up to 150+100×level each). Ashford takes its own needs from it (only what keeps it supplied; keeps 50 of each building material for sheds/upgrades). Factories on your track pull inputs from the depot and send output back by themselves: no trains to factories.
- Trains: just 🚃 **Freight** and 🧳 **Coach**. A freight train either **hauls** (tap a mine/farm/camp → it goes to Ashford, no 2nd step) or runs a 📦 **supply line** (tap Ashford, then a town; optional free 2nd town). Supply trains load whatever those towns need from the depot. Leftovers return to the depot.
- Pay: haul 0.8× and supply 0.35× of the goods value × distance factor; PAY .55. Bigger fleets cost more to run (+8% upkeep per train beyond 4).
- 🚉 **Passenger stations**: $300 per town (Ashford has one). Only station towns make and receive passengers.
- Towns: big need bubbles (green ring = supplied, red = missing); town panel says per need "supply line · N in depot", "depot is out: haul some", or "no supply line yet", with a "Start a supply line" button. Ashford panel shows the depot with bars and in/out per minute.
- Removed: town specialties, the 2nd-stop upgrade, refit choices between wagon types, goods-flow lists. Map arrows now show industry → Ashford and Ashford → town.
- Old saves convert: old wagons become freight; routes to towns become hauls to Ashford.
- Sim (bot builds sheds/trains): 20 min earnings $230–1,900/min, 45 min $2.7–7k/min gross.

## v36 (2026-10-25) Ashford's store always fills
- Bug-ish: a big Ashford wanted all the wood it received, so nothing reached the store and sheds/upgrades needing 🪵 were stuck. Now at least a third of every material load delivered to Ashford goes into the store (half price for that part).
- "Needs more X in store" message explains the one-third rule.
- HUD: "📦 store …" label, and ties now use 🛤 instead of 🪵 (looked like wood).

## v35 (2026-10-25) Contract rewards fixed (from Sébastien's report)
- Passenger contracts paid double rate per passenger (6 vs 3): fixed. His 200-passenger festival contract was worth $9,850.
- Festival contracts pay 2× instead of 3×.
- The traveling merchant no longer gives free money: he buys half of the biggest pile (20+) in Ashford's store.
- Report: notes the minute tracking started for older saves and fixes the "building/buying" total for them.

## v34 (2026-10-25) Game report, calmer income line, mid-game trim
- 🔧 Tech → "📋 Game report (copy & share)": plain-text report with income by source (deliveries, contracts, story, Ashford rewards, merchant), upkeep, building spend, money per minute, every train (route, upgrades, status, earnings), towns, industries, contracts.
- HUD income is now net earnings minus upkeep averaged over ~30 s (it used to jump, e.g. -$184 then +$4,100/min).
- Mid-game money trimmed: distance bonus exponent 1.25 → 1.1 (long hauls pay less), story rewards cut ~40% ($800 … $6,000). Sim: earnings at 30 min down ~25-30%, first 15 min about the same.

## v33 (2026-10-25) Manual town upgrades, reachable destinations
- Towns no longer grow past their size on their own. When a town is full (100 / 400 / 1,200 / 3,000 / 8,000) and could grow bigger, a green ⬆ bobs above it and a news line appears. Tap it → "⬆ Upgrade · $X" ($250 / $800 / $2,500 / $6,000 / $15,000).
- Ashford's level also rises only when you tap "Raise Ashford to level N" once its goals are met (⬆ over Ashford). Reward and unlocks unchanged.
- When a town is full but can't upgrade, the panel says why: link it, supply more needs, or the Ashford goals with progress.
- Industry panels and map arrows only list towns your track reaches (no more far-off unconnected towns), each with track distance and $/unit. Unconnected industries say to join the network.
- Sim bot upgrades automatically: seeds 3/5 at 45 min $155k/$138k.

## v32 (2026-10-25) Explain the size limit
- Town panel: when a town is held back by Ashford's level, it now lists the goals for the next Ashford level with progress (e.g. Link towns 1/2), and says Ashford rises by itself. Replaces "raise it in Jobs".
- Status says "every need is supplied, but it has hit its size limit" instead of "Growing" when full.

## v31 (2026-10-25) Clearer town panel
- Town panel rebuilt into sections: header (size · people), growth status, 📥 Needs (each with ✅/❌ and where it comes from: your train route, nearest source with no train yet, or nothing on the network), 📤 Sells (specialty stock + passengers), Ashford link status, small "wants right now" line.
- Removed the long goods-flow list from town panels (map arrows still show flows).
- A town's specialty is never one of its own first three needs (Redcliff no longer sells and needs wheat). Existing saves are fixed automatically.

## Sheds get pricier (2026-10-25)
- Shed cost: 1st free, then $1,500 + 30 wood, $2,700 + 40 wood, $4,900 + 40 planks, $8,700 + 50 planks, $15,700 + 60 planks (money ×1.8 each).

## No shed limit, no stacked panels (2026-10-25)
- Sheds are no longer capped by Ashford level. The first is free; each extra one costs $1,500 + 30 wood.
- Opening 📜 Jobs closes the bottom sheet, and tapping the map or a toolbar button closes Jobs.

## Seasons become festival contracts (2026-10-25)
Sébastien: passive seasonal demand was ignorable; he prefers occasional seasonal contracts.
- Seasons no longer change demand, output or prices.
- At each season change there is a 60% chance of a 🎉 festival offer: Spring building fair (wood/stone/planks/bricks), Summer festival (passengers/flour/wheat), Harvest festival (wheat/flour), Winter fuel drive (coal/wood/fuel). It asks 1.6× the goods, gives 1.5× the time and pays 3× the reward. The offer lasts 200 s, is announced in the news and is marked in Jobs.

## Trying every idea (2026-10-25)
Sébastien asked to try ideas 1-4 and 6 (no bank loan) and to make sure players never fail.
- No fail: towns never shrink, they only pause growing. A missed contract just expires with no penalty.
- Locomotive upgrades per train: ⚡ Faster engine (+50% speed, $2,000 + 20 wood + 20 stone), 📦 Bigger wagons (+50% load, $2,500 + 25 planks), ➕ 2nd stop.
- Town specialties: every town except Ashford trades one local good picked from the land around it (wood, wheat or stone). It makes pop/400 per second from 20 people up, so it can be loaded like an industry. Shown in the town panel and as a chip by the name.
- Seasons, an 8-minute year: Spring wood/stone demand ×1.5; Summer passengers ×1.5; Autumn farms ×1.5; Winter coal demand ×2 and coal price ×1.3, farms ×0.5. Season shows in the HUD, and a news item marks each change.
- Single track: a train waits up to 5 s when the next square is occupied, except at stations. ⏳ markers show jams. Double track costs $25 a square (Build menu painter or a track square's sheet) and never blocks. Sim: blocking costs a bot ~25-35% of income; about 20 doubled squares cut blocking from ~17% to ~3%.
- Tutorial on new maps: 6 steps in the story card, with the right toolbar button pulsing and a skip link.
- Sim at 45 min: ~$95k-150k, Ashford level 2-4.

## Early economy pass (2026-10-25)
Measured with the minute-by-minute sim (sim-early.js, LOGS=seconds per log line): early earnings were about $100-200/min against $600-2,500 costs.
- Start money $8,000 (was $5,000).
- PAY 0.7 (was 0.6).
- Goods a town does not want sell at 35% (was 20%).
- Town wants refill every 60 s (was 90 s).
- Sim earnings: $150-450/min in minutes 0-10 (was $50-230), $500-1,200/min at 15 min; $100k-120k at 45 min, Ashford level 2-4.

## Farms fit in more places (2026-10-25)
- A wheat farm can go on any open grass square with 3+ open grass squares around it (was 6+). Output scales with fields up to 6. The preview shows the % output, and blocked squares say how many fields would fit.

## Clear route picking, 2nd stop, cheaper upkeep (2026-10-25)
- Picking a route now shows a green step card at the bottom: "New Flatcar bought! Now give it a route · Step 1 of 2: tap where it loads / Step 2 of 2: tap where it delivers", with "Set it later".
- New per-train upgrade "➕ 2nd stop" ($1,500 + 20 wood). In the route confirm card, "➕ Add a 2nd stop" picks a second drop-off. The train unloads what the first stop wants (town demand, store room or factory buffer) and takes the rest to the second stop. Pay uses the total haul. Two-stop routes skip the return load.
- Upkeep: moving trains $36/min (was $72), parked or loading trains $12/min, track $0.36/min per tile (was $0.60).
- Goods put into Ashford's store now pay half price on delivery (they paid nothing).
- Sim at 45 min: $30k–95k, Ashford level 3–4; still about $2k at 20 min.

## Contract goods are used up (2026-10-25)
- Goods delivered toward an accepted contract are consumed by it: no store, no sale, no town supply. Only the extra beyond the contract amount is handled normally. The reward pays for them.

## Track grows only from the network (2026-10-25)
- Painted track must start at Ashford or at track or buildings joined to Ashford. Unconnected buildings no longer count as a starting point.
- "Start track from here" only appears on connected buildings and on squares next to the network; other squares explain the rule.

## Routes, contracts, spread-out towns (2026-10-25)
Sébastien felt he had no impact (trains self-dispatched) and chose "routes plus contracts".
- Trains no longer pick their own jobs. Each train runs a route you set: tap where it loads, then where it delivers, and see the pay per trip before confirming. It waits up to 20 s for a full load, and carries a return load when B makes something A takes.
- Ways to set a route: a new train asks for one right away; 🗺 Route in the Trains list or a shed; "🚂 Send a train from here" / "🚂 Bring goods here" on any building or town; "🚂 Send a train" on an accepted contract.
- Sheds have no range any more: their trains can run anywhere on track joined to them. Shed upgrades add train slots and bigger loads.
- Pay per unit scales as (distance/8)^1.25 (1× up to 8 tiles), so longer routes earn more per minute.
- Towns: at least 11 tiles apart; 1 near ruin, 3 far ruins, 4 settlement sites. Ashford level goals now ask for 1/2/4/6/8 linked towns.
- Contracts are offers you accept (2 at a time, offers last 2.5 min). The reward grows with haul distance.
- News: town shortages, growth, contract offers and results, listed in 📜 Jobs.
- Sim bot re-plans its trains' routes every 60 s with the old job-finder (`suggestRoute`). At 45 min: $2k–70k, Ashford level 2–3.

## Mining in the mountains (2026-10-25)
- Stone Quarries can be built on any land at the foot of a mountain (touching 2+ mountain tiles); no rock outcrops needed.
- Coal seams and hidden iron now always sit at the foot of mountains. Oil seeps stay out in the open land.
- Every new map has a mountain ridge within 5-10 tiles of Ashford, so the first quarry and coal mine are always in reach.
- Old saves keep their deposits; start a new map to get the new layout.

## Less clutter, safer panning, live panels (2026-10-25)
- Build rails: a drag paints only if it starts on your track, a building or a painted square; any other drag moves the map. Pinch never taps.
- While building rails the story card is hidden, toasts sit at the top and the cost bar is compact.
- Tapping a building no longer zooms; the map slides it above a shorter sheet that leads with the goods flow. Zooming keeps it selected.
- Trains view draws an arrow for each train's current job.
- Town and industry panels refresh every second while open.

## Fairer train dispatch (2026-10-25)
- Trains pick up within their shed range but deliver anywhere on the network up to 45 tiles of track away (before: destination also had to be inside the shed range, so far towns were never chosen).
- A town missing one of its needs is valued 2.5x, so it is served first. Ashford store only takes materials no town is short of, at half weight.
- Goods-flow arrows and the "no train can bring" warning follow the same rule.

## Painted track must connect (2026-10-24)
- Build rails: each painted square must touch existing track, a building (town, industry, factory) or a square already painted. Removing a square drops any painted squares cut off by it.

## Paint rails square by square, slower income (2026-10-24)
- Build rails: drag over exactly the squares you want (no auto-routing); tap a square to add/remove; two fingers pan while in this mode; confirm bar shows tiles and cost. Normal mode: drag always pans.
- Deliveries pay 60% of before (PAY=.6). Sim money at 45 min: $4k-$23k (was $17k-$116k); bot reaches Ashford 2-4.

## Rails only through Build → Build rails (2026-10-24)
- Finger drawing removed: dragging always moves the map. Build rails = tap start, tap finish, see cost, confirm. Rail mode ends after Build or Cancel (Undo still works).

## Start/finish track everywhere (2026-10-24)
- Every tile sheet and building/town/deposit panel has "🛤 Start track here"; then tap the finish and the whole route is planned with cost. Replaces the one-tile "Lay track to here".

## Survey clarity (2026-10-24)
- Survey radius back to 5 (Sébastien: no need to widen, just make the distance clear).
- Surveying now previews its 5-tile circle with a confirm bar. Surveyed areas stay hatched on the map and the sheet says "Already surveyed around here".

## Hidden oil/iron made obvious (2026-10-24)
- Survey reaches 7 tiles (was 5), so surveying on the clues always finds the deposit.
- Tapping near dark seeps / rusty rock shows what they mean and a Survey here button. Picking Oil Well or Iron Mine in Build glows the clues; tapping one surveys it.

## Building near deposits (2026-10-24)
- Deposits no longer block the tiles around them (only their own tile); settlement sites keep their direct neighbours free; built places still keep 2.5 tiles apart. "Too close" now names what is in the way.
- Tapping next to a deposit or settlement site offers Build mine / Found town in the sheet.
- "Lay track to here" goes to the exact tile tapped instead of snapping to a nearby deposit.

## Clarity pass (2026-10-24)
- Rail: track can start and end anywhere (drag, or tap start then end). Loose track is flagged until it joins the network; "connected" now means reachable from Ashford.
- Goods symbols: ⚫ coal, 🧲 iron, 🪵 wood, 🪨 stone, 🌾 wheat, 🛢 oil (steel is ⚙️). Map symbols sit on light chips. Goods key in Jobs.
- Tapping a building or town fits it above the sheet; the story card and Undo hide while a sheet is open; toasts move to the top.
- Goods flow: arrows from the selected building to who uses its goods and from suppliers into towns/factories; green when a train actually carries it. Same list in the panel.
- Ashford level-up shown as a checklist with progress (tap card to fold).
- Industries drawn as small buildings with coloured roofs.

## Rail drawing, footprints, wheat fields (2026-10-24)
- Build menu has a 🛤 Rail button: one finger draws track (dashed preview, red where blocked), two fingers pan. On release a confirm bar shows tiles and cost; strokes that start away from the network get joined automatically. Tapping a spot still routes there.
- Placing any building shows its footprint first (farm 3x3 with fields, lumber camp 5x5 forest reach) with cost, then confirm.
- Wheat farms grow fields on the 8 tiles around them. Need 6+ free grass tiles. Track over a field removes it; output scales with fields (6+ = full). Routes avoid fields.

## Track fix (2026-10-24)
- Tapping beside a building opened that building instead of the spot sheet, so track could not be laid near your network. Now only the building tile itself (or a town) opens info.
- Build mode with nothing picked acts like a normal tap. Clearer "needs X ties, you have Y" message.

## Tap-anything controls (2026-10-24)
- No tool modes needed. Tap any tile and a bottom sheet lists what you can do there (lay track, build camp/farm/factory, shed on track, scout fog, survey), with the reason for anything not allowed.
- Deposits and settlement sites have Build / Found buttons in their panel.
- Toolbar is now Build (finder with glowing spots), Scout, Trains, Tech. Old track-mode rings removed (they looked like build zones).
- Stored amounts are whole numbers. Toast moved off the story card.

## Building and track laying redesign (2026-10-24)
- Build button opens a menu (industries + factories) with cost and where each can go; valid tiles glow.
- Farms: open grass with 3+ grass neighbours. Sites need 2.5 tiles spacing.
- Track mode is tap-to-route: tap a destination, the cheapest route (around mountains, fog, sites; bridges over water) is previewed with cost, then Build or Cancel.
- After building an industry, the route to connect it is previewed automatically. Panels have a Connect to rail button.
- Dragging always pans. Undo works in any mode.

# Railhaven prototype changes

## 2026-10-24 (evening): No free money, first track fix

- **No automatic income.** Ashford's $2/s stipend is gone, so money only comes from selling goods, contracts and rewards (missions, Ashford level-ups, events). Running costs still never push money below $0.
- To make up for it, starting money is $5,000 (was $4,000). Any train can be sold for half its price ($400) from the shed panel. That's the way out if you run dry, now that there's no safety-net income.
- **First track:** in Track mode you can start a line from anywhere on Ashford's footprint (its tile or the 8 around it), and the same goes for linked towns and sites, as well as from your own track. Start points glow in Track mode. Drags that start elsewhere still move the map.
- Fresh start again (new save slot), so you begin on a new map with these rules.
- **Simulation (8 maps × 45 min):** all 8 maps reach Ashford level 4. Money at minute 45 is $23k–$144k.

## 2026-10-24 (latest): Build your own industries, forests, scouting

**You build every industry.** Only Ashford, the ruined towns and the 🚩 settlement sites are preset.
- The map holds natural resources instead of buildings: forests, open grassland, ⛏ coal seams and 🪨 rock outcrops (visible), and iron and oil (hidden until surveyed). The richer deposits are spread up to 31 tiles out, so reaching them takes scouting and longer track.
- One 🏗 **Build** tool (it replaces the Factory button). Tap a spot to see what it can hold:
  - Lumber Camp ($600), near forest
  - Wheat Farm ($800), on open grass
  - Coal Mine ($1,000), Quarry ($800), Iron Mine ($1,500) or Oil Well ($2,500), each on its deposit
  - Factories, on land next to your track
- Deposits glow in Build mode. Story missions and the opening tip now tell you to build a lumber camp first.

**Forests run out.** A lumber camp cuts the forest within 2 tiles. Each forest tile holds 80 wood, then turns to stumps and grows back after about 5 minutes (stumps, then saplings). A camp slows down below 6 forest tiles and stops when they're all cut. Its info panel shows how much forest is left.

**Scouting is clearer and quicker.** Scout mode draws a dashed circle (20 tiles) around every living town. Scouts walk 2.5× faster and reveal a radius of 3 along the way and 5 at the destination. The button shows how many teams are out. Tapping outside the circles or on land that's already mapped tells you why it won't work.

**Mountains** already block track until Tunnels are researched, so routes have to go around them.

**Other fixes**
- The info panel no longer covers the 📜 Jobs button, and tapping empty ground in Look mode closes it.
- Fresh start: the game uses a new save slot, so your old game is gone and you begin on a new map. Jobs has a ↺ Start a new map button (tap twice).
- Shed panel tip: if an upgrade needs wood and you have no Flatcar, it tells you to refit a train.

**Simulation (8 maps × 45 min, bot)**
- Every map reaches Ashford level 3 and six reach level 4 (before this change, all maps stopped at level 3). Money at minute 45 ranges from $20k to $200k (about $92k on average, compared with $113k before factories). Earnings at minute 45 are 4k–12k per minute, so money still piles up late on the best maps.
- The bot now builds industries, founds towns on settlement sites and refits a train when it's stuck. It still plays simply.

## 2026-10-24 (later): Upgrades cost materials, building and track fixes

**Materials economy** (Sébastien's call: upgrades cost money + materials)
- New basic resource: stone, from 🪨 Stone Quarries (3 per map, one 5–10 tiles from Ashford, hills preferred). Hoppers carry it. Farms are now "Wheat Farms".
- Ashford has a **store** (📦 in the top bar, Jobs panel and Ashford's info). Wood, stone, wheat, planks, bricks, flour and steel delivered to Ashford fill it, up to 100 × Ashford level of each. Stored goods aren't paid for; they pay for upgrades. Once the store is full, towns get everything.
- Costs:
  - Second+ shed: $1,500 + 30 wood
  - Shed level 2: $2,500 + 40 wood
  - Shed level 3: $5,000 + 40 planks + 30 bricks
  - Factory: $5,000 (+$2,500 for each one you own) + 40 wood + 40 stone
  - Factory level 2: $4,000 + 30 planks
  - Factory level 3: $8,000 + 30 planks + 30 bricks
  - Industry expansion level 2: $3,000 + 30 wood + 20 stone
  - Industry expansion level 3: $6,000 + 30 planks + 20 bricks
  - Found a town: $2,500 + 40 wood + 20 wheat
  - Wooden Trestle: $2,500 + 40 ties + 20 stone
- Factories now make materials: Sawmill (2 wood → planks), Brickworks (2 stone → bricks), Flour Mill (2 wheat → flour) at Ashford 2; Steel Mill and Refinery at Ashford 3. Cities still need a product (planks or flour first, from their own raw needs).
- Shed level 2 needs only wood, so you can't get stuck needing stone with no free train slot for a Hopper.

**Track and building fixes**
- Track drawing starts only when you press ON existing track (or a linked town or site). Drags that start next to the rail now move the map. Nothing is built until your finger reaches a new tile.
- An ↶ Undo track button refunds your last stroke (money, ties and free rails).
- In the Sheds, Factory and Town modes, tiles where a tap will build glow green. The Factory button shows 🔒 until Ashford level 2 and explains how to unlock it.

**Balance (8 maps × 45 min, bot)**
- Every map now progresses (7 of 8 reach Ashford level 3). Money at minute 45 averages about $56k (it was $113k before factories, and about $100k with the first factory version). Earnings at minute 45 are 2.9k–6.5k per minute.

## 2026-10-24: Factories and settlement sites

**Factories** (🏭 Factory tool, unlocks at Ashford level 2)
- Steel Mill (1 coal + 1 iron → steel $30), Furniture Works (2 wood → furniture $22), Cannery (2 food → preserves $28), Refinery (2 oil → fuel $45, Ashford 3).
- You build them on open land touching your track. They cost $5,000, +$2,500 for each one you already own. Upgrades cost $4,000 × level (max 3) and raise output from 27 to 51 per minute. Each costs $30/min to run.
- No new wagons: steel goes by Flatcar, preserves and furniture by Boxcar, fuel by Tank car.
- Dispatch: factories take raw goods only after every town the shed serves that needs that good is supplied (towns first). Delivering to your own factory pays nothing; the product pays when it is sold.
- The factory panel shows stock, who wants the product, and warnings when no source or train is in reach.

**Products are upper-tier needs**
- City (1,200+) needs 1 product, Metropolis (3,000+) needs 2. Without the product a town can't grow past 3,000 (or past 8,000 without the second one).
- A town's products follow its own raw needs: first the product of its 2nd need, then preserves. It never asks for something it can't make.
- Luxury sales: Town-size places (400+) buy small amounts of their future products at full price.

**Industry expansion** (tap a mine, camp, farm or well)
- $3,000 × level (max 3): +50% output per level and a bigger stockpile. Factories need surplus raw goods, and this is how money buys that surplus.

**Settlement sites**
- Map generation places 5 marked empty sites (🚩) that you find by scouting. You can only found a town on one of them. Old saves get sites added on load.

**Simulator**
- The bot builds factories, buys wagons for them, upgrades factories and expands industries.
- Fixed: the capital level-up counter (`lvlups`) never counted because it looked for the old "The Beacon rises" toast.

**Balance (8 maps × 45 min, bot)**
- Money at minute 30: about $18k on average (was about $49k). At minute 45: about $100k (was about $113k).
- Earnings at minute 45 are 3.3k–9.7k per minute (were 2k–5.9k), so money still piles up after about 40 minutes. Factories push the pile back by 10–15 minutes but don't remove it. Later sinks (steam coal, train aging, bridges) still need to finish the job.
- The cannery often stays idle because food is short everywhere. The bot rarely runs the steel mill because iron is hidden or out of a shed's range.

## v148 (2026-11-02)
- "Why no X yet" on town orders rewritten as one plain sentence (who makes it, where it goes and why) with fix buttons: 📌 Send it here instead, 🏗 Build a 2nd maker. No more ✅ checklists.
- Build menu: every option is one full-width card (icon, name, price, what it does). Sections Track / Raw goods / Sea / Factories; factories say "Turns wood into planks".

## v149 (2026-11-02)
- Chapter goal says "Link 4 towns or villages" (villages count) and how many are still hidden in the fog. The "every town is linked: build a Dock" hint no longer shows while towns are still hidden on the home isle.

## v150 (2026-11-02, Sébastien chose)
- Chapter stars and time goals removed (they changed nothing). Completion card shows "Done in N min".

## v151 (2026-11-02)
- "Settlement" = any hamlet/village/town/city. Chapter goals read "Link 4 settlements on X", "Fill 8 orders on X"; dock hint and island-connected card say settlements.

## v152 (2026-11-02)
- Size/population line under settlement names now sits on its own dark pill in bold cream text (was faint).

## v153 (2026-11-02)
- Wide curves are off when the corner or the squares next to it touch a station hall (stnAt), so track meets station platforms cleanly.

## v154 (2026-11-02)
- Rail painting: a tap or drag on the square just past a station hall end now works (stnBridge also paints the square hidden under the hall end). Before, you had to tap on the hamlet itself.

## v155 (2026-11-02)
- Shipwreck finds open a card (stays until OK) saying what it gave; tapping a wreck on the map shows it again (S.wrecks[].txt).

## v156 (2026-11-02)
- Docks: any coast square within 6 squares of your track (or a linked town) glows and can take a Dock; after building, the joining track is offered to confirm (planTo). trackNear()/DOCK_NEAR.

## v157 (2026-11-02, Sébastien: money too fast, too idle)
- Open orders pay full price. Steady buying after an order is filled pays STEADYP=.35 and is smaller: STEADY_T = 10+0.6*sqrt(pop)/min (was 15+0.06*pop: 375/min in a Metropolis). Unwanted surplus pays half of SURPLUS.
- Bot 20 min (seeds 4/5/6): earned/min 1729/1499/1317 -> 1019/722/762; orders 11/8/7 -> 9/7/7.
- Report shows v157, no stars.

## v158 (2026-11-02)
- Engine shed: if track leaves it facing a curve/gap, it moves beside the nearest plain straight track near Ashford (shedGood).
- Tutorial pointer: target button below/above the visible part of a card auto-scrolls into view; if scrolled away, the hand says Scroll down/up.

## v159 (2026-11-02)
- Engine shed redrawn at main-line gauge: one lead track, short fan to 3 stalls, bigger brick building.
- Old "Next frontier: find another island" popup removed (frontierTick no-op). Skip tutorial needs a second tap; chapter card offers "Resume the tutorial".

## v160 (2026-11-02, Sébastien: revamp tutorial, popups in order)
- Popups queue one at a time (NQ, OK becomes Next ›) instead of stacking into one card; duplicates dropped.
- During the tutorial, town growth is a toast; finishing the tutorial opens a Tutorial complete card listing Chapter 1 goals.
- Tutorial build lessons search up to 30 squares for a spot and skip goods with no buildable spot.

## v161 (2026-11-02, from Sébastien brief)
- Trains no longer snap between parallel tracks: on a new path (turn back, reroute) the drawn position glides to the new lane over 0.8 s (railPt offset, WeakMap). Probe jp.js on save-seb-2026-11-01: 34 jumps/90 s -> 0.

## v162 (2026-11-02, Sébastien: scouts hovering over water)
- Scouts cross open sea only by boat: from a town with open sea in the way, a linked dock in range sends a boat instead, else a toast says to build a Dock (seaBetween).
- Scouts drawn as two walkers with packs and a lantern on land, a small sailboat with wake on water (scoutFig).

## v163 (2026-11-02, brief: capitals)
- Capitals (Ashford, regional capitals): cobbled square with fountain, market stalls and people; low stone wall with corner towers, gaps over track/station/water. Towns 1,200+: church with spire (townFlair).

## v164 (2026-11-02, brief: ports and bridges)
- Bridges under track on water: double = stone arch viaduct, single 4+ squares = steel truss, short single = wooden trestle on piles; shadow on water (drawBridges).
- Docks: pilings along the pier, crates, a crane, a fishing boat bobbing at the berth (portFlair).

## v165 (2026-11-02)
- Dock: track drawn into the dock square (ties, rails, red buffer stop) from each joining side.
- Engine shed: never beside or behind other track (moves if so); lead rail reaches the near lane of double track.

## v166 (2026-11-02)
- Dock/landing taps next to a town now open the build card when the square is valid (was opening the town). portOk glows every square portSpot accepts (v156 near-track docks did not glow).

## v167 (2026-11-02)
- Cause of Marrow Cove Crossing break: the v128d load-time stnSideRepair ran on every load and deleted 107,134 (the north line's real joint) once the dock spur made the hall move. Repair no longer runs.
- planRoute only ends on a town tile along its hall (stnEntryOk); towns with an offset hall are joined via track, so a new spur no longer shifts the hall.
- One-time heal for his save (S.fx167): north line rerouted into the hall's north end (106,132-133).
- v167b: buying a map is a choice: "See its area, then buy" previews a gold circle (mapPreview/MAPPV, bar #mapBar with Buy / Try next town / Cancel); tapping another linked town or dock switches the preview; bought map areas show as faint dashed circles while previewing or scouting.

## v168 (2026-11-02)
- His game came back with the old 107,133 stub and no 106,133 (cause unclear; heal had set fx167). Second heal S.fx168. Fixed save code: saves/marrow-cove-fixed-code.txt.
- 🗺 Buy a map chip in Scout mode (mapChipGo → preview at linked town nearest screen centre); the map section on town/dock cards stays.

## v169 (2026-11-02)
- Map preview shows one circle: scout circles hidden (switches to pan), owned-map circles hidden, everything outside the area dimmed; zoom out to 0.12 so the whole circle fits.

## v170 (2026-11-02)
- Scouting: docks only send boats when open sea is in the way; a land spot lists only towns that can walk there. Map chip hides while a card is open.

## v171 (2026-11-02)
- Map bar: "Choose another place" opens a list (island chips when 2+ islands, then that island's settlements by size, docks last, owned maps greyed). mapPick/MAPPK.

## v172 (2026-11-02)
- Scouting revamp step 1 (option A, recommended; decision card pending): tap fog → dotted route from the auto-picked start (nearest walking town, or dock when sea in the way), bar Send / Start elsewhere / ✕; tapping a town changes the start; no more sticky scoutFrom; town range circles hidden while previewing. SCPV/scBar/scFit. Tutorial keeps the old flow.

## v173 (2026-11-02)
- Sébastien chose scouting option 1 + see all start lines: other possible starts drawn as pale dotted lines with ↔ labels; camera fits spot + up to 5 starts.
- Economy: growth prices × XP (1+0.3 per Railway level above 1) and new industries +30% per existing same type; industry/factory upgrades base doubled (6k/8k ×2^l); dock upgrades, fleet upgrades, fishing ×1.5. Bot seed 4 @20 min: 8 orders (was 9).

## v174 (2026-11-02)
- Outer-island specialty = its own resource S.ires[k] (iron/oil), never something Ashford Isle makes (Mossy Key said planks). Existing saves migrate S.rsp + untouched trade orders on load. Capital notice: "Only this region has it".

## v175 (2026-11-02)
- His save (save-seb-2026-11-02d.json): Mossy Key had nothing to carry (iron had no buyer; Kelpstone wants wheat+wood with no source there). Test: a lumber camp by Kelpstone got 2 trains ferrying over within 90 s.
- Industry card: "nothing buys X yet" now shows before the hopper message, naming the factory that uses it + Build button. Upgrades tab says trains are not tied to an island.

## v176–177 (2026-11-02) Cargo ships and bridges by depth
- Trains no longer cross the sea. Each island's trains stay there; train paths and fuel range stop at the shore (docks refuel).
- 🚢 Cargo ships: bought at a dock ($5k ×1.3 per ship × expansion factor), slow (0.9 squares/s) with big holds (80). They sail the sea routes between docks. Goods for another island go maker → dock (train) → ship → far dock → buyer (that island's trains). Dock drop pays like factory supply.
- Ship upgrades: ⚡ Faster ships, 📦 Bigger holds (80/120/170/240), hold types (bulk coal/iron, tanker oil/fuel, heavy-lift steel, chilled fish/shellfish). Reach = the dock's existing size upgrade.
- Fleet tab: trains per island, each with its own Buy; a new train for another island sails over on a cargo ship and stays there.
- Old saves: one free ship per existing sea route; long-haul trains became normal trains (trade orders count goods that came off a ship).
- 🌉 Bridges by water depth (squares to nearest land): 🪵 Trestle (1, span 4), 🧱 Stone viaduct (2, span 8, L2), ⚙️ Steel truss (4, span 14, L4), 🌉 Suspension (6, span 24, L6). 7+ squares from land = deep ocean, never bridgeable. In 🔧 Tech. Deeper water costs more per square. Bridge drawn by its deepest square (suspension: red towers + cables). Saves with the trestle start at Stone viaduct.

## v178 (2026-11-02) Engine shed joins the line properly
- The shed lead now curves into the main line like a turnout (toward Ashford) instead of stopping at its side.
- The shed prefers a spot where the main line runs straight 2 squares each way (no curve drawn there); falls back to the old rule when none exists yet.

## v179 (2026-11-03) Double track stays double into a station
- A double line turning into a station hall no longer squeezes to one track at the corner: station hall squares count as double for drawing (isDbl) and for train lanes (laneAt), and the hall fan opens to both lanes when either square at its end is double.

## v180 (2026-11-03) Town houses stay off water
- Town house lots skip squares of water, so shallow water next to a town is visible instead of hidden under houses (Sébastien thought the water north of Marrow Cove Crossing was grass).

## v181 (2026-11-03) Turn out of a station end; see where track cannot go
- Track may leave a station sideways from its end square when the station ends on the town square (endSideOk, town.sx); the platforms curve out to that side.
- Track mode marks squares near the network where track cannot go (red tint + sign: 🌉 needs a bridge, 🌊 deep ocean, ⛰ mountains, 🚉 station side, 🌫 fog). A refused square flashes a red X and its reason shows in the hint bar.
- Scan of both saves: every refused square near the network gives a reason; the only blockers are station sides, water needing a bridge, mountains (Foundry) and the engine shed square.

## v182 (2026-11-03) Map picker follows a tapped town
- With the "Where should the map be centred?" list open, tapping a town or dock on the map closes the list and shows that place's buy bar.

## v183 (2026-11-03)
- Maps: tap anywhere within 40 tiles of a linked town/dock to place the circle (45 tiles, 60 on sea). The bar counts hidden places inside before you pay; Buy is disabled when there are none; ⭐ Best spot jumps to the circle with most finds. A map now marks every hidden town, building spot and landmark inside it (not only those near explored land). After buying, a card lists each find with its direction.
- Offset stations (centred on a track square next to the town) keep their place when a side turn is added at the town end; the curve leaves from that end (stnTile/stnExt side.k).
- Rail painting: when a tap auto-adds the square beside a station, a toast says so.

## v184 (2026-11-03, Sébastien chose vague hint)
- Map bar no longer gives a count: "💬 Travellers say: lots of rumours / a few rumours / quiet around here". Buy is always allowed; a map that finds nothing shows "Nothing was found in this area" and refunds half.

## v185 (2026-11-03)
- HOTFIX: v183 stnTile briefly removed/re-added the side track square; draw loops iterate the track Set, so re-adding looped forever (freeze when Marrow Cove Crossing came into view). Now computed without touching track.

## v186 (2026-11-03, Sébastien: gives away too much)
- Removed ⭐ Best spot from the map bar.

## v187 (2026-11-03)
- Chapter goal "Reach <island>" while its coast is in fog: rough direction only ("Sailors speak of land to the south-east of <dock>"), Go › shows a wide dashed search area (r20, jittered from the real coast) instead of the exact spot (Sébastien chose).
- First sight of a new island coast: card explaining dock on your coast → landing on the island → cargo ship on the route (S.islSeen).

## v188 (2026-11-03, Sébastien felt stuck after expanding the wrong way)
- 💡 hint first: when 2+ linked towns wait on a factory good no linked factory makes (and its raw input is produced), "N towns are waiting on X and nobody makes them: build a <Factory>"; Go › opens Build with that factory (facGap).

## v189 (2026-11-03)
- Remove building shows the actual refund ("$X back (half its price)") on the card and in the confirm (rmBack).

## v190 (2026-11-03)
- BUG: removing a building spliced the site list, shifting site numbers held by sea routes/ships/docks (Tidewick Crossing Docks lost its route, ship button vanished). Removal now leaves an inert hidden placeholder; load-time repair re-points broken lanes to the docks nearest their path ends.
- Station platforms run on into a dock that sits right at the station end (no buffers).

## v191 (2026-11-03, Sébastien: getting a train onto a new island was not clear)
- Every building card on an island with no trains: "No trains on X yet" banner with Buy a train for X (or, without a ship, which dock to buy one at). 💡 hint for it. Island-found card gains step 4 (train for the island).

## v192 (2026-11-03, clarity audit batch 1)
- Orders board starts with "🚧 What's holding orders back": one line per stuck good (towns waiting, why, Build button for a missing factory; factory inputs only on outer islands say so; island with no maker says build one there) and islands with no trains (Buy button).
- Dock card: a route with no ship shows a banner + Buy a ship at the top.

## v193 (2026-11-05)
Muse Exploration Edition 10 adopted as base (visuals: island themes, houses, lighter rails, Atlas/Home/Rails, landmark quest, endless milestones; fixes ed. 7-10). Economy eased modestly, not Muse's full cut: start $12k, scout $150, survey $250, upkeep x0.85, train $1k up to 5 then +$250 (cap $2.5k before beacon 3). v192 sources kept as base90-v192.html / core90-v192.js.

## v194 (2026-11-05)
Survey confirm header, money checks and button now all say/check $250 (were $100). Found by Muse review.

## v195 (2026-11-05)
Scout leftovers: town picker header and Unexplored tile button say $150 (were $250); scoutAt checks $150 (was $50, could go negative). Found by Muse review.

## v196 (2026-11-05)
Bot playtest (8 seeds x 40 min): 3/8 stalled at 6-7 orders with $1-5k because the 2nd factory cost $8k at Railway level 3 (XP inflation) while income sat at ~$300/min. Factory price now: first of each kind $2,500, extra of a kind $2,500+$1,500 per factory owned, no level inflation. After: 7/8 seeds reach 9-17 orders and 3-5 factories by 40 min. Bot sim updated for Muse build (document stubs, shed avoidance): sim196.js.

## v197 (2026-11-05)
Hints: rawGap() "N towns want wood, but your Lumber Camp sends it all to the Sawmill: build another Lumber Camp" (Go opens Build); facGap now also hints when the factory input has no maker ("build a Stone Quarry first, then the Brickworks"). First dock $4,000 flat (was 4000x1.5xXP = $9,600 at Railway level 3), landing $2,500 flat. Bot sim197.js reads hints (rawGap/facGap), sells spare trains when broke, saves for a dock when the hint says so. 8 seeds x 40 min: orders 10/19/13/19/19/11/22/21, 4 docks built (v196 bot: 13/16/9/17/17/11/17/4, no docks before min 25 on most).

## v198 (2026-11-05)
5-hour bot runs (8 seeds, v197): every game plateaus by hour 2-3 (25-42 orders). Port upgrades cost u0*1.5*XP, so Harbor->Port was $49k-63k at Railway level 5-7 and the next islands (62+ tiles away, dock range 60) stayed out of reach; one seed sat at $40k unable to afford it. Port upgrades now flat: $12k/$22.5k/$45k. New islGap hint when every open order needs iron/oil from another island and no dock: build a Dock. Seed 1 had sat 4.5 h at 10 orders that way. Seed 7 went broke ($0, $211/min) from hour 3 (open).

## v199 (2026-11-05)
Stale "Trains cost a flat $500" line in the old showShed trains panel now shows live COST.train (Muse review). Label only.

## v200 (2026-11-05)
facGap hint no longer says "build a Iron Mine" for island-only goods: says iron/oil only come from other islands, build a Dock. Bot sim200.js: buys a map when hinted (aims it at the most fog 20 tiles out), chases rumours with scouts, sells worst train when broke, skips factories whose input is island-only.

## v201 (2026-11-05)
Sébastien chose ideas 1+2 (with Muse): dock range +10 tiles per Railway level above 2 (free, PORT.r getters); endless orders after Megacity (LADDER getters for L>=5: up to 3 goods the railway already makes, qty x1.25/level, reward LREW[4]x(1+.25(L-4)), TLIM x1.35, beaconCap no lock past L5); waiting/parked trains cost nothing (COST.trainWait=0, Muse idea); Factories header "$2,500 for a new kind, more for a repeat".

## v202 (2026-11-06)
Sea service: in bot games at 2 h no ship, island train or island mine was ever bought (ship ~$11k with XP, bulk holds ~$11k, island trains need a ship). Now every sea route with both ends linked gets one free cargo ship; ships carry ore and oil from the start (bulk/tanker holds free); each newly linked island gets one free train (seaAuto in tick). Steel/fuel hint names the linked island that has iron/oil: "Brackenholm has iron: build an Iron Mine there, link it to the landing, and a Steel Mill at home". Bot sim202.js builds island mines.

## v203 (2026-11-06)
Islands reached through another island (landing chained from a landing) get a direct sea route from the home dock (lanes concatenated, l.via), so their iron/oil can ship home; before, goods only crossed one lane and island-of-island mines sat full. Test on bot save: steel reached a town within 10 game-min. Bot: island track via game planRoute.

## v204 (2026-11-06)
placeBar (factory build confirm) used PRICE.fac() without the kind, so a first-of-kind factory showed the repeat price and could be disabled though the charge was $2,500. Now PRICE.fac(k). Found by Muse.

## v205 (2026-11-06)
Dock card: unlinked dock now shows "Connect to rail · $X" (it only said Not linked, map 4 bot stayed on the home island all game); name fallback; no-ship banner says link the dock and a free ship sails (instead of Buy a ship $11,000). Bot build() falls back to game planRoute.

## v206 (2026-11-07)
Factory removal refund (rmBack) used PRICE.fac() without kind and the old formula; now half of what was paid (stored as s.paid on new factories; older ones: $1,250 for first of kind, half of 2500+1500n for repeats). Found by Muse.

## v207 (2026-11-07, Sébastien: ships should cost money)
Ships flat $3,000 (holds for ore/oil included, no level/count inflation); no free ships (seaAuto keeps free bulk/tank holds, chained lanes, free first island train). No-ship banner: Buy a ship · $3,000, or link the dock first. Bot sim207.js saves for ships on linked routes and buys island trains.

## v208 (2026-11-07, Sébastien: island trains must be bought and delivered)
No free first train per island. Island trains are ordered from the engine shed (normal train price) or a spare home train is sent: it drives on the rails to the home dock (st ferry), waits for a cargo ship on that route, boards it (ship leaves at once, takes waiting goods too), crosses and rolls off at the landing. Status on the landing card and engine shed island rows (driving / waiting for a ship / at sea). Landing cards on other islands always show Order from engine shed + Send a spare.

## v209 (2026-11-07)
- Docks pass goods on: when a ship lands goods nobody on that island needs, and an island one more ship hop away does (town order, factory, capital trade order), the dock queues them for the next ship (seaFwd). Shipping plans now look two hops deep (via the home dock).
- Why: outer islands only connect to the home dock, so a capital's trade order for another outer island's iron/oil could never be filled.
- 4-h sims, 8 seeds: orders 68/77/49/84/63/80/65/67 (v208 same seeds 64/62/47/-/69/-/71/54), trade orders filled 42 vs 36 on the six shared seeds (60 on all 8).

## v210 (2026-11-07)
- 🏬 Dock warehouse upgrade (Sébastien asked): L1 serves 2 goods at once, L2 every good, L3 factory goods and capital trade orders first. Costs $4k/8k/12k × level factor. Dock card lists stored goods and goods waiting for a ship. Storage stays unlimited (never blocks ships).
- How: portSync rotates the offered good when trains already cover the current one or nobody fetched it for 20 s; arrived() swaps in the train's own good so trains sent for an earlier good still load it.

## v211 (2026-11-08) gameplay pass "Do 1-5"
- Trade orders only come from islands a ship route can reach (≤2 hops); unstarted unreachable orders swap to a reachable island; capital card says why nothing arrives (no ship route / nobody makes it / no hold).
- Island trains cost 75% of a home train; island grant (2000 + distance×30 + 500×towns, ×√XP).
- One discovery per new island (rotates): rich seam (×1.5 output tile), shipwreck ($1.5-3k), or old map (reveals sites).
- Chapter card collapses to one "Next goal" line with Go (▾ opens full card).
- Zoomed-out island labels show capital, specialty, ships, trains and trade progress.
- Sims 6 seeds × 4 h (2 timed out): orders 414 vs 402, trade orders 52 vs 48, islands 56 vs 56; more variance (s1/s2 lower, s3/s5/s7 higher).

## v212 (2026-11-09) dock leak fix, found by bots playing from Sébastien's Nov 7 save
- Bug: goods routed through a middle island (two ship hops) were never counted, so islands shipped endless stone/wood/coal/flour to Gullhaven Docks (6,500 stone piled up) and ships were busy with it. Now counted; a dock keeps a good only if its island has room for it, and piled goods move on every 5 s to a linked island that needs them.
- Docks offer first what their island still needs (factory/order/trade order with room), so iron and oil no longer wait behind a pile of wood.
- 💡 tip when the home island has no trains left.
- Sim: new sim212.js (LOAD=save.json starts from a saved game; logs 20-min stalls with reason). From his save, 5 variations x 3 h: orders 80 vs 75 (v211), completed trade orders 43 vs 24, stalls 2 short vs 4.
- Confirmation (final bot, 5 x 3 h from his save): orders 96 avg (was 75 on v211), trade orders 12 avg, all but one reach Railway level 10, 1 late stall.

## v213 (2026-11-09, Sébastien approved #2)
- One change only: the 💡 bottleneck hint names the missing input when a factory is starved ("the Steel Mill is short of 🧲 iron, bring more in") instead of "upgrade the Steel Mill". Everything else identical to v212.

## v214 (2026-11-10, Sébastien's bug reports + scouting choice)
- Station end squares: track or a building touching a station hall's end now joins automatically (the end square becomes free track: hallFill on computeNet). Fixes Gullhaven's track tail and the Tidewick dock needing a hidden 1-tile Connect.
- Dock on track: a glowing coast square with track offers ⚓ Build a Dock; the line keeps running through it.
- Scouting redrawn (he chose): drag from a linked town (land only) or a dock (water only), bendy route up to 20 squares (towns) / port range (docks). Walkers stop at the water's edge, boats stop where land begins, even under fog. Strip r3 along, r5 at the end. Old tap-the-fog flow kept only during the tutorial.

## v215 (2026-11-10)
- Bug: a train ordered for another island waited forever when the cargo ship was docked (with nothing to carry) at the far dock. Ships now sail back to fetch a waiting train.
- Wording: "Order from engine shed" → "🚂 Buy a train for <island>", plus a line saying how it gets there (engine shed → home dock → ship → landing).
- "⚓ Open <dock>" → "⚓ Go to <dock> to buy a ship".
- The "train on its way" box no longer shows twice on a landing card.

## v216 (2026-11-10, Sébastien chose direct routes + roaming ships, and 25% lower delivery pay)
- laneFill(): every linked dock gets the shortest water route (seaPath) to every dock on another island within max(portR) reach; runs every 5 s.
- Ships roam: no home dock; base = dock where it is (s.h=s.at). From any dock it sails where most goods/trains wait; empty ships sail after 6 s to the dock with most waiting goods that no other ship is heading to.
- Goods for dock d ride along to e when e is on the way (s.fw, dropped into e.ex[d]); pipe() counts them.
- ferryTick takes any ship docked at the waiting dock.
- PAY .55 -> .41.
- Test on save 11-10b, 20 game-min: ship carried 375 vs 362 (v215), Gullhaven ships straight to Wolfcross. Bot 10 min: no errors, money 1.5k at 10 min.

## v217 (2026-11-10, Sébastien asked)
- Tap a ship (pan/trains mode) opens showShip: destination + ETA or docked status, hold bar, goods for this stop and ride-along goods with their final dock, train aboard, Show/Open button.
- Sailing ships: crates coloured by good (GCOL) and up to 3 goods icons over the deck (zoom >= .9).

## v218 (2026-11-10, Sébastien asked)
- Dock card opens with a "📦 Waiting at this dock" box (goods per destination dock, landed goods, ship status, goods bound here).
- Map: crates + goods icons + total beside each dock with waiting goods (zoom >= .9).
- "N based here" changed to "N ships sail every route".

## v219 (2026-11-10, bug from his save)
- Empty roaming ship could not reach a dock on the same island as itself (no direct lane), so it sat at Gullhaven while 127 goods waited at Tidewick. It now sails one hop toward that dock and loads on the way.

## v220 (2026-11-10, Sébastien OK + asked)
- Idle train card: "📍 On <island>: nothing on your railway uses X yet: build a <factory>" (idleWhy).
- Train waiting for a ship drawn beside its dock with ⏳.
- Ship carrying a train draws the engine on deck + 🚂 tag.

## v221 (2026-11-10, Sébastien: drawing scout path hard, slides panned)
- Once a town/dock is picked, a tap or a drag starting anywhere inside the dashed circle draws (joins from the route end); drags outside the circle still pan.
- Circle is 85% of the old reach (scdR) and lightly filled; the route must stay inside it (any shape, up to 2x reach squares) instead of the old square-count limit.
- Bar text: Tap or drag anywhere inside the circle.

## v222 (2026-11-10, Sébastien)
- Scout drawing: taps outside the dashed circle do nothing (map stays navigable); drags there pan.
- Dashed drawing circle 75% of reach (was 85%).
- Buildings you can scout from: pulsing filled ring radius 2.3 squares; tapping within 2.3 squares picks it (was 1).

## v223 (2026-11-10, Sébastien screenshot)
- Route-end circle radius 5 -> 3 squares, and drawn-route scouts reveal 3 at the end (sc.r, base reveal uses sc.r||5).
- Drag draws only when it starts within 3 squares of the route end (or at the town); any other drag pans. Taps inside the dashed circle still extend.
- Scout-from rings back to 1.2 squares, tap area 1.5.

## v224 (2026-11-10, Sébastien: keep the surprise)
- Scout/boat routes can be drawn over any land or water (scdBad no longer blocks); the expedition stops at the first wrong square (scdRoute truncation) and the rest of the line is wasted.
- Once a building is picked, all other scout circles, start rings and map-purchase circles hide; only its dashed circle, the route and the end circle show.

## v225 (2026-11-10, Sébastien)
- Picked scout building keeps a green ring while drawing.
- Taps on the drawn line or on a town never change the route (Undo / ✕ do); drags starting on the line pan; a second finger (pinch) cancels the stroke and restores the route.

## v226 (2026-11-10, Sébastien: initial scout reach too long, should need upgrades)
- Drawn-route reach by level S.scL (0-4): on foot 10/15/20/28/36 squares, boats 14/20/28/38/50 (was town 20 / boats = dock sea reach, up to 2x squares).
- Upgrade button on the scout bar: $2k/5k/10k/20k x XP(). Dashed circle = 75% of reach.

## v227 (2026-11-10, Sébastien chose pay per square)
- Drawn scout routes cost (10n + n(n+1)) x XP(), boats x1.5 (scdCost); replaces flat $150 and the v226 reach upgrades (refunded once via S.fx226). Caps 36 on foot / 50 by boat per trip.
- Bar shows route cost and next-square price; Send shows the price; toolbar says Scout.

## v228 (2026-11-10, Sébastien)
- Route drawing stops at visible wrong terrain again (land for boats, water for scouts); hidden squares never block.
- Toolbar label: Scout (no $150), shows N/2 out when scouts are out.

## v229 (2026-11-10, Sébastien: lose 10%)
- Scouts/boats that stop early (hidden water/land) refund 90% of the unused squares cost when they finish (sc.ref), shown in the end toast.

## v230 (2026-11-10, Sébastien: ships never through fog)
- seaPath = seaPathR (revealed water only). laneFog() every 3 s: shorter seen route replaces a lane (not while a ship/train is on it); a lane with fog and no seen route is closed (l.off), its queued goods move to the dock (im) for trains; reopens with a toast when mapped.
- portLanes/laneOf/laneShips/drawing/seaAuto skip closed lanes; dock card explains a closed route.
- His save: Tidewick routes to Far Shore/Wolfcross closed (19 fog squares); ship carried 577 in 20 min.

## v231 (2026-11-10, Sébastien)
- Settlement site cards no longer show the island train box; Found is the first option.

## v232 (2026-11-10, Sébastien OK: ship visibility 1-4)
- Engine shed 🚢 Ships tab (shipsTab): status banner, Buy a ship (at the dock with most waiting), every ship (tap -> ship card), goods per dock, ship upgrades + hold types.
- Dock card top box: ships line + Buy (orange with reason when shipsBehind) + Fleet ›; upgrades/holds removed from dock card (link to Ships tab); fishing/scouts/routes/dock upgrade/warehouse folded under More (DOCKMORE).
- shipsBehind: no ship, train waiting with all ships at sea, or backlog > 2 holds per ship -> 💡 hint (Go opens Ships tab) + orange 🚢 badge on docks with a full hold waiting.

## v233 (2026-11-10, Sébastien: unclear where trains come from)
- islTrainOpts(k): two option rows: "⇄ Move Train N here · free" (Train N is free at/near X on home isle, drives to dock, ship to landing) and "＋ Buy a new train" (built at engine shed in Ashford, same route). Replaces Send a spare / Buy a train for X + ferryHow paragraph on dock, island and settlement cards; shed rows name the train.

## v234 (2026-11-10, Sébastien OK: declutter town cards)
- Town card (showInfo post-process, #tcard): subtitle, one status box naming the stuck order good + why + its buttons, order title + bar + compact chips (icon ✓ or got/need), then big tiles (👑 Capital & trade, 📋 Order details, 🚂 Trains & goods = old More, 🏗 Landmarks, 🗺 Area map); tapping a tile shows that section below (TTAB, survives live refresh). Industry/factory cards unchanged (already short).

## v235 (2026-11-10, Sébastien)
- Island train options: "⇄ Send a free train · no cost" (One of your trains with no job on Ashford Isle. Shipped from X to Y.) and "＋ Buy a new train" (Built in Ashford. Shipped from X to Y.); no train numbers.
- v236 (2026-11-10): town-card tiles open as their own page with ‹ Back; ▲/▼ more scroll arrows on every scrollable window (tap to scroll).
- v237 (2026-11-10, Sébastien): diesel +25% speed (was +60%); stale '+50% range' wording removed (range comes from island tender upgrades only).
- v238 (2026-11-10): per-train upgrades (fast/big/diesel) refunded + removed, all upgrades in Engine shed, Locomotive Works = all trains +10% speed; Map button menu (views + Go to search list); zoom out to 0.1 with building-type icons below 0.55; dock card tiles (fishing, scouts, routes, upgrade, warehouse, area map) with Back pages; bigger detailed industry/factory models (drawInd2/drawFac2).
- v239 (2026-11-10): fog landmark perks (ruins/ranger/mill +10% nearby industries, lighthouse +20% ship speed in 10-tile light, old halt −5% upkeep on island, falls 30%→10%), placed by terrain (poiRetype, claimed kept); big red ! + 'Needs X wagons' over blocked buildings (wagonBlock); town parks (max 3, 5k/10k/20k, orders −5% each, tile on town card); events back (fireEvent override: ≥15 min, 8-10 min gap, ≤2 active): area storms (slow ×.55), broken rail blocks both lanes, repair handcar from Engine shed/nearest town with visible repair, train/ship 30-s repairs; ⚠ alert button cycles issues; dock card: island trains + cargo ships tiles, no duplicate/jumping; factory build buttons show product icon.
- v240 (2026-11-10, Sébastien: limit scrolling everywhere): chapter page compact + tiles (Story/Islands/Level); build menu tabs + tile grid; Atlas/Tech sections as tiles with Back, landmark grid; dock card summary + tiles; Orders board tabs (Orders/Holding back/News/How) with 2-column order cards hiding delivered goods; Engine shed tabs Fleet/Train upgrades/Ships & upgrades/Goods, island dropdown, upgrade tiles, ship upgrades under Buy a ship; Map Go-to grouped by tabs; panel max-height 52%, Orders 68%.
- v241 (2026-11-10, Sébastien): repair crew parks the handcar one square back, two workers stand beside the broken rails swinging sledgehammers onto them (sparks), broken square drawn as bent rail + gap + loose sleeper instead of a red circle.
- v242 (2026-11-10, Sébastien: Goods tab confusing): shed tab renamed 📦 Deliveries; shows only stuck buildings with plain reason + fix button (buy wagon type, bigger tenders, build the factory, show factory); working routes folded under ✅ Shipping fine.
- v243 (2026-11-10, Sébastien: Refinery/Ashford cards contradicted): bottlenecks ignore producers that are wagon-blocked or full (no false 'can't keep up / upgrade'); full building with missing wagon type shows one ❗ banner + Buy wagons button; duplicate Full banner removed (#fullbox guard).
- v244 (2026-11-10, Sébastien): below zoom 1.1 towns show a chip of missing order goods (got/needed, up to 3) and docks a 📦 total + top goods chip; works with the zoomed-out icons too.
- v245 (2026-11-10): dock levels = faster loading (+50%/level, crane), berths 1-4 (ships queue), storage 150/300/500/800 (full docks get no new sea goods); general ❗ alert blockOf (wagons, fuel range, no buyer by rail, factory input can't reach) on map/⚠ list/card with fix button; parks become a 2×2 block in the town street grid (old parks migrate); factory build cards show input icons.
- v246 (2026-11-10): toolbar menus (Trains, Tech…) open on the island under the screen centre (viewIsl sets S.shI on any [data-m] tap).
- v247 (2026-11-10): tap a town order icon → showOrd page (every ingredient: got/need bar, srcOf reason); fixed v245 name clash (dockWait → dockQ for storage count) that zeroed dock 'goods waiting' lines/chips; L1 dock text 'normal loading speed'.
- v248 (2026-11-10): trade order clarity: '🤝 Trade: 🧲 0/40 from X' pill under the capital (tap → order page), island label says '→ capital', order page starts with a trade section (delivered where, travels how, why not incl. blocked producers with fix).
- v249 (2026-11-10): storms slow trains/ships to 25% (STORMSLOW, was 55%); storm drawn as 3 drifting puffy clouds + ground shadow + rain + lightning, label says ¼ speed.
- v250 (2026-11-10): trade orders only ask for goods the capital's island can't make (islMakes/troPick/troFix every 5 s; unstarted bad orders switch good or island, else dropped).
- v251 (2026-11-10): 'No buyer by rail' alert replaced: no alert if a buyer on another island is reachable by ship (goods wait for it); 'No sea route to a buyer' (Show button) or 'Nobody uses X' (build factory) otherwise.
- v252 (2026-11-10): factory 'No X can reach it' ❗ counts goods waiting at a rail-linked dock on the island (im/ex) or on a ship sailing there (false alarm on his Steel Mill with coal at Bay Landing).
- v253 (2026-11-10): alert audit vs real flow on 6 saves: factory input counts overseas producers with a ship route (Steel Mill false alarm); new ❗ No trains on island, No cargo ship (dock with waiting goods), Ships can't carry X, Sea route closed; ⚠ list groups town orders nobody makes ('📋 7 towns want steel: build a Steel Mill'); srcOf on islands says 'comes by ship' / build your own instead of 'build track' to another island.
- v254 (2026-11-10): parks: no early cut-off in the lot search, plus fallback to a free 2×2 block just past the town edge on its street grid (Cinder Bay said 'No free grass'); new no-room message.
- v255 (2026-11-10, Sébastien OK'd): open orders first across islands: goods matched only to a steady (past-order) buyer (f.pr false) are now considered for sea routes to open orders/factories overseas (his Wolfcross steel sold locally while 7 Ashford Isle cities waited).
- v256 (2026-11-10, Sébastien OK'd): island specialties (S.ispec; wood/farm/stone/coal/iron/oil/fish): +50% rate and storage for that kind there; unseen islands (S.ishape) reshaped (mountains/flat/forest) + ≥3 hidden deposits for coal/iron/oil; seen islands get best fit (specFit); ★ label; regSpec uses it. Fishing islands: fish order ×1.5, wheat ×.7 (new levels only). 🥫 Cannery (FAC.cannery fish→cans, Railway level 2); coastal cities (L3+) order canned fish when a cannery can reach them (new levels only).
- v257 (2026-11-10): 🐑 Sheep Farm (hills, 4+ pasture) → 🧶 wool; 🧵 Textile Mill (Railway level 3, wool→cloth); towns L2+ order wool / cities L3+ cloth once a farm/mill can reach (new levels only); Sheep island specialty (new games); price fix: raw buildings = base × level factor × (1+.3×owned on whole map), the old +25% frozen-at-load rule removed (was ~2.4× overcharge); refund matches.
- v257b (2026-11-10): Sheep Farm build squares glow (glow loop list missed 'wool'); hills drawn as rolling grassy mounds, track over hills drawn as a cutting with banks on the unused sides.
- v257c (2026-11-10): hills back to the old triangles (Sébastien: mounds ugly); Lookout Hill moves beside the track when rails run through it (lkOff/lkDraw: green knoll + wooden lookout tower + footpath, label above).
- v258 (2026-11-10): ADAPTIVE MISSIONS replace island chapters (S.ms: main + 2 optional sides, msCands from game state: stuck goods → build maker / factory input chain (msStep) / reach island with it; bottleneck expand; unlocked buildings; link towns; reach islands (dock first); town growth; trade orders; ship new goods). Acts = Railway level (ACTS), Mira lines (MIRA) and choices seeded per game (S.ms.seed). Rewards 400×level+200 (sides half). ↻ Another mission on the story page.
- v259 (2026-11-10, Muse/Gemini picks 1-5 + Sébastien): mission swap costs 25% of its reward; building/deposit/dock names only at zoom>=1.6 or selected (lblOn), dock size/crates/trade pill at zoom>=2.2 or selected (lblBig); goods arrows faint (.28) and >10 tiles hidden unless their building is selected; 🚃 no-train badge amber #d9902a; ☰ drawer folds Map/Atlas/Home/Rails/fullscreen (open during tutorial); soft blurred fog layer (fogSoft) replaces edge blobs.
- v260 (2026-11-10): materials pass on (GFX2: ballast gravel, wall shading, soft grass patches, factory window/chimney glow; Sébastien approved). Fog back to the old blobs (he disliked fogSoft). Houses/platform/terminus redesign (HOUSE2) in code but off pending his OK.
- v261 (2026-11-10, Sébastien approved): new houses (houseDraw), platform lamps/benches/edge (platDraw), arched glass train shed for the grand terminus (shedRoof); decorative island resource dots removed, island ground tinted by specialty soil colour (SOIL/soilTint); fog blobs have soft radial edges.
- v262 (2026-11-10): island specialty chip drawn under the info line (hid the island name); oil/iron 'no deposit' toast names the island you're viewing (said 'no oil on Ashford Isle' while on Gull Rock); once per save (S.dep262) every coal/iron/oil island gets 3+ deposits of its resource, hidden ones on explored land become visible.
- v263 (2026-11-10): blinking 🧰 marker removed; docks holding landed goods the island's trains can't carry get the ❗ 'Needs X wagons' alert with reason and Buy button (wagonBlock/blockOf for ports).
- v264 (2026-11-10): graphics round 2 on (GFX3: pine/birch trees, varied mountains, industry props, deeper sea). UI4 preview code added (off): discovery card with rarity, 🧭 Exploration view, slim HUD, ⭐ Recommended build.
- v265 (2026-11-10, Sébastien approved): UI4 on (discovery cards with rarity, 🧭 Exploration view, slim HUD with level bar, ⭐ Recommended build) and GFX4 on (engine shed skylights/water tower/coal stage, dock pier + crane + warehouse).
- v266 (2026-11-10, Sébastien OK'd the whole plugin design review, doc https://claude.ai/artifact/Dy5TuBrpRX9x6uqQvBrmS5): new games open with an Act 1 card (the old empty Chapter 1 goals list is gone, lessons say LESSON n OF 9, tutorial-complete card points to missions); toasts wait while a card or lesson is open; code cleanup removed 38 dead duplicate function copies (54 KB, bot sim byte-identical); UI5 style kit (button kinds main/train/gold/quiet/danger/tile/x tagged by a MutationObserver, serif card titles, brass panel edge, min 12.5 px text, brighter helper text, 40 px close/pin buttons in a row); SVG bottom bar with brass underline; wooden town name boards with paper size tag (townBoard); warmer fog at far zoom; Orders board = one row per town (reward, bar, missing goods, 🔨 nobody makes it, ● no train) with tap to open; side missions one line; 🔨 badge on town order icons when nothing makes the good (ordGaps); 🏛 Town projects tile on town cards: Clock Tower $15k (deliveries +10%, Town+), Market Hall $30k (+15%, City+), Tram Line $50k (orders −5%, City+), Grand Theatre $80k (+20%, Metropolis+), drawn in the street grid (stored in S.parks with pj). UI5=false restores the old look.

## v267 (2026-11-10, Sébastien approved) — smooth movement
- Lighter frames (~2× faster drawing on his save): station size/lookup (stnExt/stnAt) cached until track/sites change (max 1 s), siteAt uses a per-frame square lookup while drawing, canvas pixel ratio capped at 2.
- Trains ease: ~0.9 s to full speed after any stop or wait, slow down over the last square before a stop (easeT in the t.pos line).
- Ships follow a smoothed course through their lane squares and turn gradually (at/at0 in the ship drawing).
- Icons8 mono icon set was shown and rejected (keep colour emoji).
- window.SMOOTH=false restores old behaviour. Bot sim 3 seeds × 20 min: orders same as v266. Saves load.

## v267b (2026-11-10, Sébastien: menu pulses randomly)
- Cards re-drawn every second (live refresh) showed one frame of unstyled buttons before the UI5 style kit re-applied: the style pass now runs before the next paint (queueMicrotask instead of requestAnimationFrame in the UI5 MutationObserver).

## v267c (2026-11-10, Sébastien: buttons appear/disappear; landmark says Lighthouse but shows waterfall, then became Lookout Hill)
- Cards: the 1-s live refresh only changes which buttons a card shows after the new set held for 5 refreshes (livePanel wrapper); "Send a free train" row always shown (greyed when none free).
- Landmarks: type saved in S.poiT on first load (claimed ones used to fall back to their base type on reload); own drawings for Lighthouse, Ranger Hut, Old Windmill, Old Mine Ruins (poiArt; all drew as a waterfall).
## v268 (2026-11-11, Sébastien: "Ship it") — clearer shipping + colour/readability pass
- Dock cards: sea routes as coloured rows with goods chips (green/yellow/red edge = ships keep up / catching up / too slow); full dock = one red box with fill bar and two buttons (⬆ Bigger dock · price, 🚢 Ship · price) plus 'need $X more'. No automatic purchases (shAutoOn false; Sébastien: not an idle game). Ship rate tracking (P._r) every 5 s. Batching/priority loading tested and left off (SHIPB/SHIPP false).
- Colour: bottom bar emoji badges (shorter, 44 px), tiles tinted per position, buttons/tabs take their emoji's colour, each town has a fixed colour on its map name board and Orders row (townCol).
- Readability: tabs = one segmented bar (only open tab lit), banner() = slim chip, Engine shed island rows = name + chips + two equal buttons, upgrade tiles align buttons and lead with '→ next level' benefit, Orders hero row (closest to growing) + shared reward shown once, Tech shows railway level progress + next unlock, mission pill wraps, panels leave room under '▼ more', 'into planks' wording, Mira 'up' lines no longer repeat the goal.
## v269 (2026-11-11, Sébastien: scouting circles overwhelming; stuck list makes him guess)
- Scout mode: the big dashed range circle around every town/dock and the bought-map circles are gone (only the reach circle of the town you start drawing from shows). Start points are colour rings: 🟠 towns with a 🚶 badge, 🔵 docks with a ⛵ badge. Hint shortened to one line; 🗺 Buy a map chip sits above the hint (no overlap) and hides while you draw a route.
- Goods ⚠ Stuck list: each building names its one real cause (no wagons · out of fuel range · nobody uses it yet · factory is full with X/Y · no track to the factory on this island · factory is on another island with no dock / no sea route / dock not joined) with the matching button (Buy wagons, Upgrade factory · price, Show it, Build track, Build a dock, Open the dock, Build a factory). Buildings with the same cause are grouped in one card (goodsDiag/goodsList replace goodsFix's text).
## v270 (2026-11-11, Sébastien: resource icon hidden by train badge; storage and missing goods unclear; fuel seemed stuck on its island)
- 🚃 no-train badge on industries/factories: small, at the building's top-right corner (was drawn over the building's own good icon); stays beside the round icon when zoomed out.
- Factory card: one status line in priority order (🛑 Stopped: output store full → the reason in plain words + fix buttons + Sell; else ⚠ Short of X only when an input is under half; else Running). 📥 In / 📤 Out show storage bars n/cap (output cap 80); a full input says "full (waits for the output to move)"; "Why no X yet" only shows when the input is under half.
- outDiag(): when nothing on the track takes a good, names the towns that want it and the island they're on, then what is missing (no dock · dock without a sea route · no track to the dock · no ship hold for it), with a button. Also used in the Stuck list for products (it used to say "nothing to fix").
## v270b (2026-11-11, Sébastien: the 🚃 "no train" badge read like "there will never be a train")
- Badge is now ⏳ and means "goods waiting for a free train": shown only when 20+ goods are ready, they have somewhere to go, and no train is on its way (waitTrain). Building card opens with "⏳ N coal waiting for a free train · all your trains on <island> are busy" + Buy a train button.
## v270c (2026-11-11, Sébastien: ships stuck, nothing moving; warehouse vs dock upgrade confusing)
- Ship deadlock fixed: at a dock with ships queuing (1 berth), the ship at the berth reset its wait to 3 s at 6 s to give its turn away, so it never reached the "leave with a small load" (20 s) or "sail empty to waiting goods" step. Now, with a queue behind it, it leaves with what it has after 6 s, else sails empty to where goods wait, and only gives its turn if neither works. His save (11 ships, 13 docks): before, 5 ships sat docked for all 6 test minutes; after, every ship moves, goods shipped 1003 → 1715 and money +$64k → +$89k in 6 game-min.
- Dock card wording: Warehouse says it controls how many goods trains pick up at once and adds no storage (room comes from upgrading the dock, shows n/cap used); dock upgrade perks lead with '📦 room for N goods'.
## v270d (2026-11-11, Sébastien asked for a bug hunt)
- Bug hunt on his save (20 game-min, every train/ship tracked each second): no errors, no NaN, no ship parked over 2 min, one train idle 2 min waiting for wood (normal), all 12 factories running, +$349k, 12 orders. Bot new games (seeds 3, 7, 30 min): no errors; seed 3 bot stalls before its first Sawmill (known bot behaviour, not changed).
- Fixed: docks with no town within 16 squares were all called "Far Shore Landing" (5 in his game). They now take their island's name (Gull Rock Landing, Emberfell Landing, Thornby Landing…), numbered if repeated (farShoreFix, runs on load).
## v271 (2026-11-12, Sébastien: hard to see resources at docks, zoomed in or out)
- Every linked dock with goods shows a readable tag under it at any zoom (screen-size 11 px): 📦 total · top 3 goods with counts (top 2 when zoomed far out) · +N more; blue edge, red when the dock is full. The selected dock keeps its own detail pill; the old tiny label at zoom 2.2+ was removed (crates stay).
## v272 (2026-11-12, Sébastien chose "⭐ Rush a good at a building")
- ⭐ Rush (max 3, S.rush [{i,k,ord,n,got}]): on a town card (open order goods) or factory card (inputs) tap ⭐ next to a good. Every producer of it that reaches the building by track sends there first (nearest first, enough to cover what is left; shipPlan wrapper sets f.rush), and free trains score rush loads ×4 (autoPick). Towns: until the current order for that good is done; factories: 50 units (−20/＋20 on the Orders board). Ends by itself and toasts "⭐ Rush done".
- Orders board: "⭐ Rushes n/3" box on top with progress bars, amount buttons and ✕; flags "nothing linked by track makes it" (goods that only arrive by ship are not sped up). Map: gold ⭐ tag with the good and units left over each rushed building.
- Test on his save: Steel Mill · south of Gullhaven coal rush: 0 → 1 coal mine sending there, 34 coal arrived in 2 game-min (none before).

## v273 (2026-11-14)
- Ship rushes: a rushed good made only on another island is loaded first at the docks, ships sail for it, and the landing dock sends it on to the building. Orders board says "🚢 comes by ship from X".
- Rush fee: 30% of the delivery's normal pay (×1.5 when it comes by ship), minimum $150, shown on each ⭐ button. ＋20/−20 charge or refund per unit; cancelling refunds the undelivered share.
- v273b: rushes running at once cost more: 1st ×1.25, 2nd ×1.5, 3rd ×2 (Sébastien's numbers).

## v274 (2026-11-14): buildings never overlap
- Two yard buildings on diagonal neighbours could both draw their building on the same empty square (Sébastien's Oil Well + Refinery). The later-built one now puts its building on its other side when that side is free land (yardOf wrapper, artSq/claimed).
- Placement refuses a square when the new building, or a neighbour, would have nowhere to stand without overlapping ('No room here...'); glowing squares skip those (artFits in facSpot/indSpot/validFor).
- Existing saves fix themselves on load: his 2026-11-11 save had 3 overlaps (Oil Well/Refinery, Iron Mine/Steel Mill, Lumber Camp/Sawmill), now 0.
- v274b (Sébastien: the Oil Well's tower still poked into the Refinery's siding, and the Refinery covered its own train): building drawings are ~1.8 squares wide. artXf/artFit (replaces the fixed translate+scale in base draw): a drawing spreads sideways only onto empty land (no track, building or other drawing), rises over track/water to the north but never over another building, never covers its own siding rails (except buildings south of their siding, which stand in front as before), and shrinks (down to 70%) when boxed in. Cached ~1 s per building.
- v274c: fixed v274b's 'keep off own rails' rule for side sidings (a comment swallowed the else branch), so buildings beside a north-south siding no longer sit over the train (his Refinery at 174,98, save-seb-2026-11-14.json).

## v275 (2026-11-14): real track movement + building yards (Sébastien: "Build it as shown")
- Trains never turn round on the spot. The engine keeps its end of the train: to head back it reverses (engine pushes, white lamp at the front), backs into a junction branch and pulls away (wye), or runs round on a second track (5 s → 3.5 s, engine slides across). Planner rtPlan (Dijkstra on square+heading, ≤2 reversals); trips split into legs. Pay still uses the planned trip length (t._tl).
- New industries/factories/farms get a yard: building plus 2 loading tracks on 2×4 squares beside the line, joined at both ends, plus a locked row for upgrades (3rd track at level 2, 4th at level 3; farms grow fields instead). Signals at the yard ends: a train holds at red when every loading track is taken (no piling up). Preview shows the plot with ↻ Turn; no room → old small siding, with a warning.
- Old buildings convert once where room allows (5 of 56 on his save); the rest keep the old siding but trains back out on track.
- Track can't be laid on a yard's kept land or into its line from the side (exact reasons shown); one-tap linking plans from the yard's line ends.
- Code: src/rt275.js appended to core90.js; base90 hooks in tick, track draw, site draw, planBetween, planRoute, queue and train draw blocks.
- Bot (sim212, 20 min): about 15-20% lower income than v274c from reversing/run-round/signal time; his save matched v274c within 1%.
- v275b (Sébastien: trains slide left/right, rails appear after a train passes, corner buildings odd): old one-square sidings hold one train at a time (the second waits at the signal; no more sideways jump to a fake second lane, base90 _sl removed); run-around off (rtRAok false), trains reverse instead; junction curves persist (S.tn) and a trip's curves are drawn when the trip is planned (noteTurns wrapper, legs too); a building on a corner draws one curved track through it (side in, open end out) instead of straight lanes plus a curled spur (drawYard wrapper). His save: income same, longest signal wait 23 s, no deadlocks.

## v276 PREVIEW (2026-11-14, Sébastien: "Build it as shown. Ensure the rails are smooth like real life"): separate artifact https://claude.ai/artifact/DSGMQJfQeJaWbG7BxpgGxs, source in src-v276/ (rg276.js appended after rt275.js), build builds/railhaven-v276-preview.html (save key railhaven276p, copied from railhaven90 on first load; PREVIEW badge)
- One rail geometry (RG.pt) for trains and the map: the renderer samples ptAt+laneAt along short paths per rail piece. Turns: radius 2 squares with two straight squares each side, radius 1 with one, else tight. Junction turnouts are real curves from the main line.
- Rails per square (RG.conn): straights, plain corners, and junction turns (used turns + both turnouts for a new branch), persisted in S.tn; planner only takes existing rails (RG.ok in rtPlan, RG.bad rejects mid-trip splices). Switches are built with the track: on any track/building change, turns on the shortest line between every pair of stops are added (RG.seed).
- Every factory, lumber camp, farm and quarry without room moves once (free) to the nearest spot within 7 squares that fits a yard, with free connecting track; the old square stays as track if a line ran through it (33 moved on his save, 38 yards; 15 mines/wells stay on their deposits with a one-track siding).
- His save: income same as v275b, signal waits down from 4,215 to 401 tick-samples, longest 7 s. Bot 20 min similar to v275b.
- Not yet: station throats (towns keep their old fans), "room for more tracks" labels busy when zoomed out.
- v276b preview (2026-11-14, from his screenshots of broken tracks after importing): switches built only when a planned trip needs one (planner +10 cost for a missing turn instead of forbidding it; all-pairs seeding removed, S.tn cleared once via S.rgV=277); building moves pick the cheapest spot (line already track, ≤10 new squares, connection ≤5), prune the old spur that led nowhere and new line ends that lead nowhere; mines/wells/quarries on deposits get a yard in place (old spur lifted) when there's room (41 yards on his live save; 11 deposits + 4 boxed-in buildings keep a one-track siding). His live save converted: saves/railhaven-save-v276b.txt (save-seb-2026-11-14-live.json is the original). His save: income +2% vs v275b, longest signal wait 14 s.
- v276c: mine/quarry/well yards may run their loading tracks and line into mountain squares (freeLine allows terr 4 for mines): coal legacy 8→2 on his live save (44 yards). Code: saves/railhaven-save-v276c.txt.

## v278 preview (2026-11-14) track tidy
Sébastien: "Still seeing track issues" (screenshots from v276b). One-time tidy per save (S.rgT=278, rgTidy in rg276.js):
- 2x2 track rings left where buildings moved are removed (the loop beside the Lumber Camp).
- Short stubs (up to 3 squares) to nowhere off a junction are removed; access squares a building no longer needs (it has a yard or touches other track; not ports/depots/towns) are removed.
- Yard lines are made whole (Stone Quarry line was floating); mines that now have one way in get another yard try (yards 44 -> 49, all coal mines now have yards).
- Yard loading tracks fan out inside the yard when the line end is a junction (sL/eR in ydG), so they don't pile onto the switches.
- A single branch joining double track uses short (radius 1) turnouts, so the two lanes' curves don't spread into a web.
Test on his save: 4 game-min money 147k vs 146k v276c. Code: saves/railhaven-save-v278.txt. Images: preview/real-track/v278-before-after.png

## v279 preview (2026-11-14) mines in mountains
Sébastien: "Mines no longer look like mines mining in mountains... The mountains disappeared". Coal/iron/stone yards no longer pave over hill/mountain squares (clip in drawYd); kept row is only a dashed outline there; a timbered tunnel mouth with a tub on a narrow track and a spoil heap sits in the rock beside the building. Drawing only, no game rules changed. Image: preview/real-track/v279-mines.png

## v280 preview (2026-11-14) curves joined
Sébastien: "Tracks still disconnected in your preview image". Cause: RG.pt ran every wide (radius 1-2) curve from the wrong end, so on double track the lane offset (by path index) was applied to the mirrored point: double-lane curves ended beside the line instead of on it, and trains ran wide curves back to front. Fixed b0/b1 in RG.pt. 2 game-min on his save: $116.2k vs $115.6k. Image: preview/real-track/v280-joined.png

## v281 preview (2026-11-14)
Sébastien: more rail issues, text hidden behind buildings, trains vanish into the mountain at mines, mine platforms unused.
- Trains leaving any yard building started their next trip from the building square (rtSeen ignored the new path): they jumped into the building/mountain while loading and drove out of it. Now the trip starts where the train stands on its loading track, so trains load beside the platform and leave along the yard.
- Town name boards are drawn after buildings and trains.
- v278 tidy could lift two opposite corners of a 2x2 ring and cut the line (one place on his save, by the Tidewick quarry): rgRepair puts the corner back; the tidy now removes one corner at a time.
2 game-min on his save: $113k vs $116k (trains now really drive in and back out instead of teleporting). Image: preview/real-track/v281-fixes.png

## v282 preview (2026-11-14)
Sébastien: trains slide from one rail to another, turn around, freeze half a second; can not tap a broken train in Build mode.
- New rx282.js (appended after rg276.js): a train keeps the rail it stands on when its path changes (lx = own side or wrong line, picked to match where it is drawn); it returns to its own side at the next single-track square or over a scissors crossover on plain double track (S.xo, drawn). Checker (15 s, his save): sideways slides 97 -> 42, jumps 13 -> 8.
- Reversal stop 0.8 s -> 0.45 s.
- RG rail cache no longer rebuilt every 3 s.
- Broken rails and trains can be tapped in Build/Tech mode.
2 game-min: $114.8k, no stuck trains.

## v283 preview (2026-11-14)
- Bridge decks follow the rails (curves and double track), no more square tiles with gaps.
- Bridges can't join two islands (strait = land of 2 islands within 5 squares): dock + ship instead. Max bridge: steel truss, 3 from land / 8 squares; suspension bridge removed (saves that had it drop to truss).
- Bridge squares cost $500 / $1,500 / $3,500 by depth, upkeep $25/min each. Built bridges stay.
- Legacy farms/camps retry a yard within 12 squares (his Wheat Farm at 178,94 still has no room).
- Reverted the yard/station easing experiment (made slides worse).
