// Dev helper: prints what occupies the floor near the front wall of each location.
import { buildLayout, padPosition, PROP_SIZE } from '../src/sim/layout.ts';
import { getLocation } from '../src/sim/locations.ts';

for (const id of ['poczta', 'sortownia', 'hub']) {
  const loc = getLocation(id);
  const L = buildLayout(loc);
  console.log(`\n== ${id} ${L.w}x${L.h}`);
  console.log('office', JSON.stringify(L.office));
  console.log('safe', JSON.stringify(L.safe.body), 'zone', JSON.stringify(L.safe.zone));
  for (const p of loc.pads) {
    const at = padPosition(L, p);
    if (at.y > L.h - 260) console.log('pad', p.id, Math.round(at.x), Math.round(at.y));
  }
  for (const pr of loc.props ?? []) {
    const s = PROP_SIZE[pr.type as keyof typeof PROP_SIZE];
    if (pr.at[1] > L.h - 260) console.log('prop', pr.type, pr.at[0], pr.at[1], s ? `${s[0]}x${s[1]}` : '');
  }
  for (const s of L.shelves) if (s.body.y + s.body.h > L.h - 260) console.log('shelf', JSON.stringify(s.body));
  for (const d of L.docks) if (d.y > L.h - 260) console.log('dock', d.y, 'pile', JSON.stringify(d.pile));
  for (const [x, y, w, h] of loc.paint ?? []) if (y + h > L.h - 260) console.log('paint', x, y, w, h);
  if (L.courier) {
    const z = L.courier.zone;
    const hit = (r: { x: number; y: number; w: number; h: number }): boolean => r.x < z.x + z.w && z.x < r.x + r.w && r.y < z.y + z.h && z.y < r.y + r.h;
    const clashes: string[] = [];
    for (const p of loc.pads) {
      const at = padPosition(L, p);
      if (hit({ x: at.x - 45, y: at.y - 45, w: 90, h: 90 })) clashes.push(`pad ${p.id}`);
    }
    for (const r of L.extra) if (hit(r)) clashes.push(`obstacle ${JSON.stringify(r)}`);
    for (const s of L.shelves) for (const r of [s.body, s.inZone, s.outZone]) if (hit(r)) clashes.push('shelf');
    if (hit(L.office)) clashes.push('office');
    if (hit(L.safe.zone) || hit(L.safe.body)) clashes.push('safe');
    for (const [x, y, w, h] of loc.paint ?? []) if (hit({ x, y, w, h })) clashes.push('paint');
    console.log('courier zone', JSON.stringify(z), clashes.length ? 'CLASH ' + clashes.join(', ') : 'clear');
  }
}
