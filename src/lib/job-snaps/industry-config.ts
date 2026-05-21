/**
 * Industry-aware URL slug archetypes for Job Snaps.
 * ----------------------------------------------------------------------------
 * Different industries surface brand identity in URLs differently. Appliance
 * repair and HVAC sell on brand expertise ("Sub-Zero Refrigerator Defrost
 * Repair") — having the brand in the URL is a real SEO win. Plumbing,
 * pressure washing, and tree service rarely care about the equipment brand,
 * and a falsely-detected brand in the URL ("roto-rooter-drain-cleaning…")
 * is worse than no brand at all.
 *
 * This module collapses ~20 industries into 3 archetypes, each with a fixed
 * component order. A GBP-category-name → archetype lookup picks the right
 * archetype for any site based on its primary `site_categories` row.
 *
 * Each archetype's `componentOrder` is the list of slug parts in the order
 * they appear. Null/empty parts are skipped at slug-build time (graceful
 * degradation per the spec).
 */

/** The atomic slug components our snap data can supply. */
export type SlugComponentName =
  | 'brand'
  | 'equipment_type'
  | 'service_type'
  | 'primary_problem'
  | 'street_name'
  | 'city';

export interface IndustrySlugArchetype {
  /** Stable identifier — used in logging + future per-site overrides. */
  key: 'brand_led' | 'service_led' | 'brand_optional';
  /** Ordered list of components that appear in the slug. */
  componentOrder: SlugComponentName[];
  /**
   * How to handle `brand`:
   *   - 'required'  → drop entirely if brand is null (brand_led)
   *   - 'omit'      → never include brand even if AI detects one (service_led)
   *   - 'optional'  → include if present, otherwise skip (brand_optional)
   */
  brandPolicy: 'required' | 'omit' | 'optional';
}

// ── The three archetypes ────────────────────────────────────────────────

export const BRAND_LED: IndustrySlugArchetype = {
  key: 'brand_led',
  // Keyword-first: lead with brand + equipment, end with location signals.
  // E.g., sub-zero-refrigerator-defrost-repair-highfield-circle-lakewood-ranch
  componentOrder: [
    'brand',
    'equipment_type',
    'primary_problem',
    'street_name',
    'city',
  ],
  brandPolicy: 'required',
};

export const SERVICE_LED: IndustrySlugArchetype = {
  key: 'service_led',
  // Service-first; brand never appears even if the AI detects one on a
  // photographed tool (a Milwaukee drill in a plumbing photo doesn't mean
  // the customer searched for "Milwaukee drain cleaning").
  // E.g., drain-cleaning-kitchen-sink-clog-highfield-circle-lakewood-ranch
  componentOrder: [
    'service_type',
    'primary_problem',
    'street_name',
    'city',
  ],
  brandPolicy: 'omit',
};

export const BRAND_OPTIONAL: IndustrySlugArchetype = {
  key: 'brand_optional',
  // Brand-led template, but the slug builder gracefully skips the brand
  // slot when null. Used for industries where brand sometimes matters
  // (garage door opener brands, auto-repair vehicle make) but isn't
  // always present.
  // E.g., liftmaster-garage-door-opener-replacement-... OR
  //       garage-door-spring-replacement-broken-torsion-...
  componentOrder: [
    'brand',
    'service_type',
    'primary_problem',
    'street_name',
    'city',
  ],
  brandPolicy: 'optional',
};

/**
 * Default archetype when a site's GBP category doesn't match any rule.
 * Service-led is the safe fallback: never inject a falsely-detected brand
 * into the URL.
 */
export const DEFAULT_ARCHETYPE = SERVICE_LED;

// ── GBP category → archetype lookup ─────────────────────────────────────

/**
 * Lowercase normalized GBP category names → archetype.
 *
 * Match is case-insensitive substring (so "Heating Contractor" and "Heating
 * & Air Conditioning Contractor" both match "heating contractor"). Order
 * matters: the first matching rule wins, so put more specific names before
 * generic ones.
 */
