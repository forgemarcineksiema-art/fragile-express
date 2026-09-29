// Dev tool: plays each location with the pacing bot and reports where a player's time goes, to find
// dull stretches: waiting at an empty belt, walking empty-handed, standing with nothing to do, and
// long gaps between purchases (price walls). Run: npx tsx tools/playtest-stats.ts
import { PlayerBot } from '../src/sim/bot.ts';
import { getLocation } from '../src/sim/locations.ts';
import { Warehouse } from '../src/sim/warehouse.ts';
import { inRect } from '../src/core/math.ts';

const DT = 1 / 60;

function fmt(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

for (const id of ['poczta', 'sortownia', 'hub']) {
  const wh = new Warehouse(getLocation(id), null, { noAds: true, seed: 7 });
  const buys: { t: number; id: string; cost: number }[] = [];
  const bot = new PlayerBot(wh, { onBuy: (pad, t, cost) => buys.push({ t, id: pad.id, cost }) });
  const LIMIT = 22 * 60;
  const time = { idle: 0, beltWait: 0, emptyWalk: 0, loadedWalk: 0, transfer: 0, onPad: 0 };
  let beltTrips = 0;
  let parcelsPerTrip = 0;
  let wasAtBelt = false;
  let atBeltStack = 0;
  for (let t = 0; t < LIMIT && !wh.complete; t += DT) {
    bot.update(DT);
    wh.step(DT);
    const p = wh.player;
    const atBelt = wh.belts.some((b) => inRect(b.geom.zone, p.x, p.y));
    const onPad = wh.pads.some((pd) => pd.visible && inRect(pd.zone, p.x, p.y));
    if (atBelt && !wasAtBelt) atBeltStack = p.stack.length;
    if (!atBelt && wasAtBelt) {
      beltTrips++;
      parcelsPerTrip += p.stack.length - atBeltStack;
    }
    wasAtBelt = atBelt;
    if (p.moving) {
      if (p.stack.length === 0 && p.coins === 0) time.emptyWalk += DT;
      else time.loadedWalk += DT;
    } else if (onPad) time.onPad += DT;
    else if (atBelt) {
      // Standing at the belt with room left while nothing is at the front = waiting for parcels.
      const b = wh.belts.find((x) => inRect(x.geom.zone, p.x, p.y))!;
      if (!p.isFull() && b.front() === null) time.beltWait += DT;
      else time.transfer += DT;
    } else if (p.transferT > -0.3) time.transfer += DT;
    else time.idle += DT;
  }
  const total = wh.time;
  const pct = (v: number): string => `${((v / total) * 100).toFixed(0)}%`;
  console.log(`\n=== ${id}: ${wh.complete ? 'complete' : 'not complete'} at ${fmt(total)}, delivered ${wh.stats.delivered}, broken ${wh.stats.broken}`);
  console.log(`  walking empty ${pct(time.emptyWalk)} | walking loaded ${pct(time.loadedWalk)} | transfers ${pct(time.transfer)} | paying ${pct(time.onPad)} | waiting at belt ${pct(time.beltWait)} | idle ${pct(time.idle)}`);
  console.log(`  belt trips ${beltTrips}, avg parcels picked per trip ${(parcelsPerTrip / Math.max(1, beltTrips)).toFixed(1)}`);
  // Longest gaps between purchases
  const gaps: { from: number; to: number; id: string; cost: number }[] = [];
  let last = 0;
  for (const b of buys) {
    gaps.push({ from: last, to: b.t, id: b.id, cost: b.cost });
    last = b.t;
  }
  gaps.sort((a, b) => b.to - b.from - (a.to - a.from));
  console.log(`  purchases ${buys.length}; longest waits for the next one:`);
  for (const g of gaps.slice(0, 4)) console.log(`    ${fmt(g.from)} -> ${fmt(g.to)} (${Math.round(g.to - g.from)} s) for ${g.id} at ${g.cost}`);
}
