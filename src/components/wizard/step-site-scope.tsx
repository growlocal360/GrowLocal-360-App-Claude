'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Globe2, MapPin, Building2, X } from 'lucide-react';
import {
  filterGscByScope,
  type GscQueryForFilter,
} from '@/lib/onboarding/gsc-scope-filter';
import { generateCityVariants } from '@/lib/onboarding/city-variants';
import type { SiteScope } from '@/lib/onboarding/site-scope';
import type { ScopeType } from '@/types/database';
import { SiteScopeFilterReport } from './site-scope-filter-report';

interface ScopeOption {
  value: ScopeType;
  title: string;
  description: string;
  icon: typeof Globe2;
  bestFor: string;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  {
    value: 'FULL_BUSINESS',
    title: 'Full Business',
    description: 'This site covers everything you serve — all cities, services, and locations.',
    icon: Globe2,
    bestFor: 'Your main brand site. Uses all GSC data without filtering.',
  },
  {
    value: 'MICROSITE',
    title: 'Microsite',
    description: 'A standalone site focused on one specific city or area.',
    icon: MapPin,
    bestFor: 'Separate domain targeting a single city (e.g., lakewood-ranch-appliance-repair.com).',
  },
  {
    value: 'CITY_SPECIFIC',
    title: 'City-Specific Section',
    description: 'A subdirectory of a larger site focused on one city.',
    icon: Building2,
    bestFor: 'A /lakewood-ranch/ section on your main site. Same filtering, different deployment.',
  },
];

