/**
 * Address privacy and naming utilities for Job Snaps.
 *
 * Privacy rule: house/unit numbers must never appear in public-facing
 * content — website pages, storage file names, or GBP posts.
 */

/**
 * Strips the leading house or unit number from a street address.
 * "123 Main St" → "Main St"
 * "3895 Jasmine Blvd" → "Jasmine Blvd"
 * "Main St" (no number) → "Main St"
 */
export function stripHouseNumber(address: string): string {
  return address.replace(/^\d+[-\s]\s*/, '').trim();
}

/**
 * Builds a public-safe address string from location components.
 * Strips the house number and formats as: "Street Name, City, State ZIP"
 *
 * Example: { address: "3895 Jasmine Blvd", city: "Lake Charles", state: "Louisiana", zip: "70605" }
 * → "Jasmine Blvd, Lake Charles, Louisiana 70605"
 */
export function toPublicAddress(loc: {
  address: string;
  city: string;
  state: string;
  zip: string;
}): string {
  const streetName = stripHouseNumber(loc.address);
  const cityState = [loc.city, loc.state].filter(Boolean).join(', ');
  const parts = [streetName, cityState, loc.zip].filter(Boolean);
  return parts.join(', ').replace(/, (\d{5})$/, ' $1'); // "City, State 12345" not "City, State, 12345"
}

/**
 * Slugifies a string for use in file names.
 * "Jasmine Blvd" → "jasmine-blvd"
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates a SEO-friendly, privacy-safe storage file name for a job snap image.
 * Never includes the house number. Includes service, street name, city, state, zip, and sequence.
 *
 * Example:
 *   serviceType: "Appliance Removal Service"
 *   address: "3895 Jasmine Blvd"
 *   city: "Lake Charles", state: "Louisiana", zip: "70605"
 *   sequence: 1, ext: "jpg"
 * → "appliance-removal-service-jasmine-blvd-lake-charles-louisiana-70605-1.jpg"
 */
export function toStorageFileName(opts: {
  serviceType: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  sequence: number;
  ext: string;
}): string {
  const streetName = stripHouseNumber(opts.address);
  const parts = [
    opts.serviceType,
    streetName,
    opts.city,
    opts.state,
    opts.zip,
    String(opts.sequence),
  ]
    .filter(Boolean)
    .map((p) => slugify(p!));

  return `${parts.join('-')}.${opts.ext.replace(/^\./, '')}`;
}

// ─── Privacy Mode ──────────────────────────────────────────────────────────────

export type AddressVisibility = 'street-name-only' | 'city-state-only' | 'full';

/**
 * Resolves address visibility based on job type and optional manual override.
 *   residential (default) → 'street-name-only'  (house number already stripped at publish time)
 *   commercial            → 'full'               (business addresses are typically public)
 *
 * NOTE: work_items do not yet carry a job_type column. Pass jobType=null to
 * get the default residential behaviour. When job_type is added to the DB,
 * pass it here.
 */
export function resolveAddressVisibility(
  jobType?: 'residential' | 'commercial' | null,
  override?: AddressVisibility,
): AddressVisibility {
  if (override) return override;
  return jobType === 'commercial' ? 'full' : 'street-name-only';
}

/**
 * Formats a public address string respecting the given visibility level.
 *
 * 'street-name-only' → "Main St Tampa, FL 33601"
 * 'city-state-only'  → "Tampa, FL"
 * 'full'             → same as street-name-only (house number already absent from work_items)
 *
 * `streetName` is always the already-stripped form (no house number) stored in
 * work_items.address_street_name. There is no public path to address_full from a work_item.
 */
export function formatPublicAddressWithVisibility(
  fields: {
    streetName: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  },
  visibility: AddressVisibility,
): string {
  const { streetName, city, state, zip } = fields;
  if (visibility === 'city-state-only') {
    return [city, state].filter(Boolean).join(', ');
  }
  // 'street-name-only' and 'full' both use streetName (house number already absent)
  return [streetName, city && state ? `${city}, ${state}` : null, zip]
    .filter(Boolean)
    .join(' ');
}
