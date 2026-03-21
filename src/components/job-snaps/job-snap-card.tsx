'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  Eye,
  Pencil,
  Monitor,
  RefreshCw,
  Settings,
  MapPin,
  Tag,
  Wrench,
  Calendar,
} from 'lucide-react';
import type { JobStatus } from '@/types/database';

export interface JobSnapCardData {
  id: string;
  site_id: string;
  title: string | null;
  ai_generated_title: string | null;
  description: string | null;
  ai_generated_description: string | null;
  status: JobStatus;
  created_at: string;
  // Relations
  site_name: string;
  service_name: string | null;
  brand_name: string | null;
  // Location (public-safe)
  location_city: string | null;
  location_state: string | null;
  // Media
  featured_image_url: string | null;
  media_count: number;
  // Publish flags
  is_published_to_website: boolean;
  is_published_to_gbp: boolean;
}

const statusConfig: Record<JobStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  queued: { label: 'Queued', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  deployed: { label: 'Published', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
};

interface JobSnapCardProps {
  job: JobSnapCardData;
  onPushToWebsite?: (jobId: string) => void;
  onPushToGBP?: (jobId: string) => void;
  onRevalidate?: (jobId: string) => void;
  actionLoading?: string | null;
}

export function JobSnapCard({
  job,
  onPushToWebsite,
  onPushToGBP,
  onRevalidate,
  actionLoading,
}: JobSnapCardProps) {
  const displayTitle = job.title || job.ai_generated_title || 'Untitled Job';
  const displayDescription = job.description || job.ai_generated_description || null;
  const status = statusConfig[job.status];
  const isLoading = actionLoading === job.id;
  const locationDisplay = [job.location_city, job.location_state].filter(Boolean).join(', ');

  return (
    <Card className="overflow-hidden transition-colors hover:border-[#00ef99]/20">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Thumbnail */}
          <div className="relative h-48 w-full shrink-0 bg-gray-100 sm:h-auto sm:w-56">
            {job.featured_image_url ? (
              <Image
                src={job.featured_image_url}
                alt={displayTitle}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 224px"
              />
            ) : (
              <div className="flex h-full min-h-[140px] items-center justify-center">
                <Briefcase className="h-10 w-10 text-gray-300" />
              </div>
            )}
            {/* Status badge overlay */}
            <div className="absolute left-3 top-3">
              <Badge
                variant="outline"
                className={`${status.className} text-xs font-medium shadow-sm`}
              >
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
            <div>
              {/* Title */}
              <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
                {displayTitle}
              </h3>

              {/* Metadata badges */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {job.brand_name && (
                  <Badge variant="outline" className="text-xs font-normal text-gray-600">
                    <Tag className="mr-1 h-3 w-3" />
                    {job.brand_name}
                  </Badge>
                )}
                {job.service_name && (
                  <Badge variant="outline" className="text-xs font-normal text-gray-600">
                    <Wrench className="mr-1 h-3 w-3" />
                    {job.service_name}
                  </Badge>
                )}
                {locationDisplay && (
                  <Badge variant="outline" className="text-xs font-normal text-gray-600">
                    <MapPin className="mr-1 h-3 w-3" />
                    {locationDisplay}
                  </Badge>
                )}
              </div>

              {/* Description excerpt */}
              {displayDescription && (
                <p className="mt-2 text-sm leading-relaxed text-gray-600 line-clamp-2">
                  {displayDescription}
                </p>
              )}

              {/* Date */}
              <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                <Calendar className="h-3 w-3" />
                Created {new Date(job.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>

          {/* Action icons column */}
          <div className="flex shrink-0 flex-row items-center gap-1 border-t px-3 py-2 sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:px-2 sm:py-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-700"
              asChild
              title="View details"
              aria-label="View details"
            >
              <Link href={`/dashboard/job-snaps/${job.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-700"
              asChild
              title="Edit"
              aria-label="Edit job snap"
            >
              <Link href={`/dashboard/job-snaps/${job.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${
                job.is_published_to_website
                  ? 'text-[#00ef99]'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
              onClick={() => onPushToWebsite?.(job.id)}
              disabled={isLoading}
              title={job.is_published_to_website ? 'Published to website' : 'Push to website'}
              aria-label={job.is_published_to_website ? 'Unpublish from website' : 'Publish to website'}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${
                job.is_published_to_gbp
                  ? 'text-[#00ef99]'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
              onClick={() => onPushToGBP?.(job.id)}
              disabled={isLoading}
              title={job.is_published_to_gbp ? 'Published to GBP' : 'Push to Google Business Profile'}
              aria-label={job.is_published_to_gbp ? 'Published to Google Business Profile' : 'Push to Google Business Profile'}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-700"
              onClick={() => onRevalidate?.(job.id)}
              disabled={isLoading}
              title="Revalidate website"
              aria-label="Revalidate website cache"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
