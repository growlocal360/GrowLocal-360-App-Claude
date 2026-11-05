import { describe, it, expect } from 'vitest';
import { buildPlanInputs, toStoredSitePlan, plannedCityPathSet, normalizePublicPath, cityTreatmentBySlug, isV6Plan } from '../site-plan-store';
import { planSite } from '@/lib/onboarding/site-plan';
import type { SiteSettings, ServiceAreaDB } from '@/types/database';

// The Alexandria fixture driven through the DB-shaped store helpers the
// generator actually uses (buildPlanInputs → planSite → toStoredSitePlan).
const SETTINGS: SiteSettings = {
  travel_strategy: 'regional',
  primary_market_city: 'Alexandria',
  primary_market_state: 'LA',
  primary_market_source: 'user_input',
};

type AreaRow = Pick<ServiceAreaDB, 'name' | 'state' | 'is_anchor' | 'distance_miles' | 'is_priority'>;
const AREAS: AreaRow[] = [
  { name: 'Pineville', state: 'LA', is_anchor: false, distance_miles: 3, is_priority: false },
  { name: 'Colfax', state: 'LA', is_anchor: false, distance_miles: 25, is_priority: false },
  { name: 'Lecompte', state: 'LA', is_anchor: false, distance_miles: 18, is_priority: false },
  { name: 'Lafayette', state: 'LA', is_anchor: true, distance_miles: 90, is_priority: false },
];

function buildPlan(areas: AreaRow[] = AREAS) {
  const { inputs, primaryMarket, travelStrategy } = buildPlanInputs({
    settings: SETTINGS,
    primaryLocation: { city: 'Alexandria', state: 'LA', address: null },
    gbpCategories: ['Appliance repair service', 'Refrigerator repair service', 'Washer & dryer repair service'],
    primaryServices: [{ name: 'Dishwasher Repair', slug: 'dishwasher-repair' }],
    serviceAreas: areas,
  });
  const plan = planSite(inputs);
  return { plan, stored: toStoredSitePlan(plan, { travelStrategy, primaryMarket, generatedAt: '2026-11-05T00:00:00Z' }) };
}

describe('site-plan-store — generator wiring (v6)', () => {
  it('stores a v6 plan with Primary Market, GBP links, slugs and reasons', () => {
    const { stored } = buildPlan();
    expect(isV6Plan(stored)).toBe(true);
    expect(stored.primary_market).toEqual({ city: 'Alexandria', state: 'LA' });
    expect(stored.gbp_website_link_recommendation).toBe('/');
    expect(stored.gbp_website_links).toEqual([
      { city: 'Alexandria', url: '/' },
      { city: 'Lafayette', url: '/service-areas/lafayette/' },
    ]);
    expect(stored.cities.every((c) => c.slug && c.reason)).toBe(true);
  });

  it('planned path set = town pages + silo pages under promoted towns, normalized', () => {
    const { stored } = buildPlan();
    const paths = plannedCityPathSet(stored);
    expect(paths.has(normalizePublicPath('/service-areas/colfax/'))).toBe(true);
    expect(paths.has(normalizePublicPath('/Service-Areas/Lecompte'))).toBe(true);
    expect(paths.has('service-areas/lafayette')).toBe(true);
    expect(paths.has('service-areas/lafayette/dishwasher-repair')).toBe(true);
    expect(paths.has('service-areas/lafayette/refrigerator-repair')).toBe(true);
    // plain towns have no silo
    expect(paths.has('service-areas/colfax/refrigerator-repair')).toBe(false);
    // proximity-covered towns have no page
    expect([...paths].some((p) => p.includes('pineville'))).toBe(false);
    // nothing from the retired v5 shapes
    expect([...paths].some((p) => /^(alexandria|lafayette)(\/|$)/.test(p) || /^refrigerator-repair\//.test(p))).toBe(false);
  });

  it('looks towns up by slug (v6) and falls back to the name for v5 plans', () => {
    const { stored } = buildPlan();
    expect(cityTreatmentBySlug(stored, 'colfax')?.treatment).toBe('plain_page');
    expect(cityTreatmentBySlug(stored, 'lafayette')?.treatment).toBe('promoted');
    expect(cityTreatmentBySlug(stored, 'alexandria')?.treatment).toBe('primary_market');
    const legacy = { ...stored, version: undefined, cities: stored.cities.map((c) => ({ ...c, slug: undefined })) };
    expect(isV6Plan(legacy)).toBe(false);
    expect(cityTreatmentBySlug(legacy, 'colfax')?.city).toBe('Colfax');
  });

  it('is_anchor → promoted; is_priority → plain page past proximity', () => {
    const { stored } = buildPlan([
      { name: 'Pineville', state: 'LA', is_anchor: false, distance_miles: 3, is_priority: true },
      { name: 'Lafayette', state: 'LA', is_anchor: true, distance_miles: 90, is_priority: false },
    ]);
    expect(stored.cities.find((c) => c.city === 'Pineville')?.treatment).toBe('plain_page');
    expect(stored.cities.find((c) => c.city === 'Lafayette')?.treatment).toBe('promoted');
  });

  it('infers + flags the Primary Market when settings are missing (pre-v5 site)', () => {
    const { needsReview, primaryMarket, travelStrategy } = buildPlanInputs({
      settings: {},
      primaryLocation: { city: 'Lake Charles', state: 'LA', address: '123 Main St' },
      gbpCategories: ['Appliance repair'],
      serviceAreas: AREAS.filter((a) => a.name !== 'Lafayette'),
    });
    expect(needsReview).toBe(true);
    expect(primaryMarket.city).toBe('Lake Charles');
    expect(travelStrategy).toBe('regional'); // max distance 25 mi → regional band
  });
});
