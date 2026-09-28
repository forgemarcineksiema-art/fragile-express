// Pacing simulator: a greedy bot plays each location headless and we print the time to every
// milestone from the design doc. Usage: npm run pacing [-- <locationId> [--seeds N] [--log]]
import { PlayerBot } from '../../src/sim/bot.ts';
import { LOCATIONS } from '../../src/sim/locations.ts';
import type { LocationJson } from '../../src/sim/layout.ts';
import { Warehouse } from '../../src/sim/warehouse.ts';

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--') && LOCATIONS[a]);
const seedsArg = args.indexOf('--seeds');
const seeds = seedsArg >= 0 ? Number(args[seedsArg + 1]) || 3 : 3;
const showLog = args.includes('--log');

const DT = 1 / 60;
const LIMIT = 45 * 60;

interface Milestones {
  firstPurchase: number;
  firstDistrict: number;
  firstWorker: number;
  automation: number;
  complete: number;
}

const TARGETS: Milestones = { firstPurchase: 30, firstDistrict: 90, firstWorker: 180, automation: 720, complete: 1200 };
const LABELS: Record<keyof Milestones, string> = {
  firstPurchase: 'First purchase',
  firstDistrict: 'First new district',
  firstWorker: 'First worker',
  automation: 'Full automation',
  complete: 'Location complete',
};

interface Run {
  m: Milestones;
  log: string[];
  delivered: number;
  broken: number;
  earned: number;
  incomeAtAutomation: number;
}

function runOnce(loc: LocationJson, seed: number): Run {
  const wh = new Warehouse(loc, null, { seed, noAds: true });
  const m: Milestones = { firstPurchase: NaN, firstDistrict: NaN, firstWorker: NaN, automation: NaN, complete: NaN };
  const log: string[] = [];
  const bot = new PlayerBot(wh, {
    onBuy: (pad, t, cost) => {
      if (Number.isNaN(m.firstPurchase)) m.firstPurchase = t;
      if (pad.def.type === 'district' && Number.isNaN(m.firstDistrict)) m.firstDistrict = t;
      if (pad.def.type === 'hire' && Number.isNaN(m.firstWorker)) m.firstWorker = t;
      log.push(`${fmt(t)} ${pad.id}${pad.def.type === 'upgrade' ? ` L${wh.padLevel(pad)}` : ''} (${Math.round(cost)})`);
    },
  });
  let incomeAtAutomation = 0;
  let earnedAtAuto = 0;
  while (wh.time < LIMIT && !wh.complete) {
    bot.update(DT);
    wh.step(DT);
    wh.events.length = 0;
    if (Number.isNaN(m.automation) && wh.isAutomated()) {
      m.automation = wh.time;
      earnedAtAuto = wh.stats.earned;
    }
    if (!Number.isNaN(m.automation) && incomeAtAutomation === 0 && wh.time >= m.automation + 60) {
      incomeAtAutomation = wh.stats.earned - earnedAtAuto;
    }
  }
  if (wh.complete) m.complete = wh.time;
  return { m, log, delivered: wh.stats.delivered, broken: wh.stats.broken, earned: wh.stats.earned, incomeAtAutomation };
}

function fmt(t: number): string {
  if (Number.isNaN(t)) return '  --  ';
  const s = Math.round(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function median(xs: number[]): number {
  const v = xs.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  return v[Math.floor(v.length / 2)]!;
}

for (const loc of Object.values(LOCATIONS)) {
  if (only && loc.id !== only) continue;
  const runs: Run[] = [];
  for (let i = 0; i < seeds; i++) runs.push(runOnce(loc, 1000 + i * 7919));
  console.log(`\n=== ${loc.id}  (×${loc.multiplier}, ${loc.districts} districts, ${seeds} seeds) ===`);
  console.log('Milestone              median   target   delta');
  for (const k of Object.keys(TARGETS) as (keyof Milestones)[]) {
    const med = median(runs.map((r) => r.m[k]));
    const delta = Number.isNaN(med) ? '' : `${med >= TARGETS[k] ? '+' : '-'}${fmt(Math.abs(med - TARGETS[k]))}`;
    console.log(`${LABELS[k].padEnd(22)} ${fmt(med).padStart(6)}   ${fmt(TARGETS[k]).padStart(6)}   ${delta}`);
  }
  const r0 = runs[0]!;
  console.log(
    `delivered ${r0.delivered}, broken ${r0.broken}, earned ${Math.round(r0.earned)}, income 1 min after automation ${Math.round(r0.incomeAtAutomation)}/min`,
  );
  if (showLog) {
    console.log('Purchases (seed 0):');
    for (let i = 0; i < r0.log.length; i += 4) console.log('  ' + r0.log.slice(i, i + 4).join('   '));
  }
}
