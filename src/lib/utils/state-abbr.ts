/**
 * US state name → 2-character abbreviation lookup.
 *
 * Used by the Job Snap SEO naming engine to ensure every public-facing string
 * uses the canonical 2-char abbreviation (e.g., "LA" not "Louisiana") in
 * URLs, titles, and image filenames.
 *
 * Accepts either a full state name ("Louisiana") or an existing abbreviation
 * ("LA"). Returns null for unrecognized input.
 */

const FULL_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  // Territories
  'american samoa': 'AS',
  guam: 'GU',
  'northern mariana islands': 'MP',
  'puerto rico': 'PR',
  'u.s. virgin islands': 'VI',
  'us virgin islands': 'VI',
};

const VALID_ABBRS = new Set(Object.values(FULL_NAME_TO_ABBR));

/**
 * Normalize a state input to its 2-character abbreviation.
 *
 * @param state - Full state name ("Louisiana"), abbreviation ("LA"), or null
 * @returns 2-char uppercase abbreviation, or null if unrecognized
 *
 * @example
 *   normalizeStateAbbr("Louisiana") // "LA"
 *   normalizeStateAbbr("LA")        // "LA"
 *   normalizeStateAbbr("la")        // "LA"
 *   normalizeStateAbbr(" Ohio ")    // "OH"
 *   normalizeStateAbbr(null)        // null
 *   normalizeStateAbbr("Atlantis")  // null
 */
export function normalizeStateAbbr(state: string | null | undefined): string | null {
  if (!state) return null;
  const trimmed = state.trim();
  if (!trimmed) return null;

  // Already a valid abbreviation
  if (trimmed.length === 2) {
    const upper = trimmed.toUpperCase();
    return VALID_ABBRS.has(upper) ? upper : null;
  }

  // Full name lookup (case-insensitive)
  const key = trimmed.toLowerCase();
  return FULL_NAME_TO_ABBR[key] || null;
}

/**
 * Reverse lookup: abbreviation → full state name.
 * Used for alt text where the spec calls for the full state name.
 *
 * @example
 *   abbrToFullState("LA") // "Louisiana"
 *   abbrToFullState("xx") // null
 */
export function abbrToFullState(abbr: string | null | undefined): string | null {
  if (!abbr) return null;
  const upper = abbr.trim().toUpperCase();
  if (!VALID_ABBRS.has(upper)) return null;
  for (const [name, code] of Object.entries(FULL_NAME_TO_ABBR)) {
    if (code === upper) {
      // Title-case the lookup key
      return name
        .split(' ')
        .map((w) => (w === 'of' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ');
    }
  }
  return null;
}
