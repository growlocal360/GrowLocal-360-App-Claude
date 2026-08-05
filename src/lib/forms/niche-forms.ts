import type { PublicRenderCategory } from '@/lib/sites/public-render-model';

/**
 * Niche-specific intake form configuration.
 *
 * The lead intake form (`UnifiedLeadForm`) is config-driven: a niche config
 * declares the ordered steps and their fields. The scheduling steps are provided
 * by the engine (via the SCHEDULE_STEP marker). Contact fields (name/phone/email/
 * address) are ordinary fields with `reserved: true` — they map to first-class
 * `leads` columns. Everything else maps to `service_type`, `message`, or the
 * flexible `leads.metadata` JSONB (migration 055).
 *
 * Adding a niche = adding one config to NICHE_FORMS + a match term. The generic
 * config reproduces the historical form exactly and is the fallback when no niche
 * matches (so non-niche sites are unaffected).
 */

export type NicheFieldType =
  | 'select'   // dropdown; `optionsFrom: 'categories'` pulls the site's services
  | 'cards'    // tappable option grid (one choice)
  | 'chips'    // inline pill options (one choice)
  | 'text'
  | 'tel'
  | 'email'
  | 'textarea'
  | 'address'; // Google Places autocomplete input

export interface NicheFieldOption {
  label: string;
  value: string;
  icon?: string; // icon key resolved to an SVG on cards (see appliance-icons.tsx)
}

export interface NicheField {
  /** Key in the form state + (for non-reserved, non-mapped fields) the metadata key. */
  name: string;
  label: string;
  type: NicheFieldType;
  required?: boolean;
  placeholder?: string;
  options?: NicheFieldOption[];
  /** Dynamic option source. 'categories' → the site's service categories. */
  optionsFrom?: 'categories';
  /** Where the value goes in the lead payload. Omit → metadata[name]. */
  mapsTo?: 'service_type' | 'message';
  /** name/phone/email/address → first-class lead columns (not metadata). */
  reserved?: boolean;
  /** Numeric mobile keyboard (e.g. ZIP). */
  numeric?: boolean;
}

export interface NicheStep {
  key: string;
  /** Heading shown for this step. */
  title: string;
  fields: NicheField[];
}

/** Ordered-step marker: expands to Date + Time steps in booking mode, removed otherwise. */
export const SCHEDULE_STEP = '__schedule__' as const;
export type NicheStepItem = NicheStep | typeof SCHEDULE_STEP;

export interface NicheFormConfig {
  key: string;
  /** Display label for the niche (branch-selector card, e.g. "HVAC Services"). */
  label: string;
  /** Lowercased substrings matched against category names / core_industry. */
  matchTerms: string[];
  /** Ordered steps. SCHEDULE_STEP is expanded/removed by the engine per mode. */
  steps: NicheStepItem[];
  /** Step-1 heading uses the CTA label ("Book Online"/"Get Free Estimate") instead of the step title. */
  firstStepUsesCtaHeading?: boolean;
  /** Final-step submit label (falls back to the CTA-based label when omitted). */
  submitLabel?: string;
}

export const RESERVED_FIELDS = ['name', 'phone', 'email', 'address'] as const;

// ── Generic (default) — reproduces the historical form exactly ───────────────
const GENERIC_FORM: NicheFormConfig = {
  key: 'generic',
  label: 'Service Request',
  matchTerms: [],
  firstStepUsesCtaHeading: true,
  steps: [
    {
      key: 'service',
      title: 'Service Details',
      fields: [
        { name: 'service_type', label: 'Service Needed', type: 'select', optionsFrom: 'categories', mapsTo: 'service_type' },
        { name: 'message', label: 'How Can We Help - Details?', type: 'textarea', placeholder: 'Describe what you need help with...', mapsTo: 'message' },
      ],
    },
    {
      key: 'contact',
      title: 'Contact Info',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, reserved: true, placeholder: 'Your full name' },
        { name: 'phone', label: 'Phone', type: 'tel', required: true, reserved: true, placeholder: '(555) 123-4567' },
        { name: 'email', label: 'Email', type: 'email', reserved: true, placeholder: 'you@example.com (optional)' },
      ],
    },
    {
      key: 'address',
      title: 'Address',
      fields: [
        { name: 'address', label: 'Address', type: 'address', reserved: true, placeholder: 'Start typing your address...' },
      ],
    },
    SCHEDULE_STEP,
  ],
};

