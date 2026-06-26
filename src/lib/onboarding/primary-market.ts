/**
 * Primary Market resolution + backwards compatibility (v5).
 * ----------------------------------------------------------------------------
 * New sites persist travel_strategy + primary_market_* in settings (see
 * create-site.ts). EXISTING sites built before v5 won't have these. This helper
 * resolves a usable Primary Market for ANY site — reading the stored values when
 * present, otherwise inferring sensible defaults from existing data so nothing
 * breaks and no dashboard error is shown.
 *
 * Canonical spec: docs/architecture/growlocal360_master_prompt_v5.md
 */

import type { TravelStrategy } from '@/types/wizard';
import type { SiteSettings } from '@/types/database';

export interface ResolvedPrimaryMarket {
  travelStrategy: TravelStrategy;
  city: string;
  state: string;
  source: 'user_input' | 'ai_recommendation' | 'gbp_address' | 'inferred';
  /** True when values were inferred (not explicitly set) — flag for dashboard review. */
  needsReview: boolean;
}

interface InferenceContext {
  /** Primary location city/state (fallback for the market). */
  fallbackCity?: string | null;
  fallbackState?: string | null;
  /** Count of distinct service-area cities — used to infer travel strategy breadth. */
  serviceAreaCount?: number;
  /** Max distance among service areas (miles), if known. */
  serviceAreaMaxMiles?: number | null;
}

/** Infer travel strategy from how broad the existing service area is. */
function inferTravelStrategy(ctx: InferenceContext): TravelStrategy {
  const miles = ctx.serviceAreaMaxMiles ?? null;
  if (miles !== null) {
    if (miles <= 15) return 'local';
    if (miles <= 30) return 'regional';
    return 'metro';
  }
  const n = ctx.serviceAreaCount ?? 0;
  if (n <= 1) return 'local';
  if (n <= 6) return 'regional';
  return 'metro';
}

/**
 * Resolve the Primary Market for a site. Prefers stored v5 settings; falls back
 * to inference for pre-v5 sites. NEVER throws — always returns a usable value.
 */
export function resolvePrimaryMarket(
  settings: SiteSettings | null | undefined,
  ctx: InferenceContext = {},
): ResolvedPrimaryMarket {
  const s = settings || {};

  const storedCity = s.primary_market_city?.trim();
  const storedStrategy = s.travel_strategy;

  if (storedCity && storedStrategy) {
    return {
      travelStrategy: storedStrategy,
      city: storedCity,
      state: s.primary_market_state || ctx.fallbackState || '',
      source: s.primary_market_source ?? 'user_input',
      needsReview: false,
    };
  }

  // Pre-v5 / incomplete — infer and flag for review.
  return {
    travelStrategy: storedStrategy ?? inferTravelStrategy(ctx),
    city: storedCity || ctx.fallbackCity || '',
    state: s.primary_market_state || ctx.fallbackState || '',
    source: 'inferred',
    needsReview: true,
  };
}
