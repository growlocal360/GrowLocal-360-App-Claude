'use client';

import { useEffect, useRef, useState } from 'react';
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

interface Prediction {
  placeId: string;
  description: string;
}

interface JobLocationCardProps {
  location: JobLocation | null;
  onUseCurrentLocation: () => void;
  onSaveManualAddress: (location: JobLocation) => void;
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
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<JobLocation | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch autocomplete predictions as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (manualInput.trim().length < 2) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    // Clear selected location when user keeps typing after a selection
    if (selectedLocation) {
      setSelectedLocation(null);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/places/autocomplete?query=${encodeURIComponent(manualInput.trim())}`
        );
        const data = await res.json();
        setPredictions(data.predictions || []);
        setOpen((data.predictions || []).length > 0);
      } catch {
        setPredictions([]);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualInput]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectPrediction = async (prediction: Prediction) => {
    setManualInput(prediction.description);
    setOpen(false);
    setActiveIndex(-1);
    setIsLoadingDetails(true);

    try {
      const res = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(prediction.placeId)}`
      );
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const loc: JobLocation = {
        address: data.address || prediction.description,
        city: data.city || '',
        state: data.state || '',
        zip: data.zip || '',
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        source: 'manual',
      };
      setSelectedLocation(loc);
    } catch {
      // Fallback: save just the description text
      setSelectedLocation({
        address: prediction.description,
        city: '',
        state: '',
        zip: '',
        lat: null,
        lng: null,
        source: 'manual',
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSave = () => {
    if (selectedLocation) {
      onSaveManualAddress(selectedLocation);
      setManualInput('');
      setSelectedLocation(null);
      return;
    }

    // Fallback: allow saving raw text if no prediction was selected
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    onSaveManualAddress({
      address: trimmed,
      city: '',
      state: '',
      zip: '',
      lat: null,
      lng: null,
      source: 'manual',
    });
    setManualInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (open && predictions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        selectPrediction(predictions[activeIndex]);
        return;
      } else if (e.key === 'Escape') {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
    }

    if (e.key === 'Enter' && !open) {
      handleSave();
    }
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

        {/* Address autocomplete input */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Location</label>
          <div ref={containerRef} className="relative">
            <Input
              placeholder="Start typing an address..."
              value={manualInput}
              onChange={(e) => {
                setManualInput(e.target.value);
                setActiveIndex(-1);
              }}
              onFocus={() => {
                if (predictions.length > 0) setOpen(true);
              }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            {open && predictions.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md max-h-48 overflow-auto">
                {predictions.map((prediction, i) => (
                  <li
                    key={prediction.placeId}
                    className={`cursor-pointer px-3 py-2 text-sm ${
                      i === activeIndex
                        ? 'bg-[#00d9c0]/10 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectPrediction(prediction);
                    }}
                  >
                    {prediction.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleSave}
            disabled={isLoadingDetails || (!manualInput.trim() && !selectedLocation)}
          >
            {isLoadingDetails ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Getting address details...
              </>
            ) : (
              'Save Location'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
