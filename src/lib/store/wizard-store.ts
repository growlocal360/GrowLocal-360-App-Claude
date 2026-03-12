import { create } from 'zustand';
import type { WizardState, WizardStep, WizardLocation, ServiceArea, WizardNeighborhood, WizardService, WizardBrand, WizardGSCQuery } from '@/types/wizard';
import type { WebsiteType } from '@/types/database';
import type { GBPCategoryData } from '@/data/gbp-categories';
import { initialWizardState, getStepsForFlow } from '@/types/wizard';
import { isBrandApplicable } from '@/lib/brands/brand-applicable';

interface WizardStore extends WizardState {
  // Actions
  setConnectionType: (type: 'google' | 'manual') => void;
  setGoogleConnected: (connected: boolean, accessToken?: string) => void;
  setBusinessInfo: (name: string, industry: string) => void;
  setBusinessName: (name: string) => void;
  setCoreIndustry: (industry: string) => void;
  setLocations: (locations: WizardLocation[]) => void;
  addLocation: (location: WizardLocation) => void;
  removeLocation: (index: number) => void;
  updateLocation: (index: number, location: Partial<WizardLocation>) => void;
  updateLocationRepCity: (index: number, city: string, state: string) => void;
  updateLocationCategories: (index: number, primary: { gcid: string; displayName: string } | undefined, additional: { gcid: string; displayName: string }[]) => void;
  syncCategoriesFromLocations: () => void;
  setPrimaryCategory: (category: GBPCategoryData | null) => void;
  setSecondaryCategories: (categories: GBPCategoryData[]) => void;
  toggleSecondaryCategory: (category: GBPCategoryData) => void;
  setServiceAreas: (areas: ServiceArea[]) => void;
  addServiceArea: (area: ServiceArea) => void;
  removeServiceArea: (id: string) => void;
  toggleServiceArea: (area: ServiceArea) => void;
  setServiceAreaRadius: (radius: number) => void;
  setNeighborhoods: (neighborhoods: WizardNeighborhood[]) => void;
  addNeighborhood: (neighborhood: WizardNeighborhood) => void;
  removeNeighborhood: (id: string) => void;
  toggleNeighborhood: (neighborhood: WizardNeighborhood) => void;
  setBrands: (brands: WizardBrand[]) => void;
  toggleBrand: (id: string) => void;
  addCustomBrand: (brand: WizardBrand) => void;
  removeBrand: (id: string) => void;
  setServices: (services: WizardService[]) => void;
  toggleService: (id: string) => void;
  updateServiceDescription: (id: string, description: string) => void;
  addCustomService: (service: WizardService) => void;
  removeService: (id: string) => void;
  setWebsiteType: (type: WebsiteType) => void;
  setDomain: (domain: string) => void;
  setGSCPropertyUrl: (url: string | null) => void;
  setGSCQueries: (queries: WizardGSCQuery[]) => void;
  setCurrentStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  canProceed: () => boolean;
}

