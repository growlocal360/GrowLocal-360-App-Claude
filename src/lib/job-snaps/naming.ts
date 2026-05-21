/**
 * Job Snap SEO Naming Engine
 * ----------------------------------------------------------------------------
 * GL360-generated SEO fields are the source of truth for every Job Snap.
 * Customer integrations consume these fields verbatim unless an explicit
 * override is configured. Do not duplicate this logic in downstream code.
 *
 * Helpers produce a canonical naming scheme across every output channel:
 *   - GL360-hosted /work/<slug> pages
 *   - External customer sites (Next.js, WordPress, HighLevel, Webflow, ...)
 *   - GBP local posts
 *   - schema.org JSON-LD
 *   - sitemap entries
 *   - future vector / entity indexing
 *
 * Naming rules (canonical templates):
 *
 *   URL slug
 *     with brand:    {city}-{service_type}-{brand}-{primary_problem}
 *     without brand: {city}-{service_type}-{primary_problem}
 *
 *   Meta title (≤120 chars)
 *     with brand:    {Brand} {Service Type} in {City}, {StateAbbr} | {Primary Problem}
 *     without brand: {Primary Problem} {Service Type} in {City}, {StateAbbr}
 *
 *   H1
 *     with brand:    {Brand} {EquipmentType||ServiceType} {Primary Problem} in {City}, {StateAbbr}
 *     without brand: {Primary Problem} {Service Type} in {City}, {StateAbbr}
 *
 *   Image filename base (no extension)
 *     with brand:    {brand}-{service_type}-{city}-{stateAbbr}-{shortId}
 *     without brand: {service_type}-{city}-{stateAbbr}-{primary_problem}-{shortId}
 *
 *   Alt text (uses full state name)
 *     with brand:    {Brand} {primary_problem} for {service_type} in {City}, {State}
 *     without brand: {Primary Problem} for {service_type} in {City}, {State}
 *
 * Consistency over randomization. Word order is never rewritten to avoid duplicates;
 * collisions are resolved by appending {short_id} only.
 */

import { randomBytes } from 'crypto';
import { abbrToFullState, normalizeStateAbbr } from '@/lib/utils/state-abbr';
import { stripHouseNumber } from '@/lib/job-snaps/address';
import {
  DEFAULT_ARCHETYPE,
  type IndustrySlugArchetype,
  type SlugComponentName,
} from '@/lib/job-snaps/industry-config';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILLER_WORDS = new Set(['and', 'the', 'for', 'near', 'a', 'an', 'of', 'in', 'on', 'at']);
const MAX_SLUG_LENGTH = 80;
const MAX_META_TITLE_LENGTH = 120;
const META_DESCRIPTION_TARGET_MIN = 140;
const META_DESCRIPTION_TARGET_MAX = 160;

// ─── Generic text helpers ─────────────────────────────────────────────────────

/**
 * Strip control chars, normalize whitespace, drop forbidden punctuation.
 * Use this on any free-text input before piping into slug/title generators.
 *
 * @example
 *   sanitizeText("  Hello,\tworld!\n")  // "Hello, world!"
 *   sanitizeText(null)                  // ""
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lowercase, hyphenate, strip non-alphanumeric, drop filler words.
 * Internal helper for slug + filename generation.
 */
function tokenize(input: string): string[] {
  return sanitizeText(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 0 && !FILLER_WORDS.has(t));
}

/**
 * Join slug parts into a single hyphenated kebab-case string.
 * De-duplicates consecutive identical tokens to avoid "dryer-dryer".
 */
function joinSlugTokens(tokens: string[]): string {
  const dedup: string[] = [];
  for (const t of tokens) {
    if (dedup[dedup.length - 1] !== t) dedup.push(t);
  }
  return dedup.join('-');
}

/**
 * Strip leading house/unit number from a public address, then take everything
 * up to the first comma. Returns the bare street name only.
 *
 * @example
 *   sanitizeStreetName("3895 Jasmine Blvd, Lake Charles, LA")  // "Jasmine Blvd"
 *   sanitizeStreetName("Kirby St")                              // "Kirby St"
 *   sanitizeStreetName(null)                                    // null
 */
