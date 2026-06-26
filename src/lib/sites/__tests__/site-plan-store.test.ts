import { describe, it, expect } from 'vitest';
import { buildPlanInputs, toStoredSitePlan, plannedCityPathSet, normalizePublicPath } from '../site-plan-store';
import { planSite } from '@/lib/onboarding/site-plan';
import type { SiteSettings, ServiceAreaDB } from '@/types/database';

// The Section 6 fixture, but driven through the DB-shaped store helpers the
// generator actually uses (buildPlanInputs → planSite → toStoredSitePlan).
const SETTINGS: SiteSettings = {
  travel_strategy: 'regional',
  primary_market_city: 'Surprise',
  primary_market_state: 'AZ',
  primary_market_source: 'user_input',
};

const AREAS = [
  { name: 'Peoria', state: 'AZ', is_anchor: false, distance_miles: 18 },
  { name: 'Glendale', state: 'AZ', is_anchor: false, distance_miles: 22 },
  { name: 'Phoenix', state: 'AZ', is_anchor: false, distance_miles: 28 },
  { name: 'Sun City', state: 'AZ', is_anchor: false, distance_miles: 6 },
  { name: 'El Mirage', state: 'AZ', is_anchor: false, distance_miles: 8 },
] as Pick<ServiceAreaDB, 'name' | 'state' | 'is_anchor' | 'distance_miles'>[];

function buildPlan() {
  const { inputs, primaryMarket, travelStrategy } = buildPlanInputs({
    settings: SETTINGS,
    primaryLocation: { city: 'Surprise', state: 'AZ', address: null },
    gbpCategories: ['Appliance repair', 'Refrigerator repair', 'Washer and dryer repair'],
    serviceAreas: AREAS,
  });
  const plan = planSite(inputs);
  return { plan, stored: toStoredSitePlan(plan, { travelStrategy, primaryMarket, generatedAt: '2026-06-25T00:00:00Z' }) };
}

describe('site-plan-store — generator wiring', () => {
  it('reads Primary Market + travel strategy from settings (no inference flag)', () => {
    const { stored } = buildPlan();
    expect(stored.primary_market).toEqual({ city: 'Surprise', state: 'AZ' });
    expect(stored.travel_strategy).toBe('regional');
    expect(stored.gbp_website_link_recommendation).toBe('/surprise/');
  });

  it('defaults Pattern 1 depth to the top 2 GBP categories (no washer-dryer city pages)', () => {
    const { stored } = buildPlan();
    const paths = plannedCityPathSet(stored);
    expect(paths.has('appliance-repair/peoria')).toBe(true);
    expect(paths.has('refrigerator-repair/phoenix')).toBe(true);
    // washer-dryer is the 3rd category → no Pattern 1 city pages
    expect([...paths].some((p) => p.startsWith('washer-dryer-repair/'))).toBe(false);
  });

  it('proximity-covered cities are text-only (no page, excluded from the planned path set)', () => {
    const { stored } = buildPlan();
    const sunCity = stored.cities.find((c) => c.city === 'Sun City');
    expect(sunCity?.treatment).toBe('proximity_covered');
    expect(sunCity?.has_page).toBe(false);
    const paths = plannedCityPathSet(stored);
    expect([...paths].some((p) => p.includes('sun-city') || p.includes('el-mirage'))).toBe(false);
  });

  it('planned set gates correctly via normalized paths', () => {
    const { stored } = buildPlan();
    const paths = plannedCityPathSet(stored);
    // PM hub + PM service for every category are valid (incl. washer-dryer PM service)
    expect(paths.has(normalizePublicPath('/surprise/'))).toBe(true);
    expect(paths.has(normalizePublicPath('/surprise/washer-dryer-repair/'))).toBe(true);
    // a non-top-service Pattern 1 combo is NOT planned → would 404
    expect(paths.has(normalizePublicPath('/washer-dryer-repair/peoria/'))).toBe(false);
  });

  it('infers + flags Primary Market when settings are missing (pre-v5 site)', () => {
    const { needsReview, primaryMarket, travelStrategy } = buildPlanInputs({
      settings: {},
      primaryLocation: { city: 'Lake Charles', state: 'LA', address: '123 Main St' },
      gbpCategories: ['Appliance repair'],
      serviceAreas: AREAS,
    });
    expect(needsReview).toBe(true);
    expect(primaryMarket.city).toBe('Lake Charles');
    expect(travelStrategy).toBe('regional'); // max distance 28mi → regional (≤30mi band)
  });
});
