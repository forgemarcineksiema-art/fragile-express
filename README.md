# Fragile Express

Parcel-sorting tycoon for Poki in the style of Monkey Mart. Carry stacks of parcels from the belt to the
shelf of their colour, then into the van of the same district. Full vans drive off and leave coins; stand on
price tags to buy upgrades, districts and workers until the depot runs itself. Fragile parcels pay ×3 but
break when the stack is taller than 3 or you run too long.

Design document: [docs/DESIGN.md](docs/DESIGN.md). Stage report: [docs/REPORT.md](docs/REPORT.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5178
npm test           # simulation + i18n tests (Vitest)
npm run pacing     # pacing simulator report for every location
npm run build      # production build in dist/ (typecheck first)
```

`npm run pacing -- poczta --seeds 5 --log` limits the report to one location, averages 5 seeds and prints
every purchase.

## Controls

- Desktop: WASD or arrows to run, hold Shift to walk carefully (no wobble). Esc, Space or P pauses.
- Touch or mouse: press anywhere and drag. A small tilt walks carefully, a full tilt runs.
- Walking into a station moves parcels or coins by itself. Standing still on a price tag pays for it.

## Code map

| Path | What it holds |
| --- | --- |
| `src/sim` | Pure TypeScript simulation with a fixed step, no rendering imports. `Warehouse` (one location), `stations.ts` (belt, shelf, dock and vans, coin pile, buy pad, rewarded floor zone), `Carrier` (stack, capacity, wobble), `Worker` (state machine over the waypoint graph), `economy.ts`, `offline.ts`, `save.ts`, `bot.ts` (the greedy player used by the pacing simulator). |
| `src/game` | PixiJS v8 renderer: Y-sorted top-down view, parcels hopping between containers, springy stack with wobble bar, characters, pads, effects, camera, input, tutorial arrow, and `Game`, which ties everything together with saving and the Poki flows. |
| `src/ui` | DOM HUD and screens: coins, turbo badge, hints, pause, offline earnings, new location, toasts. |
| `src/core` | Portable helpers: math, RNG, i18n, storage, synthesized audio. |
| `src/poki` | Poki SDK wrapper: init never blocks, gameplay events never doubled or sent during ads, rewarded only on success. |
| `src/i18n` | Dictionaries for en, pl, de, es, fr, pt, it, tr, nl, ru. |
| `locations/*.json` | Layout of each location (station positions, waypoints), unlock order, base prices, features. |
| `tools/pacing-sim` | Headless run of every location with the greedy bot and a milestone report. |

The simulation drives three things: the game, the pacing simulator and the offline-earnings estimate
(which replays the saved location headless without the player for a few minutes).

## Location files

Positions are world units (1 unit = 1 px at zoom 1). JSON places things; station shapes and zone sizes are
defined in `src/sim/layout.ts`, so every location reads the same.

- `shelves[i]` and `docks[i]` belong to district `i` (colour `i`). The first `startDistricts` are built.
- Pads use `at` (free position) or `slot: [column, row]` in the office grid (columns: player, sorter,
  loader, collector).
- `requires` lists pad ids that must be bought first; `@fragile` waits for fragile parcels.
- Upgrade pads are stage-gated: `unlock[i]` is the number of milestones (districts, hires, second vans)
  needed for level `i + 1`, then one more level every `every` stages.
- Costs: `C0 × 1.35^k × costScale`. Districts, hires and second vans share a counter per type, so the
  third hire costs `C0 × 1.35²` whichever role it is.
- `tools/fmt-location.py locations/x.json` rewrites a file with one pad per line.

## Development helpers

In `npm run dev` the console has `__dev`:

- `__dev.sim(seconds, {x, y, careful})` steps the game manually (works in a hidden tab),
- `__dev.go(x, y)` walks the player to a point, `__dev.wait(seconds)`,
- `__dev.autoplay(seconds)` lets the pacing bot play the live game,
- `__dev.location('hub', coins)` jumps to a location, `__dev.overview(0.4, x, y)` zooms out,
- `__dev.thumbnails()` stages three scenes and records the Poki store assets into `promo/`: a text-free
  static thumbnail (`thumbnail_1080.png`) and the animated thumbnail (`animated_thumbnail_1080.mp4`,
  1080×1080, 60 fps, 5 s, encoded with the browser's WebCodecs H.264 encoder and `mp4-muxer`),
- `__dev.reset()` wipes the save.

Without the Poki SDK script (offline) the dev build simulates ads with a 1.5 s overlay; add `?mockads` to
get the same in a production build.

## Poki checklist

- `PokiSDK.init()` (the game starts even if it fails) and `gameLoadingFinished()` after the atlas is built.
- `gameplayStart()` on the first movement, `gameplayStop()` on pause, screens and ads.
- `commercialBreak()` only when returning to play from pause, the offline screen or the new-location
  screen, never in the first 5 minutes of lifetime play.
- `rewardedBreak({ size })` for: offline ×2 (medium), "buy now" when at most half the price is missing
  (medium), turbo ×2 coins for 3 min (medium), helper for 3 min (small), double starting coins (large).
- Ad buttons and floor zones carry 🎬 and are purple; the regular choice is green, same size, shown at the
  same time. Floor zones show the reward and start after standing in them for 1 s.
- During ads the ticker stops, audio is muted and input is blocked. localStorage is wrapped in try/catch.
  Page scrolling and zoom gestures are blocked. No external links, splash screens or network requests
  besides the SDK script.
