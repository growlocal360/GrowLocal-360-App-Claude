'use client';

import { Circle, Loader2, Pause, AlertCircle, Ban } from 'lucide-react';
import type { SiteStatus, SiteBuildProgress } from '@/types/database';

interface SiteStatusBadgeProps {
  status: SiteStatus;
  progress?: SiteBuildProgress | null;
  showLabel?: boolean;
}

export function SiteStatusBadge({ status, progress, showLabel = true }: SiteStatusBadgeProps) {
  switch (status) {
    case 'active':
      return (
        <div className="flex items-center gap-1.5">
          <Circle className="h-2.5 w-2.5 fill-[#00d9c0] stroke-none" />
          {showLabel && <span className="text-xs text-[#00d9c0]">Active</span>}
        </div>
      );

    case 'building':
      const percentage = progress
        ? Math.round((progress.completed_tasks / progress.total_tasks) * 100)
        : 0;
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
          {showLabel && (
            <span className="text-xs text-amber-600">
              Building{progress ? ` ${percentage}%` : '...'}
            </span>
          )}
        </div>
      );

    case 'paused':
      return (
        <div className="flex items-center gap-1.5">
          <Pause className="h-3.5 w-3.5 text-gray-400" />
          {showLabel && <span className="text-xs text-gray-500">Paused</span>}
        </div>
      );

    case 'failed':
      return (
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          {showLabel && <span className="text-xs text-red-600">Failed</span>}
        </div>
      );

    case 'suspended':
      return (
        <div className="flex items-center gap-1.5">
          <Ban className="h-3.5 w-3.5 text-red-500" />
          {showLabel && <span className="text-xs text-red-600">Suspended</span>}
        </div>
      );

    default:
      return null;
  }
}

interface BuildProgressBarProps {
  progress: SiteBuildProgress;
}

export function BuildProgressBar({ progress }: BuildProgressBarProps) {
  const percentage = Math.round((progress.completed_tasks / progress.total_tasks) * 100);

  return (
    <div className="mt-3">
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1 truncate">{progress.current_task}</p>
    </div>
  );
}
