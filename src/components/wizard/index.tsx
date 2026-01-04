'use client';

import { useWizardStore } from '@/lib/store/wizard-store';
import { WizardShell } from './wizard-shell';
import { StepConnect } from './step-connect';
import { StepBusiness } from './step-business';
import { StepCategories } from './step-categories';
import { StepServices } from './step-services';
import { StepServiceAreas } from './step-service-areas';
import { StepNeighborhoods } from './step-neighborhoods';
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
      case 'services':
        return <StepServices />;
      case 'service-areas':
        return <StepServiceAreas />;
      case 'neighborhoods':
        return <StepNeighborhoods />;
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
export { StepServices } from './step-services';
export { StepServiceAreas } from './step-service-areas';
export { StepNeighborhoods } from './step-neighborhoods';
export { StepWebsiteType } from './step-website-type';
export { StepReview } from './step-review';
