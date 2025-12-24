'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Info,
  MapPin,
  Plus,
  Search,
  X,
  Loader2,
} from 'lucide-react';
import type { ServiceArea } from '@/types/wizard';

interface SuggestedCity {
  id: string;
  name: string;
  state: string;
  placeId: string;
  distanceMiles: number;
  latitude: number;
  longitude: number;
}

const RADIUS_OPTIONS = [
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
];

export function StepServiceAreas() {
  const {
    locations,
    serviceAreas,
    serviceAreaRadius,
    toggleServiceArea,
    addServiceArea,
    removeServiceArea,
    setServiceAreaRadius,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  const [suggestedCities, setSuggestedCities] = useState<SuggestedCity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customCity, setCustomCity] = useState({ name: '', state: '' });

  // Get cities that are already GBP locations (to exclude from suggestions)
  // Include the business name variations as well to catch "City of X" vs "X"
  const gbpCityNames = useMemo(() => {
    const cities: string[] = [];
    locations.forEach((loc) => {
      if (loc.city) {
        cities.push(loc.city);
        // Add variations to handle "City of X" vs "X"
        if (!loc.city.toLowerCase().startsWith('city of ')) {
          cities.push(`City of ${loc.city}`);
        }
        // Handle "X City" variations
        if (!loc.city.toLowerCase().endsWith(' city')) {
          cities.push(`${loc.city} City`);
        }
      }
    });
    return cities;
  }, [locations]);

  // Fetch nearby cities when radius changes
  useEffect(() => {
    const fetchNearbyCities = async () => {
      setIsLoading(true);
      setError(null);

      if (locations.length === 0) {
        setIsLoading(false);
        setSuggestedCities([]);
        return;
      }

      // Geocode locations that are missing coordinates
      const locationsWithCoords = await Promise.all(
        locations.map(async (loc) => {
          if (loc.latitude && loc.longitude) {
            return loc;
          }

          // Try to geocode using city/state
          if (loc.city && loc.state) {
            try {
              const response = await fetch('/api/places/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  address: loc.address,
                  city: loc.city,
                  state: loc.state,
                }),
              });

              if (response.ok) {
                const data = await response.json();
                return {
                  ...loc,
                  latitude: data.latitude,
                  longitude: data.longitude,
                };
              }
            } catch (err) {
              console.error('Geocoding failed for:', loc.city, err);
            }
          }

          return loc;
        })
      );

      // Filter to only those with coordinates
      const validLocations = locationsWithCoords.filter(
        (loc) => loc.latitude && loc.longitude
      );

      console.log('All locations:', locations);
      console.log('Locations with coords after geocoding:', validLocations);

      if (validLocations.length === 0) {
        setIsLoading(false);
        setSuggestedCities([]);
        setError('Could not determine coordinates for your locations. You can still add cities manually.');
        return;
      }

      try {
        const response = await fetch('/api/places/nearby-cities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locations: validLocations,
            radiusMiles: serviceAreaRadius,
            excludeCities: gbpCityNames,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch nearby cities');
        }

        const data = await response.json();
        setSuggestedCities(data.cities || []);
      } catch (err) {
        console.error('Error fetching nearby cities:', err);
        setError(err instanceof Error ? err.message : 'Failed to load nearby cities');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNearbyCities();
  }, [locations, serviceAreaRadius, gbpCityNames]);

  // Filter cities by search query
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return suggestedCities;
    const query = searchQuery.toLowerCase();
    return suggestedCities.filter(
      (city) =>
        city.name.toLowerCase().includes(query) ||
        city.state.toLowerCase().includes(query)
    );
  }, [suggestedCities, searchQuery]);

  const handleToggleCity = (city: SuggestedCity) => {
    const serviceArea: ServiceArea = {
      id: city.id,
      name: city.name,
      state: city.state,
      placeId: city.placeId,
      distanceMiles: city.distanceMiles,
      isCustom: false,
    };
    toggleServiceArea(serviceArea);
  };

  const handleAddCustomCity = () => {
    if (!customCity.name.trim() || !customCity.state.trim()) return;

    const customServiceArea: ServiceArea = {
      id: `custom-${Date.now()}`,
      name: customCity.name.trim(),
      state: customCity.state.trim(),
      isCustom: true,
    };

    addServiceArea(customServiceArea);
    setCustomCity({ name: '', state: '' });
    setShowAddCustom(false);
  };

  const isSelected = (cityId: string) => {
    return serviceAreas.some((sa) => sa.id === cityId);
  };

  // Calculate step number based on wizard flow
  const stepNumber = 4;
  const totalSteps = 6;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
            Step {stepNumber} of {totalSteps}
          </span>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Service Areas</h2>
        </div>

        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-emerald-100">
            <MapPin className="h-8 w-8 text-emerald-500" />
          </div>
          <p className="text-lg font-medium text-gray-900">Finding nearby cities...</p>
          <p className="text-gray-500">Analyzing your service locations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
          Step {stepNumber} of {totalSteps}
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">Service Areas</h2>
        <p className="mt-1 text-gray-500">
          Select additional cities where you provide services. Each city gets its own service area page.
        </p>
      </div>

      {/* GBP Service Areas Banner - shown if service areas were imported */}
      {serviceAreas.some((sa) => !sa.isCustom && sa.placeId) && (
        <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
          <Check className="mt-0.5 h-5 w-5 text-blue-600" />
          <div>
            <p className="font-medium text-blue-900">Service Areas Imported from Google Business Profile</p>
            <p className="text-sm text-blue-700">
              We imported {serviceAreas.filter((sa) => !sa.isCustom && sa.placeId).length} service areas from your GBP profile.
              You can add more below or remove any you don&apos;t serve.
            </p>
          </div>
        </div>
      )}

      {/* AI Recommendation Banner */}
      <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 text-emerald-600" />
        <div>
          <p className="font-medium text-emerald-900">Additional Suggestions</p>
          <p className="text-sm text-emerald-700">
            We found more cities near your GBP locations. Your physical locations are automatically excluded.
          </p>
        </div>
      </div>

      {/* Radius Selector */}
      <div className="space-y-2">
        <Label>Search Radius</Label>
        <div className="flex gap-2">
          {RADIUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={serviceAreaRadius === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setServiceAreaRadius(option.value)}
              className={
                serviceAreaRadius === option.value
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : ''
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Selected Service Areas */}
      {serviceAreas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Selected Service Areas ({serviceAreas.length})</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {serviceAreas.map((area) => {
              // Check if from GBP (has placeId and is not custom)
              const isFromGBP = !area.isCustom && area.placeId;
              return (
                <Badge
                  key={area.id}
                  variant="secondary"
                  className={`flex items-center gap-1 ${
                    isFromGBP
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  }`}
                >
                  {area.name}
                  {area.state && `, ${area.state}`}
                  {isFromGBP && (
                    <span className="ml-1 text-xs opacity-60">(GBP)</span>
                  )}
                  {area.isCustom && (
                    <span className="ml-1 text-xs opacity-60">(custom)</span>
                  )}
                  <button
                    onClick={() => removeServiceArea(area.id)}
                    className={`ml-1 rounded-full p-0.5 ${
                      isFromGBP ? 'hover:bg-blue-300' : 'hover:bg-emerald-300'
                    }`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search cities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-medium">Unable to load suggestions</p>
          <p className="text-sm">{error}</p>
          <p className="mt-2 text-sm">
            You can still add cities manually using the button below.
          </p>
        </div>
      )}

      {/* Suggested Cities Grid */}
      {!error && filteredCities.length > 0 && (
        <div className="space-y-3">
          <Label>Suggested Cities</Label>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {filteredCities.map((city) => {
              const selected = isSelected(city.id);
              return (
                <Card
                  key={city.id}
                  className={`cursor-pointer transition-all ${
                    selected
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'hover:border-gray-300'
                  }`}
                  onClick={() => handleToggleCity(city)}
                >
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded ${
                          selected
                            ? 'bg-emerald-500 text-white'
                            : 'border-2 border-gray-300'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {city.name}
                          {city.state && <span className="text-gray-500">, {city.state}</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {city.distanceMiles} mi away
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* No results */}
      {!error && !isLoading && filteredCities.length === 0 && searchQuery && (
        <div className="py-8 text-center text-gray-500">
          <p>No cities match &quot;{searchQuery}&quot;</p>
        </div>
      )}

      {/* No suggestions available */}
      {!error && !isLoading && suggestedCities.length === 0 && !searchQuery && (
        <div className="py-8 text-center text-gray-500">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p>No nearby cities found within {serviceAreaRadius} miles</p>
          <p className="text-sm">Try increasing the search radius or add cities manually.</p>
        </div>
      )}

      {/* Add Custom City */}
      <div className="space-y-3">
        {!showAddCustom ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddCustom(true)}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Custom City
          </Button>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customCityName">City Name</Label>
                  <Input
                    id="customCityName"
                    placeholder="e.g. Palmetto"
                    value={customCity.name}
                    onChange={(e) =>
                      setCustomCity({ ...customCity, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customCityState">State</Label>
                  <Input
                    id="customCityState"
                    placeholder="e.g. FL"
                    value={customCity.state}
                    onChange={(e) =>
                      setCustomCity({ ...customCity, state: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowAddCustom(false);
                    setCustomCity({ name: '', state: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddCustomCity}
                  disabled={!customCity.name.trim() || !customCity.state.trim()}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add City
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
        <Info className="mt-0.5 h-5 w-5 text-blue-600" />
        <div className="text-sm">
          <p className="font-medium text-blue-900">How service areas work</p>
          <p className="text-blue-700">
            Each service area gets its own page at <code className="text-xs bg-blue-100 px-1 rounded">/service-areas/[city]</code>.
            These pages help you rank for &quot;[service] in [city]&quot; searches without needing a physical location there.
          </p>
        </div>
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
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          {serviceAreas.length === 0 ? 'Skip' : 'Next'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