export function sanitizeStreetName(addressPublic: string | null | undefined): string | null {
  if (!addressPublic) return null;
  const stripped = stripHouseNumber(addressPublic).trim();
  if (!stripped) return null;
  const streetOnly = stripped.split(',')[0]?.trim();
  return streetOnly || null;
}

/**
 * Generate a cryptographically random 4-character lowercase hex identifier.
 * Used as collision suffix on slugs and as a stable part of image filenames.
 *
 * @example
 *   generateShortId()  // "8b60"
 */
export function generateShortId(): string {
  return randomBytes(2).toString('hex');
}

// ─── normalizeStateAbbr re-export ─────────────────────────────────────────────
// Re-exported from the utility module so callers only need to import from naming.ts.
export { normalizeStateAbbr };

// ─── Brand / Client split ─────────────────────────────────────────────────────

/**
 * Split a combined "Brand / Client" value into its two distinct fields.
 *
 * Today some snaps have a single "Brand" field that ambiguously stores either
 * an equipment manufacturer (e.g., "Whirlpool") or a customer/family name
 * (e.g., "Anderson Family"). Going forward these are stored separately:
 *   - `brand` (public, equipment manufacturer)
 *   - `client_name` (internal-only, customer/family name)
 *
 * Heuristic: if the raw string contains a "/" or " - " separator, split on that.
 * If only one field is provided, prefer treating it as `brand` (forward-compatible
 * with the existing column). Callers can override after the call.
 */
export function separateBrandAndClientName(
  rawBrand: string | null | undefined,
  rawClient?: string | null | undefined
): { brand: string | null; client_name: string | null } {
  const clean = (v: string | null | undefined) => sanitizeText(v) || null;
  const cleanClient = clean(rawClient);

  if (!rawBrand) {
    return { brand: null, client_name: cleanClient };
  }

  const trimmed = sanitizeText(rawBrand);
  if (!trimmed) return { brand: null, client_name: cleanClient };

  // Combined value with explicit separator
  const splitMatch = trimmed.match(/^(.+?)\s*[\/|]\s*(.+)$/) || trimmed.match(/^(.+?)\s+-\s+(.+)$/);
  if (splitMatch) {
    return {
      brand: splitMatch[1]?.trim() || null,
      client_name: cleanClient || splitMatch[2]?.trim() || null,
    };
  }

  return { brand: trimmed, client_name: cleanClient };
}

// ─── Public location label ────────────────────────────────────────────────────

interface LocationLabelParts {
  neighborhood?: string | null;
  street_name_public?: string | null;
  city?: string | null;
  state_abbr?: string | null;
}

/**
 * Build a human-readable public location string.
 *
 * Priority order:
 *   1. neighborhood, city, state_abbr     → "Graywood, Lake Charles, LA"
 *   2. "Near <street>", city, state_abbr  → "Near Kirby St, Cleveland, OH"
 *   3. city, state_abbr                   → "Cleveland, OH"
 *   4. city                                → "Cleveland"
 *   5. state_abbr alone                    → "OH"
 *   6. ""                                  → empty string (caller handles)
 *
 * Never includes house numbers; never includes ZIP by default.
 */
export function generatePublicLocationLabel(parts: LocationLabelParts): string {
  const city = sanitizeText(parts.city);
  const stateAbbr = parts.state_abbr ? parts.state_abbr.trim().toUpperCase() : '';
  const cityState = [city, stateAbbr].filter(Boolean).join(', ');

  const neighborhood = sanitizeText(parts.neighborhood);
  if (neighborhood) {
    return [neighborhood, cityState].filter(Boolean).join(', ');
  }

  const street = sanitizeText(parts.street_name_public);
  if (street) {
    return [`Near ${street}`, cityState].filter(Boolean).join(', ');
  }

  if (cityState) return cityState;
  if (city) return city;
  if (stateAbbr) return stateAbbr;
  return '';
}

// ─── Slug + URL path ──────────────────────────────────────────────────────────

interface SlugParts {
  city: string | null;
  service_type: string | null;
  brand: string | null;
  primary_problem: string | null;
  equipment_type?: string | null;
  street_name?: string | null;
}

/**
 * Pull the value for a given slug-component name out of SlugParts.
 * Used by the industry-aware builder to walk componentOrder in sequence.
 */
