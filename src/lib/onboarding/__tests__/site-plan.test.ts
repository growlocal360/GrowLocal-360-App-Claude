import { describe, it, expect } from 'vitest';
import { planSite, type PlanInputs } from '../site-plan';

// A regional appliance-repair SAB in Alexandria, LA (the worked example in the
// v6 spec). Primary category = Appliance repair (home page); its services sit
// flat at root; Refrigerator + Washer/dryer are secondary category hubs.
const ALEXANDRIA: PlanInputs = {
  businessType: 'sab',
  travelStrategy: 'regional',
  primaryMarket: { city: 'Alexandria', state: 'LA' },
  gbpCategories: ['Appliance repair service', 'Refrigerator repair service', 'Washer & dryer repair service'],
  primaryServices: [
    { name: 'Dishwasher Repair', slug: 'dishwasher-repair' },
    { name: 'Oven & Range Repair', slug: 'oven-range-repair' },
  ],
  subServicesByService: {
    'Refrigerator repair service': ['Ice maker repair', 'Compressor repair'],
    'Washer & dryer repair service': ['Dryer heating element'],
  },
  neighborhoods: ['Garden District'],
  serviceAreaCities: [
    { city: 'Pineville', state: 'LA', distanceMiles: 3 },
    { city: 'Ball', state: 'LA', distanceMiles: 9 },
    { city: 'Boyce', state: 'LA', distanceMiles: 16 },
    { city: 'Colfax', state: 'LA', distanceMiles: 25 },
    { city: 'Lecompte', state: 'LA', distanceMiles: 18 },
    { city: 'Pollock', state: 'LA', distanceMiles: 20 },
  ],
};

const urlsOf = (plan: ReturnType<typeof planSite>) => new Set(plan.pages.map((p) => p.url));

describe('planSite — v6 Town Page model (Alexandria LA)', () => {
  const plan = planSite(ALEXANDRIA);
  const urls = urlsOf(plan);

  it('home is the Primary Market page: primary category + city, GBP link → /', () => {
    const home = plan.pages.find((p) => p.pageType === 'homepage')!;
    expect(home.title).toBe('Appliance repair service in Alexandria, LA');
    expect(home.associatedCity).toBe('Alexandria');
    expect(plan.gbpWebsiteLinkRecommendation).toBe('/');
    expect(plan.cities.find((c) => c.treatment === 'primary_market')?.pageUrl).toBe('/');
  });

  it('never builds a /{primary-market}/ hub, /{city}/ at root, /locations/, or /{service}/{city}/', () => {
    expect(urls.has('/alexandria/')).toBe(false);
    expect([...urls].some((u) => u.includes('/locations/'))).toBe(false);
    expect([...urls].some((u) => /^\/(dishwasher-repair|refrigerator-repair|washer-dryer-repair)\/(colfax|lecompte|boyce|pollock)\//.test(u))).toBe(false);
    expect(plan.doNotBuild.some((d) => d.what === '/service-areas/alexandria/')).toBe(true);
  });

  it('main service list: primary services flat at root, secondary categories as hubs with nested services', () => {
    for (const u of ['/dishwasher-repair/', '/oven-range-repair/', '/refrigerator-repair/', '/washer-dryer-repair/']) expect(urls.has(u), u).toBe(true);
    expect(urls.has('/refrigerator-repair/ice-maker-repair/')).toBe(true);
    expect(urls.has('/washer-dryer-repair/dryer-heating-element/')).toBe(true);
    expect(plan.pages.find((p) => p.url === '/dishwasher-repair/')?.pageType).toBe('main_service');
    expect(plan.pages.find((p) => p.url === '/refrigerator-repair/')?.pageType).toBe('category_hub');
    expect(plan.pages.find((p) => p.url === '/refrigerator-repair/ice-maker-repair/')?.pageType).toBe('sub_service');
  });

  it('one PLAIN town page per town outside the proximity zone, under /service-areas/', () => {
    for (const u of ['/service-areas/boyce/', '/service-areas/colfax/', '/service-areas/lecompte/', '/service-areas/pollock/']) {
      expect(urls.has(u), u).toBe(true);
      expect(plan.pages.find((p) => p.url === u)?.pageType).toBe('town_page');
    }
    expect(plan.cities.find((c) => c.city === 'Colfax')?.treatment).toBe('plain_page');
  });

  it('plain town pages carry the FULL main service list linking to the ROOT pages, no silo beneath', () => {
    const colfax = plan.pages.find((p) => p.url === '/service-areas/colfax/')!;
    for (const u of ['/dishwasher-repair/', '/oven-range-repair/', '/refrigerator-repair/', '/washer-dryer-repair/']) expect(colfax.links).toContain(u);
    expect([...urls].some((u) => u.startsWith('/service-areas/colfax/') && u !== '/service-areas/colfax/')).toBe(false);
  });

  it('towns within ~10 mi of the Primary Market are proximity-covered (text only)', () => {
    expect(urls.has('/service-areas/pineville/')).toBe(false);
    expect(urls.has('/service-areas/ball/')).toBe(false);
    expect(plan.cities.find((c) => c.city === 'Pineville')?.treatment).toBe('proximity_covered');
  });

  it('/service-areas/ hub links every town page', () => {
    const hub = plan.pages.find((p) => p.pageType === 'service_areas')!;
    expect(hub.links).toContain('/service-areas/colfax/');
    expect(hub.links.some((l) => l.includes('pineville'))).toBe(false);
  });

  it('Primary Market neighborhoods hang off home at /neighborhoods/{slug}/', () => {
    expect(urls.has('/neighborhoods/garden-district/')).toBe(true);
    expect(plan.pages.find((p) => p.pageType === 'homepage')!.links).toContain('/neighborhoods/garden-district/');
  });

  it('sub-services never link to town pages', () => {
    for (const s of plan.pages.filter((p) => p.pageType === 'sub_service')) {
      expect(s.links.some((l) => l.startsWith('/service-areas/'))).toBe(false);
    }
  });

  it('every town has a slug and a reason', () => {
    for (const c of plan.cities) {
      expect(c.slug).toBeTruthy();
      expect(c.reason).toBeTruthy();
    }
  });
});

describe('planSite — travel strategy only sets the town-page count', () => {
  it('local: no town pages at all', () => {
    const plan = planSite({ ...ALEXANDRIA, travelStrategy: 'local' });
    expect(plan.pages.filter((p) => p.pageType === 'town_page')).toHaveLength(0);
    expect(plan.cities.find((c) => c.city === 'Colfax')?.treatment).toBe('text_mention_only');
    expect(plan.doNotBuild.some((d) => d.what === 'Town pages')).toBe(true);
  });

  it('regional caps plain town pages at 9; metro at 12', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ city: `Town ${i + 1}`, state: 'LA', distanceMiles: 20 + i }));
    const regional = planSite({ ...ALEXANDRIA, serviceAreaCities: many });
    const metro = planSite({ ...ALEXANDRIA, travelStrategy: 'metro', serviceAreaCities: many });
    expect(regional.pages.filter((p) => p.pageType === 'town_page')).toHaveLength(9);
    expect(metro.pages.filter((p) => p.pageType === 'town_page')).toHaveLength(12);
    expect(regional.cities.filter((c) => c.treatment === 'text_mention_only')).toHaveLength(6);
  });

  it('priority ("Dedicated page") forces a plain town page past proximity and the cap, even under local', () => {
    const plan = planSite({
      ...ALEXANDRIA,
      travelStrategy: 'local',
      serviceAreaCities: [{ city: 'Pineville', state: 'LA', distanceMiles: 3, priority: true }],
    });
    expect(urlsOf(plan).has('/service-areas/pineville/')).toBe(true);
    expect(plan.cities.find((c) => c.city === 'Pineville')?.treatment).toBe('plain_page');
  });
});

