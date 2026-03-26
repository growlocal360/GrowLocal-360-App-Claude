'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, AlertCircle, Check, Loader2, ArrowLeft } from 'lucide-react';

interface LocationData {
  id: string;
  name: string;
  city: string;
  state: string;
  phone: string | null;
  address_line1: string;
  zip_code: string;
  is_primary: boolean;
  representative_city: string | null;
  representative_state: string | null;
}

export default function LocationsSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable fields per location
  const [edits, setEdits] = useState<Record<string, Partial<LocationData & { representative_city: string; representative_state: string }>>>({});

  useEffect(() => {
    fetchLocations();
  }, [siteId]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/settings/locations`);
      if (!response.ok) throw new Error('Failed to fetch locations');
      const data: LocationData[] = await response.json();
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const updateEdit = (locationId: string, field: string, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [locationId]: {
        ...prev[locationId],
        [field]: value,
      },
    }));
  };

  const getEditValue = (location: LocationData, field: keyof LocationData) => {
    const edit = edits[location.id];
    if (edit && field in edit) return (edit as Record<string, string>)[field];
    return (location[field] as string) || '';
  };

  const hasChanges = (location: LocationData) => {
    const edit = edits[location.id];
    if (!edit) return false;
    return Object.entries(edit).some(
      ([key, value]) => value !== ((location[key as keyof LocationData] as string) || '')
    );
  };

  const handleSave = async (location: LocationData) => {
    const edit = edits[location.id];
    if (!edit) return;

    try {
      setSaving(location.id);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/sites/${siteId}/settings/locations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: location.id,
          ...edit,
          representativeCity: edit.representative_city,
          representativeState: edit.representative_state,
        }),
      });

      if (!response.ok) throw new Error('Failed to update location');

      setSuccess(location.id);
      setTimeout(() => setSuccess(null), 3000);

      // Re-fetch to get updated data
      await fetchLocations();
      // Clear edits for this location
      setEdits((prev) => {
        const next = { ...prev };
        delete next[location.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/sites/${siteId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-500">Manage your business locations and service area cities.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {locations.map((location) => (
        <Card key={location.id}>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold">{location.name}</h2>
              {location.is_primary && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Primary
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`city-${location.id}`}>City</Label>
                <Input
                  id={`city-${location.id}`}
                  value={getEditValue(location, 'city')}
                  onChange={(e) => updateEdit(location.id, 'city', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`state-${location.id}`}>State</Label>
                <Input
                  id={`state-${location.id}`}
                  value={getEditValue(location, 'state')}
                  onChange={(e) => updateEdit(location.id, 'state', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`phone-${location.id}`}>Phone</Label>
              <Input
                id={`phone-${location.id}`}
                value={getEditValue(location, 'phone')}
                onChange={(e) => updateEdit(location.id, 'phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="mb-3 text-sm font-medium text-amber-800">
                Representative City (for Service Area Businesses)
              </p>
              <p className="mb-3 text-xs text-amber-700">
                If this is a SAB with no physical address, set the representative city to anchor your content to a specific area.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`rep-city-${location.id}`}>Representative City</Label>
                  <Input
                    id={`rep-city-${location.id}`}
                    value={getEditValue(location, 'representative_city')}
                    onChange={(e) => updateEdit(location.id, 'representative_city', e.target.value)}
                    placeholder="e.g. Parma"
                  />
                </div>
                <div>
                  <Label htmlFor={`rep-state-${location.id}`}>Representative State</Label>
                  <Input
                    id={`rep-state-${location.id}`}
                    value={getEditValue(location, 'representative_state')}
                    onChange={(e) => updateEdit(location.id, 'representative_state', e.target.value)}
                    placeholder="e.g. OH"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {success === location.id && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
              <Button
                onClick={() => handleSave(location)}
                disabled={!hasChanges(location) || saving === location.id}
              >
                {saving === location.id ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {locations.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            No locations found for this site.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
