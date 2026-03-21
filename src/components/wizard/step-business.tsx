'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Plus, Trash2, MapPin, Tag, BarChart3, Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { WizardLocation, WizardGSCQuery } from '@/types/wizard';

interface GSCProperty {
  siteUrl: string;
  permissionLevel: string;
}

export function StepBusiness() {
  const {
    businessName,
    coreIndustry,
    locations,
    primaryCategory,
    secondaryCategories,
    connectionType,
    setBusinessInfo,
    setCoreIndustry,
    addLocation,
    removeLocation,
    updateLocation,
    setGSCPropertyUrl,
    setGSCQueries,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  const supabase = useMemo(() => createClient(), []);

  // GSC state for manual path
  const [gscProperties, setGscProperties] = useState<GSCProperty[]>([]);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscConnecting, setGscConnecting] = useState(false);
  const [gscConnected, setGscConnected] = useState(false);
  const [selectedGscProperty, setSelectedGscProperty] = useState('');
  const [gscSyncing, setGscSyncing] = useState(false);
  const [gscSynced, setGscSynced] = useState(false);
  const [gscQueryCount, setGscQueryCount] = useState(0);

  // Check if user already has a Google token (they may have logged in with Google)
  useEffect(() => {
    const checkGoogleToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) {
        fetchGSCProperties();
      }
    };
    checkGoogleToken();
  }, [supabase]);

  const fetchGSCProperties = async () => {
    try {
      setGscLoading(true);
      const response = await fetch('/api/gsc/properties');
      if (!response.ok) return;
      const data = await response.json();
      const props = data.properties || [];
      setGscProperties(props);
      if (props.length > 0) setGscConnected(true);
    } catch {
      // Silent fail — GSC is optional
    } finally {
      setGscLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    setGscConnecting(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/oauth2callback?next=/dashboard/sites/new`,
        scopes: 'https://www.googleapis.com/auth/webmasters.readonly',
      },
    });
  };

  const handleSyncGSCQueries = async (propertyUrl: string) => {
    try {
      setGscSyncing(true);
      setSelectedGscProperty(propertyUrl);

      const response = await fetch('/api/gsc/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyUrl }),
      });

      if (!response.ok) {
        setGscSynced(false);
        return;
      }

      const data = await response.json();
      const queries: WizardGSCQuery[] = data.queries || [];
      setGSCPropertyUrl(propertyUrl);
      setGSCQueries(queries);
      setGscQueryCount(queries.length);
      setGscSynced(true);
    } catch {
      setGscSynced(false);
    } finally {
      setGscSyncing(false);
    }
  };

  // Auto-fill core industry from primary category if connected via GBP
  useEffect(() => {
    if (connectionType === 'google' && primaryCategory && !coreIndustry) {
      setCoreIndustry(primaryCategory.displayName);
    }
  }, [connectionType, primaryCategory, coreIndustry, setCoreIndustry]);

  const [showLocationForm, setShowLocationForm] = useState(locations.length === 0);
  const [newLocation, setNewLocation] = useState<Partial<WizardLocation>>({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    isPrimary: locations.length === 0,
  });

  const handleAddLocation = () => {
    if (newLocation.name && newLocation.city && newLocation.state) {
      addLocation({
        name: newLocation.name || '',
        address: newLocation.address || '',
        city: newLocation.city || '',
        state: newLocation.state || '',
        zipCode: newLocation.zipCode || '',
        phone: newLocation.phone,
        isPrimary: locations.length === 0,
      });
      setNewLocation({
        name: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        isPrimary: false,
      });
      setShowLocationForm(false);
    }
  };

  const handleSetPrimary = (index: number) => {
    locations.forEach((_, i) => {
      updateLocation(i, { isPrimary: i === index });
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
          Step 2 of 6
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">Business Basics</h2>
        <p className="mt-1 text-gray-500">
          Let&apos;s start with the core details of the business.
        </p>
      </div>

      {/* Business Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name</Label>
          <Input
            id="businessName"
            placeholder="e.g. Acme Plumbing"
            value={businessName}
            onChange={(e) => setBusinessInfo(e.target.value, coreIndustry)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="coreIndustry">Core Industry / Service</Label>
          <Input
            id="coreIndustry"
            placeholder="e.g. HVAC, Plumbing, Law"
            value={coreIndustry}
            onChange={(e) => setBusinessInfo(businessName, e.target.value)}
          />
          <p className="text-xs text-gray-500">
            This helps us suggest the best GBP categories for your business
          </p>
        </div>

        {/* GBP Categories from connected profile */}
        {connectionType === 'google' && primaryCategory && (
          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
              <Tag className="h-4 w-4" />
              GBP Categories (imported)
            </div>

            {/* Primary Category */}
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Primary Category</p>
              <span className="mt-1 inline-block rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white">
                {primaryCategory.displayName}
              </span>
            </div>

            {/* Secondary Categories */}
            {secondaryCategories.length > 0 && (
              <div>
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Secondary Categories</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {secondaryCategories.map((cat) => (
                    <span
                      key={cat.gcid}
                      className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
                    >
                      {cat.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-blue-600">
              These categories were imported from your Google Business Profile. You can adjust them in the next step.
            </p>
          </div>
        )}
      </div>

      {/* Locations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Locations</Label>
          {locations.length > 0 && !showLocationForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLocationForm(true)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Location
            </Button>
          )}
        </div>

        {/* Existing Locations */}
        {locations.map((location, index) => (
          <Card key={index} className={location.isPrimary ? 'border-[#00ef99]/30' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`rounded-full p-2 ${location.isPrimary ? 'bg-[#00ef99]/10' : 'bg-gray-100'}`}>
                    <MapPin className={`h-4 w-4 ${location.isPrimary ? 'text-[#00ef99]' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{location.name}</p>
                    <p className="text-sm text-gray-500">
                      {location.address && `${location.address}, `}
                      {location.city}, {location.state} {location.zipCode}
                    </p>
                    {location.isPrimary && (
                      <span className="mt-1 inline-block rounded bg-[#00ef99]/10 px-2 py-0.5 text-xs font-medium text-[#00ef99]">
                        Primary Location
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!location.isPrimary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetPrimary(index)}
                    >
                      Set Primary
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLocation(index)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Location Form */}
        {showLocationForm && (
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="locName">Location Name</Label>
                  <Input
                    id="locName"
                    placeholder="e.g. Main Office"
                    value={newLocation.name}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locPhone">Phone (optional)</Label>
                  <Input
                    id="locPhone"
                    placeholder="(555) 123-4567"
                    value={newLocation.phone}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="locAddress">Street Address</Label>
                <Input
                  id="locAddress"
                  placeholder="123 Main St"
                  value={newLocation.address}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, address: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="locCity">City</Label>
                  <Input
                    id="locCity"
                    placeholder="Dallas"
                    value={newLocation.city}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, city: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locState">State</Label>
                  <Input
                    id="locState"
                    placeholder="TX"
                    value={newLocation.state}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, state: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locZip">ZIP Code</Label>
                  <Input
                    id="locZip"
                    placeholder="75001"
                    value={newLocation.zipCode}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, zipCode: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {locations.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowLocationForm(false)}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handleAddLocation}
                  disabled={!newLocation.name || !newLocation.city || !newLocation.state}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Location
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {locations.length === 0 && !showLocationForm && (
          <Card className="border-dashed cursor-pointer" onClick={() => setShowLocationForm(true)}>
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <Plus className="mb-2 h-8 w-8 text-gray-400" />
              <p className="font-medium text-gray-600">Add your first location</p>
              <p className="text-sm text-gray-400">Every site needs at least one location</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* GSC Section — optional for manual path */}
      {connectionType === 'manual' && (
        <Card className="border-blue-100 bg-blue-50/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">
                  Have an existing website?
                </h4>
                <p className="text-xs text-gray-500">
                  Connect Google Search Console to use your real search data for better content
                </p>
              </div>
            </div>

            {gscConnected && gscProperties.length > 0 ? (
              <>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={selectedGscProperty}
                      onValueChange={(value) => {
                        setSelectedGscProperty(value);
                        setGscSynced(false);
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select a property..." />
                      </SelectTrigger>
                      <SelectContent>
                        {gscProperties.map((p) => (
                          <SelectItem key={p.siteUrl} value={p.siteUrl}>
                            {p.siteUrl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedGscProperty || gscSyncing}
                    onClick={() => handleSyncGSCQueries(selectedGscProperty)}
                    className="shrink-0"
                  >
                    {gscSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : gscSynced ? (
                      <CheckCircle2 className="h-4 w-4 text-[#00ef99]" />
                    ) : (
                      'Sync Data'
                    )}
                  </Button>
                </div>
                {gscSynced && (
                  <div className="flex items-center gap-2 text-xs text-[#00ef99]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {gscQueryCount} queries synced — this data will enhance your site content
                  </div>
                )}
              </>
            ) : gscLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking for Search Console access...
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectGoogle}
                disabled={gscConnecting}
                className="w-full"
              >
                {gscConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="mr-2 h-4 w-4" />
                )}
                Connect Google Search Console
              </Button>
            )}
          </CardContent>
        </Card>
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
