'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Briefcase,
  Plus,
  Loader2,
  Search,
} from 'lucide-react';
import { getActiveOrgIdClient } from '@/lib/auth/active-org-client';
import { JobSnapCard, type JobSnapCardData } from '@/components/job-snaps/job-snap-card';
import { toast } from 'sonner';
import type { JobStatus } from '@/types/database';

type StatusFilter = 'all' | JobStatus;

export default function JobSnapsPage() {
  const [jobSnaps, setJobSnaps] = useState<JobSnapCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('owner');
  const [userData, setUserData] = useState({ name: 'User', email: '', avatarUrl: undefined as string | undefined });

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get profile for active org
      const activeOrgId = getActiveOrgIdClient();
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*, organization:organizations(*)')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      const profile = (activeOrgId
        ? allProfiles?.find((p: { organization_id: string }) => p.organization_id === activeOrgId)
        : allProfiles?.[0]) || allProfiles?.[0] || null;

      const role = profile?.role || 'user';
      setUserRole(role);
      setUserData({
        name: profile?.full_name || user?.user_metadata?.full_name || 'User',
        email: user?.email || '',
        avatarUrl: profile?.avatar_url,
      });

      // Load sites — scoped to assigned sites for 'user' role
      let sites: { id: string; name: string }[] | null = null;

      if (role === 'user' && profile?.id) {
        // Users only see their assigned sites
        const { data: assignments } = await supabase
          .from('profile_site_assignments')
          .select('site_id')
          .eq('profile_id', profile.id);

        const assignedIds = (assignments || []).map((a: { site_id: string }) => a.site_id);
        if (assignedIds.length > 0) {
          const { data } = await supabase
            .from('sites')
            .select('id, name')
            .in('id', assignedIds);
          sites = data;
        }
      } else {
        // Owner/Admin see all org sites
        const orgIds = (allProfiles || []).map((p: { organization_id: string }) => p.organization_id);
        const { data } = await supabase
          .from('sites')
          .select('id, name')
          .in('organization_id', orgIds);
        sites = data;
      }

      if (!sites?.length) {
        setJobSnaps([]);
        setLoading(false);
        return;
      }

      const siteIds = sites.map((s: { id: string }) => s.id);
      const siteMap = new Map(sites.map((s: { id: string; name: string }) => [s.id, s.name]));

      // Load job snaps with relations
      const { data: snaps } = await supabase
        .from('job_snaps')
        .select(`
          id,
          site_id,
          title,
          description,
          ai_generated_title,
          ai_generated_description,
          status,
          city,
          state,
          brand,
          is_published_to_website,
          is_published_to_gbp,
          created_at,
          deployed_at,
          service:services(id, name),
          media:job_snap_media(id, storage_path, sort_order)
        `)
        .in('site_id', siteIds)
        .order('created_at', { ascending: false });

      if (!snaps) {
        setJobSnaps([]);
        setLoading(false);
        return;
      }

      // Transform to card data
      const cardData: JobSnapCardData[] = snaps.map((snap: Record<string, unknown>) => {
        const service = snap.service as { id: string; name: string } | null;
        const media = (snap.media as { id: string; storage_path: string; sort_order: number }[]) || [];

        // Get featured image URL from first media item
        let featuredImageUrl: string | null = null;
        if (media.length > 0) {
          const sorted = [...media].sort((a, b) => a.sort_order - b.sort_order);
          const { data: urlData } = supabase.storage
            .from('job-snap-media')
            .getPublicUrl(sorted[0].storage_path);
          featuredImageUrl = urlData?.publicUrl || null;
        }

        return {
          id: snap.id as string,
          site_id: snap.site_id as string,
          title: snap.title as string | null,
          ai_generated_title: snap.ai_generated_title as string | null,
          description: snap.description as string | null,
          ai_generated_description: snap.ai_generated_description as string | null,
          status: snap.status as JobStatus,
          created_at: snap.created_at as string,
          site_name: siteMap.get(snap.site_id as string) || 'Unknown Site',
          service_name: service?.name || null,
          brand_name: snap.brand as string | null,
          location_city: snap.city as string | null,
          location_state: snap.state as string | null,
          featured_image_url: featuredImageUrl,
          media_count: media.length,
          is_published_to_website: (snap.is_published_to_website as boolean) || false,
          is_published_to_gbp: (snap.is_published_to_gbp as boolean) || false,
        };
      });

      setJobSnaps(cardData);
    } catch (err) {
      console.error('Failed to load job snaps:', err);
      toast.error('Failed to load job snaps. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter logic
  const filteredSnaps = useMemo(() => {
    let result = jobSnaps;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((snap) => {
        const title = (snap.title || snap.ai_generated_title || '').toLowerCase();
        const desc = (snap.description || snap.ai_generated_description || '').toLowerCase();
        const service = (snap.service_name || '').toLowerCase();
        const site = snap.site_name.toLowerCase();
        return title.includes(q) || desc.includes(q) || service.includes(q) || site.includes(q);
      });
    }

    if (statusFilter !== 'all') {
      result = result.filter((snap) => snap.status === statusFilter);
    }

    return result;
  }, [jobSnaps, searchQuery, statusFilter]);

  async function handlePushToWebsite(jobId: string) {
    const snap = jobSnaps.find((s) => s.id === jobId);
    if (!snap) return;
    setActionLoading(jobId);

    const endpoint = snap.is_published_to_website
      ? `/api/job-snaps/${jobId}/unpublish-website`
      : `/api/job-snaps/${jobId}/publish-website`;

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Action failed');
      } else {
        const published = !snap.is_published_to_website;
        setJobSnaps((prev) =>
          prev.map((s) =>
            s.id === jobId ? { ...s, is_published_to_website: published } : s
          )
        );
        toast.success(published ? 'Published to website' : 'Unpublished from website');
      }
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePushToGBP(jobId: string) {
    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/job-snaps/${jobId}/publish-gbp`, { method: 'POST' });
      const data = await res.json();
      if (res.status === 501) {
        toast.info('GBP posting is not yet available. Check back soon.');
      } else if (!res.ok) {
        toast.error(data.error || 'Failed to push to GBP');
      } else {
        setJobSnaps((prev) =>
          prev.map((s) => (s.id === jobId ? { ...s, is_published_to_gbp: true } : s))
        );
        toast.success('Pushed to Google Business Profile');
      }
    } catch {
      toast.error('Failed to push to GBP. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevalidate(jobId: string) {
    const snap = jobSnaps.find((s) => s.id === jobId);
    if (!snap) return;
    setActionLoading(jobId);

    try {
      const response = await fetch(`/api/sites/${snap.site_id}/revalidate`, { method: 'POST' });
      if (response.ok) {
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

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Drafts' },
    { value: 'queued', label: 'Queued' },
    { value: 'approved', label: 'Approved' },
    { value: 'deployed', label: 'Published' },
    { value: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="flex flex-col">
      <Header title="Job Snaps" user={userData} />

      <div className="p-6">
        {/* Page header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Job Snaps</h2>
            <p className="text-gray-500">Manage and view all jobs across connected sites.</p>
          </div>
          <Button asChild className="bg-black hover:bg-gray-800">
            <Link href="/dashboard/job-snaps/new">
              <Plus className="mr-2 h-4 w-4" />
              New Job
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {statusFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(filter.value)}
                className={statusFilter === filter.value ? 'bg-black hover:bg-gray-800' : ''}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Job Snaps List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredSnaps.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <Briefcase className="h-8 w-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery || statusFilter !== 'all' ? 'No jobs found' : 'No job snaps yet'}
              </h4>
              <p className="text-gray-500 mb-4 max-w-sm">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Upload job photos, add details, and let AI generate content for your website.'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button asChild className="bg-black hover:bg-gray-800">
                  <Link href="/dashboard/job-snaps/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Job Snap
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredSnaps.map((snap) => (
              <JobSnapCard
                key={snap.id}
                job={snap}
                onPushToWebsite={userRole !== 'user' ? handlePushToWebsite : undefined}
                onPushToGBP={userRole !== 'user' ? handlePushToGBP : undefined}
                onRevalidate={userRole !== 'user' ? handleRevalidate : undefined}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
