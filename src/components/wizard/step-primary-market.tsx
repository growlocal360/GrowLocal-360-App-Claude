'use client';

import { useMemo, useState } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, MapPin, Home, Building2, Globe2, AlertTriangle } from 'lucide-react';
import type { TravelStrategy } from '@/types/wizard';

interface StrategyOption {
  value: TravelStrategy;
  title: string;
  range: string;
  description: string;
  icon: typeof Home;
}

const STRATEGY_OPTIONS: StrategyOption[] = [
  { value: 'local', title: 'Local', range: '0–15 miles', description: 'One primary market plus nearby adjacent towns. No broad metro pages.', icon: Home },
  { value: 'regional', title: 'Regional', range: '15–30 miles', description: 'Primary market hub plus supporting city pages within a regional radius.', icon: MapPin },
  { value: 'metro', title: 'Metro', range: '30+ miles', description: 'Primary market hub plus broader metro-level supporting pages.', icon: Building2 },
  { value: 'multi-market', title: 'Multi-market', range: 'Multiple metros', description: 'Several distinct market hubs, each with its own city/service structure.', icon: Globe2 },
];

/** Rough strategy → mile-radius mapping for the GBP service-area sanity checks. */
const STRATEGY_MAX_MILES: Record<TravelStrategy, number> = {
  local: 15,
  regional: 30,
  metro: 9999,
  'multi-market': 9999,
};

export function StepPrimaryMarket() {
  const {
    serviceAreas,
    locations,
    travelStrategy,
    primaryMarket,
    setTravelStrategy,
    setPrimaryMarket,
    nextStep,
    prevStep,
  } = useWizardStore();

  // Suggested markets: GBP/primary location city first, then every service-area city.
  const primaryLocation = locations.find((l) => l.isPrimary) || locations[0];
  const gbpAddressCity = primaryLocation?.representativeCity || primaryLocation?.city || '';
  const gbpAddressState = primaryLocation?.representativeState || primaryLocation?.state || '';

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: { city: string; state: string; source: 'gbp_address' | 'ai_recommendation' }[] = [];
    if (gbpAddressCity) {
      out.push({ city: gbpAddressCity, state: gbpAddressState, source: 'gbp_address' });
      seen.add(gbpAddressCity.toLowerCase());
    }
    for (const a of serviceAreas) {
      const key = a.name.toLowerCase();
      if (!seen.has(key)) {
        out.push({ city: a.name, state: a.state, source: 'ai_recommendation' });
        seen.add(key);
      }
    }
    return out;
  }, [serviceAreas, gbpAddressCity, gbpAddressState]);

  const [customCity, setCustomCity] = useState('');
  const [customState, setCustomState] = useState(gbpAddressState);

  const selectMarket = (city: string, state: string, source: 'user_input' | 'ai_recommendation' | 'gbp_address') => {
    setPrimaryMarket({ city, state, source });
  };

  // ── Service-area validation findings (advisory, never blocking) ──────────
  const findings = useMemo(() => {
    const out: string[] = [];
    if (!travelStrategy) return out;
    const maxMiles = STRATEGY_MAX_MILES[travelStrategy];
    const breadth = serviceAreas.reduce((max, a) => Math.max(max, a.distanceMiles ?? 0), 0);

    if (travelStrategy === 'local' && breadth > 30) {
      out.push('Your service area is broader than a Local strategy suggests. Consider trimming your GBP service areas to focus on local rankings.');
    }
    if (travelStrategy === 'metro' && serviceAreas.length <= 1) {
      out.push('A Metro strategy suggests broader coverage. Consider adding more service areas to your GBP.');
    }
    if (primaryMarket && serviceAreas.length > 0) {
      const inArea = serviceAreas.some((a) => a.name.toLowerCase() === primaryMarket.city.toLowerCase())
        || (gbpAddressCity && gbpAddressCity.toLowerCase() === primaryMarket.city.toLowerCase());
      if (!inArea) {
        out.push(`Your primary market (${primaryMarket.city}) isn't in your service area list. Add it for stronger geographic relevance.`);
      }
    }
    void maxMiles;
    return out;
  }, [travelStrategy, serviceAreas, primaryMarket, gbpAddressCity]);

  const canProceed = !!travelStrategy && !!primaryMarket?.city;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Travel strategy &amp; primary market</h2>
        <p className="mt-1 text-gray-600">
          This shapes your site structure — how far you market and which city we prioritize for SEO.
        </p>
      </div>

      {/* ── Travel strategy ─────────────────────────────────────────────── */}
      <div>
        <Label className="text-sm font-semibold text-gray-900">What is your travel strategy?</Label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {STRATEGY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = travelStrategy === opt.value;
            return (
              <Card
                key={opt.value}
                onClick={() => setTravelStrategy(opt.value)}
                className={`cursor-pointer transition-all ${active ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <CardContent className="flex gap-3 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{opt.title}</span>
                      <span className="text-xs text-gray-400">{opt.range}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-600">{opt.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Primary market ──────────────────────────────────────────────── */}
      <div>
        <Label className="text-sm font-semibold text-gray-900">Where do you want most of your next customers to come from?</Label>
        <p className="mt-1 text-sm text-gray-500">This is your primary market — it gets top placement, the strongest content, and priority job-snap routing. It doesn&apos;t have to be where you&apos;re located.</p>

        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => {
              const active = primaryMarket?.city.toLowerCase() === s.city.toLowerCase();
              return (
                <button
                  key={`${s.city}-${s.state}`}
                  type="button"
                  onClick={() => selectMarket(s.city, s.state, s.source)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {s.city}{s.state ? `, ${s.state}` : ''}
                  {s.source === 'gbp_address' && <span className={`ml-1 text-[10px] ${active ? 'text-gray-300' : 'text-gray-400'}`}>(your location)</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* custom entry */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Or enter a city"
            value={customCity}
            onChange={(e) => setCustomCity(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="State"
            value={customState}
            onChange={(e) => setCustomState(e.target.value)}
            className="sm:w-28"
          />
          <Button
            variant="outline"
            disabled={!customCity.trim()}
            onClick={() => { selectMarket(customCity.trim(), customState.trim(), 'user_input'); setCustomCity(''); }}
          >
            Use this city
          </Button>
        </div>

        {primaryMarket?.city && (
          <p className="mt-3 text-sm text-gray-700">
            Primary market: <span className="font-semibold">{primaryMarket.city}{primaryMarket.state ? `, ${primaryMarket.state}` : ''}</span>
          </p>
        )}
      </div>

      {/* ── Advisory findings ───────────────────────────────────────────── */}
      {findings.length > 0 && (
        <div className="space-y-2">
          {findings.map((f, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={nextStep} disabled={!canProceed} className="bg-gray-900 hover:bg-gray-800">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
