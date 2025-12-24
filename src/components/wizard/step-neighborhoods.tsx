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
  Building2,
} from 'lucide-react';
import type { WizardNeighborhood } from '@/types/wizard';

interface SuggestedNeighborhood {
  id: string;
  name: string;
  placeId: string;
  latitude: number;
  longitude: number;
  locationId: string;
}

export function StepNeighborhoods() {
  const {
    locations,
    neighborhoods,
    toggleNeighborhood,
    addNeighborhood,
    removeNeighborhood,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  const [suggestedNeighborhoods, setSuggestedNeighborhoods] = useState<SuggestedNeighborhood[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'google' | 'llm' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customNeighborhood, setCustomNeighborhood] = useState({ name: '', locationId: '' });
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string | 'all'>('all');

  // Fetch neighborhoods when component mounts
  useEffect(() => {
    const fetchNeighborhoods = async () => {
      setIsLoading(true);
      setError(null);

      if (locations.length === 0) {
        setIsLoading(false);
        setSuggestedNeighborhoods([]);
        return;
      }

      // Prepare locations with IDs for the API
      // Geocode any locations missing lat/lng
      const locationsWithCoords = await Promise.all(
        locations.map(async (loc, index) => {
          const id = loc.id || `loc-${index}`;

          // If we already have coordinates, use them
          if (loc.latitude && loc.longitude) {
            return {
              id,
              city: loc.city,
              state: loc.state,
              latitude: loc.latitude,
              longitude: loc.longitude,
            };
          }

          // Otherwise, geocode the address
          try {
            const address = `${loc.address}, ${loc.city}, ${loc.state} ${loc.zipCode}`;
            const geocodeResponse = await fetch('/api/places/geocode', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address }),
            });

            if (geocodeResponse.ok) {
              const geocodeData = await geocodeResponse.json();
              if (geocodeData.latitude && geocodeData.longitude) {
                return {
                  id,
                  city: loc.city,
                  state: loc.state,
                  latitude: geocodeData.latitude,
                  longitude: geocodeData.longitude,
                };
              }
            }
          } catch (err) {
            console.error(`Failed to geocode location ${loc.city}:`, err);
          }

          // Return without coordinates if geocoding failed
          return {
            id,
            city: loc.city,
            state: loc.state,
            latitude: undefined,
            longitude: undefined,
          };
        })
      );

      try {
        // First try Google Places API
        const response = await fetch('/api/places/neighborhoods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locations: locationsWithCoords }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch neighborhoods');
        }

        const data = await response.json();
        const googleNeighborhoods = data.neighborhoods || [];

        // If Google Places returned results, use them
        if (googleNeighborhoods.length > 0) {
          setSuggestedNeighborhoods(googleNeighborhoods);
          setSource('google');
        } else {
          // Fall back to LLM-based suggestions
          console.log('No Google Places results, trying LLM...');
          const llmResponse = await fetch('/api/places/neighborhoods/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locations: locationsWithCoords }),
          });

          if (llmResponse.ok) {
            const llmData = await llmResponse.json();
            setSuggestedNeighborhoods(llmData.neighborhoods || []);
            setSource('llm');
          } else {
            // Both failed, show empty state
            setSuggestedNeighborhoods([]);
            setSource(null);
          }
        }
      } catch (err) {
        console.error('Error fetching neighborhoods:', err);
        setError(err instanceof Error ? err.message : 'Failed to load neighborhoods');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNeighborhoods();
  }, [locations]);

  // Filter neighborhoods by search and location
  const filteredNeighborhoods = useMemo(() => {
    let filtered = suggestedNeighborhoods;

    if (selectedLocationFilter !== 'all') {
      filtered = filtered.filter((n) => n.locationId === selectedLocationFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((n) => n.name.toLowerCase().includes(query));
    }

    return filtered;
  }, [suggestedNeighborhoods, selectedLocationFilter, searchQuery]);

  // Group selected neighborhoods by location
  const neighborhoodsByLocation = useMemo(() => {
    const grouped: Record<string, WizardNeighborhood[]> = {};
    neighborhoods.forEach((n) => {
      if (!grouped[n.locationId]) {
        grouped[n.locationId] = [];
      }
      grouped[n.locationId].push(n);
    });
    return grouped;
  }, [neighborhoods]);

  const handleToggleNeighborhood = (neighborhood: SuggestedNeighborhood) => {
    const wizardNeighborhood: WizardNeighborhood = {
      id: neighborhood.id,
      name: neighborhood.name,
      locationId: neighborhood.locationId,
      placeId: neighborhood.placeId,
      latitude: neighborhood.latitude,
      longitude: neighborhood.longitude,
      isCustom: false,
    };
    toggleNeighborhood(wizardNeighborhood);
  };

  const handleAddCustomNeighborhood = () => {
    if (!customNeighborhood.name.trim() || !customNeighborhood.locationId) return;

    const custom: WizardNeighborhood = {
      id: `custom-${Date.now()}`,
      name: customNeighborhood.name.trim(),
      locationId: customNeighborhood.locationId,
      isCustom: true,
    };

    addNeighborhood(custom);
    setCustomNeighborhood({ name: '', locationId: '' });
    setShowAddCustom(false);
  };

  const isSelected = (neighborhoodId: string) => {
    return neighborhoods.some((n) => n.id === neighborhoodId);
  };

  const getLocationName = (locationId: string) => {
    const loc = locations.find((l, i) => (l.id || `loc-${i}`) === locationId);
    return loc ? `${loc.city}, ${loc.state}` : locationId;
  };

  // Calculate step number
  const stepNumber = 5;
  const totalSteps = 7;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
            Step {stepNumber} of {totalSteps}
          </span>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Neighborhoods</h2>
        </div>

        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-emerald-100">
            <Building2 className="h-8 w-8 text-emerald-500" />
          </div>
          <p className="text-lg font-medium text-gray-900">Finding neighborhoods...</p>
          <p className="text-gray-500">Discovering areas within your service cities</p>
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
        <h2 className="mt-2 text-2xl font-bold text-gray-900">Neighborhoods</h2>
        <p className="mt-1 text-gray-500">
          Select neighborhoods within your GBP location cities. These create hyper-local pages that boost your location rankings.
        </p>
      </div>

      {/* SEO Explanation */}
      <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 text-emerald-600" />
        <div>
          <p className="font-medium text-emerald-900">Why Neighborhoods Matter</p>
          <p className="text-sm text-emerald-700">
            Neighborhood pages build geographic relevance for your GBP landing pages. When someone searches
            &quot;plumber in Siesta Key&quot;, having a dedicated page helps you rank AND builds authority for
            your Sarasota location page.
          </p>
        </div>
      </div>

      {/* Selected Neighborhoods by Location */}
      {neighborhoods.length > 0 && (
        <div className="space-y-4">
          <Label>Selected Neighborhoods ({neighborhoods.length})</Label>
          {Object.entries(neighborhoodsByLocation).map(([locationId, locNeighborhoods]) => (
            <div key={locationId} className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium text-gray-700">
                <MapPin className="mr-1 inline h-3 w-3" />
                {getLocationName(locationId)}
              </p>
              <div className="flex flex-wrap gap-2">
                {locNeighborhoods.map((n) => (
                  <Badge
                    key={n.id}
                    variant="secondary"
                    className="flex items-center gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  >
                    {n.name}
                    {n.isCustom && (
                      <span className="ml-1 text-xs opacity-60">(custom)</span>
                    )}
                    <button
                      onClick={() => removeNeighborhood(n.id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-emerald-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Location Filter (for multi-location) */}
      {locations.length > 1 && (
        <div className="space-y-2">
          <Label>Filter by Location</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedLocationFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedLocationFilter('all')}
              className={selectedLocationFilter === 'all' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
            >
              All Locations
            </Button>
            {locations.map((loc, index) => {
              const locId = loc.id || `loc-${index}`;
              return (
                <Button
                  key={locId}
                  variant={selectedLocationFilter === locId ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedLocationFilter(locId)}
                  className={selectedLocationFilter === locId ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                >
                  {loc.city}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search neighborhoods..."
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
          <p className="mt-2 text-sm">You can still add neighborhoods manually.</p>
        </div>
      )}

      {/* Suggested Neighborhoods Grid */}
      {!error && filteredNeighborhoods.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Suggested Neighborhoods ({filteredNeighborhoods.length})</Label>
            {source === 'llm' && (
              <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700">
                <Sparkles className="mr-1 h-3 w-3" />
                AI Suggested
              </Badge>
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {filteredNeighborhoods.map((neighborhood) => {
              const selected = isSelected(neighborhood.id);
              return (
                <Card
                  key={neighborhood.id}
                  className={`cursor-pointer transition-all ${
                    selected
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'hover:border-gray-300'
                  }`}
                  onClick={() => handleToggleNeighborhood(neighborhood)}
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
                          {neighborhood.name}
                        </p>
                        {locations.length > 1 && (
                          <p className="text-xs text-gray-500">
                            {getLocationName(neighborhood.locationId)}
                          </p>
                        )}
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
      {!error && !isLoading && filteredNeighborhoods.length === 0 && searchQuery && (
        <div className="py-8 text-center text-gray-500">
          <p>No neighborhoods match &quot;{searchQuery}&quot;</p>
        </div>
      )}

      {/* No suggestions */}
      {!error && !isLoading && suggestedNeighborhoods.length === 0 && !searchQuery && (
        <div className="py-8 text-center text-gray-500">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p>No neighborhoods found automatically</p>
          <p className="text-sm">Add neighborhoods manually using the button below.</p>
        </div>
      )}

      {/* Add Custom Neighborhood */}
      <div className="space-y-3">
        {!showAddCustom ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddCustom(true)}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Custom Neighborhood
          </Button>
        ) : (
          <Card className="border-dashed">
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customNeighborhoodName">Neighborhood Name</Label>
                  <Input
                    id="customNeighborhoodName"
                    placeholder="e.g. Siesta Key"
                    value={customNeighborhood.name}
                    onChange={(e) =>
                      setCustomNeighborhood({ ...customNeighborhood, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customNeighborhoodLocation">Parent Location</Label>
                  <select
                    id="customNeighborhoodLocation"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={customNeighborhood.locationId}
                    onChange={(e) =>
                      setCustomNeighborhood({ ...customNeighborhood, locationId: e.target.value })
                    }
                  >
                    <option value="">Select location...</option>
                    {locations.map((loc, index) => (
                      <option key={loc.id || index} value={loc.id || `loc-${index}`}>
                        {loc.city}, {loc.state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowAddCustom(false);
                    setCustomNeighborhood({ name: '', locationId: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddCustomNeighborhood}
                  disabled={!customNeighborhood.name.trim() || !customNeighborhood.locationId}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Neighborhood
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
          <p className="font-medium text-blue-900">How neighborhood pages work</p>
          <p className="text-blue-700">
            Each neighborhood gets a page at{' '}
            <code className="rounded bg-blue-100 px-1 text-xs">
              /locations/[city]/neighborhoods/[neighborhood]
            </code>
            . These pages link back to your main location page, building topical authority and helping
            you rank for hyper-local searches.
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
          {neighborhoods.length === 0 ? 'Skip' : 'Next'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
