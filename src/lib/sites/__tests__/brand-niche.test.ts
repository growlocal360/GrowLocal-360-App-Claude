import { describe, it, expect } from 'vitest';
import { filterServicesForBrand, resolveBrandCategoryName } from '../brand-niche';

const HVAC = 'cat-hvac';
const APPL = 'cat-appliance';
const services = [
  { id: 's1', name: 'AC Repair', site_category_id: HVAC },
  { id: 's2', name: 'Furnace Repair', site_category_id: HVAC },
  { id: 's3', name: 'Refrigerator Repair', site_category_id: APPL },
  { id: 's4', name: 'Washer Repair', site_category_id: APPL },
];

describe('filterServicesForBrand', () => {
  it('shows only the brand niche when the brand is tied to a category', () => {
    expect(filterServicesForBrand(services, HVAC).map((s) => s.name)).toEqual(['AC Repair', 'Furnace Repair']);
    expect(filterServicesForBrand(services, APPL).map((s) => s.name)).toEqual(['Refrigerator Repair', 'Washer Repair']);
  });

  it('shows all services for a "Both" brand (null category)', () => {
    expect(filterServicesForBrand(services, null)).toHaveLength(4);
  });
});

describe('resolveBrandCategoryName', () => {
  const names = new Map([[HVAC, 'HVAC'], [APPL, 'Appliance Repair']]);
  const combined = 'HVAC & Appliance Repair';

  it('uses the brand\'s own category name when set', () => {
    expect(resolveBrandCategoryName(HVAC, names, combined)).toBe('HVAC');
    expect(resolveBrandCategoryName(APPL, names, combined)).toBe('Appliance Repair');
  });

  it('falls back to the combined label for a "Both"/unknown brand', () => {
    expect(resolveBrandCategoryName(null, names, combined)).toBe(combined);
    expect(resolveBrandCategoryName('missing-id', names, combined)).toBe(combined);
  });
});
