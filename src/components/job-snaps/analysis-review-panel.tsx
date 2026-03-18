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
} from 'lucide-react';
import type { JobSnapAnalysisResult } from '@/lib/job-snaps/analyze';
import type { JobLocation } from '@/components/job-snaps/job-location-card';

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
    brand: analysis.brand ?? '',
  });

  // Re-sync editable fields when analysis changes (re-analyze)
  useEffect(() => {
    setEdited({
      title: analysis.title,
      description: analysis.description,
      serviceType: analysis.serviceType ?? '',
      brand: analysis.brand ?? '',
    });
  }, [analysis]);

  const locationDisplay = location
    ? [location.address, location.city, location.state, location.zip]
        .filter(Boolean)
        .join(', ')
    : null;

  const handleContinue = () => {
    onContinue({
      ...analysis,
      title: edited.title.trim() || analysis.title,
      description: edited.description.trim() || analysis.description,
      serviceType: edited.serviceType.trim() || null,
      brand: edited.brand.trim() || null,
    });
  };

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

        {/* Service Type + Brand */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Service Type
            </label>
            <Input
              className="mt-1"
              value={edited.serviceType}
              onChange={(e) => setEdited((prev) => ({ ...prev, serviceType: e.target.value }))}
              placeholder="e.g. Appliance Removal"
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
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Continue to Save
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
