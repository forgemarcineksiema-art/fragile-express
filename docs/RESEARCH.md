# Research: best practices in idle arcade games (web and mobile)

September 2026. Four parallel reviews (about 350 searches and fetched pages): genre design, Poki
requirements and web tech, mobile monetisation and retention, UX and player complaints. Primary sources
where possible (Poki and CrazyGames documentation, publisher blogs), plus third-party game breakdowns
(arpubrothers, Azur Games, Udonis, Gamigion) and store reviews (through aggregators, so the numbers are
approximate). My own conclusions are marked as such.

## Key numbers

| What | Value | Source |
|---|---|---|
| Poki, test on 500 players | on average ≥ 3 min of play and ≥ 25% of sessions longer than 3 min | developers.poki.com/guide/player-fit-test |
| Poki, target | ≥ 65% of visits turn into play; ≥ 10 min for management games (Poki average: 70% and 6 min) | developers.poki.com/guide/how-testing-works |
| Poki, successful games | 11–20 min sessions | pocketgamer.biz (interview with Poki's COO) |
| Loading time | Stickman Hook: 29.5 s → 3.7 s raised conversion from 50% to 72%; every MB costs a few % of players | poki.com/blog/what-makes-high-quality-browser-game |
| Top 20 idle arcade (mobile) | D1 48–52%, D7 7–13%, about 25 min of play on day one | Sensor Tower and Homa (gamedevreports) |
| Monkey Mart (web) | first shop 20–25 min, the player should be "hooked" within 5–10 min; a gentler curve than on mobile | defold.com/2023/03/22/Monkey-Mart-is-bananas |
| My Perfect Hotel, 1st session | hiring 1:46, first cleaner 4:20, automated reception 9:26, hotel level about 12:00 | arpubrothers.com |

Our pacing from the simulator (first district 1:15, first worker 3:00, automation about 9 min, next
location about 20 min) sits within the genre's range. A bundle of about 800 KB (160 KB gzipped JS) is
exemplary for loading.

## What we already do in line with practice (checked in the code)

- No title screen, the player plays straight away; a visual tutorial (an arrow) instead of walls of text.
- `gameplayStart` on the first move, `gameplayStop` on pause and screens; pause on Esc, Space and P;
  keys by `KeyboardEvent.code` (works on AZERTY); arrows and space do not scroll the page.
- Rewarded ads as zones in the world (turbo ×2, helper) and ×2 offline earnings; the buttons are not
  green, they carry 🎬, and the plain option is the same size.
- A floating joystick with a dead zone and a base that follows the finger; a slight tilt = careful walk.
- The camera shows newly unlocked pads; with a tall stack it pulls back so the whole stack is visible.
- Districts have a colour and a symbol (colour-blind players); saving to `localStorage` in try/catch,
  saving on tab hide and `pagehide`; offline earnings capped at 2 h.
- Fragile parcels only appear after 3 minutes, once the basic loop is learned.
- Portrait on phones works, labels are enlarged, the corner with the Poki button is kept clear.
- 10 languages (EFIGS, Turkish, Russian, Portuguese, Polish, Dutch); 1080×1080 thumbnails without text,
  an animated 5 s one at 60 fps; a fixed simulation step (behaves the same at 144 Hz).

## Fixed immediately (Poki mismatches and technical risks)

- **Our own ad timer** ("not in the first 5 minutes") removed: Poki decides on frequency itself; a
  commercial break is also not requested at game start (the offline earnings window).
- **The "ad unavailable" message** removed: Poki requires that a failed ad gives neither a reward nor a
  message.
- **WebGL context loss** (common on phones when switching apps): the texture atlas lived only on the GPU,
  and after the context was restored the characters and parcels vanished. Now it keeps a canvas copy and
  comes back (checked with `WEBGL_lose_context`).
- **Sound on iOS**: unlocking also on `pointerup`/`touchend`/`keydown` (on touch, `pointerdown` is not a
  user gesture) and resuming from the "interrupted" state.
- **Careful walk without holding a key**: a C toggle next to Shift (an accessibility recommendation;
  holding a key is tiring).
- A small random pitch spread on repeated sounds (less tiring for the ear).

## Recommendations for Fragile Express

### P1: biggest effect on playtime and returns

Points 1–3 are already implemented (see the report, eighth round).

1. **Work left for the player after automation.** In the hits the player always has something of their
   own: VIP guests (My Perfect Hotel), robots to load every 3 min (Pizza Ready), waking workers up (Monkey
   Mart). Here workers do everything, fragile parcels included, so between automation (about 9 min) and
   moving on (about 20 min) the game turns passive. Proposal: fragile ×3 and express parcels stay with
   the player (workers skip them), which strengthens what makes us different. Needs pacing retuned in the
   simulator.
2. **A location progress bar** ("Post office 9/14") and a celebration of every stage. Burger Please added
   progress bars (together with other changes D1 rose from 44% to 50%); players want to see how far the
   goal is.
3. **A permanent "next goal" after the tutorial and bottleneck hints** ("Vans are waiting: hire a
   loader", "Rack full"). Kolibri raised retention with contextual hints pointing at the bottleneck. We
   only have an arrow to affordable milestones.
4. **Rewarded ads at the moment of need.** The most watched one in My Perfect Hotel is a cash bundle
   lying in the world. Proposals: a "cash parcel" when the player stands on a pad they cannot afford;
   "bubble wrap" (3 min with no fragile wobble, playing on our hook); the zone returning after 60–120 s.
   Poki recommends offering a reward when it is needed, and keeping the balance in check.
5. **More natural pauses for commercial breaks.** On a soft launch Poki expects at least one ad per active
   player per day; here a break happens mainly when moving location. A natural spot: a short summary
   screen after a location stage is completed (from point 2) with a "Continue" button.

### P2: depth and reasons to come back

6. **3 daily tasks and a 7-day calendar** counting days present (no streak reset), a big day-7 reward
   doubled by an ad (Supersonic, My Perfect Hotel). Tasks built on our hook: "deliver 10 fragile parcels
   without a break", "5 express parcels on time".
7. **Cosmetics**: courier caps and vests, van liveries; for milestones, day 7 of the calendar, ads
   (Monkey Mart has 20+ hats, Poki recommends cosmetics as goals).
8. **More content**: 5+ locations, each with a new parcel type (cold storage, oversized), light prestige
   ("franchise stars" as a multiplier), a periodic event. Poki promotes games that get updated.
9. **A "night shift" upgrade**: offline earnings cap 2 → 4 → 8 h (the cap is a reason to come back).

### P3: polish

10. Haptics on Android (10–20 ms on purchase and break, with a toggle; iOS Safari does not support it).
11. `prefers-reduced-motion`: turn camera shake off.
12. An option for a fixed joystick (requested in Monkey Mart reviews).
13. Weak phones: antialias off on mobile, a test on a cheap Android and a 4 GB Chromebook, `BitmapText`
    for frequently changing counters.
14. Optionally `PokiSDK.movePill()` instead of moving the coin counter; CJK fonts when adding languages.

## What to avoid (the most common player complaints)

- Frequent full-screen ads (the number one complaint across all titles) and ads that block progress.
- Sudden price walls (e.g. a jump from 5k to 80k in My Perfect Hotel).
- Workers who stand with full hands, get stuck or need constant supervision.
- Slow walking at the start, small carry capacity, long routes between stations.
- Lost progress and failed saves.
- Forced camera moves (My Perfect Hotel); our reveals of new pads last 2.4 s and only block controls for
  0.4 s, so keep it that way.
- Monotony: every location as the same loop with nothing new.

## Main sources

- Poki: developers.poki.com/guide/ (requirements-quality, sdk-overview, monetization, engagement,
  easy-access, how-testing-works, player-fit-test, web-fit-test, release-process, accounts, localization,
  game-thumbnail, your-game-page); poki.com/blog/building-web-browser-games-2026;
  poki.com/blog/what-makes-high-quality-browser-game
- CrazyGames: docs.crazygames.com (requirements/technical, requirements/ads, resources/basic-launch-metrics,
  resources/midgame-ads-pacing)
- Monkey Mart: defold.com/2023/03/22/Monkey-Mart-is-bananas/; poki.com/en/g/monkey-mart
- Breakdowns: arpubrothers.com/blog/burger-please-deconstruction-of-the-game/,
  arpubrothers.com/blog/my-perfect-hotel-arcade-idle-deconstruction/,
  pocketgamer.biz/under-the-hood-deconstructing-the-top-hypercasual-games/,
  gamigion.com/pizza-ready-by-supercent-comprehensive-breakdown/, blog.udonis.co (Burger Please, My Perfect Hotel)
- Publishers and benchmarks: supersonic.com/learn/blog/how-to-ideate-and-build-a-profitable-idle-arcade-game/,
  supersonic.com/learn/blog/getting-started-with-basic-hybrid-casual-liveops,
  gameanalytics.com/blog/making-a-hit-idle-game-eight-lessons-from-kolibri-games,
  gamedevreports.substack.com/p/sensor-tower-and-homa-games-arcade,
  unity.com/blog/understanding-the-impact-of-rewarded-ads-on-iap-retention-and-engagement
- UX and accessibility: developer.apple.com/design/human-interface-guidelines/game-controls,
  gameaccessibilityguidelines.com/full-list/, github.com/yoannmoinet/nipplejs,
  developer.android.com/develop/ui/views/haptics/haptics-principles
- Tech: webkit.org/blog/10218/, webkit.org/blog/14403/,
  developer.chrome.com/docs/web-platform/page-lifecycle-api, github.com/pixijs/pixijs/pull/12170
