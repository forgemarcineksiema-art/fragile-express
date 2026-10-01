# Fragile Express — MVP build report

As of 29.09.2026. All three locations from the design document are built, not just stage 1, because the
task was "build this game". The code is in a git repository with small commits.

## What works

- **The Monkey Mart loop:** belt → player's stack → rack in the district colour → other side of the rack →
  van → coin pile → buy pads. Everything by walking, no clicking.
- **Fragile parcels** from minute 3 in the post office (from the start in later locations): glass icon, ×3
  payout, wobble with a stack > 3 or running > 2 s, a bar above the stack, the top fragile parcel breaking
  with a glass sound, shards and camera shake. Shift or a slight stick tilt is the careful walk.
- **Express parcels** (sorting centre, hub) with a timer above the parcel and a +50% bonus, **XXL
  parcels** (hub): only one at a time.
- **Workers:** sorter, loader and coin collector on state machines over a waypoint graph from the JSON,
  each with capacity and speed upgrades.
- **Stations and upgrades:** new districts, a faster belt, a second van per district, bigger vans, player
  capacity, speed and stability.
- **Three locations:** Local post office (2 districts, ×1), City sorting centre (4, ×4), Regional hub
  (6 districts, ×15, two belts). Moving between them with a new-location screen.
- **Saving** every 10 s, on every purchase, pause and tab close; schema version and validation on load.
  **Offline earnings:** half the automation throughput computed by the same simulation, at most 2 h.
- **Poki:** init, gameLoadingFinished, gameplayStart on the first move, gameplayStop on pause, screens and
  ads, commercialBreak only when returning to play and not in the first 5 minutes, the five rewarded
  placements from the document. Checked with the real SDK in debug mode: the rewarded ad grants turbo,
  commercialBreak goes through the SDK, and the SDK keeps its own spacing.
- **Controls:** keyboard and a floating joystick anywhere on the screen (mouse too). Esc, Space or P pause
  and resume.
- **Tutorial** with an arrow and one line of text through the first loop. Afterwards the arrow points to a
  milestone the player can afford. The camera briefly shows a new district, the office and the move pad.
- **Sound:** synthesised effects (pickup with rising pitch, glass, van, horn, till) and a light music
  loop; muted during ads and in a hidden tab.
- **Languages:** en, pl, de, es, fr, pt, it, tr, nl, ru. A test checks that every dictionary has all keys
  and the same variables.
- **Tests:** 45 Vitest tests (simulation: belt, stack, racks, vans, coins, buy pads, rewarded zone, wobble,
  workers, offline, saving, navigation; i18n).

## Pacing simulator results

Greedy bot (buys the cheapest available pad, carries fragile parcels carefully), median of 5 seeds.

| Milestone | Target | Post office | Sorting centre | Hub |
| --- | --- | --- | --- | --- |
| First purchase | ~0:30 | 0:15 | 0:03 | 0:07 |
| First new district | ~1:30 | 1:27 | 4:06 | 6:22 |
| First worker | ~3:00 | 3:17 | 1:49 | 2:06 |
| Full automation | ~12:00 | 9:19 | 9:34 | 12:52 |
| Moving on | ~20:00 | 20:16 | 21:16 | last |

The bot is more efficient than a human: it does not wander, does not break fragile parcels and goes
straight back for coins. For people automation will come later, probably closer to 12 minutes. In the
sorting centre and hub I deliberately placed the new district after the first worker, because the player
already knows the loop and has starting coins.

## Price and rule changes compared to the document

- **Worker:** C₀ 150 → 120 (first sorter 100, loader 140, collector 150). At 150 the first worker came at
  3:50.
- **Upgrade gating:** each upgrade pad has an `unlock` list, i.e. the stage (number of milestones bought)
  at which its next level opens. Without it a greedy player kept buying cheap capacity, and the new district
  came after 4 minutes instead of 90 s.
- **A pad only charges while the player stands on it.** Walking across a pad takes no coins. The document
  says "standing", and accidental payments while crossing the office ate money meant for another purchase.
- **The van only accepts parcels from a rack** (sorted, with a white label). Otherwise the rack would be
  pointless, since the fastest way would be carrying straight from the belt to the van.
- **A full rack "stamps" the parcel in the player's hands.** Without it a player with a full stack of one
  colour and a full rack of that colour was stuck forever. The bot ran into this deadlock in the simulator.
- **Van trip:** 4 s on the road + 2.2 s of animation. With a longer trip the player mostly stood at the dock.
- **Bigger locations have more experienced workers** (sorting centre +1 capacity and ×1.15 speed, hub +2
  and ×1.3). Without it the sorters were the bottleneck and the belts stood full.
