'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, Navigation } from 'lucide-react';

export interface JobLocation {
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  source: 'exif' | 'device' | 'manual';
}

interface JobLocationCardProps {
  location: JobLocation | null;
  onUseCurrentLocation: () => void;
  onSaveManualAddress: (address: string) => void;
  onEdit: () => void;
  isLoadingLocation: boolean;
}

export function JobLocationCard({
  location,
  onUseCurrentLocation,
  onSaveManualAddress,
  onEdit,
  isLoadingLocation,
}: JobLocationCardProps) {
  const [manualInput, setManualInput] = useState('');

  const handleSave = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    onSaveManualAddress(trimmed);
    setManualInput('');
  };

  // State: Location found
  if (location) {
    const gpsDisplay =
      location.lat != null && location.lng != null
        ? `GPS: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
        : null;

    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#00d9c0]" />
              <h3 className="text-lg font-semibold text-gray-900">Job Location</h3>
            </div>
            <button
              type="button"
              onClick={onEdit}
              className="text-sm font-medium text-[#00d9c0] hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="mt-3 space-y-1">
            {location.address && (
              <p className="text-sm text-gray-800">{location.address}</p>
            )}
            {(location.city || location.state) && (
              <p className="text-sm text-gray-800">
                {[location.city, location.state].filter(Boolean).join(', ')}
                {location.zip ? ` ${location.zip}` : ''}
              </p>
            )}
            {gpsDisplay && (
              <p className="text-sm font-medium text-[#00d9c0]">{gpsDisplay}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // State: No location yet — show input options
  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-5 w-5 text-[#00d9c0]" />
          <h3 className="text-lg font-semibold text-gray-900">Job Location</h3>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          No GPS data found in images. Please set the job location.
        </p>

        {/* Use Current Location */}
        <Button
          onClick={onUseCurrentLocation}
          disabled={isLoadingLocation}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          {isLoadingLocation ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Getting location...
            </>
          ) : (
            <>
              <Navigation className="mr-2 h-4 w-4" />
              Use Current Location
            </>
          )}
        </Button>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-400">or</span>
          </div>
        </div>

        {/* Manual address input */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Location</label>
          <Input
            placeholder="Enter address..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={handleSave}
            disabled={!manualInput.trim()}
          >
            Save Location
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
