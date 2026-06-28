import { describe, it, expect } from 'vitest';
import { planSite, type PlanInputs } from '../site-plan';

// Section 6 fixture from the URL-structure refactor: a regional SAB appliance
// repair business in Surprise, AZ.
const SURPRISE: PlanInputs = {
  businessType: 'sab',
  travelStrategy: 'regional',
  primaryMarket: { city: 'Surprise', state: 'AZ' },
  gbpCategories: ['Appliance repair', 'Refrigerator repair', 'Washer and dryer repair'],
  subServicesByService: {
    'Refrigerator repair': ['Not cooling', 'Ice maker repair'],
    'Washer and dryer repair': ['Not spinning'],
  },
  topServices: ['Appliance repair', 'Refrigerator repair'], // top 2 only
  serviceAreaCities: [
    { city: 'Peoria', state: 'AZ', distanceMiles: 18 },
    { city: 'Glendale', state: 'AZ', distanceMiles: 22 },
    { city: 'Phoenix', state: 'AZ', distanceMiles: 28 },
    { city: 'Sun City', state: 'AZ', distanceMiles: 6 },
    { city: 'El Mirage', state: 'AZ', distanceMiles: 8 },
  ],
};

describe('planSite — v5 Primary Market model (Surprise AZ)', () => {
  const plan = planSite(SURPRISE);
  const urls = new Set(plan.pages.map((p) => p.url));

  it('always builds homepage, primary market hub, PM service pages, brand hubs, service-areas', () => {
    for (const u of [
      '/', '/surprise/',
      '/surprise/appliance-repair/', '/surprise/refrigerator-repair/', '/surprise/washer-dryer-repair/',
      '/appliance-repair/', '/refrigerator-repair/', '/washer-dryer-repair/',
      '/service-areas/',
    ]) expect(urls.has(u), u).toBe(true);
  });

  it('nests sub-services under their parent brand hub', () => {
    expect(urls.has('/refrigerator-repair/not-cooling/')).toBe(true);
    expect(urls.has('/refrigerator-repair/ice-maker-repair/')).toBe(true);
  });

  it('builds Pattern 1 city pages only for the top 2 services × non-proximity cities', () => {
    for (const u of [
      '/appliance-repair/peoria/', '/appliance-repair/glendale/', '/appliance-repair/phoenix/',
      '/refrigerator-repair/peoria/', '/refrigerator-repair/glendale/', '/refrigerator-repair/phoenix/',
    ]) expect(urls.has(u), u).toBe(true);
  });

  it('does NOT build Pattern 1 city pages for washer-dryer (not a top-2 service)', () => {
    const wdCityPages = plan.pages.filter(
      (p) => p.pageType === 'pattern_1_city' && p.url.startsWith('/washer-dryer-repair/'),
    );
    expect(wdCityPages).toHaveLength(0);
  });

  it('never uses a /locations/ parent', () => {
    expect([...urls].filter((u) => u.includes('/locations/'))).toHaveLength(0);
  });

  it('proximity-covers Sun City and El Mirage (no dedicated pages)', () => {
    expect([...urls].some((u) => u.includes('sun-city'))).toBe(false);
    expect([...urls].some((u) => u.includes('el-mirage'))).toBe(false);
    expect(plan.cities.find((c) => c.city === 'Sun City')?.treatment).toBe('proximity_covered');
    expect(plan.cities.find((c) => c.city === 'El Mirage')?.treatment).toBe('proximity_covered');
  });

  it('/service-areas/ links built city pages but not proximity-covered ones', () => {
    const sa = plan.pages.find((p) => p.pageType === 'service_areas')!;
    expect(sa.links).toContain('/appliance-repair/peoria/');
    expect(sa.links.some((l) => l.includes('sun-city'))).toBe(false);
  });

  it('recommends pointing the GBP website link at the primary market hub', () => {
    expect(plan.gbpWebsiteLinkRecommendation).toBe('/surprise/');
  });

  it('sub-services never link to city pages', () => {
    const subs = plan.pages.filter((p) => p.pageType === 'sub_service');
    for (const s of subs) {
      expect(s.links.some((l) => /\/(peoria|glendale|phoenix)\//.test(l))).toBe(false);
    }
  });
});

describe('planSite — Local strategy builds no Pattern 1 pages', () => {
  it('local: proximity + primary market only', () => {
    const plan = planSite({ ...SURPRISE, travelStrategy: 'local' });
    expect(plan.pages.filter((p) => p.pageType === 'pattern_1_city')).toHaveLength(0);
    expect(plan.doNotBuild.some((d) => /Pattern 1/.test(d.what))).toBe(true);
  });
});

describe('planSite — GBP-anchored city gets a city-first hub', () => {
  it('anchored city builds /{city}/ + /{city}/{service}/, not Pattern 1', () => {
    const plan = planSite({
      ...SURPRISE,
      serviceAreaCities: [{ city: 'Peoria', state: 'AZ', anchored: true, distanceMiles: 18 }],
    });
    const urls = new Set(plan.pages.map((p) => p.url));
    expect(urls.has('/peoria/')).toBe(true);
    expect(urls.has('/peoria/appliance-repair/')).toBe(true);
    expect([...urls].some((u) => u === '/appliance-repair/peoria/')).toBe(false);
    expect(plan.cities.find((c) => c.city === 'Peoria')?.treatment).toBe('has_city_hub');
  });
});

describe('planSite — Model B (home IS the Primary Market page)', () => {
  const plan = planSite({ ...SURPRISE, travelStrategy: 'local', homepageIsPrimaryMarket: true });
  const urls = new Set(plan.pages.map((p) => p.url));

  it('does NOT build a separate /{primary-market}/ hub (no duplicate of home)', () => {
    expect(urls.has('/surprise/')).toBe(false);
    expect(plan.pages.some((p) => p.pageType === 'primary_market_hub')).toBe(false);
    expect(plan.pages.some((p) => p.pageType === 'primary_market_service')).toBe(false);
    expect(plan.doNotBuild.some((d) => /Primary Market hub/.test(d.what))).toBe(true);
  });

  it('points the GBP website link at the home page, and the PM city page is "/"', () => {
    expect(plan.gbpWebsiteLinkRecommendation).toBe('/');
    expect(plan.cities.find((c) => c.city === 'Surprise')?.pageUrl).toBe('/');
  });

  it('still builds brand service hubs + /service-areas/ + utility', () => {
    expect(urls.has('/appliance-repair/')).toBe(true);
    expect(urls.has('/service-areas/')).toBe(true);
    expect(urls.has('/about/')).toBe(true);
  });
});
