// Site Setup Wizard Types

import type { WebsiteType } from './database';
import type { GBPCategoryData } from '@/data/gbp-categories';

export type WizardStep =
  | 'connect'        // Step 1: Connect GBP or Manual
  | 'locations'      // Step 2a: Select GBP Locations (if connected)
  | 'business'       // Step 2b: Business Basics (if manual)
  | 'categories'     // Step 3: GBP Categories
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
  services: [],
  serviceAreas: [],
  serviceAreaRadius: 25,
  neighborhoods: [],
  websiteType: null,
  currentStep: 'connect',
  isLoading: false,
  error: null,
};

// Step configuration
export const WIZARD_STEPS: { id: WizardStep; title: string; description: string }[] = [
  { id: 'connect', title: 'Connect', description: 'Import or start fresh' },
  { id: 'locations', title: 'Locations', description: 'Your business locations' },
  { id: 'categories', title: 'Categories', description: 'GBP categories' },
  { id: 'services', title: 'Services', description: 'Services you offer' },
  { id: 'service-areas', title: 'Areas', description: 'Cities you travel to' },
  { id: 'neighborhoods', title: 'Local', description: 'Neighborhoods in your city' },
  { id: 'website-type', title: 'Type', description: 'Choose structure' },
  { id: 'review', title: 'Review', description: 'Confirm & create' },
];

// For manual flow, we use 'business' instead of 'locations'
export const getStepsForFlow = (connectionType: 'google' | 'manual'): WizardStep[] => {
  if (connectionType === 'google') {
    return ['connect', 'locations', 'categories', 'services', 'service-areas', 'neighborhoods', 'website-type', 'review'];
  }
  return ['connect', 'business', 'categories', 'services', 'service-areas', 'neighborhoods', 'website-type', 'review'];
};
