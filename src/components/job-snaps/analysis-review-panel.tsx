'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Tag,
  Wrench,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { JobSnapAnalysisResult } from '@/lib/job-snaps/analyze';
import type { JobLocation } from '@/components/job-snaps/job-location-card';

interface AnalysisReviewPanelProps {
  analysis: JobSnapAnalysisResult;
  location: JobLocation | null;
  onContinue: () => void;
  onReanalyze: () => void;
  isLoading?: boolean;
}

function ConfidenceBadge({ score, label }: { score: number; label: string }) {
  const pct = Math.round(score * 100);
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline';
  let className = 'text-gray-500 border-gray-200';

  if (pct >= 80) {
    variant = 'outline';
    className = 'text-green-700 border-green-200 bg-green-50';
  } else if (pct >= 50) {
    variant = 'outline';
    className = 'text-amber-700 border-amber-200 bg-amber-50';
  } else if (pct > 0) {
    variant = 'outline';
    className = 'text-red-600 border-red-200 bg-red-50';
  }

  return (
    <Badge variant={variant} className={`text-xs ${className}`}>
      {label}: {pct}%
    </Badge>
  );
}

export function AnalysisReviewPanel({
  analysis,
  location,
  onContinue,
  onReanalyze,
  isLoading,
}: AnalysisReviewPanelProps) {
  const locationDisplay = location
    ? [location.address, location.city, location.state, location.zip]
        .filter(Boolean)
        .join(', ')
    : null;

  return (
    <Card className="border-[#00d9c0]/30 bg-[#00d9c0]/5">
      <CardContent className="py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#00d9c0]" />
          <h3 className="text-lg font-semibold text-gray-900">AI Analysis Result</h3>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Title
          </label>
          <p className="mt-1 text-base font-semibold text-gray-900">
            {analysis.title}
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Description
          </label>
          <p className="mt-1 text-sm leading-relaxed text-gray-700">
            {analysis.description}
          </p>
        </div>

        {/* Service & Brand */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Service Type
            </label>
            <div className="mt-1 flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">
                {analysis.serviceType || 'Not detected'}
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Brand
            </label>
            <div className="mt-1 flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">
                {analysis.brand || 'None'}
              </span>
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
              {analysis.imageRoles.map((ir) => (
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
            onClick={onContinue}
            disabled={isLoading}
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
