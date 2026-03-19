'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BrandCombobox } from '@/components/job-snaps/brand-combobox';
import {
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { JobSnapAnalysisResult } from '@/lib/job-snaps/analyze';
import type { JobLocation } from '@/components/job-snaps/job-location-card';

interface CategoryOption {
  id: string;
  name: string;
  isPrimary: boolean;
  services: { id: string; name: string; slug: string }[];
}

interface AnalysisReviewPanelProps {
  analysis: JobSnapAnalysisResult;
  location: JobLocation | null;
  siteId: string;
  onContinue: (editedAnalysis: JobSnapAnalysisResult) => void;
  onReanalyze: () => void;
  isLoading?: boolean;
}

function ConfidenceBadge({ score, label }: { score: number; label: string }) {
  const pct = Math.round(score * 100);
  let className = 'text-gray-500 border-gray-200';

  if (pct >= 80) {
    className = 'text-green-700 border-green-200 bg-green-50';
  } else if (pct >= 50) {
    className = 'text-amber-700 border-amber-200 bg-amber-50';
  } else if (pct > 0) {
    className = 'text-red-600 border-red-200 bg-red-50';
  }

  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}: {pct}%
    </Badge>
  );
}

/**
 * Fuzzy-match AI's serviceType text against actual service names.
 * Returns the ID of the best-matching service, or null.
 */
function fuzzyMatchService(
  serviceType: string | null,
  categories: CategoryOption[]
): string | null {
  if (!serviceType) return null;
  const lower = serviceType.toLowerCase();

  // Exact match first
  for (const cat of categories) {
    for (const svc of cat.services) {
      if (svc.name.toLowerCase() === lower) return svc.id;
    }
  }

  // Substring match: AI text contains service name or vice versa
  let bestMatch: { id: string; score: number } | null = null;
  for (const cat of categories) {
    for (const svc of cat.services) {
      const svcLower = svc.name.toLowerCase();
      if (lower.includes(svcLower) || svcLower.includes(lower)) {
        const score = Math.min(lower.length, svcLower.length) / Math.max(lower.length, svcLower.length);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { id: svc.id, score };
        }
      }
    }
  }

  // Word overlap match
  if (!bestMatch) {
    const aiWords = lower.split(/\s+/).filter(w => w.length > 2);
    for (const cat of categories) {
      for (const svc of cat.services) {
        const svcWords = svc.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const overlap = aiWords.filter(w => svcWords.some(sw => sw.includes(w) || w.includes(sw)));
        if (overlap.length > 0) {
          const score = overlap.length / Math.max(aiWords.length, svcWords.length);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { id: svc.id, score };
          }
        }
      }
    }
  }

  return bestMatch?.id ?? null;
}

/**
 * Find the parent category ID for a given service ID.
 */
function findCategoryForService(serviceId: string, categories: CategoryOption[]): string | null {
  for (const cat of categories) {
    if (cat.services.some(s => s.id === serviceId)) return cat.id;
  }
  return null;
}

