'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlanCard } from './plan-card';
import { PLAN_CONFIG, PlanName } from '@/lib/stripe';
import { Loader2, ShieldCheck, CreditCard } from 'lucide-react';

interface PlanSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelectPlan: (planName: PlanName) => Promise<void>;
}

export function PlanSelectionModal({
  open,
  onClose,
  onSelectPlan,
}: PlanSelectionModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanName | null>(null);

  const handleSelectPlan = async (planName: PlanName) => {
    setLoadingPlan(planName);
    try {
      await onSelectPlan(planName);
    } catch (error) {
      console.error('Error selecting plan:', error);
      setLoadingPlan(null);
    }
  };

  const plans = Object.values(PLAN_CONFIG);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Choose Your Plan</DialogTitle>
          <DialogDescription>
            Select a subscription plan to create your website. You can upgrade or cancel anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.name}
              name={plan.name}
              displayName={plan.displayName}
              price={plan.priceCents}
              features={plan.features}
              highlighted={'highlighted' in plan && plan.highlighted}
              onSelect={() => handleSelectPlan(plan.name as PlanName)}
              isLoading={loadingPlan === plan.name}
              disabled={loadingPlan !== null}
            />
          ))}
        </div>

        {/* Trust indicators */}
        <div className="mt-6 flex flex-col gap-4 rounded-lg bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ShieldCheck className="h-5 w-5 text-[#00d9c0]" />
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CreditCard className="h-5 w-5 text-[#00d9c0]" />
            <span>Secure payment via Stripe</span>
          </div>
        </div>

        {loadingPlan && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Preparing checkout...</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
