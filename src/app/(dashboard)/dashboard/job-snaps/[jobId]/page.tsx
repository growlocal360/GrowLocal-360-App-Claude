'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import {
  ArrowLeft,
  Pencil,
  Loader2,
  Briefcase,
  Globe,
  MapPin,
  Wrench,
  Clock,
  CheckCircle2,
  Tag,
  Navigation,
  Monitor,
  MonitorOff,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { getActiveOrgIdClient } from '@/lib/auth/active-org-client';
import { toast } from 'sonner';
import type { JobStatus, JobSnapWithRelations } from '@/types/database';

const statusConfig: Record<JobStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  queued: { label: 'Queued', variant: 'outline', className: 'border-amber-300 text-amber-700 bg-amber-50' },
  approved: { label: 'Approved', variant: 'outline', className: 'border-blue-300 text-blue-700 bg-blue-50' },
  deployed: { label: 'Deployed', variant: 'outline', className: 'border-green-300 text-green-700 bg-green-50' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export default function JobSnapDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [jobSnap, setJobSnap] = useState<JobSnapWithRelations | null>(null);
  const [siteName, setSiteName] = useState<string>('');
  const [siteSlug, setSiteSlug] = useState<string>('');
  const [siteCustomDomain, setSiteCustomDomain] = useState<string | null>(null);
  const [workItemSlug, setWorkItemSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userData, setUserData] = useState({ name: 'User', email: '', avatarUrl: undefined as string | undefined });

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const activeOrgId = getActiveOrgIdClient();
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('*, organization:organizations(*)')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });
        const profile = (activeOrgId
          ? allProfiles?.find((p: { organization_id: string }) => p.organization_id === activeOrgId)
          : allProfiles?.[0]) || allProfiles?.[0] || null;

        setUserData({
          name: profile?.full_name || user?.user_metadata?.full_name || 'User',
          email: user?.email || '',
          avatarUrl: profile?.avatar_url,
        });

        // Load job snap with relations
        const { data: snap, error } = await supabase
          .from('job_snaps')
          .select(`
            *,
            media:job_snap_media(*),
            service:services(*)
          `)
          .eq('id', jobId)
          .single();

        if (error || !snap) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        // Verify org access
        const { data: site } = await supabase
          .from('sites')
          .select('name, slug, custom_domain, organization_id')
          .eq('id', snap.site_id)
          .single();

        if (!site || site.organization_id !== activeOrgId) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setSiteName(site.name);
        setSiteSlug(site.slug || '');
        setSiteCustomDomain(site.custom_domain || null);

        // Fetch work item slug for the "View on website" link
        if (snap.work_item_id) {
          const { data: workItem } = await supabase
            .from('work_items')
            .select('slug')
            .eq('id', snap.work_item_id)
            .single();
          setWorkItemSlug(workItem?.slug || null);
        }
        setJobSnap(snap as unknown as JobSnapWithRelations);
      } catch (err) {
        console.error('Failed to load job snap:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supabase, jobId]);

  const getDisplayTitle = (snap: JobSnapWithRelations) =>
    snap.title || snap.ai_generated_title || 'Untitled Job';

  async function handlePublishToWebsite() {
    if (!jobSnap) return;
    setActionLoading('website');

    const endpoint = jobSnap.is_published_to_website
      ? `/api/job-snaps/${jobId}/unpublish-website`
      : `/api/job-snaps/${jobId}/publish-website`;

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Action failed');
      } else {
        const published = !jobSnap.is_published_to_website;
        setJobSnap((prev) => prev ? {
          ...prev,
          is_published_to_website: published,
          status: published ? 'deployed' : 'approved',
        } : prev);
        toast.success(published ? 'Published to website' : 'Unpublished from website');
      }
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePushToGBP() {
    if (!jobSnap) return;
    setActionLoading('gbp');
    try {
      const res = await fetch(`/api/job-snaps/${jobId}/publish-gbp`, { method: 'POST' });
      const data = await res.json();
      if (res.status === 501) {
        toast.info('GBP posting is not yet available. Check back soon.');
      } else if (!res.ok) {
        toast.error(data.error || 'Failed to push to GBP');
      } else {
        setJobSnap((prev) => prev ? { ...prev, is_published_to_gbp: true } : prev);
        toast.success('Pushed to Google Business Profile');
      }
    } catch {
      toast.error('Failed to push to GBP. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevalidate() {
    if (!jobSnap) return;
    setActionLoading('revalidate');
    try {
      const res = await fetch(`/api/sites/${jobSnap.site_id}/revalidate`, { method: 'POST' });
      if (res.ok) {
        toast.success('Website cache revalidated');
      } else {
        toast.error('Failed to revalidate');
      }
    } catch {
      toast.error('Failed to revalidate');
    } finally {
      setActionLoading(null);
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  if (loading) {
    return (
      <>
        <Header title="Job Snap" user={userData} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </>
    );
  }

  if (notFound || !jobSnap) {
    return (
      <>
        <Header title="Job Snap" user={userData} />
        <div className="p-6 space-y-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/job-snaps">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Job Snaps
            </Link>
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-gray-100 p-4">
                <Briefcase className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Job snap not found</h3>
              <p className="mt-2 text-sm text-gray-500">
                This job snap may have been deleted or you don&apos;t have access to it.
              </p>
              <Button className="mt-6" variant="outline" asChild>
                <Link href="/dashboard/job-snaps">View All Job Snaps</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const config = statusConfig[jobSnap.status];

  return (
    <>
      <Header title={getDisplayTitle(jobSnap)} user={userData} />

      <div className="p-6 space-y-6">
        {/* Breadcrumb */}
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/job-snaps">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Job Snaps
            </Link>
          </Button>
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">{getDisplayTitle(jobSnap)}</h2>
            <Badge variant={config.variant} className={config.className}>
              {config.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/job-snaps/${jobId}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={handlePublishToWebsite}
              disabled={actionLoading !== null}
              className={jobSnap.is_published_to_website ? 'border-[#00d9c0] text-[#00d9c0] hover:text-[#00d9c0]' : ''}
            >
              {actionLoading === 'website' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : jobSnap.is_published_to_website ? (
                <MonitorOff className="mr-2 h-4 w-4" />
              ) : (
                <Monitor className="mr-2 h-4 w-4" />
              )}
              {jobSnap.is_published_to_website ? 'Unpublish' : 'Publish to Website'}
            </Button>
            <Button
              variant="outline"
              onClick={handlePushToGBP}
              disabled={actionLoading !== null || !jobSnap.is_published_to_website}
              className={jobSnap.is_published_to_gbp ? 'border-[#00d9c0] text-[#00d9c0] hover:text-[#00d9c0]' : ''}
              title={!jobSnap.is_published_to_website ? 'Publish to website first' : ''}
            >
              {actionLoading === 'gbp' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Push to GBP
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRevalidate}
              disabled={actionLoading !== null}
              title="Revalidate website cache"
              aria-label="Revalidate website cache"
            >
              {actionLoading === 'revalidate' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Detail cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Photos */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                Job Photos {jobSnap.media && jobSnap.media.length > 0 ? `(${jobSnap.media.length})` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobSnap.media && jobSnap.media.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {jobSnap.media
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((m) => {
                      const { data: urlData } = supabase.storage
                        .from('job-snap-media')
                        .getPublicUrl(m.storage_path);
                      return (
                        <div key={m.id} className="relative">
                          <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                            <Image
                              src={urlData.publicUrl}
                              alt={m.alt_text || m.file_name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 50vw, 33vw"
                            />
                          </div>
                          {m.role && (
                            <span className="mt-1 block text-center text-xs capitalize text-gray-500">
                              {m.role}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No photos uploaded</p>
              )}
            </CardContent>
          </Card>

          {/* Job Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Site:</span>
                <span className="font-medium">{siteName}</span>
              </div>
              {(jobSnap.service_type || jobSnap.service) && (
                <div className="flex items-center gap-2 text-sm">
                  <Wrench className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">Service:</span>
                  <span className="font-medium">
                    {jobSnap.service_type || jobSnap.service?.name}
                  </span>
                </div>
              )}
              {jobSnap.brand && (
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">Brand:</span>
                  <span className="font-medium">{jobSnap.brand}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Created:</span>
                <span className="font-medium">{formatDate(jobSnap.created_at)}</span>
              </div>
              {jobSnap.approved_at && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-gray-500">Approved:</span>
                  <span className="font-medium">{formatDate(jobSnap.approved_at)}</span>
                </div>
              )}
              {jobSnap.is_published_to_website && workItemSlug && (
                <div className="pt-1">
                  <a
                    href={`https://${siteCustomDomain || `${siteSlug}.${process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com'}`}/work/${workItemSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#00d9c0] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View on website
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location */}
          {(jobSnap.address_full || jobSnap.city) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {jobSnap.address_full && (
                  <div>
                    <p className="text-xs text-gray-400">Address (internal)</p>
                    <p className="font-medium">{jobSnap.address_full}</p>
                  </div>
                )}
                {jobSnap.city && (
                  <div>
                    <p className="text-xs text-gray-400">City, State</p>
                    <p className="font-medium">
                      {[jobSnap.city, jobSnap.state].filter(Boolean).join(', ')}
                      {jobSnap.zip ? ` ${jobSnap.zip}` : ''}
                    </p>
                  </div>
                )}
                {jobSnap.latitude && jobSnap.longitude && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Navigation className="h-3 w-3" />
                    <span>
                      {jobSnap.latitude.toFixed(6)}, {jobSnap.longitude.toFixed(6)}
                    </span>
                  </div>
                )}
                {jobSnap.location_source && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    <span className="text-xs capitalize text-gray-500">
                      Source: {jobSnap.location_source}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Description */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                {jobSnap.description || jobSnap.ai_generated_description || (
                  <span className="text-gray-400">No description yet</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