const CATEGORY_RULES: Array<{ match: string; archetype: IndustrySlugArchetype }> = [
  // ── Brand-led ──────────────────────────────────────────────────────────
  { match: 'appliance repair', archetype: BRAND_LED },
  { match: 'appliance store', archetype: BRAND_LED },
  { match: 'hvac', archetype: BRAND_LED },
  { match: 'heating contractor', archetype: BRAND_LED },
  { match: 'air conditioning contractor', archetype: BRAND_LED },
  { match: 'air conditioning repair', archetype: BRAND_LED },
  { match: 'furnace repair', archetype: BRAND_LED },
  { match: 'pool cleaning', archetype: BRAND_LED },
  { match: 'pool service', archetype: BRAND_LED },
  { match: 'pool equipment', archetype: BRAND_LED },
  { match: 'electronics repair', archetype: BRAND_LED },
  { match: 'computer repair', archetype: BRAND_LED },
  { match: 'phone repair', archetype: BRAND_LED },
  { match: 'auto repair', archetype: BRAND_LED },
  { match: 'mechanic', archetype: BRAND_LED },
  { match: 'lawn mower repair', archetype: BRAND_LED },
  { match: 'small engine repair', archetype: BRAND_LED },

  // ── Brand-optional ────────────────────────────────────────────────────
  { match: 'garage door', archetype: BRAND_OPTIONAL },

  // ── Service-led (everything else falls here too, but explicit is nicer) ─
  { match: 'plumber', archetype: SERVICE_LED },
  { match: 'plumbing', archetype: SERVICE_LED },
  { match: 'pressure washing', archetype: SERVICE_LED },
  { match: 'power washing', archetype: SERVICE_LED },
  { match: 'soft washing', archetype: SERVICE_LED },
  { match: 'landscaping', archetype: SERVICE_LED },
  { match: 'landscape', archetype: SERVICE_LED },
  { match: 'lawn care', archetype: SERVICE_LED },
  { match: 'lawn service', archetype: SERVICE_LED },
  { match: 'roofing', archetype: SERVICE_LED },
  { match: 'painter', archetype: SERVICE_LED },
  { match: 'painting', archetype: SERVICE_LED },
  { match: 'cleaning service', archetype: SERVICE_LED },
  { match: 'house cleaning', archetype: SERVICE_LED },
  { match: 'commercial cleaning', archetype: SERVICE_LED },
  { match: 'pest control', archetype: SERVICE_LED },
  { match: 'exterminator', archetype: SERVICE_LED },
  { match: 'electrician', archetype: SERVICE_LED },
  { match: 'electrical contractor', archetype: SERVICE_LED },
  { match: 'carpet cleaning', archetype: SERVICE_LED },
  { match: 'upholstery cleaning', archetype: SERVICE_LED },
  { match: 'tree service', archetype: SERVICE_LED },
  { match: 'tree removal', archetype: SERVICE_LED },
  { match: 'arborist', archetype: SERVICE_LED },
  { match: 'concrete contractor', archetype: SERVICE_LED },
  { match: 'concrete', archetype: SERVICE_LED },
  { match: 'fence', archetype: SERVICE_LED },
  { match: 'window cleaning', archetype: SERVICE_LED },
  { match: 'gutter', archetype: SERVICE_LED },
  { match: 'junk removal', archetype: SERVICE_LED },
  { match: 'hauling', archetype: SERVICE_LED },
  { match: 'demolition', archetype: SERVICE_LED },
  { match: 'handyman', archetype: SERVICE_LED },
  { match: 'remodel', archetype: SERVICE_LED },
  { match: 'contractor', archetype: SERVICE_LED },
];

/**
 * Resolve an industry archetype from a site's primary GBP category name.
 *
 * Falls back to SERVICE_LED if the category doesn't match any rule —
 * safer to omit brand than to falsely include it.
 *
 * @example
 *   getIndustryArchetype('Appliance Repair Service') // BRAND_LED
 *   getIndustryArchetype('Plumber')                  // SERVICE_LED
 *   getIndustryArchetype('Garage Door Supplier')     // BRAND_OPTIONAL
 *   getIndustryArchetype(null)                       // DEFAULT_ARCHETYPE (SERVICE_LED)
 */
export function getIndustryArchetype(
  gbpCategoryName: string | null | undefined
): IndustrySlugArchetype {
  if (!gbpCategoryName) return DEFAULT_ARCHETYPE;
  const lower = gbpCategoryName.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (lower.includes(rule.match)) return rule.archetype;
  }
  return DEFAULT_ARCHETYPE;
}
