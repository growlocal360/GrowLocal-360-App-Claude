// Google Business Profile Categories Database
// This is a curated list of common service business categories
// Full list can be fetched from Google's API, but this covers most service businesses

export interface GBPCategoryData {
  gcid: string;
  name: string;
  displayName: string;
  keywords: string[]; // Keywords that match this category
  relatedCategories: string[]; // Related GCIDs for secondary category suggestions
  commonServices: string[]; // Common services under this category
}

export const GBP_CATEGORIES: GBPCategoryData[] = [
  // HVAC & Climate Control
  {
    gcid: 'gcid:air_conditioning_repair_service',
    name: 'air_conditioning_repair_service',
    displayName: 'Air Conditioning Repair Service',
    keywords: ['ac repair', 'a/c repair', 'air conditioning', 'ac fix', 'ac service', 'cooling repair', 'ac not working', 'ac not cooling'],
    relatedCategories: ['gcid:hvac_contractor', 'gcid:air_conditioning_contractor', 'gcid:furnace_repair_service', 'gcid:heating_contractor'],
    commonServices: ['AC Repair', 'AC Maintenance', 'AC Installation', 'Refrigerant Recharge', 'Thermostat Repair', 'Duct Cleaning', 'Emergency AC Repair']
  },
  {
    gcid: 'gcid:hvac_contractor',
    name: 'hvac_contractor',
    displayName: 'HVAC Contractor',
    keywords: ['hvac', 'heating and cooling', 'heating ventilation', 'climate control', 'hvac install', 'hvac service'],
    relatedCategories: ['gcid:air_conditioning_repair_service', 'gcid:furnace_repair_service', 'gcid:heating_contractor', 'gcid:air_conditioning_contractor'],
    commonServices: ['HVAC Installation', 'HVAC Repair', 'System Maintenance', 'Duct Installation', 'Indoor Air Quality', 'Zoning Systems']
  },
  {
    gcid: 'gcid:air_conditioning_contractor',
    name: 'air_conditioning_contractor',
    displayName: 'Air Conditioning Contractor',
    keywords: ['ac contractor', 'ac installation', 'air conditioning install', 'new ac', 'ac replacement'],
    relatedCategories: ['gcid:air_conditioning_repair_service', 'gcid:hvac_contractor', 'gcid:heating_contractor'],
    commonServices: ['AC Installation', 'AC Replacement', 'Ductless Mini Split', 'Central Air Installation', 'Commercial AC']
  },
  {
    gcid: 'gcid:furnace_repair_service',
    name: 'furnace_repair_service',
    displayName: 'Furnace Repair Service',
    keywords: ['furnace repair', 'heater repair', 'furnace fix', 'furnace not working', 'heating repair'],
    relatedCategories: ['gcid:hvac_contractor', 'gcid:heating_contractor', 'gcid:air_conditioning_repair_service'],
    commonServices: ['Furnace Repair', 'Furnace Maintenance', 'Heat Exchanger Repair', 'Ignitor Replacement', 'Blower Motor Repair']
  },
  {
    gcid: 'gcid:heating_contractor',
    name: 'heating_contractor',
    displayName: 'Heating Contractor',
    keywords: ['heating contractor', 'heating install', 'heater install', 'furnace install', 'heating system'],
    relatedCategories: ['gcid:hvac_contractor', 'gcid:furnace_repair_service', 'gcid:air_conditioning_contractor'],
    commonServices: ['Heating Installation', 'Furnace Installation', 'Boiler Installation', 'Radiant Heating', 'Heat Pump Installation']
  },

  // Plumbing
  {
    gcid: 'gcid:plumber',
    name: 'plumber',
    displayName: 'Plumber',
    keywords: ['plumber', 'plumbing', 'pipes', 'leak repair', 'drain', 'water heater', 'toilet', 'faucet'],
    relatedCategories: ['gcid:drain_cleaning_service', 'gcid:water_heater_repair_service', 'gcid:septic_system_service'],
    commonServices: ['Leak Repair', 'Drain Cleaning', 'Water Heater Repair', 'Toilet Repair', 'Faucet Installation', 'Pipe Repair', 'Sewer Line Repair']
  },
  {
    gcid: 'gcid:drain_cleaning_service',
    name: 'drain_cleaning_service',
    displayName: 'Drain Cleaning Service',
    keywords: ['drain cleaning', 'clogged drain', 'drain unclog', 'sewer cleaning', 'rooter'],
    relatedCategories: ['gcid:plumber', 'gcid:septic_system_service'],
    commonServices: ['Drain Cleaning', 'Hydro Jetting', 'Camera Inspection', 'Root Removal', 'Main Line Cleaning']
  },
  {
    gcid: 'gcid:water_heater_repair_service',
    name: 'water_heater_repair_service',
    displayName: 'Water Heater Repair Service',
    keywords: ['water heater', 'hot water', 'water heater repair', 'tankless', 'water heater install'],
    relatedCategories: ['gcid:plumber', 'gcid:water_heater_installation_service'],
    commonServices: ['Water Heater Repair', 'Tankless Water Heater', 'Water Heater Installation', 'Anode Rod Replacement']
  },

  // Electrical
  {
    gcid: 'gcid:electrician',
    name: 'electrician',
    displayName: 'Electrician',
    keywords: ['electrician', 'electrical', 'wiring', 'outlet', 'circuit', 'panel', 'lighting'],
    relatedCategories: ['gcid:electrical_installation_service', 'gcid:lighting_contractor'],
    commonServices: ['Electrical Repair', 'Panel Upgrade', 'Outlet Installation', 'Wiring', 'Lighting Installation', 'Generator Installation']
  },
  {
    gcid: 'gcid:electrical_installation_service',
    name: 'electrical_installation_service',
    displayName: 'Electrical Installation Service',
    keywords: ['electrical install', 'electrical contractor', 'commercial electrical'],
    relatedCategories: ['gcid:electrician', 'gcid:lighting_contractor'],
    commonServices: ['New Construction Wiring', 'Commercial Electrical', 'Industrial Electrical', 'EV Charger Installation']
  },

  // Appliance Repair
  {
    gcid: 'gcid:appliance_repair_service',
    name: 'appliance_repair_service',
    displayName: 'Appliance Repair Service',
    keywords: ['appliance repair', 'washer repair', 'dryer repair', 'refrigerator repair', 'dishwasher repair', 'oven repair', 'stove repair'],
    relatedCategories: ['gcid:refrigerator_repair_service', 'gcid:washer_dryer_repair_service'],
    commonServices: ['Refrigerator Repair', 'Washer Repair', 'Dryer Repair', 'Dishwasher Repair', 'Oven Repair', 'Microwave Repair']
  },
  {
    gcid: 'gcid:refrigerator_repair_service',
    name: 'refrigerator_repair_service',
    displayName: 'Refrigerator Repair Service',
    keywords: ['refrigerator repair', 'fridge repair', 'freezer repair', 'refrigerator not cooling'],
    relatedCategories: ['gcid:appliance_repair_service'],
    commonServices: ['Refrigerator Repair', 'Freezer Repair', 'Ice Maker Repair', 'Compressor Repair', 'Thermostat Repair']
  },

  // Roofing
  {
    gcid: 'gcid:roofing_contractor',
    name: 'roofing_contractor',
    displayName: 'Roofing Contractor',
    keywords: ['roofing', 'roof repair', 'roof replacement', 'roofer', 'shingles', 'roof leak'],
    relatedCategories: ['gcid:gutter_cleaning_service', 'gcid:siding_contractor'],
    commonServices: ['Roof Repair', 'Roof Replacement', 'Shingle Repair', 'Flat Roof Repair', 'Roof Inspection', 'Emergency Roof Repair']
  },

  // Garage Door
  {
    gcid: 'gcid:garage_door_supplier',
    name: 'garage_door_supplier',
    displayName: 'Garage Door Supplier',
    keywords: ['garage door', 'garage door repair', 'garage door install', 'garage door opener'],
    relatedCategories: ['gcid:door_supplier'],
    commonServices: ['Garage Door Repair', 'Garage Door Installation', 'Opener Repair', 'Spring Replacement', 'Panel Replacement']
  },

  // Pest Control
  {
    gcid: 'gcid:pest_control_service',
    name: 'pest_control_service',
    displayName: 'Pest Control Service',
    keywords: ['pest control', 'exterminator', 'bug spray', 'termite', 'rodent', 'ant', 'roach'],
    relatedCategories: ['gcid:termite_control_service', 'gcid:wildlife_control_service'],
    commonServices: ['General Pest Control', 'Termite Treatment', 'Rodent Control', 'Bed Bug Treatment', 'Mosquito Control', 'Ant Treatment']
  },

  // Landscaping
  {
    gcid: 'gcid:landscaper',
    name: 'landscaper',
    displayName: 'Landscaper',
    keywords: ['landscaping', 'landscaper', 'yard work', 'lawn care', 'garden', 'hardscape'],
    relatedCategories: ['gcid:lawn_care_service', 'gcid:tree_service', 'gcid:irrigation_system_supplier'],
    commonServices: ['Landscape Design', 'Lawn Maintenance', 'Hardscaping', 'Planting', 'Mulching', 'Sod Installation']
  },
  {
    gcid: 'gcid:lawn_care_service',
    name: 'lawn_care_service',
    displayName: 'Lawn Care Service',
    keywords: ['lawn care', 'lawn mowing', 'grass cutting', 'lawn maintenance', 'lawn treatment'],
    relatedCategories: ['gcid:landscaper', 'gcid:tree_service'],
    commonServices: ['Lawn Mowing', 'Fertilization', 'Weed Control', 'Aeration', 'Overseeding', 'Lawn Treatment']
  },

  // Cleaning
  {
    gcid: 'gcid:house_cleaning_service',
    name: 'house_cleaning_service',
    displayName: 'House Cleaning Service',
    keywords: ['house cleaning', 'home cleaning', 'maid service', 'cleaning service', 'deep cleaning'],
    relatedCategories: ['gcid:carpet_cleaning_service', 'gcid:window_cleaning_service'],
    commonServices: ['Regular Cleaning', 'Deep Cleaning', 'Move In/Out Cleaning', 'Post Construction Cleaning']
  },
  {
    gcid: 'gcid:carpet_cleaning_service',
    name: 'carpet_cleaning_service',
    displayName: 'Carpet Cleaning Service',
    keywords: ['carpet cleaning', 'carpet cleaner', 'rug cleaning', 'upholstery cleaning', 'steam cleaning'],
    relatedCategories: ['gcid:house_cleaning_service'],
    commonServices: ['Carpet Cleaning', 'Upholstery Cleaning', 'Rug Cleaning', 'Stain Removal', 'Pet Odor Removal']
  },

  // Painting
  {
    gcid: 'gcid:painter',
    name: 'painter',
    displayName: 'Painter',
    keywords: ['painter', 'painting', 'house painting', 'interior painting', 'exterior painting'],
    relatedCategories: ['gcid:painting_contractor'],
    commonServices: ['Interior Painting', 'Exterior Painting', 'Cabinet Painting', 'Deck Staining', 'Commercial Painting']
  },

  // Fencing
  {
    gcid: 'gcid:fence_contractor',
    name: 'fence_contractor',
    displayName: 'Fence Contractor',
    keywords: ['fence', 'fencing', 'fence install', 'fence repair', 'gate'],
    relatedCategories: ['gcid:deck_builder'],
    commonServices: ['Fence Installation', 'Fence Repair', 'Gate Installation', 'Wood Fence', 'Vinyl Fence', 'Chain Link Fence']
  },

  // Pool
  {
    gcid: 'gcid:swimming_pool_contractor',
    name: 'swimming_pool_contractor',
    displayName: 'Swimming Pool Contractor',
    keywords: ['pool', 'swimming pool', 'pool builder', 'pool install', 'pool construction'],
    relatedCategories: ['gcid:swimming_pool_repair_service', 'gcid:pool_cleaning_service'],
    commonServices: ['Pool Construction', 'Pool Renovation', 'Pool Decking', 'Spa Installation']
  },
  {
    gcid: 'gcid:swimming_pool_repair_service',
    name: 'swimming_pool_repair_service',
    displayName: 'Swimming Pool Repair Service',
    keywords: ['pool repair', 'pool pump', 'pool leak', 'pool equipment'],
    relatedCategories: ['gcid:swimming_pool_contractor', 'gcid:pool_cleaning_service'],
    commonServices: ['Pool Pump Repair', 'Pool Heater Repair', 'Leak Detection', 'Equipment Repair', 'Resurfacing']
  },

  // Locksmith
  {
    gcid: 'gcid:locksmith',
    name: 'locksmith',
    displayName: 'Locksmith',
    keywords: ['locksmith', 'lock', 'key', 'lockout', 'rekey', 'lock change'],
    relatedCategories: ['gcid:security_system_supplier'],
    commonServices: ['Lockout Service', 'Lock Rekey', 'Lock Installation', 'Key Duplication', 'Safe Opening', 'Car Key Replacement']
  },

  // Moving
  {
    gcid: 'gcid:moving_company',
    name: 'moving_company',
    displayName: 'Moving Company',
    keywords: ['moving', 'movers', 'moving company', 'relocation', 'packing'],
    relatedCategories: ['gcid:storage_facility'],
    commonServices: ['Local Moving', 'Long Distance Moving', 'Packing Services', 'Loading/Unloading', 'Commercial Moving']
  },

  // Concrete
  {
    gcid: 'gcid:concrete_contractor',
    name: 'concrete_contractor',
    displayName: 'Concrete Contractor',
    keywords: ['concrete', 'cement', 'driveway', 'sidewalk', 'patio', 'foundation'],
    relatedCategories: ['gcid:masonry_contractor', 'gcid:paving_contractor'],
    commonServices: ['Concrete Driveways', 'Concrete Patios', 'Foundation Repair', 'Stamped Concrete', 'Concrete Repair']
  },

  // General Contractor
  {
    gcid: 'gcid:general_contractor',
    name: 'general_contractor',
    displayName: 'General Contractor',
    keywords: ['general contractor', 'contractor', 'remodel', 'renovation', 'construction', 'home improvement'],
    relatedCategories: ['gcid:home_improvement_store', 'gcid:kitchen_remodeler', 'gcid:bathroom_remodeler'],
    commonServices: ['Home Remodeling', 'Kitchen Remodel', 'Bathroom Remodel', 'Room Addition', 'Home Renovation']
  },

  // Auto
  {
    gcid: 'gcid:auto_repair_shop',
    name: 'auto_repair_shop',
    displayName: 'Auto Repair Shop',
    keywords: ['auto repair', 'car repair', 'mechanic', 'car service', 'auto service'],
    relatedCategories: ['gcid:brake_shop', 'gcid:oil_change_service', 'gcid:tire_shop'],
    commonServices: ['Oil Change', 'Brake Repair', 'Engine Repair', 'Transmission Repair', 'AC Repair', 'Diagnostics']
  },

  // Towing
  {
    gcid: 'gcid:towing_service',
    name: 'towing_service',
    displayName: 'Towing Service',
    keywords: ['towing', 'tow truck', 'roadside assistance', 'car tow', 'vehicle towing'],
    relatedCategories: ['gcid:auto_repair_shop'],
    commonServices: ['Emergency Towing', 'Flatbed Towing', 'Roadside Assistance', 'Jump Start', 'Tire Change', 'Lockout Service']
  },

  // Junk Removal
  {
    gcid: 'gcid:junk_removal_service',
    name: 'junk_removal_service',
    displayName: 'Junk Removal Service',
    keywords: ['junk removal', 'hauling', 'trash removal', 'debris removal', 'cleanout'],
    relatedCategories: ['gcid:dumpster_rental_service'],
    commonServices: ['Junk Removal', 'Furniture Removal', 'Appliance Removal', 'Estate Cleanout', 'Construction Debris']
  },

  // Window
  {
    gcid: 'gcid:window_installation_service',
    name: 'window_installation_service',
    displayName: 'Window Installation Service',
    keywords: ['window installation', 'window replacement', 'new windows', 'window contractor'],
    relatedCategories: ['gcid:glass_repair_service', 'gcid:door_supplier'],
    commonServices: ['Window Installation', 'Window Replacement', 'Energy Efficient Windows', 'Bay Windows', 'Picture Windows']
  },

  // Flooring
  {
    gcid: 'gcid:flooring_contractor',
    name: 'flooring_contractor',
    displayName: 'Flooring Contractor',
    keywords: ['flooring', 'floor install', 'hardwood', 'tile', 'carpet', 'laminate', 'vinyl'],
    relatedCategories: ['gcid:tile_contractor', 'gcid:carpet_installation_service'],
    commonServices: ['Hardwood Installation', 'Tile Installation', 'Carpet Installation', 'Laminate Flooring', 'Vinyl Flooring']
  },

  // Septic
  {
    gcid: 'gcid:septic_system_service',
    name: 'septic_system_service',
    displayName: 'Septic System Service',
    keywords: ['septic', 'septic tank', 'septic pumping', 'septic repair', 'septic install'],
    relatedCategories: ['gcid:plumber', 'gcid:drain_cleaning_service'],
    commonServices: ['Septic Pumping', 'Septic Inspection', 'Septic Repair', 'Septic Installation', 'Drain Field Repair']
  },

  // Tree Service
  {
    gcid: 'gcid:tree_service',
    name: 'tree_service',
    displayName: 'Tree Service',
    keywords: ['tree service', 'tree removal', 'tree trimming', 'tree cutting', 'stump removal', 'arborist'],
    relatedCategories: ['gcid:landscaper', 'gcid:lawn_care_service'],
    commonServices: ['Tree Removal', 'Tree Trimming', 'Stump Grinding', 'Tree Pruning', 'Emergency Tree Service', 'Land Clearing']
  },

  // Pressure Washing
  {
    gcid: 'gcid:pressure_washing_service',
    name: 'pressure_washing_service',
    displayName: 'Pressure Washing Service',
    keywords: ['pressure washing', 'power washing', 'exterior cleaning', 'driveway cleaning', 'deck cleaning'],
    relatedCategories: ['gcid:house_cleaning_service', 'gcid:window_cleaning_service'],
    commonServices: ['House Washing', 'Driveway Cleaning', 'Deck Cleaning', 'Roof Cleaning', 'Commercial Pressure Washing']
  },
];

