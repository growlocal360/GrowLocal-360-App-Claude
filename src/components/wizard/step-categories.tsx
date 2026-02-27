'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Sparkles, Check, Info, Search, MapPin, Globe2, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getCategoriesForIndustry, searchCategories, GBP_CATEGORIES, type GBPCategoryData } from '@/data/gbp-categories';

export function StepCategories() {
  const {
    coreIndustry,
    primaryCategory,
    secondaryCategories,
    connectionType,
    locations,
    setPrimaryCategory,
    toggleSecondaryCategory,
    updateLocationCategories,
    syncCategoriesFromLocations,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  const [suggestedPrimary, setSuggestedPrimary] = useState<GBPCategoryData[]>([]);
  const [suggestedSecondary, setSuggestedSecondary] = useState<GBPCategoryData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  // Track which location sections are expanded
  const [expandedLocations, setExpandedLocations] = useState<Set<number>>(
    new Set(locations.map((_, i) => i))
  );
  // Track which location is in "change primary" search mode
  const [changingPrimaryFor, setChangingPrimaryFor] = useState<number | null>(null);
  const [primarySearchQuery, setPrimarySearchQuery] = useState('');

  // Check if we have per-location categories from GBP import
  const hasPerLocationCategories = connectionType === 'google' &&
    locations.some((loc) => loc.gbpPrimaryCategory);

  // Get search results
  const searchResults = searchQuery.trim()
    ? searchCategories(searchQuery)
    : GBP_CATEGORIES.slice(0, 20);

  const primarySearchResults = primarySearchQuery.trim()
    ? searchCategories(primarySearchQuery)
    : GBP_CATEGORIES.slice(0, 15);

  const normalizeDisplayName = (name: string) => name.toLowerCase().trim();

  useEffect(() => {
    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      const { primary, secondary } = getCategoriesForIndustry(coreIndustry);

      if (connectionType === 'google' && primaryCategory) {
        const filteredPrimary = primary.filter(
          c => normalizeDisplayName(c.displayName) !== normalizeDisplayName(primaryCategory.displayName)
        );
        setSuggestedPrimary([primaryCategory, ...filteredPrimary]);

        const importedDisplayNames = new Set(
          secondaryCategories.map(c => normalizeDisplayName(c.displayName))
        );
        const additionalSuggestions = secondary.filter(
          c => !importedDisplayNames.has(normalizeDisplayName(c.displayName))
        );
        setSuggestedSecondary([...secondaryCategories, ...additionalSuggestions]);
      } else {
        setSuggestedPrimary(primary);
        setSuggestedSecondary(secondary);

        if (!primaryCategory && primary.length > 0) {
          setPrimaryCategory(primary[0]);
        }

        if (primary.length === 0) {
          setShowSearch(true);
        }
      }

      setIsAnalyzing(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [coreIndustry, primaryCategory, secondaryCategories, connectionType, setPrimaryCategory]);

  const handlePrimarySelect = (category: GBPCategoryData) => {
    setPrimaryCategory(category);
    if (secondaryCategories.some((c) => c.gcid === category.gcid)) {
      toggleSecondaryCategory(category);
    }
  };

  const handleSecondaryToggle = (category: GBPCategoryData) => {
    if (primaryCategory?.gcid === category.gcid) return;
    toggleSecondaryCategory(category);
  };

  const toggleLocationExpanded = (index: number) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleLocationPrimaryChange = (locIndex: number, category: { gcid: string; displayName: string }) => {
    const loc = locations[locIndex];
    // Remove the new primary from additionals if it was there
    const newAdditional = (loc.gbpAdditionalCategories || []).filter(
      (c) => c.gcid !== category.gcid
    );
    // If old primary is different, add it to additionals
    if (loc.gbpPrimaryCategory && loc.gbpPrimaryCategory.gcid !== category.gcid) {
      newAdditional.unshift({
        gcid: loc.gbpPrimaryCategory.gcid,
        displayName: loc.gbpPrimaryCategory.displayName,
      });
    }
    updateLocationCategories(
      locIndex,
      { gcid: category.gcid, displayName: category.displayName },
      newAdditional
    );
    syncCategoriesFromLocations();
    setChangingPrimaryFor(null);
    setPrimarySearchQuery('');
  };

  const handleLocationSecondaryToggle = (locIndex: number, category: { gcid: string; displayName: string }) => {
    const loc = locations[locIndex];
    // Don't allow adding location's primary as secondary
    if (loc.gbpPrimaryCategory?.gcid === category.gcid) return;

    const current = loc.gbpAdditionalCategories || [];
    const exists = current.some((c) => c.gcid === category.gcid);
    const updated = exists
      ? current.filter((c) => c.gcid !== category.gcid)
      : [...current, { gcid: category.gcid, displayName: category.displayName }];

    updateLocationCategories(locIndex, loc.gbpPrimaryCategory, updated);
    syncCategoriesFromLocations();
  };

  // Compute merged site categories for display
  const mergedSiteCategories = useMemo(() => {
    const cats: { gcid: string; displayName: string; isPrimary: boolean }[] = [];
    if (primaryCategory) {
      cats.push({ gcid: primaryCategory.gcid, displayName: primaryCategory.displayName, isPrimary: true });
    }
    for (const c of secondaryCategories) {
      cats.push({ gcid: c.gcid, displayName: c.displayName, isPrimary: false });
    }
    return cats;
  }, [primaryCategory, secondaryCategories]);

  if (isAnalyzing) {
    return (
      <div className="space-y-6">
        <div>
          <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
            Step 3 of 8
          </span>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">GBP Categories</h2>
        </div>

        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-[#00d9c0]/10">
            <Sparkles className="h-8 w-8 text-[#00d9c0]" />
          </div>
          <p className="text-lg font-medium text-gray-900">Analyzing your business...</p>
          <p className="text-gray-500">Finding the best GBP categories for &quot;{coreIndustry}&quot;</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
          Step 3 of 8
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">GBP Categories</h2>
        <p className="mt-1 text-gray-500">
          {hasPerLocationCategories
            ? 'Categories imported from each GBP location. You can adjust them below.'
            : `Based on "${coreIndustry}", we recommend these Google Business Profile categories.`}
        </p>
      </div>

      {/* ── Per-Location Category Sections (Google flow with multiple locations) ── */}
      {hasPerLocationCategories && (
        <div className="space-y-4">
          {locations.map((location, locIndex) => {
            if (!location.gbpPrimaryCategory) return null;
            const isExpanded = expandedLocations.has(locIndex);
            const isSAB = location.businessType === 'CUSTOMER_LOCATION_ONLY';
            const isChangingPrimary = changingPrimaryFor === locIndex;

            return (
              <Card key={location.gbpLocationId || locIndex}>
                <CardContent className="p-0">
                  {/* Location header — clickable to expand/collapse */}
                  <button
                    type="button"
                    className="flex w-full items-center justify-between p-4 text-left"
                    onClick={() => toggleLocationExpanded(locIndex)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-1.5 ${location.isPrimary ? 'bg-[#00d9c0]/10' : 'bg-gray-100'}`}>
                        {isSAB ? (
                          <Globe2 className={`h-4 w-4 ${location.isPrimary ? 'text-[#00d9c0]' : 'text-gray-500'}`} />
                        ) : (
                          <MapPin className={`h-4 w-4 ${location.isPrimary ? 'text-[#00d9c0]' : 'text-gray-500'}`} />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{location.name}</p>
                        <p className="text-xs text-gray-500">
                          {isSAB
                            ? `SAB — ${location.representativeCity || location.city || 'No city'}, ${location.representativeState || location.state || ''}`
                            : `${location.city}, ${location.state}`}
                        </p>
                      </div>
                      {location.isPrimary && (
                        <Badge variant="outline" className="text-xs text-[#00d9c0] border-[#00d9c0]/30">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {1 + (location.gbpAdditionalCategories?.length || 0)} categories
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t px-4 pb-4 pt-3 space-y-3">
                      {/* Primary category */}
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Primary Category
                          </p>
                          <button
                            type="button"
                            className="text-xs text-[#00d9c0] hover:underline"
                            onClick={() => {
                              setChangingPrimaryFor(isChangingPrimary ? null : locIndex);
                              setPrimarySearchQuery('');
                            }}
                          >
                            {isChangingPrimary ? 'Cancel' : 'Change'}
                          </button>
                        </div>
                        {!isChangingPrimary && (
                          <span className="mt-1 inline-block rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white">
                            {location.gbpPrimaryCategory.displayName}
                          </span>
                        )}
                        {isChangingPrimary && (
                          <div className="mt-2 space-y-2">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                              <Input
                                type="text"
                                placeholder="Search categories..."
                                value={primarySearchQuery}
                                onChange={(e) => setPrimarySearchQuery(e.target.value)}
                                className="h-8 pl-9 text-sm"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-40 space-y-1 overflow-y-auto">
                              {primarySearchResults.map((cat) => (
                                <button
                                  key={cat.gcid}
                                  type="button"
                                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50 ${
                                    location.gbpPrimaryCategory?.gcid === cat.gcid
                                      ? 'bg-[#00d9c0]/5 font-medium text-[#00d9c0]'
                                      : 'text-gray-700'
                                  }`}
                                  onClick={() => handleLocationPrimaryChange(locIndex, cat)}
                                >
                                  {location.gbpPrimaryCategory?.gcid === cat.gcid && (
                                    <Check className="h-3.5 w-3.5 text-[#00d9c0]" />
                                  )}
                                  {cat.displayName}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Secondary categories */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Secondary Categories
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {(location.gbpAdditionalCategories || []).map((cat) => (
                            <button
                              key={cat.gcid}
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200 transition-colors"
                              onClick={() => handleLocationSecondaryToggle(locIndex, cat)}
                              title="Click to remove"
                            >
                              {cat.displayName}
                              <span className="text-blue-400">&times;</span>
                            </button>
                          ))}
                          {(location.gbpAdditionalCategories?.length || 0) === 0 && (
                            <span className="text-xs text-gray-400 italic">None imported</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Merged Site Categories Summary */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Site Categories (merged from all locations)
            </p>
            <div className="flex flex-wrap gap-2">
              {mergedSiteCategories.map((cat) => (
                <span
                  key={cat.gcid}
                  className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                    cat.isPrimary
                      ? 'bg-[#00d9c0] text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {cat.displayName}
                  {cat.isPrimary && (
                    <span className="ml-1 text-xs opacity-80">Primary</span>
                  )}
                </span>
              ))}
              {mergedSiteCategories.length === 0 && (
                <span className="text-sm text-gray-400">No categories selected</span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {mergedSiteCategories.length} total &mdash; primary from your primary location, secondaries from all locations (max 10).
            </p>
          </div>
        </div>
      )}

      {/* ── Standard Category Selection (manual flow or no per-location data) ── */}
      {!hasPerLocationCategories && (
        <>
          {suggestedPrimary.length > 0 && !showSearch ? (
            <>
              <div className="flex items-start gap-3 rounded-lg bg-[#00d9c0]/5 p-4">
                <Sparkles className="mt-0.5 h-5 w-5 text-[#00d9c0]" />
                <div>
                  <p className="font-medium text-gray-900">AI-Powered Recommendation</p>
                  <p className="text-sm text-[#00d9c0]">
                    Categories are matched based on Google&apos;s official GBP taxonomy and your industry keywords.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">Primary Category</h3>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </div>
                <p className="text-sm text-gray-500">
                  This is your main business category. Your homepage will target this category.
                </p>

                <div className="grid gap-3">
                  {suggestedPrimary.map((category, index) => (
                    <Card
                      key={category.gcid}
                      className={`cursor-pointer transition-all ${
                        primaryCategory?.gcid === category.gcid
                          ? 'border-[#00d9c0] bg-[#00d9c0]/5 ring-2 ring-[#00d9c0]/20'
                          : 'hover:border-gray-300'
                      }`}
                      onClick={() => handlePrimarySelect(category)}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full ${
                              primaryCategory?.gcid === category.gcid
                                ? 'bg-[#00d9c0] text-white'
                                : 'border-2 border-gray-300'
                            }`}
                          >
                            {primaryCategory?.gcid === category.gcid && (
                              <Check className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{category.displayName}</p>
                            {index === 0 && (
                              <span className="text-xs text-[#00d9c0]">Best Match</span>
                            )}
                          </div>
                        </div>
                        {index === 0 && (
                          <Badge className="bg-[#00d9c0]/10 text-[#00d9c0] hover:bg-[#00d9c0]/10">
                            <Sparkles className="mr-1 h-3 w-3" />
                            Recommended
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  className="text-sm text-[#00d9c0] hover:text-[#00d9c0] hover:underline"
                >
                  Can&apos;t find your category? Search all categories &rarr;
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {suggestedPrimary.length === 0 && (
                <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4">
                  <Info className="mt-0.5 h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">No exact matches found</p>
                    <p className="text-sm text-amber-700">
                      We couldn&apos;t find categories matching &quot;{coreIndustry}&quot;. Search below to find your business category.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Search Categories</h3>
                    <Badge variant="outline" className="text-xs">Required</Badge>
                  </div>
                  {suggestedPrimary.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowSearch(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      &larr; Back to suggestions
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search for your business category (e.g., plumber, electrician, landscaper)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {primaryCategory && (
                  <div className="rounded-lg bg-[#00d9c0]/5 p-3">
                    <p className="text-sm text-[#00d9c0]">
                      <span className="font-medium">Selected:</span> {primaryCategory.displayName}
                    </p>
                  </div>
                )}

                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {searchResults.map((category) => (
                    <Card
                      key={category.gcid}
                      className={`cursor-pointer transition-all ${
                        primaryCategory?.gcid === category.gcid
                          ? 'border-[#00d9c0] bg-[#00d9c0]/5 ring-2 ring-[#00d9c0]/20'
                          : 'hover:border-gray-300'
                      }`}
                      onClick={() => handlePrimarySelect(category)}
                    >
                      <CardContent className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full ${
                              primaryCategory?.gcid === category.gcid
                                ? 'bg-[#00d9c0] text-white'
                                : 'border-2 border-gray-300'
                            }`}
                          >
                            {primaryCategory?.gcid === category.gcid && (
                              <Check className="h-3 w-3" />
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {category.displayName}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {searchQuery && searchResults.length === 0 && (
                    <p className="py-4 text-center text-sm text-gray-500">
                      No categories found for &quot;{searchQuery}&quot;. Try a different search term.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Secondary Categories Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Secondary Categories</h3>
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </div>
              <span className="text-sm text-gray-500">
                {secondaryCategories.length}/9 selected
              </span>
            </div>
            <p className="text-sm text-gray-500">
              These categories will become content silos on your website. Each gets its own hub page.
            </p>

            <div className="grid gap-2 md:grid-cols-2">
              {suggestedSecondary.map((category, index) => {
                const isSelected = secondaryCategories.some((c) => c.gcid === category.gcid);
                const isPrimary = primaryCategory?.gcid === category.gcid;
                const isFromGBP = connectionType === 'google' && index < secondaryCategories.length;

                return (
                  <Card
                    key={category.gcid}
                    className={`cursor-pointer transition-all ${
                      isPrimary
                        ? 'cursor-not-allowed opacity-50'
                        : isSelected
                        ? 'border-[#00d9c0] bg-[#00d9c0]/5'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => !isPrimary && handleSecondaryToggle(category)}
                  >
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded ${
                            isSelected
                              ? 'bg-[#00d9c0] text-white'
                              : 'border-2 border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {category.displayName}
                        </span>
                      </div>
                      {isFromGBP && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">
                          GBP
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Info Box */}
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
        <Info className="mt-0.5 h-5 w-5 text-blue-600" />
        <div className="text-sm">
          <p className="font-medium text-blue-900">Why categories matter</p>
          <p className="text-blue-700">
            GBP categories determine your website structure. The primary category targets your
            homepage, while secondary categories become separate content silos with their own
            service pages underneath.
          </p>
        </div>
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
          className="bg-black hover:bg-gray-800"
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
