'use client';

import { useWizardStore } from '@/lib/store/wizard-store';
import { WizardShell } from './wizard-shell';
import { StepConnect } from './step-connect';
import { StepBusiness } from './step-business';
import { StepLocations } from './step-locations';
import { StepCategories } from './step-categories';
import { StepBrands } from './step-brands';
import { StepServices } from './step-services';
import { StepServiceAreas } from './step-service-areas';
import { StepPrimaryMarket } from './step-primary-market';
import { StepNeighborhoods } from './step-neighborhoods';
import { StepWebsiteType } from './step-website-type';
import { StepSiteScope } from './step-site-scope';
import { StepReview } from './step-review';

export function SiteWizard() {
  const { currentStep } = useWizardStore();

  const renderStep = () => {
    switch (currentStep) {
      case 'connect':
        return <StepConnect />;
      case 'business':
        return <StepBusiness />;
      case 'locations':
        return <StepLocations />;
      case 'categories':
        return <StepCategories />;
      case 'brands':
        return <StepBrands />;
      case 'services':
        return <StepServices />;
      case 'service-areas':
        return <StepServiceAreas />;
      case 'primary-market':
        return <StepPrimaryMarket />;
      case 'neighborhoods':
        return <StepNeighborhoods />;
      case 'website-type':
        return <StepWebsiteType />;
      case 'site-scope':
        return <StepSiteScope />;
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
export { StepLocations } from './step-locations';
export { StepCategories } from './step-categories';
export { StepBrands } from './step-brands';
export { StepServices } from './step-services';
export { StepServiceAreas } from './step-service-areas';
export { StepPrimaryMarket } from './step-primary-market';
export { StepNeighborhoods } from './step-neighborhoods';
export { StepWebsiteType } from './step-website-type';
export { StepSiteScope } from './step-site-scope';
export { StepReview } from './step-review';