// Helper function to search categories by keyword
export function searchCategories(query: string): GBPCategoryData[] {
  const normalizedQuery = query.toLowerCase().trim();

  return GBP_CATEGORIES.filter(category => {
    // Check display name
    if (category.displayName.toLowerCase().includes(normalizedQuery)) return true;

    // Check keywords
    if (category.keywords.some(kw => kw.includes(normalizedQuery) || normalizedQuery.includes(kw))) return true;

    return false;
  }).sort((a, b) => {
    // Prioritize exact keyword matches
    const aExact = a.keywords.some(kw => kw === normalizedQuery);
    const bExact = b.keywords.some(kw => kw === normalizedQuery);
    if (aExact && !bExact) return -1;
    if (bExact && !aExact) return 1;
    return 0;
  });
}

// Get category by GCID
export function getCategoryByGcid(gcid: string): GBPCategoryData | undefined {
  return GBP_CATEGORIES.find(cat => cat.gcid === gcid);
}

// Get related categories for a given category
export function getRelatedCategories(gcid: string): GBPCategoryData[] {
  const category = getCategoryByGcid(gcid);
  if (!category) return [];

  return category.relatedCategories
    .map(relatedGcid => getCategoryByGcid(relatedGcid))
    .filter((cat): cat is GBPCategoryData => cat !== undefined);
}

// Get all categories for a specific industry
export function getCategoriesForIndustry(industry: string): {
  primary: GBPCategoryData[];
  secondary: GBPCategoryData[];
} {
  const matches = searchCategories(industry);

  if (matches.length === 0) {
    return { primary: [], secondary: [] };
  }

  // First match is the best primary category
  const primary = matches.slice(0, 3); // Top 3 options for primary

  // Get all related categories as secondary options
  const secondarySet = new Set<string>();
  matches.forEach(match => {
    match.relatedCategories.forEach(gcid => secondarySet.add(gcid));
  });

  // Remove any categories that are already in primary
  primary.forEach(p => secondarySet.delete(p.gcid));

  const secondary = Array.from(secondarySet)
    .map(gcid => getCategoryByGcid(gcid))
    .filter((cat): cat is GBPCategoryData => cat !== undefined);

  return { primary, secondary };
}
