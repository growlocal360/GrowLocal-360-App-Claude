'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BrandCombobox } from '@/components/job-snaps/brand-combobox';
import { TechnicianCombobox } from '@/components/job-snaps/technician-combobox';
import {
  AttachmentPicker,
  EMPTY_SELECTION,
  type AttachmentSelection,
  type AttachmentAiHints,
} from '@/components/job-snaps/attachment-picker';
import {
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import type { JobSnapAnalysisResult } from '@/lib/job-snaps/analyze';
import type { JobLocation } from '@/components/job-snaps/job-location-card';

/**
 * Shape of /api/job-snaps/attachment-targets — what AnalysisReviewPanel
 * pulls down so it can auto-match the AI's detections to actual site rows.
 */
interface AttachmentTargets {
  services: Array<{ id: string; name: string; slug: string; category_id: string | null; category_name: string | null }>;
  categories: Array<{ id: string; name: string; is_primary: boolean }>;
  brands: Array<{ id: string; name: string; slug: string }>;
  service_areas: Array<{ id: string; name: string; slug: string; state: string | null }>;
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
 * Three passes in priority order: exact → substring → word overlap.
 * Returns the ID of the best-matching service, or null.
 */
function fuzzyMatchService(
  serviceType: string | null,
  services: AttachmentTargets['services']
): string | null {
  if (!serviceType || services.length === 0) return null;
  const lower = serviceType.toLowerCase();

  // Exact match first
  for (const svc of services) {
    if (svc.name.toLowerCase() === lower) return svc.id;
  }

  // Substring match
  let bestMatch: { id: string; score: number } | null = null;
  for (const svc of services) {
    const svcLower = svc.name.toLowerCase();
    if (lower.includes(svcLower) || svcLower.includes(lower)) {
      const score = Math.min(lower.length, svcLower.length) / Math.max(lower.length, svcLower.length);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { id: svc.id, score };
      }
    }
  }
  if (bestMatch) return bestMatch.id;

  // Word overlap match
  const aiWords = lower.split(/\s+/).filter((w) => w.length > 2);
  for (const svc of services) {
    const svcWords = svc.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const overlap = aiWords.filter((w) => svcWords.some((sw) => sw.includes(w) || w.includes(sw)));
    if (overlap.length > 0) {
      const score = overlap.length / Math.max(aiWords.length, svcWords.length);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { id: svc.id, score };
      }
    }
  }
  return bestMatch?.id ?? null;
}

/**
 * Case-insensitive exact-name match. Used for brands and service areas where
 * the AI returns a specific name we can directly look up. No fuzzy fallback
 * — we'd rather miss than pre-check a wrong brand and have the user not
 * notice.
 */
function exactMatchByName<T extends { id: string; name: string }>(
  needle: string | null | undefined,
  haystack: T[]
): string | null {
  if (!needle) return null;
  const lower = needle.trim().toLowerCase();
  if (!lower) return null;
  return haystack.find((row) => row.name.trim().toLowerCase() === lower)?.id ?? null;
}

/**
 * Compute the AI's auto-attachment hints from the analysis + location +
 * loaded site taxonomy. Each hit gets pre-checked AND shows the "AI
 * suggested" pill in the picker.
 *
 *  - service: fuzzy-match analysis.serviceType against site services
 *  - category: pick up the parent category of any auto-matched service
 *  - brand: exact name match against analysis.brand
 *  - service_area: exact name match against location.city (with neighborhood fallback)
 */
