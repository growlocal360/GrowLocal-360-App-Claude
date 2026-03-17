'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Briefcase } from 'lucide-react';
import { getActiveOrgIdClient } from '@/lib/auth/active-org-client';
import type { JobSnapWithRelations } from '@/types/database';

export default function EditJobSnapPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [jobSnap, setJobSnap] = useState<JobSnapWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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

        // Load job snap
        const { data: snap, error } = await supabase
          .from('job_snaps')
          .select(`
            *,
            media:job_snap_media(*),
            location:locations(*),
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
          .select('organization_id')
          .eq('id', snap.site_id)
          .single();

        if (!site || site.organization_id !== activeOrgId) {
          setNotFound(true);
          setLoading(false);
          return;
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

  if (loading) {
    return (
      <>
        <Header title="Edit Job Snap" user={userData} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </>
    );
  }

  if (notFound || !jobSnap) {
    return (
      <>
        <Header title="Edit Job Snap" user={userData} />
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
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={`Edit: ${getDisplayTitle(jobSnap)}`} user={userData} />

      <div className="p-6 space-y-6">
        {/* Breadcrumb */}
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/job-snaps/${jobId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Job Snap
            </Link>
          </Button>
        </div>

        {/* Page header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Edit Job Snap</h2>
          <p className="mt-1 text-sm text-gray-500">
            Update photos, details, and content for this job snap.
          </p>
        </div>

        {/* Placeholder form sections */}
        <div className="max-w-3xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos</CardTitle>
              <CardDescription>Add, remove, or reorder job photos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">Photo management will be built in the next phase.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job Details</CardTitle>
              <CardDescription>Title, description, service, and location</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">Form fields will be built in the next phase.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Content</CardTitle>
              <CardDescription>AI-generated title and description</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">AI content review will be built in the next phase.</p>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/job-snaps/${jobId}`}>Cancel</Link>
            </Button>
            <Button disabled>Save Changes</Button>
          </div>
        </div>
      </div>
    </>
  );
}