function pickComponent(name: SlugComponentName, parts: SlugParts): string | null {
  switch (name) {
    case 'brand':           return parts.brand ?? null;
    case 'equipment_type':  return parts.equipment_type ?? null;
    case 'service_type':    return parts.service_type ?? null;
    case 'primary_problem': return parts.primary_problem ?? null;
    case 'street_name':     return parts.street_name ?? null;
    case 'city':            return parts.city ?? null;
    default:                return null;
  }
}

/**
 * Build the canonical kebab-case slug for a Job Snap, using an industry
 * archetype to decide which components appear and in what order.
 *
 * Templates by archetype:
 *   brand_led (Appliance, HVAC, Pool, Auto):
 *     {brand}-{equipment_type}-{primary_problem}-{street_name}-{city}
 *   service_led (Plumbing, Pressure Washing, Roofing, Tree, etc.):
 *     {service_type}-{primary_problem}-{street_name}-{city}
 *   brand_optional (Garage Door):
 *     {brand?}-{service_type}-{primary_problem}-{street_name}-{city}
 *
 * Behavior:
 *   - Lowercase, hyphenated, no special chars
 *   - Filler words stripped ("and", "the", "for", "near", ...)
 *   - Consecutive duplicate tokens collapse (e.g., "refrigerator" once,
 *     not twice when service_type and equipment_type overlap)
 *   - Empty/null components are skipped (graceful degradation)
 *   - Soft cap 80 chars at the last token boundary; hard cap 110
 *   - brandPolicy controls when brand is included:
 *       'omit'     → never (defends against false-positive AI detection)
 *       'required' → only when present; archetype skips itself if missing
 *       'optional' → include when present, skip when null
 *
 * @example
 *   generateJobSnapSlug(
 *     { city: 'Lakewood Ranch', service_type: 'Refrigerator Repair',
 *       brand: 'Sub-Zero', equipment_type: 'Refrigerator',
 *       primary_problem: 'Defrost Repair',
 *       street_name: 'Highfield Circle' },
 *     BRAND_LED
 *   )
 *   // "sub-zero-refrigerator-defrost-repair-highfield-circle-lakewood-ranch"
 */
export function generateJobSnapSlug(
  parts: SlugParts,
  archetype: IndustrySlugArchetype = DEFAULT_ARCHETYPE
): string {
  const tokens: string[] = [];
  for (const componentName of archetype.componentOrder) {
    // Skip brand entirely when archetype says so.
    if (componentName === 'brand' && archetype.brandPolicy === 'omit') continue;

    const value = pickComponent(componentName, parts);
    if (!value) continue;
    tokens.push(...tokenize(value));
  }

  let slug = joinSlugTokens(tokens);

  // Soft cap: truncate at the last complete token inside the limit.
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH);
    const lastHyphen = slug.lastIndexOf('-');
    if (lastHyphen > MAX_SLUG_LENGTH * 0.6) slug = slug.slice(0, lastHyphen);
  }
  // Hard cap (defense in depth)
  if (slug.length > 110) slug = slug.slice(0, 110).replace(/-[^-]*$/, '');

  return slug;
}

/**
 * Wrap a slug as its full public URL path.
 *
 * @example
 *   generateJobSnapUrlPath("cleveland-dryer-repair")  // "/work/cleveland-dryer-repair/"
 */
export function generateJobSnapUrlPath(slug: string): string {
  if (!slug) return '/work/';
  return `/work/${slug}/`;
}

/**
 * Resolve a slug collision by appending a sequential numeric suffix
 * (`-2`, `-3`, …), only when the candidate slug already exists on this
 * site. Word order is never rewritten — the suffix is the only change.
 *
 * The first occupied slug keeps the bare form; the next collision becomes
 * `-2`, then `-3`, etc. If `foo-2` already exists in the set, the next is
 * `-3` (skips occupied numbers).
 *
 * @example
 *   handleDuplicateSlug("cleveland-dryer-repair", new Set())
 *     // "cleveland-dryer-repair"
 *   handleDuplicateSlug("cleveland-dryer-repair", new Set(["cleveland-dryer-repair"]))
 *     // "cleveland-dryer-repair-2"
 *   handleDuplicateSlug("cleveland-dryer-repair", new Set([
 *     "cleveland-dryer-repair", "cleveland-dryer-repair-2",
 *   ]))
 *     // "cleveland-dryer-repair-3"
 */
