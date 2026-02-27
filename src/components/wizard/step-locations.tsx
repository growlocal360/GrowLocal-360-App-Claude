'use client';

import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Globe2,
  Star,
  Tag,
} from 'lucide-react';

export function StepLocations() {
  const {
    locations,
    updateLocation,
    updateLocationRepCity,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  const handleSetPrimary = (index: number) => {
    locations.forEach((_, i) => {
      updateLocation(i, { isPrimary: i === index });
    });
  };

  const isSAB = (loc: (typeof locations)[0]) =>
    loc.businessType === 'CUSTOMER_LOCATION_ONLY';

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
          Step 2 of 8
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">
          Your Business Locations
        </h2>
        <p className="mt-1 text-gray-500">
          Review your imported locations. Service area businesses need a representative city.
        </p>
      </div>

      <div className="space-y-4">
        {locations.map((location, index) => (
          <Card
            key={location.gbpLocationId || index}
            className={location.isPrimary ? 'border-[#00d9c0]/30' : ''}
          >
            <CardContent className="p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-full p-2 ${
                      location.isPrimary ? 'bg-[#00d9c0]/10' : 'bg-gray-100'
                    }`}
                  >
                    {isSAB(location) ? (
                      <Globe2
                        className={`h-4 w-4 ${
                          location.isPrimary ? 'text-[#00d9c0]' : 'text-gray-500'
                        }`}
                      />
                    ) : (
                      <MapPin
                        className={`h-4 w-4 ${
                          location.isPrimary ? 'text-[#00d9c0]' : 'text-gray-500'
                        }`}
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{location.name}</p>
                    {location.address ? (
                      <p className="text-sm text-gray-500">
                        {location.address}, {location.city}, {location.state}{' '}
                        {location.zipCode}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">
                        Service Area Business &mdash; no physical address
                      </p>
                    )}
                    {location.phone && (
                      <p className="text-sm text-gray-500">{location.phone}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isSAB(location) && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      SAB
                    </span>
                  )}
                  {location.isPrimary ? (
                    <span className="rounded bg-[#00d9c0]/10 px-2 py-0.5 text-xs font-medium text-[#00d9c0]">
                      <Star className="mr-1 inline h-3 w-3" />
                      Primary
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleSetPrimary(index)}
                    >
                      Set Primary
                    </Button>
                  )}
                </div>
              </div>

              {/* GBP Category badge */}
              {location.gbpPrimaryCategory && (
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-blue-500" />
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {location.gbpPrimaryCategory.displayName}
                  </span>
                  {(location.gbpAdditionalCategories?.length ?? 0) > 0 && (
                    <span className="text-xs text-gray-400">
                      +{location.gbpAdditionalCategories!.length} more
                    </span>
                  )}
                </div>
              )}

              {/* SAB Representative City inputs */}
              {isSAB(location) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                  <p className="text-xs font-medium text-amber-800">
                    Representative City (required for SABs)
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor={`rep-city-${index}`}
                        className="text-xs text-amber-700"
                      >
                        City
                      </Label>
                      <Input
                        id={`rep-city-${index}`}
                        placeholder="e.g. Orlando"
                        value={location.representativeCity || ''}
                        onChange={(e) =>
                          updateLocationRepCity(
                            index,
                            e.target.value,
                            location.representativeState || ''
                          )
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={`rep-state-${index}`}
                        className="text-xs text-amber-700"
                      >
                        State
                      </Label>
                      <Input
                        id={`rep-state-${index}`}
                        placeholder="e.g. FL"
                        value={location.representativeState || ''}
                        onChange={(e) =>
                          updateLocationRepCity(
                            index,
                            location.representativeCity || '',
                            e.target.value
                          )
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={nextStep}
          disabled={!canProceed()}
          className="bg-black hover:bg-gray-800"
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