// ── Appliance Repair — conversion-optimized: What → Problem → When → Who ──────
const APPLIANCE_FORM: NicheFormConfig = {
  key: 'appliance',
  label: 'Appliance Services',
  matchTerms: [
    'appliance',
    'refrigerator',
    'freezer',
    'washer',
    'dryer',
    'dishwasher',
    'oven',
    'microwave',
    'ice maker',
  ],
  firstStepUsesCtaHeading: false,
  submitLabel: 'Book My Repair',
  steps: [
    {
      key: 'appliance',
      title: 'What needs fixing?',
      fields: [
        {
          name: 'appliance',
          label: 'Appliance',
          type: 'cards',
          required: true,
          mapsTo: 'service_type',
          options: [
            { label: 'Refrigerator', value: 'Refrigerator', icon: 'refrigerator' },
            { label: 'Washer', value: 'Washer', icon: 'washer' },
            { label: 'Dryer', value: 'Dryer', icon: 'dryer' },
            { label: 'Dishwasher', value: 'Dishwasher', icon: 'dishwasher' },
            { label: 'Oven / Stove', value: 'Oven / Stove', icon: 'oven' },
            { label: 'Microwave', value: 'Microwave', icon: 'microwave' },
            { label: 'Freezer', value: 'Freezer', icon: 'freezer' },
            { label: 'Ice Maker', value: 'Ice Maker', icon: 'ice-maker' },
            { label: 'Garbage Disposal', value: 'Garbage Disposal', icon: 'garbage-disposal' },
            { label: 'Wine Cooler', value: 'Wine Cooler', icon: 'wine-cooler' },
            { label: 'Other', value: 'Other', icon: 'other' },
          ],
        },
        { name: 'brand', label: 'Brand (optional)', type: 'text', placeholder: 'Samsung, LG, Whirlpool…' },
      ],
    },
    {
      key: 'problem',
      title: "What's going on?",
      fields: [
        {
          name: 'symptom',
          label: "What's happening?",
          type: 'chips',
          mapsTo: 'message',
          options: [
            { label: 'Not turning on', value: 'Not turning on' },
            { label: 'Not cooling', value: 'Not cooling' },
            { label: 'Leaking water', value: 'Leaking water' },
            { label: 'Making noise', value: 'Making noise' },
            { label: 'Not draining', value: 'Not draining' },
            { label: 'Not heating', value: 'Not heating' },
            { label: 'Error code', value: 'Error code' },
            { label: 'Other', value: 'Other' },
          ],
        },
        { name: 'details', label: 'Any details? (optional)', type: 'textarea', placeholder: "Describe what's happening…" },
      ],
    },
    SCHEDULE_STEP,
    {
      key: 'contact',
      title: 'How can we reach you?',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, reserved: true, placeholder: 'Your full name' },
        { name: 'phone', label: 'Phone', type: 'tel', required: true, reserved: true, placeholder: '(555) 123-4567' },
        { name: 'email', label: 'Email (optional)', type: 'email', reserved: true, placeholder: 'you@example.com' },
        // Required: exact dispatch location. ZIP + city are auto-extracted from the
        // selected place (see UnifiedLeadForm) into metadata — no separate ZIP field.
        { name: 'address', label: 'Service Address', type: 'address', required: true, reserved: true, placeholder: 'Start typing your address...' },
      ],
    },
  ],
};

// ── HVAC — richer qualifier: Type of Service → System → When → Who ────────────
const HVAC_FORM: NicheFormConfig = {
  key: 'hvac',
  label: 'HVAC Services',
  matchTerms: [
    'hvac',
    'heating',
    'cooling',
    'air condition',
    'furnace',
    'a/c',
    'ac ',
    'heat pump',
  ],
  firstStepUsesCtaHeading: false,
  submitLabel: 'Book My Appointment',
  steps: [
    {
      key: 'service_type',
      title: 'What can we help with?',
      fields: [
        {
          name: 'service_type',
          label: 'Type of Service',
          type: 'cards',
          required: true,
          mapsTo: 'service_type',
          options: [
            { label: 'Repair', value: 'Repair', icon: 'repair' },
            { label: 'Installation', value: 'Installation', icon: 'installation' },
            { label: 'Tune-Up & Maintenance', value: 'Tune-Up & Maintenance', icon: 'maintenance' },
          ],
        },
      ],
    },
    {
      key: 'system',
      title: 'Which system?',
      fields: [
        {
          name: 'system',
          label: 'System Type',
          type: 'chips',
          mapsTo: 'message',
          options: [
            { label: 'Air Conditioner', value: 'Air Conditioner' },
            { label: 'Furnace', value: 'Furnace' },
            { label: 'Heat Pump', value: 'Heat Pump' },
            { label: 'Mini-Split', value: 'Mini-Split' },
            { label: 'Thermostat', value: 'Thermostat' },
            { label: 'Ductwork', value: 'Ductwork' },
            { label: 'Other', value: 'Other' },
          ],
        },
        { name: 'details', label: 'Any details? (optional)', type: 'textarea', placeholder: "Describe what's going on…" },
      ],
    },
    SCHEDULE_STEP,
    {
      key: 'contact',
      title: 'How can we reach you?',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, reserved: true, placeholder: 'Your full name' },
        { name: 'phone', label: 'Phone', type: 'tel', required: true, reserved: true, placeholder: '(555) 123-4567' },
        { name: 'email', label: 'Email (optional)', type: 'email', reserved: true, placeholder: 'you@example.com' },
        { name: 'address', label: 'Service Address', type: 'address', required: true, reserved: true, placeholder: 'Start typing your address...' },
      ],
    },
  ],
};

