// Site Setup Wizard Types

import type { WebsiteType } from './database';
import type { GBPCategoryData } from '@/data/gbp-categories';

export type WizardStep =
  | 'connect'      // Step 1: Connect GBP or Manual
  | 'locations'    // Step 2a: Select GBP Locations (if connected)
  | 'business'     // Step 2b: Business Basics (if manual)
  | 'categories'   // Step 3: GBP Categories
  | 'website-type' // Step 4: Website Type Selection
  | 'review';      // Step 5: Review & Generate

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

  // Step 4
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
  { id: 'website-type', title: 'Website Type', description: 'Choose structure' },
  { id: 'review', title: 'Review', description: 'Confirm & create' },
];

// For manual flow, we use 'business' instead of 'locations'
export const getStepsForFlow = (connectionType: 'google' | 'manual'): WizardStep[] => {
  if (connectionType === 'google') {
    return ['connect', 'locations', 'categories', 'website-type', 'review'];
  }
  return ['connect', 'business', 'categories', 'website-type', 'review'];
};