describe('planSite — a second GBP PROMOTES a town page', () => {
  const plan = planSite({
    ...ALEXANDRIA,
    serviceAreaCities: [
      { city: 'Lafayette', state: 'LA', anchored: true, distanceMiles: 90 },
      { city: 'Colfax', state: 'LA', distanceMiles: 25 },
    ],
  });
  const urls = urlsOf(plan);

  it('a town with its own GBP lives under /locations/ with a silo page per main-service entry', () => {
    expect(urls.has('/locations/lafayette/')).toBe(true);
    expect(urls.has('/service-areas/lafayette/')).toBe(false);
    expect(plan.pages.find((p) => p.url === '/locations/lafayette/')?.pageType).toBe('location_page');
    for (const u of [
      '/locations/lafayette/dishwasher-repair/',
      '/locations/lafayette/oven-range-repair/',
      '/locations/lafayette/refrigerator-repair/',
      '/locations/lafayette/washer-dryer-repair/',
    ]) {
      expect(urls.has(u), u).toBe(true);
      expect(plan.pages.find((p) => p.url === u)?.pageType).toBe('location_service');
    }
    expect(plan.cities.find((c) => c.city === 'Lafayette')?.treatment).toBe('promoted');
    expect(plan.cities.find((c) => c.city === 'Lafayette')?.pageUrl).toBe('/locations/lafayette/');
  });

  it('the /locations/ hub exists only once a location exists, and home links straight to every location page', () => {
    expect(urls.has('/locations/')).toBe(true);
    const home = plan.pages.find((p) => p.pageType === 'homepage')!;
    expect(home.links).toContain('/locations/lafayette/');
    expect(urlsOf(planSite(ALEXANDRIA)).has('/locations/')).toBe(false);
  });

  it('location cards link into the silo, not the root pages', () => {
    const loc = plan.pages.find((p) => p.url === '/locations/lafayette/')!;
    expect(loc.links).toContain('/locations/lafayette/refrigerator-repair/');
    expect(loc.links).not.toContain('/refrigerator-repair/');
  });

  it('silo pages link UP to their location page and SIDEWAYS to the root page', () => {
    const silo = plan.pages.find((p) => p.url === '/locations/lafayette/refrigerator-repair/')!;
    expect(silo.links).toContain('/locations/lafayette/');
    expect(silo.links).toContain('/refrigerator-repair/');
  });

  it('each GBP gets its own website-link recommendation; locations do not count against the cap', () => {
    expect(plan.gbpWebsiteLinks).toEqual([
      { city: 'Alexandria', url: '/' },
      { city: 'Lafayette', url: '/locations/lafayette/' },
    ]);
    expect(plan.cities.find((c) => c.city === 'Colfax')?.treatment).toBe('plain_page');
  });

  it('never gives a /{city}/ root hub to an anchored town (v5 retired), never /locations/ to a plain town', () => {
    expect(urls.has('/lafayette/')).toBe(false);
    expect(urls.has('/lafayette/refrigerator-repair/')).toBe(false);
    expect(urls.has('/locations/colfax/')).toBe(false);
  });
});

describe('planSite — v5 compatibility inputs are ignored', () => {
  it('homepageIsPrimaryMarket / topServices / niches change nothing', () => {
    const a = planSite(ALEXANDRIA);
    const b = planSite({ ...ALEXANDRIA, homepageIsPrimaryMarket: false, topServices: ['Refrigerator repair service'], niches: [{ key: 'x', topService: 'y' }] });
    expect(b.pages.map((p) => p.url)).toEqual(a.pages.map((p) => p.url));
  });
});
