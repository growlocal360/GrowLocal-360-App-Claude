import { describe, it, expect } from 'vitest';
import { normalizeCategorySlug } from '../slugify';

describe('normalizeCategorySlug', () => {
  // --- Required spec examples ---

  it('"Appliance Repair Service" → "appliance-repair"', () => {
    expect(normalizeCategorySlug('Appliance Repair Service')).toBe('appliance-repair');
  });

  it('"Pressure Washing Service" → "pressure-washing"', () => {
    expect(normalizeCategorySlug('Pressure Washing Service')).toBe('pressure-washing');
  });

  it('"Washer and Dryer Repair Service" → "washer-dryer-repair"', () => {
    expect(normalizeCategorySlug('Washer and Dryer Repair Service')).toBe('washer-dryer-repair');
  });

  it('"Washer & Dryer Repair Service" → "washer-dryer-repair"', () => {
    expect(normalizeCategorySlug('Washer & Dryer Repair Service')).toBe('washer-dryer-repair');
  });

  it('"Drone Service" → "drone-service" (single-word guard)', () => {
    expect(normalizeCategorySlug('Drone Service')).toBe('drone-service');
  });

  it('"Dating Service" → "dating-service" (single-word guard)', () => {
    expect(normalizeCategorySlug('Dating Service')).toBe('dating-service');
  });

  it('"Tree Service" → "tree-service" (single-word guard)', () => {
    expect(normalizeCategorySlug('Tree Service')).toBe('tree-service');
  });

  it('"HVAC contractor" → "hvac-contractor" (no suffix match)', () => {
    expect(normalizeCategorySlug('HVAC contractor')).toBe('hvac-contractor');
  });

  // --- Blocklist guard (2+ words remaining) ---

  it('"House Cleaning Services" → "house-cleaning-services" (blocklist guard)', () => {
    expect(normalizeCategorySlug('House Cleaning Services')).toBe('house-cleaning-services');
  });

  // --- Single-word remaining guard ---

  it('"Plumbing Services" → "plumbing-services" (single-word guard)', () => {
    expect(normalizeCategorySlug('Plumbing Services')).toBe('plumbing-services');
  });

  // --- Real GBP categories ---

  it('"Refrigerator Repair Service" → "refrigerator-repair"', () => {
    expect(normalizeCategorySlug('Refrigerator Repair Service')).toBe('refrigerator-repair');
  });

  it('"Dryer Vent Cleaning Service" → "dryer-vent-cleaning-service" (blocklist guard)', () => {
    expect(normalizeCategorySlug('Dryer Vent Cleaning Service')).toBe('dryer-vent-cleaning-service');
  });

  it('"Air Conditioning Repair Service" → "air-conditioning-repair"', () => {
    expect(normalizeCategorySlug('Air Conditioning Repair Service')).toBe('air-conditioning-repair');
  });

  // --- Baseline slugification ---

  it('converts ampersand to "and"', () => {
    expect(normalizeCategorySlug('Heating & Cooling')).toBe('heating-and-cooling');
  });

  it('removes apostrophes', () => {
    expect(normalizeCategorySlug("Mike's Plumbing Service")).toBe('mikes-plumbing');
  });

  it('handles empty string', () => {
    expect(normalizeCategorySlug('')).toBe('');
  });

  it('handles whitespace-only string', () => {
    expect(normalizeCategorySlug('   ')).toBe('');
  });

  // --- Options override ---

  it('respects custom empty suffixes list (no stripping)', () => {
    expect(normalizeCategorySlug('Appliance Repair Service', { suffixes: [] }))
      .toBe('appliance-repair-service');
  });

  it('respects custom blocklist override', () => {
    // "repair" not in default blocklist, but adding it should prevent stripping
    expect(normalizeCategorySlug('Appliance Repair Service', { blocklist: ['repair'] }))
      .toBe('appliance-repair-service');
  });

  // --- Phrase compaction ---

  it('"Washers and Dryers Repair Service" → "washer-dryer-repair"', () => {
    expect(normalizeCategorySlug('Washers and Dryers Repair Service')).toBe('washer-dryer-repair');
  });
});
