'use client';

import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, MapPin, Building2, Target, Check, Info } from 'lucide-react';
import type { WebsiteType } from '@/types/database';

interface WebsiteTypeOption {
  type: WebsiteType;
  title: string;
  description: string;
  icon: typeof MapPin;
  features: string[];
  bestFor: string;
  badge?: string;
}

const websiteTypeOptions: WebsiteTypeOption[] = [
  {
    type: 'single_location',
    title: 'Single Location',
    description: 'One GBP, one physical location. Homepage targets primary category + city.',
    icon: MapPin,
    features: [
      'Homepage = GBP landing page',
      'Primary category targets homepage',
      'Secondary categories get silos',
      'No /locations/ directory needed',
    ],
    bestFor: 'Businesses with exactly ONE Google Business Profile',
  },
  {
    type: 'multi_location',
    title: 'Multi-Location',
    description: 'Multiple GBPs, multiple cities. Each location gets its own landing page.',
    icon: Building2,
    features: [
      'Brand-focused homepage (no city keywords)',
      '/locations/{city}/ structure',
      'Each city = separate GBP landing page',
      'Primary category lives at location root',
    ],
    bestFor: 'Businesses serving multiple cities with physical offices',
    badge: 'Recommended',
  },
  {
    type: 'microsite',
    title: 'Microsite (EMD)',
    description: 'Hyper-targeted site for a specific service + city. Great for long-tail keywords.',
    icon: Target,
    features: [
      'Exact-match domain focused',
      'Single narrow topic + location',
      'Supports main brand site',
      'Built for organic ranking',
    ],
    bestFor: 'Long-tail keywords like "lg refrigerator repair sarasota"',
  },
];

export function StepWebsiteType() {
  const {
    websiteType,
    locations,
    setWebsiteType,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  // Suggest type based on location count
  const suggestedType: WebsiteType = locations.length > 1 ? 'multi_location' : 'single_location';

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
          Step 5 of 6
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">Website Type</h2>
        <p className="mt-1 text-gray-500">
          Choose the architecture that best fits your business model.
        </p>
      </div>

      {/* Location Count Info */}
      <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-3">
        <MapPin className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-700">
          You have <strong>{locations.length}</strong> location{locations.length !== 1 ? 's' : ''} configured.
          {locations.length > 1
            ? ' Multi-location is recommended.'
            : ' Single location or microsite works best.'}
        </span>
      </div>

      {/* Website Type Cards */}
      <div className="space-y-4">
        {websiteTypeOptions.map((option) => {
          const isSelected = websiteType === option.type;
          const isSuggested = option.type === suggestedType;
          const Icon = option.icon;

          return (
            <Card
              key={option.type}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                  : 'hover:border-gray-300 hover:shadow-sm'
              }`}
              onClick={() => setWebsiteType(option.type)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Selection Indicator */}
                  <div
                    className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      isSelected
                        ? 'bg-emerald-500 text-white'
                        : 'border-2 border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-emerald-600' : 'text-gray-500'}`} />
                      <h3 className="font-semibold text-gray-900">{option.title}</h3>
                      {isSuggested && (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Suggested
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-gray-600">{option.description}</p>

                    {/* Features */}
                    <ul className="mt-3 space-y-1">
                      {option.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Best For */}
                    <div className="mt-3 rounded bg-gray-100 px-3 py-2">
                      <p className="text-xs text-gray-600">
                        <strong>Best for:</strong> {option.bestFor}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* URL Structure Preview */}
      {websiteType && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 font-medium text-gray-900">
            <Info className="h-4 w-4" />
            URL Structure Preview
          </h4>
          <div className="space-y-1 font-mono text-sm text-gray-600">
            {websiteType === 'single_location' && (
              <>
                <p><span className="text-emerald-600">/</span> ← Primary Category + City (GBP Landing)</p>
                <p><span className="text-gray-400">/hvac-contractor/</span> ← Secondary Category Hub</p>
                <p><span className="text-gray-400">/hvac-contractor/ac-installation/</span> ← Service Page</p>
                <p><span className="text-gray-400">/service-areas/</span> ← Nearby Cities</p>
              </>
            )}
            {websiteType === 'multi_location' && (
              <>
                <p><span className="text-emerald-600">/</span> ← Brand Homepage (no city keywords)</p>
                <p><span className="text-emerald-600">/locations/dallas/</span> ← Primary Category + Dallas (GBP Landing)</p>
                <p><span className="text-gray-400">/locations/dallas/hvac-contractor/</span> ← Secondary Hub</p>
                <p><span className="text-gray-400">/locations/dallas/hvac-contractor/ac-repair/</span> ← Service</p>
                <p><span className="text-emerald-600">/locations/fort-worth/</span> ← Primary Category + Fort Worth (GBP Landing)</p>
              </>
            )}
            {websiteType === 'microsite' && (
              <>
                <p><span className="text-emerald-600">/</span> ← Single Topic + City Focus</p>
                <p><span className="text-gray-400">/services/</span> ← Related Services Only</p>
                <p><span className="text-gray-400">/about/</span> ← Minimal Supporting Pages</p>
                <p><span className="text-gray-400">/contact/</span> ← Contact + Location Info</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={nextStep}
          disabled={!canProceed()}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
