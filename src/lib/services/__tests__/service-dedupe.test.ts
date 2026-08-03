import { describe, it, expect } from 'vitest';
import {
  normalizeServiceName,
  findDuplicateService,
  dedupeGeneratedServices,
  moveService,
} from '../service-dedupe';

// 5 HVAC-adjacent categories (the real overlap case).
const CATS = {
  acRepair: 'ac-repair',
  acContractor: 'ac-contractor',
  hvacContractor: 'hvac-contractor',
  heating: 'heating-contractor',
  appliance: 'appliance',
};
const categoryNameById: Record<string, string> = {
  [CATS.acRepair]: 'Air conditioning repair service',
  [CATS.acContractor]: 'Air conditioning contractor',
  [CATS.hvacContractor]: 'HVAC contractor',
  [CATS.heating]: 'Heating contractor',
  [CATS.appliance]: 'Appliance repair service',
};
const svc = (name: string, gcid: string, extra: Record<string, unknown> = {}) => ({
  id: `${gcid}-${name}`,
  name,
  categoryGcid: gcid,
  categoryName: categoryNameById[gcid],
  ...extra,
});

describe('normalizeServiceName', () => {
  it('treats interchangeable suffixes as equal', () => {
    expect(normalizeServiceName('Indoor Air Quality Services')).toBe(
      normalizeServiceName('Indoor Air Quality Solutions')
    );
  });
  it('ignores case, punctuation, and filler words', () => {
    expect(normalizeServiceName('AC Repair & Diagnostic Service')).toBe('ac repair diagnostic');
  });
});

describe('dedupeGeneratedServices — 5-category HVAC overlap', () => {
  const services = [
    svc('AC Repair & Diagnostic Service', CATS.acRepair), // repair-type dupe
    svc('AC Repair & Diagnostic Service', CATS.acContractor),
    svc('AC Installation & Replacement', CATS.acContractor), // install-type dupe
    svc('AC Installation & Replacement', CATS.hvacContractor),
    svc('Indoor Air Quality Services', CATS.hvacContractor), // whole-system near-dupe
    svc('Indoor Air Quality Solutions', CATS.acContractor),
    svc('Furnace Repair', CATS.heating), // unique
    svc('Refrigerator Repair', CATS.appliance), // unique
  ];
  const out = dedupeGeneratedServices(services, { primaryGcid: CATS.acRepair, categoryNameById });

  it('collapses every duplicate/near-dupe to exactly one', () => {
    expect(out).toHaveLength(5);
    const keys = out.map((s) => normalizeServiceName(s.name));
    expect(new Set(keys).size).toBe(keys.length); // no normalized name repeats
  });

  it('places by best-fit category', () => {
    const cat = (n: string) => out.find((s) => s.name.startsWith(n))?.categoryGcid;
    expect(cat('AC Repair')).toBe(CATS.acRepair); // repair → repair-service category
    expect(categoryNameById[cat('AC Installation')!]).toMatch(/contractor/i); // install → contractor
    expect(cat('Indoor Air Quality')).toBe(CATS.hvacContractor); // whole-system → broadest contractor
  });
});

describe('dedupeGeneratedServices — edge cases', () => {
  it('single-category customer: nothing removed', () => {
    const services = [svc('Drain Cleaning', 'plumber'), svc('Water Heater Repair', 'plumber')];
    expect(dedupeGeneratedServices(services, { primaryGcid: 'plumber' })).toHaveLength(2);
  });

  it('near-dup suffix pair collapses to one', () => {
    const services = [
      svc('Indoor Air Quality Services', CATS.hvacContractor),
      svc('Indoor Air Quality Solutions', CATS.acContractor),
    ];
    expect(dedupeGeneratedServices(services, { categoryNameById })).toHaveLength(1);
  });
});

describe('findDuplicateService — custom-add / move checks', () => {
  const existing = [svc('AC Repair & Diagnostic Service', CATS.acRepair), svc('Furnace Repair', CATS.heating)];

  it('flags a custom name matching an existing suggestion (any category)', () => {
    expect(findDuplicateService('ac repair diagnostic services', existing)?.categoryGcid).toBe(CATS.acRepair);
  });
  it('returns null for a genuinely new name', () => {
    expect(findDuplicateService('Ductless Mini Split Install', existing)).toBeNull();
  });
  it('can scope to a target category (move collision)', () => {
    expect(findDuplicateService('Furnace Repair', existing, { inCategoryGcid: CATS.acRepair })).toBeNull();
    expect(findDuplicateService('Furnace Repair', existing, { inCategoryGcid: CATS.heating })?.name).toBe('Furnace Repair');
  });
});

describe('moveService', () => {
  it('re-homes a service, preserving its description, with no duplicate left behind', () => {
    const services = [
      svc('Thermostat Installation', CATS.acRepair, { description: 'Install and configure smart thermostats.', isSelected: true }),
      svc('Furnace Repair', CATS.heating, { description: 'Fix furnaces.' }),
    ];
    const moved = moveService(services, services[0].id, CATS.hvacContractor, 'HVAC contractor');
    const t = moved.find((s) => s.name === 'Thermostat Installation')!;
    expect(t.categoryGcid).toBe(CATS.hvacContractor);
    expect(t.categoryName).toBe('HVAC contractor');
    expect(t.description).toBe('Install and configure smart thermostats.'); // preserved
    expect(t.isSelected).toBe(true); // preserved
    expect(moved).toHaveLength(2); // no duplicate created
    expect(moved.filter((s) => s.categoryGcid === CATS.acRepair)).toHaveLength(0); // gone from old category
  });
});
