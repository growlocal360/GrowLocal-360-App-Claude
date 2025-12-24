import { create } from 'zustand';
import type { WizardState, WizardStep, WizardLocation, ServiceArea, WizardNeighborhood } from '@/types/wizard';
import type { WebsiteType } from '@/types/database';
import type { GBPCategoryData } from '@/data/gbp-categories';
import { initialWizardState, getStepsForFlow } from '@/types/wizard';

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
  setWebsiteType: (type: WebsiteType) => void;
  setDomain: (domain: string) => void;
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

  setWebsiteType: (type) => set({ websiteType: type }),

  setDomain: (domain) => set({ domain }),

  setCurrentStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const state = get();
    if (!state.connectionType) return;

    const steps = getStepsForFlow(state.connectionType);
    const currentIndex = steps.indexOf(state.currentStep);

    if (currentIndex < steps.length - 1) {
      set({ currentStep: steps[currentIndex + 1] });
    }
  },

  prevStep: () => {
    const state = get();
    if (!state.connectionType) return;

    const steps = getStepsForFlow(state.connectionType);
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
        return state.locations.length > 0;

      case 'business':
        return (
          state.businessName.trim() !== '' &&
          state.coreIndustry.trim() !== '' &&
          state.locations.length > 0
        );

      case 'categories':
        return state.primaryCategory !== null;

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
