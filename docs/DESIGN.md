# Fragile Express — design document

Sep 28, 2026 · @Marcin

> The original design document, translated from Polish. It describes the plan at the start of the
> project; what changed since then (XXL rules, courier orders, franchise prestige, ad flows and more) is
> recorded in [REPORT.md](REPORT.md).

## Concept and hook

Fragile Express is a tycoon in the style of Monkey Mart: you run a parcel sorting depot, carry parcels in a stack from the belt to the racks and into the vans, then automate everything with workers and machines.

- **Hook:** fragile parcels pay three times more, but they break when you carry more than three of them or run. The same risk-taking fun as Fragile Van, only in a different genre.
- **Gap on Poki:** the tycoon and idle categories are full of food, shop, mine and farm games, but there is no sorting depot or courier company among them. On phones the theme has a few proven games, so the loop is familiar while the subject is fresh on Poki ([Idle](https://poki.com/en/idle), [Tycoon](https://poki.com/en/tycoon)).
- **Shared brand:** the same van, the same parcels and the same "Fragile" name as the first game. Players searching for the brand on Google are traffic whose revenue stays with us in full ([Deal Types](https://sdk.poki.com/deals)).
- **Audience:** ages 8–16 and casual adults. The satisfaction of growing parcel stacks, filling racks and departing vans.
- **Role in the portfolio:** the main money-maker. The longest sessions, the most natural places for rewarded ads, and players come back to their saved depot.

## Gameplay loop and controls

Everything happens by walking: stepping into a station's zone moves parcels or money by itself, with no clicking. It is the same rule as in Monkey Mart, so players understand it within seconds.

1. **Unloading:** a truck drops parcels onto the belt. Each parcel has the colour of the district it is going to.
2. **Picking up:** the player walks to the end of the belt and parcels jump onto their stack, up to the carry limit (6 at the start).
3. **Sorting:** at the rack of a given colour, parcels of that colour leave the stack by themselves.
4. **Loading:** from the rack the player carries parcels to the van of their district. A full van drives off and leaves a pile of coins on the floor.
5. **Collecting money:** walking over the coin pile.
6. **Expansion:** standing on a price tag slowly takes coins until a station, worker or upgrade unlocks.

**Fragile parcels (from minute 3 of play):**

- They have a glass icon and pay three times more.
- A stack with a fragile parcel starts to wobble when it holds more than 3 parcels or when the player runs for longer than 2 seconds. A wobble bar above the head warns in advance.
- A full bar breaks the top fragile parcel: a glass sound, shards, and no payout for it.

**Controls:**

- **Desktop:** WASD or arrows to run. Holding Shift walks carefully, without wobble.
- **Mobile:** a virtual joystick anywhere on the screen. A small tilt walks, a full tilt runs.
- Esc or Space: pause.

**Camera:** top-down at a slight angle, following the player. When a new zone unlocks it briefly shows what appeared.

## Stations, workers, progression and economy

The MVP has three locations, each for about 20 minutes of play. After finishing a location the player moves to a bigger one with higher pay per parcel.

| Location | Districts | Pay multiplier | New element |
| --- | --- | --- | --- |
| Local post office | 2 | ×1 | Fragile parcels |
| City sorting centre | 4 | ×4 | Express parcels with a timer, +50% bonus |
| Regional hub | 6 | ×15 | XXL parcels: the player carries only one at a time |

**Upgrades in every location:**

- **Player:** carry capacity (6 to 20 parcels), speed, stability of a stack with fragile parcels.
- **Workers:** sorter (belt to rack), loader (rack to van), coin collector. Each has its own capacity and speed upgrades.
- **Stations:** new racks and districts, a faster belt, a second van per district, bigger van capacity (8 to 20).

**Economy (starting values):**

```latex
W = 5 \cdot M_{loc} \cdot (3 \text{ if fragile}) \qquad C_k = C_0 \cdot 1.35^{k}
```

W is the payout per parcel and C the cost of level k of an upgrade. Base costs C₀ in the first location: capacity 30, speed 40, new district 100, worker 150.

**Pacing targets (checked with the simulator):** first new district after about 90 s, first worker after about 3 min, full automation of the first location after about 12 min, moving to the second one after about 20 min.

**Offline earnings:** when every link of a location is staffed, a returning player gets earnings for the time away: half the automation rate, at most 2 hours. The main reason to come back every day.

## Monetisation

The game flows without breaks, so ads rely mainly on rewarded floor zones that the player chooses to step on. commercialBreak is used only where the player returns to play from a screen.

**commercialBreak** when returning to play: closing the pause screen, "Collect" on the offline earnings screen, "Continue" after moving to a new location. Never when opening screens. No ads in the first 5 minutes.

**rewardedBreak:**

| Place | Reward | Size | Normal alternative |
| --- | --- | --- | --- |
| Return screen | Offline earnings ×2 | medium | Collect (green) |
| Upgrade pad, not enough coins | The upgrade right away, when at most half the price is missing | medium | The player walks off the pad |
| "Turbo" zone appearing about every 3 min | Double payouts for 3 min | medium | The player walks off the zone |
| "Helper" zone | An extra worker for 3 min | small | The player walks off the zone |
| New location | Double starting coins | large | Continue (green) |

**Poki rules as in our other games:** on choice screens the normal button is green, no smaller and shown at the same time. Ad buttons and zones carry the 🎬 icon and are not green. An ad zone shows what it gives before you step in, and the ad starts only after standing in it for 1 s. The reward applies immediately and only after a completed ad. During an ad the game is paused, audio muted and input blocked.

## Poki metric targets

This is a management game, so we measure it against Poki's bar for the genre: more than 10 minutes of average playtime.

| Metric | Poki threshold | Our target | Main lever |
| --- | --- | --- | --- |
| Average playtime (Player Fit) | > 3 min | 12+ min | Unlock pacing, fragile parcels, further locations |
| Sessions over 3 min | ≥ 25% | ≥ 55% | First purchase within 30 s, first worker at 3 min |
| Conversion to play (Web Fit) | 65%+ recommended | 75%+ | The player stands at the belt right away, no menu |
| Initial size | < 8 MB | < 4 MB | Characters, parcels and depot drawn in code |
| Ads per DAU (soft release) | ≥ 1 | 2+ | Offline earnings ×2, Turbo and upgrade zones |

**What matters most in playtest recordings:** whether players discover on their own that walking moves parcels, and whether fragile parcels are fun or frustrating. If they frustrate, we raise the stack limit from 3 to 4 before changing anything else.

Sources: [How testing works](https://developers.poki.com/guide/how-testing-works), [Release Process](https://sdk.poki.com/releaseprocess).

## Technology and architecture

The same stack as our other games: TypeScript, Vite, PixiJS v8 and poki-kit. From Fragile Van we also take the code that draws the van and parcels, so the brand looks consistent.

**Key decision:** the depot simulation is a pure TypeScript module with a fixed step, independent of rendering. The same module drives three things: the game, the headless pacing simulator and the offline earnings estimate from the automation throughput.

**Code structure**

- `src/sim` — `Warehouse`, `Station` (belt, rack, van dock, buy pad), `Carrier` (shared by the player and workers: stack, capacity, wobble), `Worker` (state machine: go for parcels, take, go to the target, drop), `Economy`, `Offline`.
- `src/game` — top-down rendering sorted by Y, a parcel stack with wobble animation, joystick, camera, coin and shard effects.
- `src/ui` — HUD with coins, pause, the return screen with offline earnings, moving between locations.
- `locations/*.json` — location layout: zones, stations, buy pads in unlock order, base prices.
- `tools/pacing-sim` — a Node script in which a simple bot plays greedily (buys the cheapest available upgrade) and prints the time to each milestone from the economy section.

**Worker movement:** the location layout is open, so a graph of waypoints defined in JSON is enough instead of full pathfinding.

**Saving:** location, unlocked stations, upgrade levels, workers, coins, a timestamp for offline earnings, settings. Saved every 10 s and on every purchase, in try/catch, with a schema version.

**Languages:** a dictionary from day one. The interface relies on icons and numbers, so there is very little text.

## MVP scope and schedule

The first location (Local post office) goes to playtests around day 12. The other two are built during testing, because Player Fit mostly measures the first minutes of play.

1. **Days 1–3:** poki-kit and van code from Fragile Van, `src/sim` with the belt, racks, van dock and buy pads, the player with a stack and joystick.
2. **Days 4–7:** workers (state machine, waypoint graph), economy, pacing simulator and first tuning to the pacing targets.
3. **Days 8–12:** fragile parcels with wobble, the complete Local post office, saving, offline earnings, SDK, sounds. Upload, 10 playtest recordings, first Player Fit.
4. **Days 13–20:** fixes from the recordings (first 3 minutes first), City sorting centre with express parcels, Regional hub with XXL parcels, rewarded ads.
5. **Days 21–24:** static and animated thumbnail (a van and a wobbling stack of fragile parcels), translations, size, second Player Fit, Web Fit submission.

**Beyond the MVP:** a cargo airport with drones as a fourth location, seasonal parcels (Christmas, Halloween), character skins.

**Not in the MVP:** multiplayer, prestige with permanent bonuses, 3D graphics.

## Starting prompt for Claude Code

Before starting, export this document to `docs/DESIGN.md` and give the path to the Fragile Van repository (poki-kit and the van and parcel code). The prompt covers stage 1: the depot core and the player.

```markdown
You are building a browser game "Fragile Express" (a parcel sorting depot tycoon in the style of Monkey Mart) for Poki.com. It is the second game in the "Fragile" world after Fragile Van. You are the only programmer; I am the designer and I test the builds.

## Source of truth
The full design document is in `docs/DESIGN.md`. Read all of it before the first line of code. If something is missing or contradictory, ask instead of guessing.

## The game in short
- Top-down view. The player walks around the depot; stepping into a station's zone moves parcels or coins by itself, with no clicking.
- The unloading belt releases parcels in district colours. The player picks them up into a stack (capacity 6 at the start), drops them on the rack of their colour, then carries them to that district's van. A full van drives off and leaves a pile of coins.
- Standing on a price tag slowly takes coins and unlocks a station, worker or upgrade.
- Fragile parcels: pay ×3; a stack with a fragile parcel wobbles when it holds more than 3 parcels or the player runs longer than 2 s. A full wobble bar = the top fragile parcel breaks.
- Workers (sorter, loader, coin collector) are the same `Carrier` as the player, driven by a state machine.
- Payout: 5 × location multiplier (×3 for fragile). Cost of upgrade level k: C₀ × 1.35^k. Starting values, to be tuned.
- Controls: WASD/arrows = run, Shift = careful walk; on touch a joystick anywhere (small tilt walks, full tilt runs). Esc or Space = pause.

## Stack (do not change without asking)
TypeScript strict, Vite, PixiJS v8, Vitest. No network requests besides the Poki SDK script. Characters, parcels and the depot drawn in code. Target: build under 4 MB.

## Shared code
From the Fragile Van repository (I will give the path) copy `src/core`, `src/poki` and the code that draws the van and parcels. Do not change the poki-kit API. If something is missing, add it so it can be ported back.

## Hard Poki requirements
- 16:9 game area (base 1031×580) on desktop; full screen on phones in landscape and portrait.
- `PokiSDK.init()` (the game starts even if it fails), `gameLoadingFinished()` after loading.
- `gameplayStart()` on the player's first move, `gameplayStop()` on pause and screens. Never two identical in a row, no events during an ad.
- `commercialBreak()` only when returning to play from a screen (pause, offline earnings, new location), before `gameplayStart()`. No ads in the first 5 minutes. No timers of our own.
- `rewardedBreak({ size })`: reward only when `success === true`. On choice screens the normal button is green, no smaller, shown at the same time; ad buttons and zones carry 🎬 and are not green. An ad zone starts after standing in it for 1 s.
- During an ad the game is paused, audio muted and input blocked. localStorage in try/catch. Page scrolling blocked.
- No external links, splash screens, third-party ads or purchases.

## Architecture
- `src/sim`: pure TypeScript, fixed step, no rendering dependencies (`Warehouse`, `Station`, `Carrier`, `Worker`, `Economy`, `Offline`). Emits events to the renderer.
- `src/game`: rendering sorted by Y, the stack with wobble, joystick, camera, effects.
- `src/ui`: HUD, pause, return screen, location transitions.
- `locations/*.json`: zones, stations, buy pads in unlock order, waypoint graph, base prices.
- `tools/pacing-sim`: a Node script with a bot that greedily buys the cheapest upgrade.

## Task now: stage 1
1. Initialise the project and copy the shared code.
2. `src/sim` with tests: belt, stack with a carry limit, racks by colour, a van with capacity and departure, coin pile, buy pads that take coins over time.
3. The player with joystick and keyboard, camera, rendering of the "Local post office" location with 2 districts from the JSON file.
4. One worker type (sorter) on a state machine over the waypoint graph.
5. `tools/pacing-sim`: prints the time to the first new district, the first worker and full automation. Compare with the pacing targets in the document (90 s, 3 min, 12 min) and propose price changes.

## Definition of done for stage 1
- Simulation tests pass, the pacing simulator gives a readable report.
- The belt → rack → van → coins → purchase loop works on desktop and phone, 60 FPS with 4× CPU slowdown in Chrome.
- A short report: what works, simulator results, plan for stage 2. Do not start stage 2 without my approval.

## Way of working
Plan in points first, then code. Small commits. Code and comments in English, texts only through the i18n dictionary. If something in the design seems bad for the player, say so plainly.
```
