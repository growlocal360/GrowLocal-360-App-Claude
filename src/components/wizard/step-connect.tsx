'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowRight,
  Link2,
  PenLine,
  Loader2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

interface GBPServiceArea {
  name: string;
  placeId: string;
}

interface GBPLocation {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  isPrimary: boolean;
  gbpPlaceId?: string;
  gbpLocationId?: string;
  latitude?: number;
  longitude?: number;
  primaryCategory?: {
    name: string;
    displayName: string;
  };
  additionalCategories?: {
    name: string;
    displayName: string;
  }[];
  accountName?: string;
  accountId?: string;
  // Service areas from GBP profile
  serviceAreas?: GBPServiceArea[];
}

export function StepConnect() {
  const {
    setConnectionType,
    nextStep,
    connectionType,
    setBusinessName,
    setLocations,
    setPrimaryCategory,
    setSecondaryCategories,
    setServiceAreas,
  } = useWizardStore();

  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gbpLocations, setGbpLocations] = useState<GBPLocation[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Check if user is already connected via Google
  useEffect(() => {
    const checkGoogleConnection = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) {
        // User has Google token, try to fetch locations
        fetchGBPLocations();
      }
    };
    checkGoogleConnection();
  }, [supabase]);

  const fetchGBPLocations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gbp/locations');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch locations');
      }

      setGbpLocations(data.locations || []);
      setIsConnected(true);

      // Don't auto-select - let user choose which locations to import
      setSelectedLocations(new Set());
    } catch (err) {
      console.error('Error fetching GBP locations:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch locations';
      // Check if token expired
      if (errorMessage.includes('401') || errorMessage.includes('token') || errorMessage.includes('unauthorized')) {
        setError('Your Google session has expired. Please reconnect.');
      } else if (errorMessage.includes('permission') || errorMessage.includes('403') || errorMessage.includes('not found')) {
        // User doesn't have a Google Business Profile
        setError('No Google Business Profile found for this account. You can add your business details manually instead.');
        setIsConnected(true); // Show the "no locations" screen with manual option
        setGbpLocations([]); // Empty locations triggers the "No Locations Found" UI
        return;
      } else {
        setError(errorMessage);
      }
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleConnect = async () => {
    setIsLoading(true);
    setError(null);

    // Always re-authenticate with Google to ensure we have the business.manage scope
    // The regular login/signup doesn't request this scope, so we need to get it here
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/oauth2callback?next=/dashboard/sites/new`,
        scopes: 'https://www.googleapis.com/auth/business.manage',
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  const handleManualEntry = () => {
    setConnectionType('manual');
    nextStep();
  };

  const handleContinueWithSelected = () => {
    if (selectedLocations.size === 0) {
      setError('Please select at least one location');
      return;
    }

    // Get selected location data
    const selected = gbpLocations.filter(
      (loc) => selectedLocations.has(loc.gbpLocationId || loc.name)
    );

    // Set business name from first location
    if (selected.length > 0 && selected[0].name) {
      setBusinessName(selected[0].name);
    }

    // Convert to wizard location format
    const wizardLocations = selected.map((loc, index) => ({
      name: loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      zipCode: loc.zipCode,
      phone: loc.phone || '',
      isPrimary: index === 0,
      gbpPlaceId: loc.gbpPlaceId,
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));

    setLocations(wizardLocations);

    // Set categories from first location if available
    // Note: GBP returns minimal category data, so we create partial objects
    // The categories step will allow users to refine their selection
    if (selected[0]?.primaryCategory) {
      setPrimaryCategory({
        gcid: selected[0].primaryCategory.name,
        name: selected[0].primaryCategory.name,
        displayName: selected[0].primaryCategory.displayName,
        keywords: [],
        relatedCategories: [],
        commonServices: [],
      });
    }

    if (selected[0]?.additionalCategories?.length) {
      setSecondaryCategories(
        selected[0].additionalCategories.map((cat) => ({
          gcid: cat.name,
          name: cat.name,
          displayName: cat.displayName,
          keywords: [],
          relatedCategories: [],
          commonServices: [],
        }))
      );
    }

    // Collect service areas from all selected GBP locations
    // Dedupe by placeId and exclude the primary location's city
    const allServiceAreas = new Map<string, { name: string; placeId: string }>();
    const primaryCity = selected[0]?.city?.toLowerCase();

    for (const loc of selected) {
      if (loc.serviceAreas) {
        for (const area of loc.serviceAreas) {
          // Skip if it's the same as the primary city
          const areaName = area.name.split(',')[0].trim().toLowerCase();
          if (areaName === primaryCity) continue;

          // Use placeId as key for deduplication
          if (area.placeId && !allServiceAreas.has(area.placeId)) {
            allServiceAreas.set(area.placeId, {
              name: area.name,
              placeId: area.placeId,
            });
          }
        }
      }
    }

    // Convert to wizard ServiceArea format
    if (allServiceAreas.size > 0) {
      const serviceAreasArray = Array.from(allServiceAreas.values()).map((area) => {
        // Parse "City, STATE, USA" format
        const parts = area.name.split(',').map((p) => p.trim());
        const cityName = parts[0] || area.name;
        const stateName = parts[1] || '';

        return {
          id: area.placeId,
          name: cityName,
          state: stateName,
          placeId: area.placeId,
          isCustom: false, // From GBP
        };
      });

      setServiceAreas(serviceAreasArray);
    }

    setConnectionType('google');
    nextStep();
  };

  const toggleLocation = (locationId: string) => {
    setSelectedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  };

  // Filter locations based on search query
  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return gbpLocations;
    const query = searchQuery.toLowerCase();
    return gbpLocations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(query) ||
        loc.city?.toLowerCase().includes(query) ||
        loc.state?.toLowerCase().includes(query) ||
        loc.address?.toLowerCase().includes(query) ||
        loc.primaryCategory?.displayName?.toLowerCase().includes(query)
    );
  }, [gbpLocations, searchQuery]);

  // If connected and has locations, show location picker
  if (isConnected && gbpLocations.length > 0) {
    return (
      <div className="space-y-6">
        <div>
          <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
            Step 1 of 6
          </span>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">
            Select Your Locations
          </h2>
          <p className="mt-1 text-gray-500">
            Choose which Google Business Profile locations to import.
            <span className="ml-1 font-medium">({gbpLocations.length} locations found)</span>
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
          <span>Connected to Google Business Profile</span>
        </div>

        {/* Search box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name, city, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Location count indicator */}
        {searchQuery && (
          <p className="text-sm text-gray-500">
            Showing {filteredLocations.length} of {gbpLocations.length} locations
          </p>
        )}

        <div className="max-h-[400px] space-y-3 overflow-y-auto">
          {filteredLocations.map((location) => {
            const locationId = location.gbpLocationId || location.name;
            const isSelected = selectedLocations.has(locationId);

            return (
              <Card
                key={locationId}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => toggleLocation(locationId)}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleLocation(locationId)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {location.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {location.address && `${location.address}, `}
                          {location.city}, {location.state} {location.zipCode}
                        </p>
                        {location.phone && (
                          <p className="text-sm text-gray-500">{location.phone}</p>
                        )}
                      </div>
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    {location.primaryCategory && (
                      <div className="mt-2">
                        <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          {location.primaryCategory.displayName}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              setIsConnected(false);
              setGbpLocations([]);
            }}
          >
            Back
          </Button>
          <Button
            onClick={handleContinueWithSelected}
            disabled={selectedLocations.size === 0}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            Continue with {selectedLocations.size} location
            {selectedLocations.size !== 1 ? 's' : ''}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // If connected but no locations found
  if (isConnected && gbpLocations.length === 0 && !isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
            Step 1 of 6
          </span>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">
            No Business Profile Found
          </h2>
          <p className="mt-1 text-gray-500">
            {error || "We couldn't find any Google Business Profile locations connected to your account."}
          </p>
        </div>

        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600">
            You can still create your site manually.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={handleManualEntry}
          >
            <PenLine className="mr-2 h-4 w-4" />
            Continue Manually
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={() => setIsConnected(false)}
          className="w-full"
        >
          Try a different Google account
        </Button>
      </div>
    );
  }

  // Initial connection screen
  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
          Step 1 of 5
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">
          Import from Google Business Profile
        </h2>
        <p className="mt-1 text-gray-500">
          We&apos;ll import your business details, categories, and locations to build your website automatically.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Google Connect Option */}
        <Card
          className={`cursor-pointer transition-all hover:border-emerald-300 hover:shadow-md ${
            connectionType === 'google' ? 'border-emerald-500 ring-2 ring-emerald-200' : ''
          }`}
          onClick={handleGoogleConnect}
        >
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <svg className="h-8 w-8" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Connect Google Account
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Import categories, locations, photos, and hours automatically
            </p>
            <Button
              className="mt-4 w-full bg-blue-500 hover:bg-blue-600"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect Google Business
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Manual Entry Option */}
        <Card
          className={`cursor-pointer transition-all hover:border-emerald-300 hover:shadow-md ${
            connectionType === 'manual' ? 'border-emerald-500 ring-2 ring-emerald-200' : ''
          }`}
          onClick={handleManualEntry}
        >
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <PenLine className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Add Manually
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              No Google Profile? We&apos;ll help you pick categories and set up your site structure
            </p>
            <Button variant="outline" className="mt-4 w-full">
              <ArrowRight className="mr-2 h-4 w-4" />
              Start Fresh
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-sm text-gray-400">
        You can always connect your Google Business Profile later
      </p>
    </div>
  );
}
