import { create } from 'zustand';
import type { WizardState, WizardStep, WizardLocation } from '@/types/wizard';
import type { WebsiteType } from '@/types/database';
import type { GBPCategoryData } from '@/data/gbp-categories';
import { initialWizardState, getStepsForFlow } from '@/types/wizard';

interface WizardStore extends WizardState {
  // Actions
  setConnectionType: (type: 'google' | 'manual') => void;
  setGoogleConnected: (connected: boolean, accessToken?: string) => void;
  setBusinessInfo: (name: string, industry: string) => void;
  setLocations: (locations: WizardLocation[]) => void;
  addLocation: (location: WizardLocation) => void;
  removeLocation: (index: number) => void;
  updateLocation: (index: number, location: Partial<WizardLocation>) => void;
  setPrimaryCategory: (category: GBPCategoryData | null) => void;
  toggleSecondaryCategory: (category: GBPCategoryData) => void;
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

      case 'website-type':
        return state.websiteType !== null;

      case 'review':
        return true;

      default:
        return false;
    }
  },
}));