export function AnalysisReviewPanel({
  analysis,
  location,
  siteId,
  onContinue,
  onReanalyze,
  isLoading,
}: AnalysisReviewPanelProps) {
  const [edited, setEdited] = useState({
    title: analysis.title,
    description: analysis.description,
    serviceType: analysis.serviceType ?? '',
    serviceId: analysis.serviceId ?? null as string | null,
    brand: analysis.brand ?? '',
  });

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Fetch categories + services for this site
  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/job-snaps/services?siteId=${siteId}`)
      .then(r => r.json())
      .then(data => {
        const cats = data.categories || [];
        setCategories(cats);

        // Auto-match AI's serviceType to an actual service
        if (analysis.serviceType && cats.length > 0) {
          const matchedId = fuzzyMatchService(analysis.serviceType, cats);
          if (matchedId) {
            setSelectedServiceId(matchedId);
            setEdited(prev => ({ ...prev, serviceId: matchedId }));
            // Expand the parent category
            const catId = findCategoryForService(matchedId, cats);
            if (catId) setExpandedCategories(new Set([catId]));
          }
        }
      })
      .catch(() => {});
  }, [siteId, analysis.serviceType]);

  // Re-sync editable fields when analysis changes (re-analyze)
  useEffect(() => {
    setEdited({
      title: analysis.title,
      description: analysis.description,
      serviceType: analysis.serviceType ?? '',
      serviceId: analysis.serviceId ?? null,
      brand: analysis.brand ?? '',
    });
  }, [analysis]);

  const locationDisplay = location
    ? [location.address, location.city, location.state, location.zip]
        .filter(Boolean)
        .join(', ')
    : null;

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const selectService = (serviceId: string) => {
    const newId = selectedServiceId === serviceId ? null : serviceId;
    setSelectedServiceId(newId);
    setEdited(prev => ({ ...prev, serviceId: newId }));
  };

  const handleContinue = () => {
    onContinue({
      ...analysis,
      title: edited.title.trim() || analysis.title,
      description: edited.description.trim() || analysis.description,
      serviceType: edited.serviceType.trim() || null,
      serviceId: edited.serviceId,
      brand: edited.brand.trim() || null,
    });
  };

  // Get selected service name for display
  const selectedServiceName = categories
    .flatMap(c => c.services)
    .find(s => s.id === selectedServiceId)?.name;

  return (
    <Card className="border-[#00d9c0]/30 bg-[#00d9c0]/5">
      <CardContent className="py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#00d9c0]" />
          <h3 className="text-lg font-semibold text-gray-900">AI Analysis Result</h3>
          <span className="text-xs text-gray-400 ml-1">— edit before saving</span>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Title
          </label>
          <Input
            className="mt-1"
            value={edited.title}
            onChange={(e) => setEdited((prev) => ({ ...prev, title: e.target.value }))}
            maxLength={200}
            disabled={isLoading}
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Description
          </label>
          <Textarea
            className="mt-1"
            value={edited.description}
            onChange={(e) => setEdited((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            maxLength={2000}
            disabled={isLoading}
          />
        </div>

        {/* Service Type (AI-detected, read-only context) + Brand */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              AI-Detected Service
            </label>
            <Input
              className="mt-1"
              value={edited.serviceType}
              onChange={(e) => setEdited((prev) => ({ ...prev, serviceType: e.target.value }))}
              placeholder="e.g. Decal Printing"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Brand / Client
            </label>
            <div className="mt-1">
              <BrandCombobox
                value={edited.brand}
                onChange={(v) => setEdited((prev) => ({ ...prev, brand: v }))}
                siteId={siteId}
                placeholder="e.g. Whirlpool, Acme Co."
              />
            </div>
          </div>
        </div>

        {/* Category / Service Selector */}
        {categories.length > 0 && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Link to Service Page
            </label>
            <p className="mt-0.5 text-xs text-gray-400">
              Select which service page this job should appear on
            </p>
            <div className="mt-2 rounded-lg border border-gray-200 bg-white overflow-hidden">
              {categories.map((cat) => {
                const isExpanded = expandedCategories.has(cat.id);
                const hasSelectedChild = cat.services.some(s => s.id === selectedServiceId);

                return (
                  <div key={cat.id} className="border-b border-gray-100 last:border-b-0">
                    {/* Category header */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                        hasSelectedChild
                          ? 'bg-[#00d9c0]/5 text-gray-900'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                      )}
                      {cat.name}
                      {cat.isPrimary && (
                        <Badge variant="outline" className="ml-1 text-[10px] text-gray-400 py-0">
                          Primary
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-gray-400">
                        {cat.services.length} services
                      </span>
                    </button>

                    {/* Services list */}
                    {isExpanded && cat.services.length > 0 && (
                      <div className="border-t border-gray-100 bg-gray-50/50">
                        {cat.services.map((svc) => {
                          const isSelected = svc.id === selectedServiceId;
                          return (
                            <button
                              key={svc.id}
                              type="button"
                              onClick={() => selectService(svc.id)}
                              className={`flex w-full items-center gap-2 px-3 py-2 pl-9 text-left text-sm transition-colors ${
                                isSelected
                                  ? 'bg-[#00d9c0]/10 text-gray-900 font-medium'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <div
                                className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                                  isSelected
                                    ? 'border-[#00d9c0] bg-[#00d9c0]'
                                    : 'border-gray-300'
                                }`}
                              >
                                {isSelected && (
                                  <CheckCircle2 className="h-3 w-3 text-white" />
                                )}
                              </div>
                              {svc.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {selectedServiceName && (
              <p className="mt-1.5 text-xs text-[#00d9c0]">
                Will appear on: <span className="font-medium">{selectedServiceName}</span> service page + its category page
              </p>
            )}
          </div>
        )}

        {/* Location */}
        {locationDisplay && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Location
            </label>
            <div className="mt-1 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#00d9c0]" />
              <span className="text-sm text-gray-700">{locationDisplay}</span>
              {location && (
                <Badge variant="outline" className="ml-1 text-xs text-gray-500">
                  {location.source}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Confidence scores */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Confidence
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <ConfidenceBadge score={analysis.confidence.service} label="Service" />
            <ConfidenceBadge score={analysis.confidence.brand} label="Brand" />
            <ConfidenceBadge score={analysis.confidence.location} label="Location" />
          </div>
        </div>

        {/* Image roles */}
        {analysis.imageRoles.length > 0 && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Image Roles
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {analysis.imageRoles.map((ir: { index: number; role: string }) => (
                <Badge key={ir.index} variant="outline" className="text-xs capitalize">
                  Image {ir.index + 1}: {ir.role}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleContinue}
            disabled={isLoading || !edited.title.trim()}
            className="flex-1 bg-gray-900 hover:bg-gray-800"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {isLoading ? 'Saving…' : 'Continue to Save'}
          </Button>
          <Button
            variant="outline"
            onClick={onReanalyze}
            disabled={isLoading}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Re-analyze
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