export function handleDuplicateSlug(
  candidateSlug: string,
  siteExistingSlugs: Set<string>
): string {
  if (!siteExistingSlugs.has(candidateSlug)) return candidateSlug;
  let n = 2;
  while (siteExistingSlugs.has(`${candidateSlug}-${n}`)) n++;
  return `${candidateSlug}-${n}`;
}

// ─── Meta title ───────────────────────────────────────────────────────────────

interface MetaTitleParts {
  brand: string | null;
  service_type: string | null;
  city: string | null;
  state_abbr: string | null;
  primary_problem: string | null;
}

/**
 * Build the <title> tag value (≤120 chars).
 *
 * Templates (per spec):
 *   with brand:    {Brand} {Service Type} in {City}, {StateAbbr} | {Primary Problem}
 *   without brand: {Primary Problem} {Service Type} in {City}, {StateAbbr}
 *
 * @example
 *   generateJobSnapMetaTitle({
 *     brand: "Whirlpool", service_type: "Dryer Repair",
 *     city: "Cleveland", state_abbr: "OH", primary_problem: "Drum Roller Replacement"
 *   })
 *   // "Whirlpool Dryer Repair in Cleveland, OH | Drum Roller Replacement"
 */
export function generateJobSnapMetaTitle(parts: MetaTitleParts): string {
  const brand = titleCase(parts.brand);
  const service = titleCase(parts.service_type);
  const city = titleCase(parts.city);
  const stateAbbr = parts.state_abbr ? parts.state_abbr.trim().toUpperCase() : '';
  const problem = titleCase(parts.primary_problem);

  const cityState = [city, stateAbbr].filter(Boolean).join(', ');
  let title: string;

  if (brand && service) {
    const head = `${brand} ${service}`;
    title = cityState ? `${head} in ${cityState}` : head;
    if (problem) title += ` | ${problem}`;
  } else if (problem && service) {
    title = `${problem} ${service}`;
    if (cityState) title += ` in ${cityState}`;
  } else if (service) {
    title = service;
    if (cityState) title += ` in ${cityState}`;
  } else if (problem) {
    title = problem;
    if (cityState) title += ` in ${cityState}`;
  } else {
    title = cityState || 'Job Snap';
  }

  return title.length > MAX_META_TITLE_LENGTH ? title.slice(0, MAX_META_TITLE_LENGTH - 1) + '…' : title;
}

// ─── H1 ───────────────────────────────────────────────────────────────────────

interface H1Parts {
  brand: string | null;
  equipment_type: string | null;
  service_type: string | null;
  primary_problem: string | null;
  city: string | null;
  state_abbr: string | null;
  neighborhood?: string | null;
}

/**
 * Build the H1 heading.
 *
 * Templates (per spec):
 *   with brand:    {Brand} {EquipmentType||ServiceType} {Primary Problem} in {City}, {StateAbbr}
 *   without brand: {Primary Problem} {Service Type} in {City}, {StateAbbr}
 *
 * Optional: append " in {Neighborhood}, {City}, {StateAbbr}" when neighborhood present.
 *
 * @example
 *   generateJobSnapH1({
 *     brand: "Whirlpool", equipment_type: "Dryer", service_type: "Dryer Repair",
 *     primary_problem: "Drum Roller Replacement", city: "Cleveland", state_abbr: "OH"
 *   })
 *   // "Whirlpool Dryer Drum Roller Replacement in Cleveland, OH"
 */
export function generateJobSnapH1(parts: H1Parts): string {
  const brand = titleCase(parts.brand);
  const equipment = titleCase(parts.equipment_type);
  const service = titleCase(parts.service_type);
  const problem = titleCase(parts.primary_problem);
  const city = titleCase(parts.city);
  const stateAbbr = parts.state_abbr ? parts.state_abbr.trim().toUpperCase() : '';
  const neighborhood = titleCase(parts.neighborhood);

  const subject = brand ? equipment || service : service;
  const cityState = [city, stateAbbr].filter(Boolean).join(', ');

  let h1: string;
  if (brand) {
    h1 = [brand, subject, problem].filter(Boolean).join(' ');
  } else {
    h1 = [problem, service].filter(Boolean).join(' ');
  }

  if (neighborhood && cityState) {
    h1 += ` in ${neighborhood}, ${cityState}`;
  } else if (cityState) {
    h1 += ` in ${cityState}`;
  } else if (city) {
    h1 += ` in ${city}`;
  }

  return h1.trim() || 'Job Snap';
}

