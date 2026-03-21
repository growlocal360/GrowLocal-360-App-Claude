'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Plus,
  RefreshCw,
  Search,
  X,
  Tag,
  Loader2,
} from 'lucide-react';
import type { WizardBrand } from '@/types/wizard';

export function StepBrands() {
  const {
    coreIndustry,
    primaryCategory,
    secondaryCategories,
    brands,
    setBrands,
    toggleBrand,
    addCustomBrand,
    removeBrand,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customBrandName, setCustomBrandName] = useState('');

  // All category display names for the API call
  const allCategoryNames = useMemo(() => {
    const cats: string[] = [];
    if (primaryCategory) cats.push(primaryCategory.displayName);
    cats.push(...secondaryCategories.map((c) => c.displayName));
    return cats;
  }, [primaryCategory, secondaryCategories]);

  // Fetch brand suggestions from AI
  const generateBrands = async () => {
    if (allCategoryNames.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/brands/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: coreIndustry || primaryCategory?.displayName || '',
          categories: allCategoryNames,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.brands && data.brands.length > 0) {
          const suggestedBrands: WizardBrand[] = data.brands.map(
            (brand: { name: string }, index: number) => ({
              id: `ai-${brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
              name: brand.name,
              isSelected: true,
              isCustom: false,
            })
          );
          setBrands(suggestedBrands);
        } else {
          setError('No brand suggestions found. Add brands manually below.');
        }
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Failed to fetch brand suggestions. Please try again.');
      }
    } catch (err) {
      console.error('Error fetching brand suggestions:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch brands on mount if not already loaded
  useEffect(() => {
    if (brands.length > 0) return;
    generateBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategoryNames, brands.length]);

  // Filter brands by search
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const query = searchQuery.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(query));
  }, [brands, searchQuery]);

  // Counts
  const selectedCount = brands.filter((b) => b.isSelected).length;
  const totalCount = brands.length;

  // Handle adding custom brand
  const handleAddCustomBrand = () => {
    const name = customBrandName.trim();
    if (!name) return;

    // Prevent duplicates
    const exists = brands.some(
      (b) => b.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setCustomBrandName('');
      return;
    }

    addCustomBrand({
      id: `custom-${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      isSelected: true,
      isCustom: true,
    });

    setCustomBrandName('');
  };

  // Handle Enter key in custom brand input
  const handleCustomBrandKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomBrand();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <span className="inline-block rounded bg-black px-2 py-1 text-xs font-medium text-white">
            Brands
          </span>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Brands You Service</h2>
          <p className="mt-1 text-gray-500">Finding popular brands for your industry...</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#00ef99]" />
          <p className="text-sm text-gray-500">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block rounded bg-black px-2 py-1 text-xs font-medium text-white">
          Brands
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">Brands You Service</h2>
        <p className="mt-1 text-gray-500">
          Select the brands you work with. Each brand gets its own page on your site.
        </p>
      </div>

      {/* Info Card */}
      <Card className="border-[#00ef99]/20 bg-[#00ef99]/5">
        <CardContent className="flex gap-3 p-4">
          <Tag className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#00ef99]" />
          <div>
            <p className="font-medium text-gray-900">Why Brands Matter</p>
            <p className="text-sm text-gray-600">
              Customers often search for brand-specific services like &quot;Samsung appliance repair&quot;
              or &quot;Carrier AC installation.&quot; Each selected brand gets a dedicated page to help
              you rank for these searches.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search + Add Custom */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Add Custom Brand Inline */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a brand not listed..."
          value={customBrandName}
          onChange={(e) => setCustomBrandName(e.target.value)}
          onKeyDown={handleCustomBrandKeyDown}
          className="flex-1"
        />
        <Button
          variant="outline"
          onClick={handleAddCustomBrand}
          disabled={!customBrandName.trim()}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Selected Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{selectedCount}</span> of {totalCount} brands selected
        </p>
        {brands.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const allSelected = brands.every((b) => b.isSelected);
                setBrands(brands.map((b) => ({ ...b, isSelected: !allSelected })));
              }}
            >
              {brands.every((b) => b.isSelected) ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={generateBrands}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Regenerate
            </Button>
          </div>
        )}
      </div>

      {/* Brand Grid */}
      {filteredBrands.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filteredBrands.map((brand) => (
            <button
              key={brand.id}
              type="button"
              onClick={() => toggleBrand(brand.id)}
              className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                brand.isSelected
                  ? 'border-[#00ef99] bg-[#00ef99]/10 text-[#00ef99]'
                  : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                  brand.isSelected
                    ? 'border-[#00ef99] bg-[#00ef99] text-white'
                    : 'border-gray-300'
                }`}
              >
                {brand.isSelected && <Check className="h-2.5 w-2.5" />}
              </span>
              {brand.name}
              {brand.isCustom && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBrand(brand.id);
                  }}
                  className="ml-0.5 text-gray-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && brands.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="font-medium text-amber-900">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={generateBrands}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty search state */}
      {filteredBrands.length === 0 && !error && brands.length > 0 && (
        <div className="py-8 text-center">
          <Tag className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-gray-500">No brands match your search</p>
          <p className="text-sm text-gray-400">
            Try a different search or add the brand manually above
          </p>
        </div>
      )}

      {/* Info about brand pages */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="flex gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500" />
          <div>
            <p className="font-medium text-gray-900">How brand pages work</p>
            <p className="text-sm text-gray-600">
              Each brand gets a template-driven page (e.g., <code className="rounded bg-gray-100 px-1">/brands/samsung</code>)
              showcasing your services for that brand. No extra generation time required.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={nextStep} disabled={!canProceed()}>
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
