'use client';

import { useEffect, useState } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Sparkles, Check, Info } from 'lucide-react';
import { getCategoriesForIndustry, type GBPCategoryData } from '@/data/gbp-categories';

export function StepCategories() {
  const {
    coreIndustry,
    primaryCategory,
    secondaryCategories,
    setPrimaryCategory,
    toggleSecondaryCategory,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  const [suggestedPrimary, setSuggestedPrimary] = useState<GBPCategoryData[]>([]);
  const [suggestedSecondary, setSuggestedSecondary] = useState<GBPCategoryData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  useEffect(() => {
    // Simulate AI analysis delay for UX
    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      const { primary, secondary } = getCategoriesForIndustry(coreIndustry);
      setSuggestedPrimary(primary);
      setSuggestedSecondary(secondary);

      // Auto-select the best primary category if none selected
      if (!primaryCategory && primary.length > 0) {
        setPrimaryCategory(primary[0]);
      }

      setIsAnalyzing(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [coreIndustry, primaryCategory, setPrimaryCategory]);

  const handlePrimarySelect = (category: GBPCategoryData) => {
    setPrimaryCategory(category);
    // If the new primary was in secondary, remove it
    if (secondaryCategories.some((c) => c.gcid === category.gcid)) {
      toggleSecondaryCategory(category);
    }
  };

  const handleSecondaryToggle = (category: GBPCategoryData) => {
    // Don't allow selecting primary as secondary
    if (primaryCategory?.gcid === category.gcid) return;
    toggleSecondaryCategory(category);
  };

  if (isAnalyzing) {
    return (
      <div className="space-y-6">
        <div>
          <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
            Step 2 of 5
          </span>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">GBP Categories</h2>
        </div>

        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-emerald-100">
            <Sparkles className="h-8 w-8 text-emerald-500" />
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
          Step 2 of 5
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">GBP Categories</h2>
        <p className="mt-1 text-gray-500">
          Based on &quot;{coreIndustry}&quot;, we recommend these Google Business Profile categories.
        </p>
      </div>

      {/* AI Recommendation Banner */}
      <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 text-emerald-600" />
        <div>
          <p className="font-medium text-emerald-900">AI-Powered Recommendation</p>
          <p className="text-sm text-emerald-700">
            Categories are matched based on Google&apos;s official GBP taxonomy and your industry keywords.
          </p>
        </div>
      </div>

      {/* Primary Category Selection */}
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
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                  : 'hover:border-gray-300'
              }`}
              onClick={() => handlePrimarySelect(category)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      primaryCategory?.gcid === category.gcid
                        ? 'bg-emerald-500 text-white'
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
                      <span className="text-xs text-emerald-600">Best Match</span>
                    )}
                  </div>
                </div>
                {index === 0 && (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Recommended
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

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
          {suggestedSecondary.map((category) => {
            const isSelected = secondaryCategories.some((c) => c.gcid === category.gcid);
            const isPrimary = primaryCategory?.gcid === category.gcid;

            return (
              <Card
                key={category.gcid}
                className={`cursor-pointer transition-all ${
                  isPrimary
                    ? 'cursor-not-allowed opacity-50'
                    : isSelected
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => !isPrimary && handleSecondaryToggle(category)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded ${
                      isSelected
                        ? 'bg-emerald-500 text-white'
                        : 'border-2 border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {category.displayName}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

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
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
