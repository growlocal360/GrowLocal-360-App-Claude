// GBP categories where product/equipment brands are relevant to the business
const BRAND_APPLICABLE_GCIDS = new Set([
  // HVAC & Climate Control
  'gcid:hvac_contractor',
  'gcid:air_conditioning_repair_service',
  'gcid:air_conditioning_contractor',
  'gcid:heating_contractor',
  'gcid:furnace_repair_service',
  // Appliance Repair
  'gcid:appliance_repair_service',
  'gcid:refrigerator_repair_service',
  'gcid:washer_dryer_repair_service',
  // Auto
  'gcid:auto_repair_shop',
  'gcid:brake_shop',
  'gcid:tire_shop',
  // Other equipment-based
  'gcid:roofing_contractor',
  'gcid:swimming_pool_contractor',
  'gcid:swimming_pool_repair_service',
  'gcid:garage_door_supplier',
]);

export function isBrandApplicable(categoryGcids: string[]): boolean {
  return categoryGcids.some((gcid) => BRAND_APPLICABLE_GCIDS.has(gcid));
}
