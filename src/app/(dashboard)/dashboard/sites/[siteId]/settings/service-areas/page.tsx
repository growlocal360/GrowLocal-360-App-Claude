'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  Check,
  Loader2,
} from 'lucide-react';

interface ServiceArea {
  id: string;
  name: string;
  slug: string;
  state: string | null;
  is_custom: boolean;
  sort_order: number;
}

export default function ServiceAreasPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [areas, setAreas] = useState<ServiceArea[]>([]);
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

  useEffect(() => {
    fetchAreas();
  }, [siteId]);

  const fetchAreas = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/settings/service-areas`);
      if (!response.ok) throw new Error('Failed to fetch service areas');
      const data = await response.json();
      setAreas(data.serviceAreas || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service areas');
    } finally {
      setLoading(false);
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

      // Get primary location for nearby cities
      const siteResponse = await fetch(`/api/sites/${siteId}/settings/business`);
      if (!siteResponse.ok) throw new Error('Failed to fetch site info');

      // Try the nearby-cities API
      const response = await fetch('/api/places/nearby-cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Areas</h1>
          <p className="text-gray-500 mt-1">
            Manage the cities and areas you serve
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
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
          <Button onClick={() => setAddOpen(true)} className="bg-black hover:bg-gray-800">
            <Plus className="h-4 w-4 mr-2" />
            Add Area
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-[#00d9c0]/5 border border-[#00d9c0]/20 rounded-lg text-[#00d9c0]">
          <Check className="h-5 w-5 flex-shrink-0" />
          <p>Service area added successfully!</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Map className="h-5 w-5 text-[#00d9c0]" />
            <h2 className="font-semibold">Current Service Areas</h2>
            <Badge variant="secondary" className="ml-auto">
              {areas.length} area{areas.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {areas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {areas.map((area) => (
                <Badge
                  key={area.id}
                  variant="secondary"
                  className="text-sm px-3 py-1.5 flex items-center gap-1"
                >
                  {area.name}
                  {area.state && (
                    <span className="text-gray-400">, {area.state}</span>
                  )}
                  <button
                    onClick={() => handleDeleteArea(area.id)}
                    disabled={deletingId === area.id}
                    className="ml-1 hover:text-red-600"
                  >
                    {deletingId === area.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No service areas added yet.</p>
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

      {/* Suggestions Modal */}
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
    </div>
  );
}