/** Niche configs matched in order; GENERIC_FORM is the fallback (not in this list). */
const NICHE_FORMS: NicheFormConfig[] = [HVAC_FORM, APPLIANCE_FORM];

/** A distinct niche present on a site, with the categories that belong to it. */
export interface SiteNiche {
  config: NicheFormConfig;
  key: string;
  label: string;
  /** Category display names classified into this niche (primary-first order). */
  categories: string[];
  /** Representative service for routing — the first (highest-priority) category. */
  topService: string;
}

/** Classify a single category name against the niche configs; null → no match. */
function classifyName(name: string): NicheFormConfig | null {
  const haystack = (name || '').toLowerCase();
  for (const config of NICHE_FORMS) {
    if (config.matchTerms.some((term) => haystack.includes(term))) return config;
  }
  return null;
}

/**
 * The distinct niches a site spans, primary-category first. Each category is
 * classified independently, then grouped by niche config (order = first
 * appearance). Categories that match no niche fall under GENERIC. Used by both
 * the intake form (branch selector) and the planner (per-niche city pages).
 */
export function resolveSiteNiches(
  categories?: PublicRenderCategory[],
  coreIndustry?: string
): SiteNiche[] {
  const names = (categories ?? []).map((c) => c.gbp_category?.display_name || '');
  return groupNiches(names, coreIndustry);
}

/**
 * String-only variant for callers without the render model (the site planner).
 * Returns one entry per distinct niche: its key + representative top service.
 */
export function resolveNichesFromNames(
  names: string[],
  coreIndustry?: string
): { key: string; topService: string }[] {
  return groupNiches(names, coreIndustry).map((n) => ({ key: n.key, topService: n.topService }));
}

/** Shared grouping used by both resolvers. */
function groupNiches(names: string[], coreIndustry?: string): SiteNiche[] {
  const order: string[] = [];
  const byKey = new Map<string, SiteNiche>();

  const add = (config: NicheFormConfig, name: string) => {
    let niche = byKey.get(config.key);
    if (!niche) {
      niche = { config, key: config.key, label: config.label, categories: [], topService: name };
      byKey.set(config.key, niche);
      order.push(config.key);
    }
    niche.categories.push(name);
  };

  // A category that matches no niche falls back to the niche implied by
  // core_industry (preserves the old whole-site behavior), then generic.
  const industryFallback = coreIndustry ? classifyName(coreIndustry) : null;

  for (const name of names.filter((n) => n && n.trim())) {
    add(classifyName(name) ?? industryFallback ?? GENERIC_FORM, name);
  }

  // No categories provided: fall back to a single niche from core_industry.
  if (order.length === 0) {
    const config = industryFallback ?? GENERIC_FORM;
    return [{ config, key: config.key, label: config.label, categories: [], topService: '' }];
  }

  return order.map((k) => byKey.get(k)!);
}

/**
 * Pick the intake form config for a site — the primary (first) niche's config.
 * Backward-compatible single-form resolver for callers that don't branch.
 */
export function resolveNicheForm(
  categories?: PublicRenderCategory[],
  coreIndustry?: string
): NicheFormConfig {
  return resolveSiteNiches(categories, coreIndustry)[0]?.config ?? GENERIC_FORM;
}

/** All fields across a config's non-schedule steps (used for payload mapping). */
export function allFields(config: NicheFormConfig): NicheField[] {
  return config.steps
    .filter((s): s is NicheStep => s !== SCHEDULE_STEP)
    .flatMap((s) => s.fields);
}

export { GENERIC_FORM, APPLIANCE_FORM, HVAC_FORM };