// ─── Meta description ─────────────────────────────────────────────────────────

interface MetaDescriptionParts {
  brand: string | null;
  service_type: string | null;
  primary_problem: string | null;
  city: string | null;
  state_abbr: string | null;
  public_location_label: string | null;
  description: string | null;
}

/**
 * Build a natural-language meta description (140–160 chars).
 *
 * Uses service_type + primary_problem + city/state + brand (when present),
 * borrowing from the snap's own description when it adds value.
 *
 * Never includes house numbers; never overpromises outcomes.
 */
export function generateJobSnapMetaDescription(parts: MetaDescriptionParts): string {
  const brand = titleCase(parts.brand);
  const service = titleCase(parts.service_type) || 'job';
  const problem = parts.primary_problem ? sanitizeText(parts.primary_problem).toLowerCase() : null;
  const city = titleCase(parts.city);
  const stateAbbr = parts.state_abbr ? parts.state_abbr.trim().toUpperCase() : '';
  const location = [city, stateAbbr].filter(Boolean).join(', ');

  const head = brand
    ? `See a recent ${brand} ${service.toLowerCase()}`
    : `See a recent ${service.toLowerCase()} job`;
  const locationClause = location ? ` in ${location}` : '';
  const problemClause = problem ? ` involving ${problem}` : '';
  const desc = sanitizeText(parts.description);
  const tail = desc ? `. ${truncateAtBoundary(desc, META_DESCRIPTION_TARGET_MAX - 80)}` : '.';

  let combined = `${head}${locationClause}${problemClause}${tail}`;

  // Pad to minimum length when too short (with safe filler context)
  if (combined.length < META_DESCRIPTION_TARGET_MIN && parts.public_location_label) {
    combined += ` Service area: ${parts.public_location_label}.`;
  }

  return combined.length > META_DESCRIPTION_TARGET_MAX
    ? truncateAtBoundary(combined, META_DESCRIPTION_TARGET_MAX - 1) + '…'
    : combined;
}

// ─── Image filename ───────────────────────────────────────────────────────────

interface ImageFilenameParts {
  brand: string | null;
  service_type: string | null;
  city: string | null;
  state_abbr: string | null;
  primary_problem: string | null;
  short_id: string;
}

/**
 * Build the SEO-safe image filename base (no extension, no index).
 *
 * Templates (per spec):
 *   with brand:    {brand}-{service_type}-{city}-{stateAbbr}-{shortId}
 *   without brand: {service_type}-{city}-{stateAbbr}-{primary_problem}-{shortId}
 *
 * Per-image filenames are derived by callers as `${base}-${index}.${ext}`.
 *
 * @example
 *   generateJobSnapImageFilename({
 *     brand: "Whirlpool", service_type: "Dryer Repair",
 *     city: "Cleveland", state_abbr: "OH",
 *     primary_problem: "Drum Roller Replacement", short_id: "8b60"
 *   })
 *   // "whirlpool-dryer-repair-cleveland-oh-8b60"
 */
export function generateJobSnapImageFilename(parts: ImageFilenameParts): string {
  const stateAbbr = parts.state_abbr ? parts.state_abbr.trim().toLowerCase() : null;
  const orderedFields = parts.brand
    ? [parts.brand, parts.service_type, parts.city, stateAbbr]
    : [parts.service_type, parts.city, stateAbbr, parts.primary_problem];

  const tokens: string[] = [];
  for (const field of orderedFields) {
    if (!field) continue;
    tokens.push(...tokenize(field));
  }
  const base = joinSlugTokens(tokens);
  return `${base}-${parts.short_id}`;
}

// ─── Alt text ─────────────────────────────────────────────────────────────────

interface AltTextParts {
  brand: string | null;
  primary_problem: string | null;
  service_type: string | null;
  city: string | null;
  state: string | null;       // accepts full name or abbrev
  state_abbr: string | null;
}

