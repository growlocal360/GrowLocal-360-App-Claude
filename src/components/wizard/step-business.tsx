'use client';

import { useState, useEffect } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Plus, Trash2, MapPin, Tag } from 'lucide-react';
import type { WizardLocation } from '@/types/wizard';

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
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

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
          Step 1 of 5
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
          <Card key={index} className={location.isPrimary ? 'border-emerald-300' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`rounded-full p-2 ${location.isPrimary ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                    <MapPin className={`h-4 w-4 ${location.isPrimary ? 'text-emerald-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{location.name}</p>
                    <p className="text-sm text-gray-500">
                      {location.address && `${location.address}, `}
                      {location.city}, {location.state} {location.zipCode}
                    </p>
                    {location.isPrimary && (
                      <span className="mt-1 inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
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
