'use client';

import { useWizardStore } from '@/lib/store/wizard-store';
import { WizardShell } from './wizard-shell';
import { StepConnect } from './step-connect';
import { StepBusiness } from './step-business';
import { StepCategories } from './step-categories';
import { StepWebsiteType } from './step-website-type';
import { StepReview } from './step-review';

export function SiteWizard() {
  const { currentStep } = useWizardStore();

  const renderStep = () => {
    switch (currentStep) {
      case 'connect':
        return <StepConnect />;
      case 'business':
      case 'locations':
        return <StepBusiness />;
      case 'categories':
        return <StepCategories />;
      case 'website-type':
        return <StepWebsiteType />;
      case 'review':
        return <StepReview />;
      default:
        return <StepConnect />;
    }
  };

  return <WizardShell>{renderStep()}</WizardShell>;
}

export { WizardShell } from './wizard-shell';
export { StepConnect } from './step-connect';
export { StepBusiness } from './step-business';
export { StepCategories } from './step-categories';
export { StepWebsiteType } from './step-website-type';
export { StepReview } from './step-review';
