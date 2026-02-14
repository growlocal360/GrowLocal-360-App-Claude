'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Tag, X, Search, AlertCircle, Check, Loader2, Star } from 'lucide-react';
import { searchCategories, type GBPCategoryData } from '@/data/gbp-categories';

interface CategoryWithGbp {
  id: string;
  gbp_category_id: string;
  is_primary: boolean;
  sort_order: number;
  gbp_category: {
    id: string;
    gcid: string;
    display_name: string;
  };
}

export default function CategoriesPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [categories, setCategories] = useState<CategoryWithGbp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Search modal state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GBPCategoryData[]>([]);
  const [searchMode, setSearchMode] = useState<'primary' | 'secondary'>('secondary');

  useEffect(() => {
    fetchCategories();
  }, [siteId]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/settings/categories`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 2) {
      const results = searchCategories(query);
      // Filter out already-selected categories
      const selectedGcids = new Set(categories.map((c) => c.gbp_category.gcid));
      setSearchResults(results.filter((r) => !selectedGcids.has(r.gcid)));
    } else {
      setSearchResults([]);
    }
  }, [categories]);

  const openSearchModal = (mode: 'primary' | 'secondary') => {
    setSearchMode(mode);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(true);
  };

  const selectCategory = (cat: GBPCategoryData) => {
    if (searchMode === 'primary') {
      // Make this the primary, demote existing primary
      const updated = categories.map((c) => ({ ...c, is_primary: false }));
      updated.unshift({
        id: crypto.randomUUID(),
        gbp_category_id: '',
        is_primary: true,
        sort_order: 0,
        gbp_category: {
          id: '',
          gcid: cat.gcid,
          display_name: cat.displayName,
        },
      });
      setCategories(updated);
    } else {
      // Add as secondary
      setCategories((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          gbp_category_id: '',
          is_primary: false,
          sort_order: prev.length,
          gbp_category: {
            id: '',
            gcid: cat.gcid,
            display_name: cat.displayName,
          },
        },
      ]);
    }
    setHasChanges(true);
    setSearchOpen(false);
  };

  const removeCategory = (gcid: string) => {
    setCategories((prev) => prev.filter((c) => c.gbp_category.gcid !== gcid));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const primary = categories.find((c) => c.is_primary);
    if (!primary) {
      setError('A primary category is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch(`/api/sites/${siteId}/settings/categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryGcid: primary.gbp_category.gcid,
          secondaryGcids: categories
            .filter((c) => !c.is_primary)
            .map((c) => c.gbp_category.gcid),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      const result = await response.json();
      setCategories(result.categories || []);
      setHasChanges(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
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

  const primaryCategory = categories.find((c) => c.is_primary);
  const secondaryCategories = categories.filter((c) => !c.is_primary);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <p className="text-gray-500 mt-1">
          Manage your Google Business Profile categories
        </p>
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
          <p>Categories saved successfully!</p>
        </div>
      )}

      {/* Primary Category */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-[#00d9c0]" />
            <h2 className="font-semibold">Primary Category</h2>
          </div>
        </CardHeader>
        <CardContent>
          {primaryCategory ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-[#00d9c0] text-white text-sm px-3 py-1">
                  {primaryCategory.gbp_category.display_name}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSearchModal('primary')}
              >
                Change
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => openSearchModal('primary')}>
              Select Primary Category
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Secondary Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-[#00d9c0]" />
              <h2 className="font-semibold">Secondary Categories</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openSearchModal('secondary')}
            >
              Add Category
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {secondaryCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {secondaryCategories.map((cat) => (
                <Badge
                  key={cat.gbp_category.gcid}
                  variant="secondary"
                  className="text-sm px-3 py-1 flex items-center gap-1"
                >
                  {cat.gbp_category.display_name}
                  <button
                    onClick={() => removeCategory(cat.gbp_category.gcid)}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No secondary categories added yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-black hover:bg-gray-800"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {searchMode === 'primary' ? 'Select Primary Category' : 'Add Secondary Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {searchResults.length > 0 ? (
                searchResults.map((cat) => (
                  <button
                    key={cat.gcid}
                    onClick={() => selectCategory(cat)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <p className="font-medium text-sm">{cat.displayName}</p>
                    <p className="text-xs text-gray-400">{cat.gcid}</p>
                  </button>
                ))
              ) : searchQuery.trim().length >= 2 ? (
                <p className="text-sm text-gray-500 text-center py-4">No categories found</p>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  Type at least 2 characters to search
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