/**
 * Build descriptive default alt text. Uses the full state name (not abbreviation)
 * per spec — alt text is for accessibility/SEO, not URL-style brevity.
 *
 * Templates (per spec):
 *   with brand:    {Brand} {primary_problem} for {service_type} in {City}, {State}
 *   without brand: {Primary Problem} for {service_type} in {City}, {State}
 *
 * @example
 *   generateJobSnapAltText({
 *     brand: "Whirlpool", primary_problem: "Drum Roller Replacement",
 *     service_type: "Dryer Repair", city: "Cleveland", state: "OH", state_abbr: "OH"
 *   })
 *   // "Whirlpool drum roller replacement for dryer repair in Cleveland, Ohio"
 */
export function generateJobSnapAltText(parts: AltTextParts): string {
  const brand = sanitizeText(parts.brand);
  const problem = sanitizeText(parts.primary_problem).toLowerCase();
  const service = sanitizeText(parts.service_type).toLowerCase();
  const city = titleCase(parts.city);

  // Resolve full state name from whichever input is most reliable
  const fullState =
    abbrToFullState(parts.state_abbr) ||
    abbrToFullState(parts.state) ||
    (parts.state && parts.state.length > 2 ? titleCase(parts.state) : null) ||
    null;
  const locationClause = [city, fullState].filter(Boolean).join(', ');

  let text: string;
  if (brand && problem && service) {
    text = `${brand} ${problem} for ${service}`;
  } else if (problem && service) {
    text = `${capitalizeFirst(problem)} for ${service}`;
  } else if (service) {
    text = capitalizeFirst(service);
  } else if (problem) {
    text = capitalizeFirst(problem);
  } else if (brand) {
    text = `${brand} job`;
  } else {
    text = 'Job photo';
  }

  if (locationClause) text += ` in ${locationClause}`;
  return text;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Input shape for computeJobSnapNaming(). Maps to the columns on `job_snaps`
 * that feed the naming engine, plus any caller-supplied overrides.
 */
export interface JobSnapNamingInput {
  // Structured inputs (sourced from analyzer output + user edits)
  title?: string | null;
  description?: string | null;
  service_type: string | null;
  brand: string | null;
  primary_problem: string | null;
  equipment_type?: string | null;
  city: string | null;
  state: string | null;          // may be full name or abbrev
  zip?: string | null;
  neighborhood?: string | null;
  address_public?: string | null;

  // Pre-resolved if available; otherwise computed
  state_abbr?: string | null;
  street_name_public?: string | null;
  short_id?: string | null;
}

/**
 * Output shape: every generated SEO field plus the derived structured ones.
 * Caller writes these directly into the job_snaps row.
 */
export interface JobSnapNamingOutput {
  // Derived structured
  state_abbr: string | null;
  street_name_public: string | null;
  short_id: string;
  public_location_label: string;

  // Generated SEO
  slug: string;
  url_path: string;
  meta_title: string;
  h1: string;
  meta_description: string;
  alt_text_default: string;
  image_filename_base: string;
}

export interface ComputeNamingOptions {
  /**
   * When true, the orchestrator preserves caller-supplied permalink fields
   * (`slug`, `url_path`, `image_filename_base`, `short_id`) and ONLY re-derives
   * meta_title, h1, alt_text, meta_description, public_location_label.
   * Used on edit so existing /work/<slug> URLs and image paths stay stable.
   */
  preservePermalinks?: boolean;

  /**
   * Slugs that already exist on this site. Used for collision detection
   * (sequential -2 / -3 / … suffix). Pass an empty Set when the caller
   * hasn't fetched the list yet — the orchestrator will return the
   * un-suffixed slug and let the DB unique constraint catch any race.
   */
  siteExistingSlugs?: Set<string>;

  /**
   * Industry archetype controlling slug component order + whether brand
   * is included. Defaults to SERVICE_LED (safe fallback). Callers should
   * resolve this from the site's primary GBP category via
   * `getIndustryArchetype()` from `industry-config.ts`.
   */
  industryArchetype?: IndustrySlugArchetype;

  /**
   * Existing permalink values to preserve when preservePermalinks is true.
   */
  existing?: {
    slug?: string | null;
    url_path?: string | null;
    image_filename_base?: string | null;
    short_id?: string | null;
  };
}

/**
 * Compute the full naming object for a Job Snap.
 *
 * Two modes:
 *   - Full recompute (default): all permalink + display fields regenerated.
 *     Used on initial create and on the explicit "Regenerate SEO Fields"
 *     action in the advanced editor.
 *   - Permalink-preserving (`preservePermalinks: true`): only display fields
 *     re-derived. slug, url_path, image_filename_base, short_id are taken
 *     from `options.existing`. Used on routine edits.
 */
export function computeJobSnapNaming(
  input: JobSnapNamingInput,
  options: ComputeNamingOptions = {}
): JobSnapNamingOutput {
  const state_abbr = input.state_abbr ?? normalizeStateAbbr(input.state);
  const street_name_public =
    input.street_name_public ?? sanitizeStreetName(input.address_public);

  const short_id =
    (options.preservePermalinks ? options.existing?.short_id : null) ??
    input.short_id ??
    generateShortId();

  const public_location_label = generatePublicLocationLabel({
    neighborhood: input.neighborhood,
    street_name_public,
    city: input.city,
    state_abbr,
  });

  // ── Permalink fields (preserved on edit by default) ─────────
  let slug: string;
  let url_path: string;
  let image_filename_base: string;

  if (options.preservePermalinks && options.existing?.slug) {
    slug = options.existing.slug;
    url_path = options.existing.url_path || generateJobSnapUrlPath(slug);
    image_filename_base =
      options.existing.image_filename_base ||
      generateJobSnapImageFilename({
        brand: input.brand,
        service_type: input.service_type,
        city: input.city,
        state_abbr,
        primary_problem: input.primary_problem,
        short_id,
      });
  } else {
    const candidateSlug = generateJobSnapSlug(
      {
        city: input.city,
        service_type: input.service_type,
        brand: input.brand,
        primary_problem: input.primary_problem,
        equipment_type: input.equipment_type ?? null,
        street_name: street_name_public,
      },
      options.industryArchetype ?? DEFAULT_ARCHETYPE
    );
    slug = handleDuplicateSlug(
      candidateSlug || `job-${short_id}`,
      options.siteExistingSlugs || new Set()
    );
    url_path = generateJobSnapUrlPath(slug);
    image_filename_base = generateJobSnapImageFilename({
      brand: input.brand,
      service_type: input.service_type,
      city: input.city,
      state_abbr,
      primary_problem: input.primary_problem,
      short_id,
    });
  }

  // ── Display fields (always recomputed) ──────────────────────
  const meta_title = generateJobSnapMetaTitle({
    brand: input.brand,
    service_type: input.service_type,
    city: input.city,
    state_abbr,
    primary_problem: input.primary_problem,
  });

  const h1 = generateJobSnapH1({
    brand: input.brand,
    equipment_type: input.equipment_type ?? null,
    service_type: input.service_type,
    primary_problem: input.primary_problem,
    city: input.city,
    state_abbr,
    neighborhood: input.neighborhood,
  });

  const meta_description = generateJobSnapMetaDescription({
    brand: input.brand,
    service_type: input.service_type,
    primary_problem: input.primary_problem,
    city: input.city,
    state_abbr,
    public_location_label: public_location_label || null,
    description: input.description ?? null,
  });

  const alt_text_default = generateJobSnapAltText({
    brand: input.brand,
    primary_problem: input.primary_problem,
    service_type: input.service_type,
    city: input.city,
    state: input.state,
    state_abbr,
  });

  return {
    state_abbr,
    street_name_public,
    short_id,
    public_location_label,
    slug,
    url_path,
    meta_title,
    h1,
    meta_description,
    alt_text_default,
    image_filename_base,
  };
}

// ─── Internal text formatters ─────────────────────────────────────────────────

function titleCase(input: string | null | undefined): string {
  const s = sanitizeText(input);
  if (!s) return '';
  const words = s.split(/\s+/);
  return words
    .map((word, idx) => {
      // Preserve all-uppercase acronyms 2–5 chars: "AC", "TV", "GAF", "HVAC".
      if (word.length >= 2 && word.length <= 5 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
        return word;
      }
      const lower = word.toLowerCase();
      if (FILLER_WORDS.has(lower) && idx !== 0) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function capitalizeFirst(input: string): string {
  if (!input) return '';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function truncateAtBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
}
