'use client';

import { useWizardStore } from '@/lib/store/wizard-store';
import { getStepsForFlow } from '@/types/wizard';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface WizardShellProps {
  children: React.ReactNode;
}

export function WizardShell({ children }: WizardShellProps) {
  const { currentStep, connectionType } = useWizardStore();

  // Default to manual flow steps for display until connection type is chosen
  const steps = connectionType
    ? getStepsForFlow(connectionType)
    : ['connect', 'business', 'categories', 'service-areas', 'neighborhoods', 'website-type', 'review'];

  const currentIndex = steps.indexOf(currentStep);

  const stepLabels: Record<string, string> = {
    connect: 'Connect',
    locations: 'Locations',
    business: 'Business',
    categories: 'Categories',
    'service-areas': 'Areas',
    neighborhoods: 'Local',
    'website-type': 'Type',
    review: 'Review',
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={step} className="flex items-center">
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                      isCompleted
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : isCurrent
                        ? 'border-emerald-500 bg-white text-emerald-500'
                        : 'border-gray-300 bg-white text-gray-400'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      'mt-2 text-xs font-medium',
                      isCurrent ? 'text-emerald-600' : 'text-gray-500'
                    )}
                  >
                    {stepLabels[step]}
                  </span>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'mx-2 h-0.5 w-12 sm:w-20 md:w-24',
                      index < currentIndex ? 'bg-emerald-500' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