- **An XXL parcel pays ×6.** The document gives no rate, and it takes the whole capacity.
- **Leftover coins move to the new location** and are added to the starting coins.
- **No ads in the first 5 minutes** counts total playtime, not the session. Otherwise an ad on "Collect" on
  the return screen could never appear. The Poki SDK refuses commercialBreak before the first gameplayStart
  of a session anyway (checked in debug), so at session start "Collect" will not show an ad.
- **The hub has no move pad.** After all purchases the game simply continues.

## What may be bad for the player (said plainly)

1. **Careful walk switches wobble off completely**, as in the document. The 3-parcel limit is therefore only
   dangerous when running, and with Shift you can carry 20 fragile parcels without risk, just half as fast.
   If recordings show fragile parcels are boring, set `FRAGILE.carefulFactor` to about 0.3 in
   `src/sim/economy.ts`. If they frustrate, the document says to raise `safeCount` from 3 to 4 first.
2. **The "van only takes from a rack" rule** may not be obvious. The tutorial teaches it step by step, but
   it is worth watching recordings for anyone trying to carry parcels from the belt straight to a van.
3. **The camera reveal takes control away for about 2.4 s.** With two unlocks at once it is about 4 s.
   Readable, but it may annoy.
4. **The post office's office ends up with 12 pads.** It keeps everything in one place, but the player has
   to walk back there for every upgrade.

## Performance and size

- Build: **710 KB** (target < 4 MB). Graphics and sound entirely from code; the only network resource is the
  Poki SDK script.
- Hub under full load (131 parcels, 6 workers): logic 0.6 ms and render 1.0 ms per frame (median), 1.4 and
  2.5 ms (p95), measured in Chrome without throttling. Scaled to a 4× CPU slowdown that is about 6–16 ms,
  within the 60 FPS budget. A measurement in DevTools with throttling on still has to be done by hand,
  because the browser pane I tested in does not have that option.
- Render resolution capped at 2× devicePixelRatio. Textures live in one atlas, so sprites batch.

## What is missing

- **The Fragile Van repository.** It is not on disk, so poki-kit (`src/poki`), the van and parcel code
  (`src/game/art.ts`) and the helpers (`src/core`) were written from scratch, with no dependency on the game,
  so they can be ported over. Given the path, I will swap the van drawing for the one from Fragile Van for
  brand consistency.
- Thumbnails are recorded from the game with `__dev.thumbnails()` (`npm run dev`): a static one without text
  (`promo/thumbnail_1080.png`) and an animated one (`promo/animated_thumbnail_1080.mp4`: 1080×1080, 60 fps,
  5 s, 3 scenes: running with a wobbling stack and a break, loading and a departing van, the whole hall at
  work). Poki requirements: static ≥ 628×628 without text; animated MP4 1080×1080, ≥ 50 fps, 4–6 s, 2–3
  scenes, no UI.
- A 60 FPS measurement with 4× CPU slowdown in Chrome DevTools and a test on a real phone.
- Listening to the sounds on devices: the effects are synthesised, but I have not heard them live.

## Suggested next step

1. Upload to Poki (inspector) and 10 playtest recordings of the post office: do players discover by
   themselves that walking moves parcels, and are fragile parcels fun?
2. Tuning from the recordings, first 3 minutes first (prices in `locations/poczta.json`, constants in
   `src/sim/economy.ts`), always checked with `npm run pacing`.
3. Thumbnails, then a second Player Fit.

## Second round (after test feedback)

- **Vans:** trip shortened to 3 s, and a pallet stands by the dock. While the van is away, parcels go on
  the pallet and load themselves into the next van, so neither the player nor the loaders stand at the
  dock. Above the pallet you can see when the van returns.
- **Smoothness:** the player and workers accelerate and brake instead of changing speed in steps; the
  switch between running and careful walking is smooth. Fragile parcel rules unchanged.
- **Stack physics:** a chain of springs (each parcel follows the one below), so the stack sways when
  starting and stopping; parcels bounce on landing, drop down when a middle one is taken out, lie slightly
  askew on racks and pallets, and fall from the truck onto the belt.
- **Vans:** separate spoked wheels, suspension (the van dips with every parcel and when braking), reversing
  to the dock with lights and a beeper, exhaust on departure.
- **Characters:** hands holding the stack, hair, the loader's hard hat, leaning when running, springy steps,
  blinking, speech bubbles ("!" on a break, "$" at the till, a greeting from a new worker); when walking
  sideways the stack is held in front of the character, so the face stays visible.
- **Surroundings:** a clock, posters, a notice board, a district map and a fire extinguisher on the wall,
  light from the windows and lamps, floor scuffs, a vignette.
- **Prices retuned** for the faster loop (simulator, median of 5 runs): post office — first district 1:15,
  first worker 3:03, automation 9:12, moving on 20:34; sorting centre — moving on 18:33.

## Third round

