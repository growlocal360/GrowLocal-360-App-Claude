'use client';

import { useEffect, useMemo } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, MapPin, Building2, Target, Check, Info } from 'lucide-react';
import type { WebsiteType } from '@/types/database';
import type { MicrositeConfig } from '@/types/wizard';

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

function generateMicrositeSlug(
  city: string,
  service: string,
  brand?: string
): string {
  const parts = brand
    ? [brand, service, city]
    : [city, service];

  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function StepWebsiteType() {
  const {
    websiteType,
    locations,
    services,
    serviceAreas,
    brands,
    primaryCategory,
    micrositeConfig,
    setWebsiteType,
    setMicrositeConfig,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  // Suggest type based on location count
  const suggestedType: WebsiteType = locations.length > 1 ? 'multi_location' : 'single_location';

  // Build city options from service areas + primary location
  const cityOptions = useMemo(() => {
    const cities: { name: string; state: string }[] = [];
    const seen = new Set<string>();

    // Primary location city first
    const primaryLoc = locations.find((l) => l.isPrimary) || locations[0];
    if (primaryLoc?.city) {
      const key = `${primaryLoc.city}-${primaryLoc.state}`;
      if (!seen.has(key)) {
        seen.add(key);
        cities.push({ name: primaryLoc.city, state: primaryLoc.state });
      }
    }

    // Then service areas
    for (const area of serviceAreas) {
      const key = `${area.name}-${area.state}`;
      if (!seen.has(key)) {
        seen.add(key);
        cities.push({ name: area.name, state: area.state });
      }
    }

    return cities;
  }, [locations, serviceAreas]);

  // Selected services grouped by category
  const selectedServices = useMemo(
    () => services.filter((s) => s.isSelected),
    [services]
  );

  // Selected brands
  const selectedBrands = useMemo(
    () => brands.filter((b) => b.isSelected),
    [brands]
  );

  const hasBrands = selectedBrands.length > 0;

  // Update config helper
  const updateConfig = (updates: Partial<MicrositeConfig>) => {
    const current = micrositeConfig || {
      targetCity: '',
      targetCityState: '',
      targetServiceId: '',
      targetServiceName: '',
      targetCategoryGcid: primaryCategory?.gcid || '',
      targetCategoryName: primaryCategory?.displayName || '',
      brandMode: 'all_major' as const,
      suggestedSlug: '',
    };
    const updated = { ...current, ...updates };
    // Auto-regenerate slug
    updated.suggestedSlug = generateMicrositeSlug(
      updated.targetCity,
      updated.targetServiceName,
      updated.brandMode === 'single_brand' ? updated.selectedBrandName : undefined
    );
    setMicrositeConfig(updated);
  };

  // Initialize config when microsite is selected
  useEffect(() => {
    if (websiteType === 'microsite' && !micrositeConfig) {
      const primaryLoc = locations.find((l) => l.isPrimary) || locations[0];
      const firstService = selectedServices[0];
      updateConfig({
        targetCity: primaryLoc?.city || '',
        targetCityState: primaryLoc?.state || '',
        targetServiceId: firstService?.id || '',
        targetServiceName: firstService?.name || '',
        targetCategoryGcid: firstService?.categoryGcid || primaryCategory?.gcid || '',
        targetCategoryName: firstService?.categoryName || primaryCategory?.displayName || '',
        brandMode: 'all_major',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteType]);

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
                  ? 'border-[#00ef99] bg-[#00ef99]/5 ring-2 ring-[#00ef99]/20'
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
                        ? 'bg-[#00ef99] text-white'
                        : 'border-2 border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-[#00ef99]' : 'text-gray-500'}`} />
                      <h3 className="font-semibold text-gray-900">{option.title}</h3>
                      {isSuggested && (
                        <Badge className="bg-[#00ef99]/10 text-[#00ef99] hover:bg-[#00ef99]/10">
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

      {/* Microsite Configuration Panel */}
      {websiteType === 'microsite' && (
        <Card className="border-[#00ef99]/30 bg-[#00ef99]/5">
          <CardContent className="space-y-5 p-5">
            <div>
              <h4 className="flex items-center gap-2 font-semibold text-gray-900">
                <Target className="h-4 w-4 text-[#00ef99]" />
                Microsite Targeting
              </h4>
              <p className="mt-1 text-sm text-gray-500">
                Define the niche for your microsite. All content will be focused on this combination.
              </p>
            </div>

            {/* Target City */}
            <div>
              <Label htmlFor="ms-city" className="text-sm font-medium">Target City</Label>
              <select
                id="ms-city"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#00ef99] focus:outline-none focus:ring-1 focus:ring-[#00ef99]"
                value={micrositeConfig ? `${micrositeConfig.targetCity}|${micrositeConfig.targetCityState}` : ''}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    updateConfig({ targetCity: '', targetCityState: '' });
                  } else {
                    const [city, state] = e.target.value.split('|');
                    updateConfig({ targetCity: city, targetCityState: state });
                  }
                }}
              >
                <option value="">Select a city...</option>
                {cityOptions.map((c) => (
                  <option key={`${c.name}-${c.state}`} value={`${c.name}|${c.state}`}>
                    {c.name}, {c.state}
                  </option>
                ))}
                <option value="__custom__">Other (type manually)</option>
              </select>
              {micrositeConfig?.targetCity === '' && (
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="City name"
                    className="flex-1"
                    onChange={(e) => updateConfig({ targetCity: e.target.value })}
                  />
                  <Input
                    placeholder="State"
                    className="w-20"
                    maxLength={2}
                    onChange={(e) => updateConfig({ targetCityState: e.target.value.toUpperCase() })}
                  />
                </div>
              )}
            </div>

            {/* Target Service */}
            <div>
              <Label htmlFor="ms-service" className="text-sm font-medium">Target Service</Label>
              <select
                id="ms-service"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#00ef99] focus:outline-none focus:ring-1 focus:ring-[#00ef99]"
                value={micrositeConfig?.targetServiceId || ''}
                onChange={(e) => {
                  const svc = selectedServices.find((s) => s.id === e.target.value);
                  if (svc) {
                    updateConfig({
                      targetServiceId: svc.id,
                      targetServiceName: svc.name,
                      targetCategoryGcid: svc.categoryGcid,
                      targetCategoryName: svc.categoryName,
                    });
                  }
                }}
              >
                <option value="">Select a service...</option>
                {selectedServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.categoryName})
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Mode */}
            {hasBrands && (
              <div>
                <Label className="text-sm font-medium">Brand Focus</Label>
                <div className="mt-2 space-y-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-4 py-3 hover:bg-gray-50">
                    <input
                      type="radio"
                      name="brand-mode"
                      checked={micrositeConfig?.brandMode === 'all_major'}
                      onChange={() => updateConfig({ brandMode: 'all_major', selectedBrandName: undefined })}
                      className="accent-[#00ef99]"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">All major brands</p>
                      <p className="text-xs text-gray-500">Multi-brand site — &quot;We service GE, Whirlpool, Samsung...&quot;</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-4 py-3 hover:bg-gray-50">
                    <input
                      type="radio"
                      name="brand-mode"
                      checked={micrositeConfig?.brandMode === 'single_brand'}
                      onChange={() => updateConfig({ brandMode: 'single_brand', selectedBrandName: selectedBrands[0]?.name })}
                      className="accent-[#00ef99]"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Single brand focus</p>
                      <p className="text-xs text-gray-500">Entire site built around one specific brand</p>
                    </div>
                  </label>
                </div>
                {micrositeConfig?.brandMode === 'single_brand' && (
                  <select
                    className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#00ef99] focus:outline-none focus:ring-1 focus:ring-[#00ef99]"
                    value={micrositeConfig?.selectedBrandName || ''}
                    onChange={(e) => updateConfig({ selectedBrandName: e.target.value })}
                  >
                    <option value="">Select a brand...</option>
                    {selectedBrands.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Auto-Suggested Slug */}
            {micrositeConfig?.suggestedSlug && (
              <div>
                <Label htmlFor="ms-slug" className="text-sm font-medium">Suggested Slug</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id="ms-slug"
                    value={micrositeConfig.suggestedSlug}
                    onChange={(e) => {
                      const slug = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]+/g, '-')
                        .replace(/^-|-$/g, '');
                      setMicrositeConfig({ ...micrositeConfig, suggestedSlug: slug });
                    }}
                    className="font-mono text-sm"
                  />
                  <span className="shrink-0 text-xs text-gray-400">.goleadflow.com</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  This becomes your subdomain. Add a custom domain later in site settings.
                </p>
              </div>
            )}

            {/* Microsite Summary */}
            {micrositeConfig?.targetCity && micrositeConfig?.targetServiceName && (
              <div className="rounded-lg bg-white border border-[#00ef99]/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Microsite Focus</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {micrositeConfig.brandMode === 'single_brand' && micrositeConfig.selectedBrandName
                    ? `${micrositeConfig.selectedBrandName} `
                    : ''}
                  {micrositeConfig.targetServiceName} in {micrositeConfig.targetCity}, {micrositeConfig.targetCityState}
                </p>
                {micrositeConfig.brandMode === 'all_major' && hasBrands && (
                  <p className="mt-1 text-sm text-gray-500">
                    Brands: {selectedBrands.slice(0, 5).map((b) => b.name).join(', ')}
                    {selectedBrands.length > 5 ? ` +${selectedBrands.length - 5} more` : ''}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* URL Structure Preview */}
      {websiteType && websiteType !== 'microsite' && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 font-medium text-gray-900">
            <Info className="h-4 w-4" />
            URL Structure Preview
          </h4>
          <div className="space-y-1 font-mono text-sm text-gray-600">
            {websiteType === 'single_location' && (
              <>
                <p><span className="text-[#00ef99]">/</span> ← Primary Category + City (GBP Landing)</p>
                <p><span className="text-gray-400">/hvac-contractor/</span> ← Secondary Category Hub</p>
                <p><span className="text-gray-400">/hvac-contractor/ac-installation/</span> ← Service Page</p>
                <p><span className="text-gray-400">/service-areas/</span> ← Nearby Cities</p>
              </>
            )}
            {websiteType === 'multi_location' && (
              <>
                <p><span className="text-[#00ef99]">/</span> ← Brand Homepage (no city keywords)</p>
                <p><span className="text-[#00ef99]">/locations/dallas/</span> ← Primary Category + Dallas (GBP Landing)</p>
                <p><span className="text-gray-400">/locations/dallas/hvac-contractor/</span> ← Secondary Hub</p>
                <p><span className="text-gray-400">/locations/dallas/hvac-contractor/ac-repair/</span> ← Service</p>
                <p><span className="text-[#00ef99]">/locations/fort-worth/</span> ← Primary Category + Fort Worth (GBP Landing)</p>
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
          className="bg-black hover:bg-gray-800"
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