function computeAiHints(
  targets: AttachmentTargets,
  analysis: JobSnapAnalysisResult,
  location: JobLocation | null
): { hints: AttachmentAiHints; selection: AttachmentSelection } {
  const service_ids: string[] = [];
  const category_ids: string[] = [];
  const brand_ids: string[] = [];
  const area_ids: string[] = [];

  const matchedServiceId = fuzzyMatchService(analysis.serviceType, targets.services);
  if (matchedServiceId) {
    service_ids.push(matchedServiceId);
    const matchedSvc = targets.services.find((s) => s.id === matchedServiceId);
    if (matchedSvc?.category_id) category_ids.push(matchedSvc.category_id);
  }

  const matchedBrandId = exactMatchByName(analysis.brand, targets.brands);
  if (matchedBrandId) brand_ids.push(matchedBrandId);

  // Prefer the captured location's city; fall back to the AI's inferred
  // neighborhood when no precise city is known.
  const matchedAreaId =
    exactMatchByName(location?.city, targets.service_areas) ??
    exactMatchByName(analysis.neighborhood, targets.service_areas);
  if (matchedAreaId) area_ids.push(matchedAreaId);

  const hints: AttachmentAiHints = { service_ids, category_ids, brand_ids, area_ids };
  // Initial selection mirrors the hints — user can uncheck anything that's
  // wrong before saving.
  const selection: AttachmentSelection = { service_ids, category_ids, brand_ids, area_ids };
  return { hints, selection };
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
    clientName: '',
    equipmentType: analysis.equipmentType ?? '',
    primaryProblem: analysis.primaryProblem ?? '',
    neighborhood: analysis.neighborhood ?? '',
    technicianId: null as string | null,
  });

  // Multi-attachment state. AI auto-matches are folded in once the targets
  // load; users can check/uncheck anything before saving.
  const [attachments, setAttachments] = useState<AttachmentSelection>(EMPTY_SELECTION);
  const [aiHints, setAiHints] = useState<AttachmentAiHints>({});

  // Fetch all four taxonomies + run AI auto-matching for services, categories,
  // brands, and service areas in one pass.
  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    fetch(`/api/job-snaps/attachment-targets?siteId=${siteId}`)
      .then((r) => r.json())
      .then((data: AttachmentTargets) => {
        if (cancelled || !data) return;
        const { hints, selection } = computeAiHints(data, analysis, location);
        setAiHints(hints);
        // Pre-populate selection with the auto-matches. The user can still
        // edit before saving.
        setAttachments(selection);
        // Keep edited.serviceId in sync with the matched service (legacy
        // single-FK path still flows through to work_items.service_id).
        if (hints.service_ids?.[0]) {
          setEdited((prev) => ({ ...prev, serviceId: hints.service_ids![0] }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // analysis + location are captured at mount; re-analyze handles the
    // re-sync separately. Avoid re-running matching on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, analysis.serviceType, analysis.brand, analysis.neighborhood, location?.city]);

  // Re-sync editable fields when analysis changes (re-analyze)
  useEffect(() => {
    setEdited((prev) => ({
      title: analysis.title,
      description: analysis.description,
      serviceType: analysis.serviceType ?? '',
      serviceId: analysis.serviceId ?? null,
      brand: analysis.brand ?? '',
      // Preserve user-entered fields across re-analyze (AI never emits these).
      clientName: prev.clientName,
      equipmentType: analysis.equipmentType ?? '',
      primaryProblem: analysis.primaryProblem ?? '',
      neighborhood: analysis.neighborhood ?? '',
      technicianId: prev.technicianId,
    }));
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
      serviceId: edited.serviceId,
      brand: edited.brand.trim() || null,
      equipmentType: edited.equipmentType.trim() || null,
      primaryProblem: edited.primaryProblem.trim() || null,
      neighborhood: edited.neighborhood.trim() || null,
      // Attach user-only fields onto the analysis payload so the parent page
      // can forward them to the save route. AI never emits these.
      clientName: edited.clientName.trim() || null,
      technicianId: edited.technicianId,
      attachments,
    } as JobSnapAnalysisResult & {
      clientName: string | null;
      technicianId: string | null;
      attachments: AttachmentSelection;
    });
  };

  return (
    <Card className="border-[#00ef99]/30 bg-[#00ef99]/5">
      <CardContent className="py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#00ef99]" />
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
              Brand
            </label>
            <div className="mt-1">
              <BrandCombobox
                value={edited.brand}
                onChange={(v) => setEdited((prev) => ({ ...prev, brand: v }))}
                siteId={siteId}
                placeholder="e.g. Whirlpool"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Equipment manufacturer. Shown publicly when present.
            </p>
          </div>
        </div>

        {/* Client Name (internal-only) + Equipment Type */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400 flex items-center gap-1">
              <Lock className="h-3 w-3 text-gray-400" />
              Client Name (Internal Only)
            </label>
            <Input
              className="mt-1"
              value={edited.clientName}
              onChange={(e) => setEdited((prev) => ({ ...prev, clientName: e.target.value }))}
              placeholder="e.g. Anderson Family"
              disabled={isLoading}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Never shown publicly. Internal record only.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Equipment Type
            </label>
            <Input
              className="mt-1"
              value={edited.equipmentType}
              onChange={(e) => setEdited((prev) => ({ ...prev, equipmentType: e.target.value }))}
              placeholder="e.g. Dryer, Condenser Unit"
              disabled={isLoading}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              When the job involves a specific piece of equipment.
            </p>
          </div>
        </div>

        {/* Primary Problem + Neighborhood */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Primary Problem
            </label>
            <Input
              className="mt-1"
              value={edited.primaryProblem}
              onChange={(e) => setEdited((prev) => ({ ...prev, primaryProblem: e.target.value }))}
              placeholder="e.g. drum roller replacement"
              disabled={isLoading}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Drives the SEO URL and title.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Neighborhood
            </label>
            <Input
              className="mt-1"
              value={edited.neighborhood}
              onChange={(e) => setEdited((prev) => ({ ...prev, neighborhood: e.target.value }))}
              placeholder="e.g. Graywood"
              disabled={isLoading}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Optional. Appears in H1 and body when present.
            </p>
          </div>
        </div>

        {/* Technician attribution */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Technician on Job
          </label>
          <div className="mt-1">
            <TechnicianCombobox
              siteId={siteId}
              value={edited.technicianId}
              onChange={(id) => setEdited((prev) => ({ ...prev, technicianId: id }))}
              disabled={isLoading}
            />
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Who performed the work. Defaults to the uploader if left unset.
          </p>
        </div>

        {/* Multi-attachment picker: services, categories, brands, areas */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Link to Pages
          </label>
          <p className="mt-0.5 mb-2 text-xs text-gray-400">
            Choose every page this snap should appear on. The AI-detected service
            is pre-selected; add more for wider SEO coverage.
          </p>
          <AttachmentPicker
            siteId={siteId}
            value={attachments}
            onChange={setAttachments}
            aiHints={aiHints}
            disabled={isLoading}
          />
        </div>

        {/* Location */}
        {locationDisplay && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Location
            </label>
            <div className="mt-1 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#00ef99]" />
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