- **Truck unloading:** the truck has a raised side door with cargo inside; a worker reaches in, turns
  around with a parcel (already the right colour and kind, because the simulation rolls the next parcel in
  advance) and hands it onto the belt. The idling engine shakes slightly and smokes.
- **Props** from the location files: forklifts, wrapped pallets and pallet stacks, tall racks with
  cartons, a snack machine, a water cooler, a bench, lockers, bins, cones, plants, a hand truck, a parcel
  scale and hatched areas on the floor. Solid props are obstacles for the player and workers.
- **Coins and payouts:** shiny coins that spin in flight; bundles of banknotes for big amounts; glints on
  piles. A van payout rains coins, and the pile grows as they land; collected coins fly to the counter,
  which counts smoothly; the collector opens the till drawer; bigger payout labels with a coin (and "×2" in
  turbo); clink and till sounds.

## Fourth round

- **Characters redone:** every role has its own outfit (hi-vis vests, the loader's coverall and hard hat,
  the collector's waistcoat and bag), shaded heads with hairstyles, caps with the logo, separate sleeves and
  forearms, coloured shoes. Faces have moods: a smile on collecting coins and buying, worry when a fragile
  stack wobbles (with a drop of sweat), shock at a break, blinking. Running kicks up little dust puffs.
- **Street in front of the building:** two lanes with a dashed line, kerbs, pavements, a zebra crossing,
  manholes, benches, bins, planters and a hydrant. Cars drive both ways; they keep their distance and brake
  behind slower ones (visual only, no effect on the game).
- **Car parks:** a staff car park behind the building (cars parked nose-in or reversed in), car parks west
  of the building between the truck lanes (cars side-on), rows of cars at the north and south ends of the
  loading yard. Car colours are random but fixed per location.
- **Loading yard:** painted bays with dock numbers, a yellow stop line, dashed queue lanes, bollards at the
  dock doors, give-way "teeth" at the exit onto the street.
- **Lamps** along the car parks, between the docks and across the street; "P" signs.
- The camera now shows more of the surroundings (world margin: right 400, top 190, bottom 230), because
  the street and car parks are close enough to be seen at the docks and by the front wall.
- Cost: about 1.4 ms per frame (unchanged), bundle 770 KB. Thumbnails re-recorded.

## Fifth round: characters from scratch

The previous models were chibi: a head as wide as the torso, big shiny eyes with blush, a side view made
from the front torso with a profile head stuck on, limbs without knees or elbows. Now:

- **Adult proportions** (about 5 heads tall), a small head with a neck, a real side profile (forehead,
  nose, chin, ear, back of the head), faces without blush or huge eyes: small eyes, brows, a nose shadow,
  a mouth.
- **Separate torso silhouettes** from the front, side and back for every outfit (the courier's polo with a
  reflective band, the sorter's hi-vis vest, the loader's dungarees, the collector's waistcoat with a tie
  and bag, the helper's hoodie), with shading.
- **Joints:** thigh–knee–shin–shoe and upper arm–elbow–forearm–hand. Body height follows the legs, so the
  planted foot stays on the ground and the body dips on a wide stride. Separate run and careful-walk
  cycles, arms swinging against the legs, far limbs darker.
- **Variety:** hairstyles (short, crop, bob, ponytail), beards, six skin tones, seven hair colours.
- **Carrying:** hands under the stack; from the side the stack is held in front so the face is visible; the
  collector carries coins in front.
- Developer tool `lab.html` (dev mode only): every role, facing and walk phase.
- Cost: about 2.3 ms per frame in the hub, bundle 782 KB. Thumbnails re-recorded.

## Sixth round: review as a player and publisher

A review of the whole game at 16:9 and fixes for what stood out most:

- **Parcels:** corrugated cardboard boxes, bigger (30×14 footprint instead of 26×12, height unchanged so
  towers do not grow). The district is on wide tape over the lid and a big sticker on the front; fragile
  ones have white tape with red stripes and a glass label, express ones yellow-black tape and a bolt,
  sorted ones a barcode label on the lid. Rack and pallet slots spaced for the new cartons.
- **Warehouse:** poured concrete floor in large slabs with saw-cut joints, stains and forklift tyre marks;
  a panelled back wall with steel columns and lamps, a plinth and framed windows; column heads on the side
  walls; steel sorting racks in the district colour; a service counter with a till; carpet tiles in the
  office.
- **Time of day** (8 minutes of play per day): morning, day, golden hour, sunset, night, dawn. Night darkens
  the surroundings (the ground through multiply blending; cars, vans, trucks and lamps through tint) while
  the warehouse stays lit; street lamps and column lamps glow, moving cars have headlights, the windows show
  the sky. Thumbnails are recorded at noon.
- **Car parks:** cars drive in along the aisle, turn into a free space and park; after a while they reverse
  (or drive) out and leave.
- A returning player finds parcels on the belt right away; milestone messages sit under the top bar instead
  of the middle of the screen.
- Cost: about 2.1–2.8 ms per frame in the hub (static ground in its own render group), bundle 794 KB.

## Seventh round: tall stacks, phones, sound, western car parks

- **Tall stacks:** while the player carries a tall tower, the camera smoothly looks up and pulls back (down
  to 0.68×) so the whole stack and the wobble bar stay on screen; it returns when the stack shrinks.
- **Phones in portrait:** world labels are created up to 1.45× larger when the screen shows the world zoomed
  out; prices on buy pads fit inside the pad; on touch screens the coin counter stays out of the corner
  where Poki shows its button.
- **Sound rewritten:** effects sound physical instead of beeps (cardboard, a marimba rising with the stack,
  FM bells for coins, a diesel van engine, air brakes, a quiet reversing beeper), the player's footsteps, a
  quiet hall ambience and crickets at night. World sounds are placed in stereo by their position on screen
  and fade out off-screen, so distant docks are not noisy; the horn only now and then. A compressor on the
  output prevents clipping. Levels balanced by offline measurement (RMS and peak of every effect). New
  music: a 100 BPM groove (drums, bass, keys, changing melodies, a 32-bar form, a breakdown every third
  pass), softer at night and muffled on pause.
- **Western car parks:** cars drive in from the access road straight into a space, then reverse out, turn
  round and leave (or drive out forwards if they reversed in earlier).
- Cost: about 2.6–3.1 ms per frame in the hub, bundle 798 KB.

## Eighth round: work for the player after automation, location progress, hints

- **Courier orders** (modelled on the courier orders in Burger Please). After the first worker is hired,
  every 30–55 s a courier walks in through a door in the front wall and stands on a mat. Above him is a
  card: 2–4 parcels from different districts (some fragile), a timer bar and the reward. The player brings
  matching parcels (from the belt or a rack); each pays 4× the van rate, and a full order adds a 50% bonus.
  When time runs out the courier leaves with no penalty. Workers do not serve him, so the player has active,
  well-paid work once the depot runs itself; fragile parcels in an order are the most valuable. Automation,
  offline earnings and simulator pacing unchanged (the bot ignores the courier, and the courier has its own
  random stream). 6 new simulation tests.
- **Goal card** under the coin counter: the location name, stages "2/9" with a bar and the next milestone
  with its price (highlighted when the player can afford it). After each stage the card pulses and
  "Stage n/m done!" appears. The card appears only after the tutorial.
- **Bottleneck hints** with an arrow to the spot: the courier is waiting, coins are lying at the dock (no
  collector), a rack is full (no loader), the belt is full (no sorter). Each shows for up to 7 s and then
  rests for 25 s.
- On narrow screens hints and messages sit under the goal card rather than over the coin counter.

## Ninth round: rewarded ads at the moment of need, natural pauses and the game itself

Ads (following Poki rules: rewards only by the player's choice, breaks only at natural pauses):
- **Cash parcel**: when the player stands on a pad with more than half its price missing (where "Buy now"
  does not apply), a cash parcel appears next to it for an ad: 40% of the price; at most once every 150 s.
- **Bubble wrap**: offered right after a break; for 3 minutes the player's fragile parcels do not wobble.
  The stack shows a clear sheet of bubble wrap, the HUD a countdown.
- **Natural pauses**: a short celebration screen after a new district and when a location first runs
  itself (never during the tutorial), after the camera reveal; the commercial break comes on "Continue".
- Bug fixed: the game container could be scrolled (the hidden joystick base stuck out of it), so after a
  click and an ad the whole view and HUD shifted up. Now `overflow: clip` and a correction every frame.

The game itself (a new tool, `tools/playtest-stats.ts`, measures where a bot player's time goes):
- **XXL no longer blocks the belt or the racks.** The old "XXL alone" rule, with a queue on the belt and a
  pile on the rack, stopped a player holding anything at all: 31% idle time in the hub, 1.4 parcels per
  trip on average. Now an XXL parcel is heavy and takes 3 places in the stack. Idle time in the hub fell to
  5%, 2.3× more parcels delivered, automation at 8 min instead of 13.5.
- **"MAX" over a full stack** – a genre standard, so you know when to go and deliver.
- **The end of the game is no longer a dead end.** After about 21 min in the hub there was nothing left to
  buy and coins piled up with no purpose. Now the hub ends with a **franchise** (prestige): you start over
  at the post office, and all earnings are permanently ×1.5 (×2, ×2.5…). The first run takes about 66 min
  (post office 20, sorting centre 19, hub 26.5), later ones go faster; a franchise star on the goal card.
- 57 tests; bundle about 800 KB.
