// GBP categories where product/equipment brands are relevant to the business.
// Uses regex patterns on the GCID string so new Google category variants are
// automatically matched without any list maintenance.
const BRAND_APPLICABLE_PATTERNS: RegExp[] = [
  // HVAC — all variants: hvac_contractor, hvac_systems_supplier, hvac_engineer, etc.
  /hvac/,
  /air_condition/,        // air_conditioning_repair_service, air_conditioning_contractor, etc.
  /heating/,              // heating_contractor, heating_equipment_supplier, etc.
  /furnace/,
  /mechanical_contractor/,

  // Appliance repair — all variants
  /appliance/,            // appliance_repair_service, small_appliance_repair_service
  /refrigerator/,
  /washer/,
  /dryer/,
  /dishwasher/,

  // Auto
  /auto_repair/,
  /tire_shop/,
  /brake_shop/,
  /auto_body/,

  // Plumbing (water heaters, fixtures)
  /\bplumber\b/,
  /\bplumbing\b/,
  /water_heater/,

  // Electrical (panels, devices)
  /\belectrician\b/,
  /electrical_install/,

  // Generators
  /generator/,

  // Garage door — catches both garage_door_supplier and garage_door_repair_service
  /garage_door/,

  // Roofing / pools
  /roofing/,
  /swimming_pool/,

  // Flooring
  /flooring/,
  /carpet_install/,

  // Kitchen / bath remodel
  /kitchen_remodel/,
  /bathroom_remodel/,
];

export function isBrandApplicable(categoryGcids: string[]): boolean {
  return categoryGcids.some((gcid) =>
    BRAND_APPLICABLE_PATTERNS.some((pattern) => pattern.test(gcid))
  );
}
