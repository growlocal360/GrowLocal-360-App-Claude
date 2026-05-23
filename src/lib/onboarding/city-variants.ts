/**
 * Auto-suggest city variants + zip codes for the wizard's Site Scope step.
 * ----------------------------------------------------------------------------
 * Pure helpers — no network calls. The wizard pre-populates suggested
 * variants so the user can edit them in place rather than typing every
 * permutation by hand.
 *
 * Zip code lookup is intentionally NOT included here — accurate zip-to-city
 * data needs an authoritative source (USPS data dump, Google Places, or a
 * paid geocoding API). For Phase 1 we expose `commonZipsForCity()` as a
 * stub that returns []; the wizard treats zips as user-entered. A later
 * enhancement can wire in real lookup.
 */

import { abbrToFullState, normalizeStateAbbr } from '@/lib/utils/state-abbr';

/**
 * Generate a deduplicated list of search-query variants for a city.
 *
 * Includes:
 *   - bare city name
 *   - city + state abbreviation ("Lakewood Ranch FL")
 *   - city + full state name ("Lakewood Ranch Florida")
 *   - common local shorthand (initialism for multi-word cities — "LWR")
 *
 * @example
 *   generateCityVariants("Lakewood Ranch", "FL")
 *   // ["Lakewood Ranch", "Lakewood Ranch FL", "Lakewood Ranch Florida", "LWR"]
 *
 *   generateCityVariants("Tampa", "Florida")
 *   // ["Tampa", "Tampa FL", "Tampa Florida"]
 */
export function generateCityVariants(
  city: string | null | undefined,
  state: string | null | undefined
): string[] {
  const cityClean = (city || '').trim();
  if (!cityClean) return [];

  const stateAbbr = normalizeStateAbbr(state);
  const stateFull = stateAbbr ? abbrToFullState(stateAbbr) : null;

  const variants = new Set<string>();
  variants.add(cityClean);
  if (stateAbbr) variants.add(`${cityClean} ${stateAbbr}`);
  if (stateFull && stateFull !== stateAbbr) variants.add(`${cityClean} ${stateFull}`);

  // Initialism for multi-word cities (e.g., "Lakewood Ranch" → "LWR").
  // Only include when the city has 2+ words AND the initialism is at
  // least 2 chars — single-word cities don't get an acronym (would be
  // ambiguous, e.g., "T" for Tampa).
  const initialism = computeInitialism(cityClean);
  if (initialism && initialism.length >= 2) variants.add(initialism);

  return Array.from(variants);
}

/**
 * Stubbed zip lookup. Phase 1 returns []; wizard collects zips manually.
 * Wire to a real geocoder in a follow-up.
 */
export function commonZipsForCity(
  _city: string | null | undefined,
  _state: string | null | undefined
): string[] {
  return [];
}

// ─── Internal ────────────────────────────────────────────────────────────

function computeInitialism(city: string): string | null {
  const words = city.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 2) return null;
  return words
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}
