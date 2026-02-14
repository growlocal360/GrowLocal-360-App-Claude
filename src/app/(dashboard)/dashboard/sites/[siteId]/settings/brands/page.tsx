'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Award,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  Check,
  Loader2,
} from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
}

interface SuggestedBrand {
  name: string;
}

export default function BrandsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Add brand
  const [newBrandName, setNewBrandName] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Suggest brands
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedBrand[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // Deleting
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBrands();
  }, [siteId]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/settings/brands`);
      if (!response.ok) throw new Error('Failed to fetch brands');
      const data = await response.json();
      setBrands(data.brands || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brands');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) return;

    try {
      setAddSaving(true);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/settings/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBrandName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add brand');
      }

      const result = await response.json();
      setBrands((prev) => [...prev, result.brand]);
      setNewBrandName('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add brand');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteBrand = async (brandId: string) => {
    try {
      setDeletingId(brandId);
      const response = await fetch(
        `/api/sites/${siteId}/settings/brands?id=${brandId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete');

      setBrands((prev) => prev.filter((b) => b.id !== brandId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete brand');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSuggestBrands = async () => {
    try {
      setSuggesting(true);
      setError(null);

      // Fetch categories to send to the suggest API
      const catResponse = await fetch(`/api/sites/${siteId}/settings/categories`);
      if (!catResponse.ok) throw new Error('Failed to fetch categories');
      const catData = await catResponse.json();
      const categories = (catData.categories || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.gbp_category?.display_name || ''
      ).filter(Boolean);

      // Fetch business info for industry
      const bizResponse = await fetch(`/api/sites/${siteId}/settings/business`);
      if (!bizResponse.ok) throw new Error('Failed to fetch business info');
      const bizData = await bizResponse.json();

      const response = await fetch('/api/brands/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: bizData.coreIndustry || categories[0] || 'General Services',
          categories,
        }),
      });

      if (!response.ok) throw new Error('Failed to get suggestions');

      const data = await response.json();
      const existingNames = new Set(brands.map((b) => b.name.toLowerCase()));
      const filtered = (data.brands || []).filter(
        (b: SuggestedBrand) => !existingNames.has(b.name.toLowerCase())
      );
      setSuggestions(filtered);
      setSuggestOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  const addSuggestedBrand = async (suggestion: SuggestedBrand) => {
    try {
      const response = await fetch(`/api/sites/${siteId}/settings/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: suggestion.name }),
      });

      if (!response.ok) throw new Error('Failed to add');

      const result = await response.json();
      setBrands((prev) => [...prev, result.brand]);
      setSuggestions((prev) => prev.filter((s) => s.name !== suggestion.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add brand');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-gray-500 mt-1">
            Manage the brands and manufacturers you service
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleSuggestBrands}
          disabled={suggesting}
        >
          {suggesting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Suggest Brands
        </Button>
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
          <p>Brand added successfully!</p>
        </div>
      )}

      {/* Add Brand Inline */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-[#00d9c0]" />
            <h2 className="font-semibold">Add Brand</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="e.g., Samsung, Carrier, Lennox"
              onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
            />
            <Button
              onClick={handleAddBrand}
              disabled={addSaving || !newBrandName.trim()}
              className="bg-black hover:bg-gray-800 whitespace-nowrap"
            >
              {addSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Add'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Brands */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-[#00d9c0]" />
            <h2 className="font-semibold">Current Brands</h2>
            <Badge variant="secondary" className="ml-auto">
              {brands.length} brand{brands.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {brands.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {brands.map((brand) => (
                <Badge
                  key={brand.id}
                  variant="secondary"
                  className="text-sm px-3 py-1.5 flex items-center gap-1"
                >
                  {brand.name}
                  <button
                    onClick={() => handleDeleteBrand(brand.id)}
                    disabled={deletingId === brand.id}
                    className="ml-1 hover:text-red-600"
                  >
                    {deletingId === brand.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No brands added yet. Use &quot;Suggest Brands&quot; to get started or add them manually above.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Suggestions Modal */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggested Brands</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mb-4">
            Click to add brands you service or work with.
          </p>
          <div className="flex flex-wrap gap-2 max-h-96 overflow-y-auto">
            {suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-sm px-3 py-1.5 cursor-pointer hover:bg-[#00d9c0]/10 hover:border-[#00d9c0] transition-colors"
                  onClick={() => addSuggestedBrand(s)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {s.name}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4 w-full">
                All suggested brands have already been added!
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
