// Site Setup Wizard Types

import type { WebsiteType } from './database';
import type { GBPCategoryData } from '@/data/gbp-categories';

export type WizardStep =
  | 'connect'        // Step 1: Connect GBP or Manual
  | 'locations'      // Step 2a: Select GBP Locations (if connected)
  | 'business'       // Step 2b: Business Basics (if manual)
  | 'categories'     // Step 3: GBP Categories
  | 'brands'         // Step 3.5: Brands (conditional — brand-applicable categories only)
  | 'services'       // Step 4: Services offered
  | 'service-areas'  // Step 5: Service Areas (cities you travel to)
  | 'neighborhoods'  // Step 6: Neighborhoods (hyper-local within GBP city)
  | 'website-type'   // Step 7: Website Type Selection
  | 'review';        // Step 8: Review & Generate

export interface WizardLocation {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  isPrimary: boolean;
  // GBP data if imported
  gbpPlaceId?: string;
  gbpAccountId?: string;
  gbpLocationId?: string;
  gbpCategory?: string;
  latitude?: number;
  longitude?: number;
  // Per-location GBP categories (imported from GBP API)
  gbpPrimaryCategory?: { gcid: string; displayName: string };
  gbpAdditionalCategories?: { gcid: string; displayName: string }[];
  // SAB (Service Area Business) support
  businessType?: 'CUSTOMER_LOCATION_ONLY' | 'CUSTOMER_AND_BUSINESS_LOCATION';
  representativeCity?: string;
  representativeState?: string;
}

export interface ServiceArea {
  id: string;
  name: string; // City/Town name
  state: string;
  placeId?: string;
  population?: number;
  distanceMiles?: number;
  nearestLocationId?: string; // Which GBP location is closest
  isCustom?: boolean; // User-added vs AI-suggested
}

// Neighborhoods are hyper-local areas WITHIN a GBP location's city
// They feed geographic relevance to the parent location page
export interface WizardNeighborhood {
  id: string;
  name: string;
  locationId: string; // Links to the parent WizardLocation
  placeId?: string;
  latitude?: number;
  longitude?: number;
  isCustom?: boolean;
}

// Brands serviced by the business (conditional — brand-applicable categories only)
export interface WizardBrand {
  id: string;
  name: string;
  isSelected: boolean;
  isCustom: boolean;
}

// Services offered by the business
export interface WizardService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryGcid: string; // Which category this service belongs to
  categoryName: string; // Display name of the category
  isSelected: boolean;
  isCustom: boolean;
  sortOrder: number;
}

// Microsite configuration — collected when websiteType === 'microsite'
export interface MicrositeConfig {
  targetCity: string;           // e.g. "Sarasota"
  targetCityState: string;      // e.g. "FL"
  targetServiceId: string;      // references WizardService.id
  targetServiceName: string;    // e.g. "Refrigerator Repair"
  targetCategoryGcid: string;   // parent category GCID
  targetCategoryName: string;   // e.g. "Appliance Repair"
  brandMode: 'all_major' | 'single_brand';
  selectedBrandName?: string;   // only when brandMode === 'single_brand'
  suggestedSlug: string;        // e.g. "sarasota-refrigerator-repair"
}

// GSC query data fetched during wizard (pre-site-creation)
export interface WizardGSCQuery {
  query: string;
  pageUrl: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  dateRangeStart: string;
  dateRangeEnd: string;
}

export interface WizardState {
  // Step 1
  connectionType: 'google' | 'manual' | null;
  googleConnected: boolean;
  googleAccessToken?: string;

  // Step 2
  businessName: string;
  coreIndustry: string;
  locations: WizardLocation[];

  // Step 3
  primaryCategory: GBPCategoryData | null;
  secondaryCategories: GBPCategoryData[];

  // Step 3.5: Brands (conditional)
  brands: WizardBrand[];

  // Step 4: Services
  services: WizardService[];

  // Step 5: Service Areas (cities you travel to)
  serviceAreas: ServiceArea[];
  serviceAreaRadius: number; // in miles

  // Step 6: Neighborhoods (hyper-local within GBP city)
  neighborhoods: WizardNeighborhood[];

  // Step 7
  websiteType: WebsiteType | null;
  domain?: string;
  micrositeConfig: MicrositeConfig | null;

  // GSC (Google Search Console) — optional, enhances content generation
  gscPropertyUrl: string | null;
  gscQueries: WizardGSCQuery[];

  // Metadata
  currentStep: WizardStep;
  isLoading: boolean;
  error: string | null;
}

export const initialWizardState: WizardState = {
  connectionType: null,
  googleConnected: false,
  businessName: '',
  coreIndustry: '',
  locations: [],
  primaryCategory: null,
  secondaryCategories: [],
  brands: [],
  services: [],
  serviceAreas: [],
  serviceAreaRadius: 25,
  neighborhoods: [],
  websiteType: null,
  micrositeConfig: null,
  gscPropertyUrl: null,
  gscQueries: [],
  currentStep: 'connect',
  isLoading: false,
  error: null,
};

// Step configuration (includes all possible steps; brands is conditional)
export const WIZARD_STEPS: { id: WizardStep; title: string; description: string }[] = [
  { id: 'connect', title: 'Connect', description: 'Import or start fresh' },
  { id: 'locations', title: 'Locations', description: 'Your business locations' },
  { id: 'categories', title: 'Categories', description: 'GBP categories' },
  { id: 'brands', title: 'Brands', description: 'Brands you service' },
  { id: 'services', title: 'Services', description: 'Services you offer' },
  { id: 'service-areas', title: 'Areas', description: 'Cities you travel to' },
  { id: 'neighborhoods', title: 'Local', description: 'Neighborhoods in your city' },
  { id: 'website-type', title: 'Type', description: 'Choose structure' },
  { id: 'review', title: 'Review', description: 'Confirm & create' },
];

// For manual flow, we use 'business' instead of 'locations'
// includeBrands is true when selected categories are brand-applicable (HVAC, appliance, auto, etc.)
export const getStepsForFlow = (
  connectionType: 'google' | 'manual',
  options?: { includeBrands?: boolean }
): WizardStep[] => {
  const base: WizardStep[] = connectionType === 'google'
    ? ['connect', 'locations', 'categories']
    : ['connect', 'business', 'categories'];

  if (options?.includeBrands) base.push('brands');

  base.push('services', 'service-areas', 'neighborhoods', 'website-type', 'review');
  return base;
};