export const useWizardStore = create<WizardStore>((set, get) => ({
  ...initialWizardState,

  setConnectionType: (type) => set({ connectionType: type }),

  setGoogleConnected: (connected, accessToken) =>
    set({ googleConnected: connected, googleAccessToken: accessToken }),

  setBusinessInfo: (name, industry) =>
    set({ businessName: name, coreIndustry: industry }),

  setBusinessName: (name) => set({ businessName: name }),

  setCoreIndustry: (industry) => set({ coreIndustry: industry }),

  setLocations: (locations) => set({ locations }),

  addLocation: (location) =>
    set((state) => ({
      locations: [...state.locations, location],
    })),

  removeLocation: (index) =>
    set((state) => ({
      locations: state.locations.filter((_, i) => i !== index),
    })),

  updateLocation: (index, updates) =>
    set((state) => ({
      locations: state.locations.map((loc, i) =>
        i === index ? { ...loc, ...updates } : loc
      ),
    })),

  updateLocationRepCity: (index, city, state) =>
    set((s) => ({
      locations: s.locations.map((loc, i) =>
        i === index ? { ...loc, representativeCity: city, representativeState: state } : loc
      ),
    })),

  updateLocationCategories: (index, primary, additional) =>
    set((s) => ({
      locations: s.locations.map((loc, i) =>
        i === index ? { ...loc, gbpPrimaryCategory: primary, gbpAdditionalCategories: additional } : loc
      ),
    })),

  // Merge per-location categories into global primaryCategory + secondaryCategories
  syncCategoriesFromLocations: () => {
    const state = get();
    const primaryLoc = state.locations.find((l) => l.isPrimary) || state.locations[0];
    if (!primaryLoc?.gbpPrimaryCategory) return;

    // Helper to convert minimal category data to full GBPCategoryData
    const toGBPCategoryData = (cat: { gcid: string; displayName: string }): GBPCategoryData => ({
      gcid: cat.gcid,
      name: cat.gcid, // Use gcid as name (GBP API name field)
      displayName: cat.displayName,
      keywords: [],
      relatedCategories: [],
      commonServices: [],
    });

    // Site primary = primary location's primary category
    const sitePrimary = toGBPCategoryData(primaryLoc.gbpPrimaryCategory);

    // Collect all unique categories from all locations (excluding site primary)
    const seen = new Set<string>([sitePrimary.gcid]);
    const secondaries: GBPCategoryData[] = [];

    for (const loc of state.locations) {
      // Add this location's primary if different from site primary
      if (loc.gbpPrimaryCategory && !seen.has(loc.gbpPrimaryCategory.gcid)) {
        seen.add(loc.gbpPrimaryCategory.gcid);
        secondaries.push(toGBPCategoryData(loc.gbpPrimaryCategory));
      }
      // Add this location's additional categories
      for (const cat of loc.gbpAdditionalCategories || []) {
        if (!seen.has(cat.gcid)) {
          seen.add(cat.gcid);
          secondaries.push(toGBPCategoryData(cat));
        }
      }
    }

    // Cap at 9 secondaries (GBP limit: 10 total including primary)
    set({
      primaryCategory: sitePrimary,
      secondaryCategories: secondaries.slice(0, 9),
    });
  },

  setPrimaryCategory: (category) => set({ primaryCategory: category }),

  setSecondaryCategories: (categories) => set({ secondaryCategories: categories }),

  toggleSecondaryCategory: (category) =>
    set((state) => {
      const exists = state.secondaryCategories.some(
        (c) => c.gcid === category.gcid
      );
      if (exists) {
        return {
          secondaryCategories: state.secondaryCategories.filter(
            (c) => c.gcid !== category.gcid
          ),
        };
      }
      // Max 9 secondary categories (GBP limit is 10 total including primary)
      if (state.secondaryCategories.length >= 9) {
        return state;
      }
      return {
        secondaryCategories: [...state.secondaryCategories, category],
      };
    }),

  setServiceAreas: (areas) => set({ serviceAreas: areas }),

  addServiceArea: (area) =>
    set((state) => ({
      serviceAreas: [...state.serviceAreas, area],
    })),

  removeServiceArea: (id) =>
    set((state) => ({
      serviceAreas: state.serviceAreas.filter((a) => a.id !== id),
    })),

  toggleServiceArea: (area) =>
    set((state) => {
      const exists = state.serviceAreas.some((a) => a.id === area.id);
      if (exists) {
        return {
          serviceAreas: state.serviceAreas.filter((a) => a.id !== area.id),
        };
      }
      return {
        serviceAreas: [...state.serviceAreas, area],
      };
    }),

  setServiceAreaRadius: (radius) => set({ serviceAreaRadius: radius }),

  setNeighborhoods: (neighborhoods) => set({ neighborhoods }),

  addNeighborhood: (neighborhood) =>
    set((state) => ({
      neighborhoods: [...state.neighborhoods, neighborhood],
    })),

  removeNeighborhood: (id) =>
    set((state) => ({
      neighborhoods: state.neighborhoods.filter((n) => n.id !== id),
    })),

  toggleNeighborhood: (neighborhood) =>
    set((state) => {
      const exists = state.neighborhoods.some((n) => n.id === neighborhood.id);
      if (exists) {
        return {
          neighborhoods: state.neighborhoods.filter((n) => n.id !== neighborhood.id),
        };
      }
      return {
        neighborhoods: [...state.neighborhoods, neighborhood],
      };
    }),

  setBrands: (brands) => set({ brands }),

  toggleBrand: (id) =>
    set((state) => ({
      brands: state.brands.map((b) =>
        b.id === id ? { ...b, isSelected: !b.isSelected } : b
      ),
    })),

  addCustomBrand: (brand) =>
    set((state) => ({
      brands: [...state.brands, brand],
    })),

  removeBrand: (id) =>
    set((state) => ({
      brands: state.brands.filter((b) => b.id !== id),
    })),

  setServices: (services) => set({ services }),

  toggleService: (id) =>
    set((state) => ({
      services: state.services.map((s) =>
        s.id === id ? { ...s, isSelected: !s.isSelected } : s
      ),
    })),

  updateServiceDescription: (id, description) =>
    set((state) => ({
      services: state.services.map((s) =>
        s.id === id ? { ...s, description } : s
      ),
    })),

  addCustomService: (service) =>
    set((state) => ({
      services: [...state.services, service],
    })),

  removeService: (id) =>
    set((state) => ({
      services: state.services.filter((s) => s.id !== id),
    })),

  setWebsiteType: (type) => set({ websiteType: type }),

  setDomain: (domain) => set({ domain }),

  setGSCPropertyUrl: (url) => set({ gscPropertyUrl: url }),

  setGSCQueries: (queries) => set({ gscQueries: queries }),

  setCurrentStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const state = get();
    if (!state.connectionType) return;

    const allGcids = [
      state.primaryCategory?.gcid,
      ...state.secondaryCategories.map((c) => c.gcid),
    ].filter(Boolean) as string[];
    const steps = getStepsForFlow(state.connectionType, {
      includeBrands: isBrandApplicable(allGcids),
    });
    const currentIndex = steps.indexOf(state.currentStep);

    if (currentIndex < steps.length - 1) {
      set({ currentStep: steps[currentIndex + 1] });
    }
  },

  prevStep: () => {
    const state = get();
    if (!state.connectionType) return;

    const allGcids = [
      state.primaryCategory?.gcid,
      ...state.secondaryCategories.map((c) => c.gcid),
    ].filter(Boolean) as string[];
    const steps = getStepsForFlow(state.connectionType, {
      includeBrands: isBrandApplicable(allGcids),
    });
    const currentIndex = steps.indexOf(state.currentStep);

    if (currentIndex > 0) {
      set({ currentStep: steps[currentIndex - 1] });
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialWizardState),

  canProceed: () => {
    const state = get();

    switch (state.currentStep) {
      case 'connect':
        return state.connectionType !== null;

      case 'locations':
        // Require at least one location AND all SABs must have representative city
        return (
          state.locations.length > 0 &&
          state.locations.every(
            (loc) =>
              loc.businessType !== 'CUSTOMER_LOCATION_ONLY' ||
              (loc.representativeCity?.trim() && loc.representativeState?.trim())
          )
        );

      case 'business':
        return (
          state.businessName.trim() !== '' &&
          state.coreIndustry.trim() !== '' &&
          state.locations.length > 0
        );

      case 'categories':
        return state.primaryCategory !== null;

      case 'brands':
        // Brands are optional, can always proceed
        return true;

      case 'services':
        // Services are optional, can always proceed (but encourage at least 1)
        return true;

      case 'service-areas':
        // Service areas are optional, can always proceed
        return true;

      case 'neighborhoods':
        // Neighborhoods are optional, can always proceed
        return true;

      case 'website-type':
        return state.websiteType !== null;

      case 'review':
        return true;

      default:
        return false;
    }
  },
}));
