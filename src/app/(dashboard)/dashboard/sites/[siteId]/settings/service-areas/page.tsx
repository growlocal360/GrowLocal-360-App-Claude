'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Map,
  MapPin,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  Check,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

interface ServiceArea {
  id: string;
  name: string;
  slug: string;
  state: string | null;
  is_custom: boolean;
  sort_order: number;
  h1: string | null;
}

interface SiteLocation {
  id: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
}

interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  location_id: string;
  is_active: boolean;
}

export default function ServiceAreasPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [locations, setLocations] = useState<SiteLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Add area
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newState, setNewState] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Suggest areas
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; state: string }[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // Deleting
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Content generation
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Neighborhoods
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [neighborhoodsLoading, setNeighborhoodsLoading] = useState(true);
  const [addNeighborhoodOpen, setAddNeighborhoodOpen] = useState(false);
  const [newNeighborhoodName, setNewNeighborhoodName] = useState('');
  const [addNeighborhoodSaving, setAddNeighborhoodSaving] = useState(false);
  const [deletingNeighborhoodId, setDeletingNeighborhoodId] = useState<string | null>(null);
  const [suggestingNeighborhoods, setSuggestingNeighborhoods] = useState(false);
  const [neighborhoodSuggestions, setNeighborhoodSuggestions] = useState<
    { name: string; placeId: string; latitude: number; longitude: number; locationId: string }[]
  >([]);
  const [neighborhoodSuggestOpen, setNeighborhoodSuggestOpen] = useState(false);

  useEffect(() => {
    fetchAreas();
    fetchNeighborhoods();
  }, [siteId]);

  const fetchAreas = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/settings/service-areas`);
      if (!response.ok) throw new Error('Failed to fetch service areas');
      const data = await response.json();
      setAreas(data.serviceAreas || []);
      setLocations(data.locations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service areas');
    } finally {
      setLoading(false);
    }
  };

  const fetchNeighborhoods = async () => {
    try {
      setNeighborhoodsLoading(true);
      const response = await fetch(`/api/sites/${siteId}/settings/neighborhoods`);
      if (!response.ok) throw new Error('Failed to fetch neighborhoods');
      const data = await response.json();
      setNeighborhoods(data.neighborhoods || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load neighborhoods');
    } finally {
      setNeighborhoodsLoading(false);
    }
  };

  const handleAddArea = async () => {
    if (!newName.trim()) return;

    try {
      setAddSaving(true);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/settings/service-areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          state: newState.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add area');
      }

      const result = await response.json();
      setAreas((prev) => [...prev, result.serviceArea]);
      setNewName('');
      setNewState('');
      setAddOpen(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add area');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    try {
      setDeletingId(areaId);
      const response = await fetch(
        `/api/sites/${siteId}/settings/service-areas?id=${areaId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete');

      setAreas((prev) => prev.filter((a) => a.id !== areaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete area');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSuggestAreas = async () => {
    try {
      setSuggesting(true);
      setError(null);

      if (locations.length === 0) {
        setError('No locations found. Add a location first.');
        return;
      }

      const response = await fetch('/api/places/nearby-cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations }),
      });

      if (response.ok) {
        const data = await response.json();
        const existingNames = new Set(areas.map((a) => a.name.toLowerCase()));
        const filtered = (data.cities || []).filter(
          (c: { name: string }) => !existingNames.has(c.name.toLowerCase())
        );
        setSuggestions(filtered);
        setSuggestOpen(true);
      } else {
        setError('Nearby cities suggestions are not available. Add areas manually.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  const addSuggestedArea = async (suggestion: { name: string; state: string }) => {
    try {
      const response = await fetch(`/api/sites/${siteId}/settings/service-areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: suggestion.name,
          state: suggestion.state,
        }),
      });

      if (!response.ok) throw new Error('Failed to add');

      const result = await response.json();
      setAreas((prev) => [...prev, result.serviceArea]);
      setSuggestions((prev) => prev.filter((s) => s.name !== suggestion.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add area');
    }
  };

  const handleGenerateContent = async (areaId: string) => {
    try {
      setGeneratingId(areaId);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/generate-content/service-area`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceAreaId: areaId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate content');
      }

      setAreas((prev) =>
        prev.map((a) => (a.id === areaId ? { ...a, h1: 'generated' } : a))
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setGeneratingId(null);
    }
  };

  // Neighborhood handlers
  const handleAddNeighborhood = async () => {
    if (!newNeighborhoodName.trim()) return;

    try {
      setAddNeighborhoodSaving(true);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/settings/neighborhoods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newNeighborhoodName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add neighborhood');
      }

      const result = await response.json();
      setNeighborhoods((prev) => [...prev, result.neighborhood]);
      setNewNeighborhoodName('');
      setAddNeighborhoodOpen(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add neighborhood');
    } finally {
      setAddNeighborhoodSaving(false);
    }
  };

  const handleDeleteNeighborhood = async (neighborhoodId: string) => {
    try {
      setDeletingNeighborhoodId(neighborhoodId);
      const response = await fetch(
        `/api/sites/${siteId}/settings/neighborhoods?id=${neighborhoodId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete');

      setNeighborhoods((prev) => prev.filter((n) => n.id !== neighborhoodId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete neighborhood');
    } finally {
      setDeletingNeighborhoodId(null);
    }
  };

  const handleSuggestNeighborhoods = async () => {
    try {
      setSuggestingNeighborhoods(true);
      setError(null);

      if (locations.length === 0) {
        setError('No locations found. Add a location first.');
        return;
      }

      // Try Google Places first
      const response = await fetch('/api/places/neighborhoods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations }),
      });

      let results: { name: string; placeId: string; latitude: number; longitude: number; locationId: string }[] = [];

      if (response.ok) {
        const data = await response.json();
        results = data.neighborhoods || [];
      }

      // If Google returned few results, try LLM fallback
      if (results.length < 3) {
        const llmResponse = await fetch('/api/places/neighborhoods/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locations }),
        });

        if (llmResponse.ok) {
          const llmData = await llmResponse.json();
          const llmResults = llmData.neighborhoods || [];
          // Merge, avoiding duplicates by name
          const existingNames = new Set(results.map((r) => r.name.toLowerCase()));
          for (const n of llmResults) {
            if (!existingNames.has(n.name.toLowerCase())) {
              results.push(n);
              existingNames.add(n.name.toLowerCase());
            }
          }
        }
      }

      // Filter out already-added neighborhoods
      const existingNames = new Set(neighborhoods.map((n) => n.name.toLowerCase()));
      const filtered = results.filter((r) => !existingNames.has(r.name.toLowerCase()));

      setNeighborhoodSuggestions(filtered);
      setNeighborhoodSuggestOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get neighborhood suggestions');
    } finally {
      setSuggestingNeighborhoods(false);
    }
  };

  const addSuggestedNeighborhood = async (suggestion: {
    name: string;
    placeId: string;
    latitude: number;
    longitude: number;
    locationId: string;
  }) => {
    try {
      const response = await fetch(`/api/sites/${siteId}/settings/neighborhoods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: suggestion.name,
          placeId: suggestion.placeId,
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          locationId: suggestion.locationId || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to add');

      const result = await response.json();
      setNeighborhoods((prev) => [...prev, result.neighborhood]);
      setNeighborhoodSuggestions((prev) => prev.filter((s) => s.name !== suggestion.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add neighborhood');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link
        href={`/dashboard/sites/${siteId}`}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Site
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Areas & Neighborhoods</h1>
          <p className="text-gray-500 mt-1">
            Manage the cities, areas, and neighborhoods you serve
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-[#00ef99]/5 border border-[#00ef99]/20 rounded-lg text-[#00ef99]">
          <Check className="h-5 w-5 shrink-0" />
          <p>Saved successfully!</p>
        </div>
      )}

      {/* Service Areas Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Map className="h-5 w-5 text-[#00ef99]" />
              <h2 className="font-semibold">Service Areas</h2>
              <Badge variant="secondary">
                {areas.length} area{areas.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSuggestAreas}
                disabled={suggesting}
              >
                {suggesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Suggest Areas
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)} className="bg-black hover:bg-gray-800">
                <Plus className="h-4 w-4 mr-2" />
                Add Area
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {areas.length > 0 ? (
            <div className="space-y-2">
              {areas.map((area) => (
                <div
                  key={area.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white border-gray-200"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">
                      {area.name}
                      {area.state && (
                        <span className="text-gray-400">, {area.state}</span>
                      )}
                    </span>
                    {area.h1 ? (
                      <span className="inline-flex h-2 w-2 rounded-full bg-green-500 shrink-0" title="Content generated" />
                    ) : (
                      <span className="inline-flex h-2 w-2 rounded-full bg-gray-300 shrink-0" title="No content" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleGenerateContent(area.id)}
                      disabled={generatingId === area.id || deletingId === area.id}
                      title={area.h1 ? 'Regenerate content' : 'Generate content'}
                    >
                      {generatingId === area.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteArea(area.id)}
                      disabled={deletingId === area.id || generatingId === area.id}
                      className="text-red-500 hover:text-red-700"
                    >
                      {deletingId === area.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No service areas added yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Neighborhoods Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#00ef99]" />
              <h2 className="font-semibold">Neighborhoods</h2>
              <Badge variant="secondary">
                {neighborhoods.length} neighborhood{neighborhoods.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSuggestNeighborhoods}
                disabled={suggestingNeighborhoods}
              >
                {suggestingNeighborhoods ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Suggest Neighborhoods
              </Button>
              <Button size="sm" onClick={() => setAddNeighborhoodOpen(true)} className="bg-black hover:bg-gray-800">
                <Plus className="h-4 w-4 mr-2" />
                Add Neighborhood
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {neighborhoodsLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          ) : neighborhoods.length > 0 ? (
            <div className="space-y-2">
              {neighborhoods.map((neighborhood) => (
                <div
                  key={neighborhood.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white border-gray-200"
                >
                  <span className="font-medium text-sm truncate">
                    {neighborhood.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteNeighborhood(neighborhood.id)}
                    disabled={deletingNeighborhoodId === neighborhood.id}
                    className="text-red-500 hover:text-red-700 ml-4"
                  >
                    {deletingNeighborhoodId === neighborhood.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No neighborhoods added yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Add Area Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service Area</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="areaName">City / Area Name</Label>
              <Input
                id="areaName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Fort Worth"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="areaState">State</Label>
              <Input
                id="areaState"
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
                placeholder="e.g., TX"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddArea}
                disabled={addSaving || !newName.trim()}
                className="bg-black hover:bg-gray-800"
              >
                {addSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Add Area
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Neighborhood Modal */}
      <Dialog open={addNeighborhoodOpen} onOpenChange={setAddNeighborhoodOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Neighborhood</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="neighborhoodName">Neighborhood Name</Label>
              <Input
                id="neighborhoodName"
                value={newNeighborhoodName}
                onChange={(e) => setNewNeighborhoodName(e.target.value)}
                placeholder="e.g., Downtown, Midtown, West End"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddNeighborhoodOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddNeighborhood}
                disabled={addNeighborhoodSaving || !newNeighborhoodName.trim()}
                className="bg-black hover:bg-gray-800"
              >
                {addNeighborhoodSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Add Neighborhood
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suggest Areas Modal */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggested Service Areas</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50"
                >
                  <span className="text-sm font-medium">
                    {s.name}
                    {s.state && <span className="text-gray-400">, {s.state}</span>}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addSuggestedArea(s)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                All suggested areas have already been added!
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Suggest Neighborhoods Modal */}
      <Dialog open={neighborhoodSuggestOpen} onOpenChange={setNeighborhoodSuggestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggested Neighborhoods</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {neighborhoodSuggestions.length > 0 ? (
              neighborhoodSuggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50"
                >
                  <span className="text-sm font-medium">{s.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addSuggestedNeighborhood(s)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                All suggested neighborhoods have already been added!
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
