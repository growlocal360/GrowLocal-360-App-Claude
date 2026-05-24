'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Filter, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { FilteringReport } from '@/lib/onboarding/gsc-scope-filter';

interface SiteScopeFilterReportProps {
  report: FilteringReport;
  /** Optional: total GSC queries the user has connected. Lets us frame "we analyzed 2,400 of your 14,000 queries." */
  totalConnectedQueries?: number;
}

/**
 * Visual summary of what the GSC scope filter kept vs. dropped.
 * Shown in the wizard's site-scope step before the user confirms the
 * scope and continues to site creation.
 *
 * Purpose: build user trust by showing "we're being precise, not lazy."
 * The user sees exactly which subset of their GSC data will drive the
 * analysis.
 */
export function SiteScopeFilterReport({
  report,
  totalConnectedQueries,
}: SiteScopeFilterReportProps) {
  const isFullBusiness = report.scope_type === 'FULL_BUSINESS';
  const confidenceColor =
    report.confidence === 'HIGH'
      ? 'text-green-700 border-green-200 bg-green-50'
      : report.confidence === 'MEDIUM'
        ? 'text-amber-700 border-amber-200 bg-amber-50'
        : 'text-red-600 border-red-200 bg-red-50';

  return (
    <Card className="border-[#00ef99]/30 bg-[#00ef99]/5">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#00ef99]" />
            <h3 className="font-semibold text-sm text-gray-900">
              GSC Filtering Report
            </h3>
          </div>
          <Badge variant="outline" className={`text-[11px] ${confidenceColor}`}>
            {report.confidence} confidence
          </Badge>
        </div>

        {/* Numbers */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat
            label="Queries retained"
            value={`${report.filtered_query_count.toLocaleString()} / ${report.original_query_count.toLocaleString()}`}
          />
          <Stat
            label="Impressions retained"
            value={`${report.filtered_impressions.toLocaleString()} / ${report.original_impressions.toLocaleString()}`}
          />
          <Stat label="Retention" value={`${report.retention_pct}%`} />
          <Stat
            label="Excluded by city mention"
            value={report.excluded_by_city_mention.toLocaleString()}
          />
        </div>

        {/* Narrative summary */}
        {isFullBusiness ? (
          <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
            <span>
              Using all your GSC data without filtering — this site covers your
              full business scope.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
            <span>
              We analyzed{' '}
              <strong>{report.filtered_query_count.toLocaleString()}</strong>{' '}
              queries
              {totalConnectedQueries && totalConnectedQueries > 0
                ? ` out of your ${totalConnectedQueries.toLocaleString()} total`
                : ''}
              {report.target_city && (
                <>
                  {' '}
                  — these are the searches relevant to{' '}
                  <strong>{report.target_city}</strong>
                </>
              )}
              . Demand from other cities you serve was filtered out so it doesn&apos;t skew the analysis.
            </span>
          </div>
        )}

        {/* Warnings */}
        {report.low_signal_warning && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>Low demand signal:</strong> filtered impressions are below
              the 100/90d threshold. This may indicate a great untapped market —
              OR very low actual demand. Verify before investing in heavy
              infrastructure for this scope.
            </span>
          </div>
        )}

        {report.high_drop_warning && !report.low_signal_warning && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>{100 - report.retention_pct}% of your data was filtered out.</strong>{' '}
              That&apos;s normal for a focused microsite — but worth double-checking
              that your city variants + zip codes capture the queries that matter.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