export function StepSiteScope() {
  const {
    websiteType,
    micrositeConfig,
    locations,
    serviceAreas,
    siteScope,
    setSiteScope,
    gscQueries,
    nextStep,
    prevStep,
  } = useWizardStore();

  // Initialize from prior wizard state. Microsite → MICROSITE scope with the
  // microsite's target city; otherwise default to FULL_BUSINESS.
  const initialScope: SiteScope = useMemo(() => {
    if (siteScope) return siteScope;
    if (websiteType === 'microsite' && micrositeConfig) {
      return {
        scope_type: 'MICROSITE',
        target_city: micrositeConfig.targetCity,
        city_variants: generateCityVariants(
          micrositeConfig.targetCity,
          micrositeConfig.targetCityState
        ),
        zip_codes: [],
        excluded_cities: [],
        existing_url_pattern: null,
      };
    }
    return {
      scope_type: 'FULL_BUSINESS',
      target_city: null,
      city_variants: [],
      zip_codes: [],
      excluded_cities: [],
      existing_url_pattern: null,
    };
  }, [siteScope, websiteType, micrositeConfig]);

  const [scope, setScope] = useState<SiteScope>(initialScope);

  // Local input buffers for the list fields (variants, zips, excluded).
  // We commit on Enter / blur to keep the array clean.
  const [variantInput, setVariantInput] = useState('');
  const [zipInput, setZipInput] = useState('');
  const [excludedInput, setExcludedInput] = useState('');

  // Live preview of the GSC scope filter against the queries already loaded
  // in the wizard (from a prior step). Recomputes on every scope change.
  const filterResult = useMemo(() => {
    const queries: GscQueryForFilter[] = gscQueries.map((q) => ({
      query: q.query,
      page_url: q.pageUrl,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position,
    }));
    return filterGscByScope(queries, scope);
  }, [scope, gscQueries]);

  // Whenever the user picks "Microsite" or "City-Specific" and there's a
  // suggested city from previous wizard steps (primary location city),
  // auto-fill the target_city + variants if empty. Don't clobber if the
  // user has already edited.
  useEffect(() => {
    if (scope.scope_type === 'FULL_BUSINESS') return;
    if (scope.target_city) return;

    const primaryLoc = locations.find((l) => l.isPrimary) || locations[0];
    const city = primaryLoc?.city || null;
    const state = primaryLoc?.state || null;
    if (city) {
      setScope((prev) => ({
        ...prev,
        target_city: city,
        city_variants: generateCityVariants(city, state),
      }));
    }
  }, [scope.scope_type, scope.target_city, locations]);

  // When the user changes scope_type, reset relevant fields. Going from
  // MICROSITE → FULL_BUSINESS clears city/variants/zips/excluded.
  function changeScopeType(next: ScopeType) {
    if (next === 'FULL_BUSINESS') {
      setScope({
        scope_type: 'FULL_BUSINESS',
        target_city: null,
        city_variants: [],
        zip_codes: [],
        excluded_cities: [],
        existing_url_pattern: null,
      });
    } else {
      setScope((prev) => ({ ...prev, scope_type: next }));
    }
  }

  function updateField<K extends keyof SiteScope>(key: K, value: SiteScope[K]) {
    setScope((prev) => ({ ...prev, [key]: value }));
  }

  function addListItem(key: 'city_variants' | 'zip_codes' | 'excluded_cities', raw: string) {
    const cleaned = raw.trim();
    if (!cleaned) return;
    setScope((prev) => {
      if (prev[key].includes(cleaned)) return prev;
      return { ...prev, [key]: [...prev[key], cleaned] };
    });
  }

  function removeListItem(key: 'city_variants' | 'zip_codes' | 'excluded_cities', idx: number) {
    setScope((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  }

  // Suggested excluded cities = service areas that aren't the target city.
  // One-click chip to add them.
  const suggestedExclusions = useMemo(() => {
    if (scope.scope_type === 'FULL_BUSINESS') return [];
    const targetLower = (scope.target_city || '').toLowerCase();
    const already = new Set(scope.excluded_cities.map((c) => c.toLowerCase()));
    return serviceAreas
      .map((a) => a.name)
      .filter((name) => {
        const lower = name.toLowerCase();
        return lower !== targetLower && !already.has(lower);
      });
  }, [serviceAreas, scope.target_city, scope.excluded_cities, scope.scope_type]);

  function handleNext() {
    setSiteScope(scope);
    nextStep();
  }

  const isScoped = scope.scope_type !== 'FULL_BUSINESS';
  const canProceed = scope.scope_type === 'FULL_BUSINESS' || !!scope.target_city;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Site Scope</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tell us what geography this site is for. If you&apos;ve connected GSC, we&apos;ll filter your search data to only the queries relevant to this scope — so demand from other cities doesn&apos;t skew the analysis.
        </p>
      </div>

      {/* ── Scope type picker ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SCOPE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = scope.scope_type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => changeScopeType(opt.value)}
              className={`text-left rounded-lg border p-4 transition-colors ${
                selected
                  ? 'border-[#00ef99] bg-[#00ef99]/5 ring-1 ring-[#00ef99]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${selected ? 'text-[#00ef99]' : 'text-gray-400'}`} />
                <h3 className="font-semibold text-sm">{opt.title}</h3>
              </div>
              <p className="mt-1.5 text-xs text-gray-600">{opt.description}</p>
              <p className="mt-2 text-[11px] text-gray-400">{opt.bestFor}</p>
            </button>
          );
        })}
      </div>

      {/* ── Scoped fields (visible only for MICROSITE / CITY_SPECIFIC) ── */}
      {isScoped && (
        <Card>
          <CardContent className="p-5 space-y-5">
            <h3 className="text-sm font-semibold text-gray-900">Target geography</h3>

            {/* Target city */}
            <div className="space-y-1.5">
              <Label htmlFor="target-city">Target City</Label>
              <Input
                id="target-city"
                value={scope.target_city ?? ''}
                onChange={(e) => updateField('target_city', e.target.value)}
                onBlur={(e) => {
                  // When the user finishes typing the city, auto-fill
                  // variants if they haven't manually edited that list.
                  const primaryLoc = locations.find((l) => l.isPrimary) || locations[0];
                  if (scope.city_variants.length === 0 && e.target.value) {
                    setScope((prev) => ({
                      ...prev,
                      city_variants: generateCityVariants(
                        e.target.value,
                        primaryLoc?.state || null
                      ),
                    }));
                  }
                }}
                placeholder="e.g. Lakewood Ranch"
              />
            </div>

            {/* City variants */}
            <ListField
              label="City Variants"
              hint="Search query variants for the target city. We auto-suggested these — edit as needed."
              items={scope.city_variants}
              inputValue={variantInput}
              onInputChange={setVariantInput}
              onAdd={() => {
                addListItem('city_variants', variantInput);
                setVariantInput('');
              }}
              onRemove={(i) => removeListItem('city_variants', i)}
              placeholder="Type a variant and press Enter"
            />

            {/* Zip codes */}
            <ListField
              label="Zip Codes"
              hint="Zip codes covered by the target geography. Catches GSC queries that include a zip but not the city name."
              items={scope.zip_codes}
              inputValue={zipInput}
              onInputChange={setZipInput}
              onAdd={() => {
                addListItem('zip_codes', zipInput);
                setZipInput('');
              }}
              onRemove={(i) => removeListItem('zip_codes', i)}
              placeholder="e.g. 34202"
            />

            {/* Excluded cities */}
            <div className="space-y-1.5">
              <ListField
                label="Excluded Cities"
                hint="Other cities you serve that this site is NOT for. Queries explicitly mentioning these will be filtered out."
                items={scope.excluded_cities}
                inputValue={excludedInput}
                onInputChange={setExcludedInput}
                onAdd={() => {
                  addListItem('excluded_cities', excludedInput);
                  setExcludedInput('');
                }}
                onRemove={(i) => removeListItem('excluded_cities', i)}
                placeholder="e.g. Sarasota"
              />
              {suggestedExclusions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-gray-500">Suggested from your service areas:</span>
                  {suggestedExclusions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => addListItem('excluded_cities', name)}
                      className="text-[11px] rounded border border-gray-200 px-1.5 py-0.5 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
                    >
                      + {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Existing URL pattern (migrations) */}
            <div className="space-y-1.5">
              <Label htmlFor="url-pattern">Existing URL Pattern (optional)</Label>
              <Input
                id="url-pattern"
                value={scope.existing_url_pattern ?? ''}
                onChange={(e) => updateField('existing_url_pattern', e.target.value || null)}
                placeholder="/lakewood-ranch/"
              />
              <p className="text-[11px] text-gray-500">
                If migrating an existing site, the URL prefix that scopes pages to this geography. Pages under this path in your GSC data will be included in the analysis.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Live filter preview ─────────────────────────────────────────── */}
      {gscQueries.length > 0 && (
        <SiteScopeFilterReport
          report={filterResult.filtering_report}
          totalConnectedQueries={gscQueries.length}
        />
      )}

      {gscQueries.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
          You haven&apos;t connected Google Search Console yet — that&apos;s fine. The scope you set here will still drive the Phase 2 onboarding analysis once GSC data flows in.
        </div>
      )}

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleNext} disabled={!canProceed} className="bg-gray-900 hover:bg-gray-800">
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── ListField subcomponent ──────────────────────────────────────────────

interface ListFieldProps {
  label: string;
  hint: string;
  items: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  placeholder: string;
}

function ListField({
  label,
  hint,
  items,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  placeholder,
}: ListFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <p className="text-[11px] text-gray-500 -mt-1">{hint}</p>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={onAdd} disabled={!inputValue.trim()}>
          Add
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {items.map((item, idx) => (
            <Badge
              key={`${item}-${idx}`}
              variant="outline"
              className="text-xs font-normal text-gray-700 pr-1"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="ml-1 rounded hover:bg-gray-100"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
