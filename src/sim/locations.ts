// Location registry. JSON files are the source of truth for layout, unlock order and base prices.
import hub from '../../locations/hub.json';
import poczta from '../../locations/poczta.json';
import sortownia from '../../locations/sortownia.json';
import type { LocationJson } from './layout.ts';

export const LOCATIONS: Record<string, LocationJson> = {
  poczta: poczta as unknown as LocationJson,
  sortownia: sortownia as unknown as LocationJson,
  hub: hub as unknown as LocationJson,
};

export const FIRST_LOCATION = 'poczta';

export function getLocation(id: string): LocationJson {
  return LOCATIONS[id] ?? LOCATIONS[FIRST_LOCATION]!;
}
