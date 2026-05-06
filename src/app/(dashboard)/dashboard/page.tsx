import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Briefcase, Users, Plus, Camera, ArrowRight, Check } from 'lucide-react';
import { SiteStatusBadge, BuildProgressBar } from '@/components/sites/site-status-badge';
import type { SiteStatus, SiteBuildProgress, UserRole } from '@/types/database';
import { getAccessibleSiteIds } from '@/lib/auth/permissions';
import { getActiveOrgId } from '@/lib/auth/active-org';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get profile for the active org
  const activeOrgId = await getActiveOrgId();
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*, organization:organizations(*)')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });
  const profile = (activeOrgId
    ? allProfiles?.find(p => p.organization_id === activeOrgId)
    : allProfiles?.[0]) || allProfiles?.[0] || null;

  // Users only see Job Snaps — redirect them
  if (profile?.role === 'user') {
    redirect('/dashboard/job-snaps');
  }

  // Determine which sites this user can access
  const accessibleSiteIds = await getAccessibleSiteIds(
    supabase,
    profile?.id,
    (profile?.role as UserRole) || 'user'
  );

  // Get stats — scoped to accessible sites
  let sitesCountQuery = supabase
    .from('sites')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile?.organization_id);
  if (accessibleSiteIds) sitesCountQuery = sitesCountQuery.in('id', accessibleSiteIds);
  const { count: sitesCount } = await sitesCountQuery;

  // Get accessible site IDs for job count query
  let jobSiteIds: string[];
  if (accessibleSiteIds) {
    jobSiteIds = accessibleSiteIds;
  } else {
    const { data: allSites } = await supabase
      .from('sites')
      .select('id')
      .eq('organization_id', profile?.organization_id);
    jobSiteIds = allSites?.map(s => s.id) || [];
  }

  const { count: jobsCount } = await supabase
    .from('job_snaps')
    .select('*', { count: 'exact', head: true })
    .in('site_id', jobSiteIds);

  const { count: teamCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile?.organization_id);

  // Get sites with status and build progress — scoped
  let sitesQuery = supabase
    .from('sites')
    .select('*, locations(*), status, build_progress, status_message')
    .eq('organization_id', profile?.organization_id);
  if (accessibleSiteIds) sitesQuery = sitesQuery.in('id', accessibleSiteIds);
  const { data: sites } = await sitesQuery.order('created_at', { ascending: false });

  const userData = {
    name: profile?.full_name || user?.user_metadata?.full_name || 'User',
    email: user?.email || '',
    avatarUrl: profile?.avatar_url,
  };

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" user={userData} />

      <div className="p-6">
        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-gray-500">Overview of your local service businesses.</p>
          </div>
          <Button asChild className="bg-black hover:bg-gray-800">
            <Link href="/dashboard/sites/new">
              <Plus className="mr-2 h-4 w-4" />
              New Site
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Sites</p>
                <p className="text-3xl font-bold text-gray-900">{sitesCount || 0}</p>
                <p className="text-xs text-gray-400">+2 this month</p>
              </div>
              <div className="rounded-lg bg-[#00ef99]/5 p-3">
                <Globe className="h-6 w-6 text-[#00ef99]" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Job Snaps</p>
                <p className="text-3xl font-bold text-gray-900">{jobsCount || 0}</p>
                <p className="text-xs text-gray-400">+12 this week</p>
              </div>
              <div className="rounded-lg bg-cyan-50 p-3">
                <Briefcase className="h-6 w-6 text-cyan-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Team Members</p>
                <p className="text-3xl font-bold text-gray-900">{teamCount || 0}</p>
                <p className="text-xs text-gray-400">Active now</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3">
                <Users className="h-6 w-6 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sites Section */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Globe className="h-5 w-5" />
              Your Sites
            </h3>
            <Link href="/dashboard/sites" className="text-sm text-[#00ef99] hover:text-[#00ef99]">
              View all sites
            </Link>
          </div>

          {sites && sites.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sites.map((site) => (
                <Card key={site.id} className="hover:border-[#00ef99]/20 transition-colors">
                  <CardContent className="p-6">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">{site.name}</h4>
                      <SiteStatusBadge
                        status={site.status as SiteStatus}
                        progress={site.build_progress as SiteBuildProgress | null}
                      />
                    </div>
                    <p className="text-sm text-gray-500">
                      {site.locations?.length || 0} location{site.locations?.length !== 1 ? 's' : ''}
                    </p>

                    {/* Show progress bar if building */}
                    {site.status === 'building' && site.build_progress && (
                      <BuildProgressBar progress={site.build_progress as SiteBuildProgress} />
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full"
                      asChild
                      disabled={site.status === 'building'}
                    >
                      <Link href={`/dashboard/sites/${site.id}`}>
                        {site.status === 'building' ? 'Building...' :
                         site.status === 'failed' ? 'View Error' :
                         'Manage Site'}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {/* Add Site Card */}
              <Card className="border-dashed border-2 hover:border-[#00ef99]/30 transition-colors cursor-pointer">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[160px]">
                  <Link href="/dashboard/sites/new" className="flex flex-col items-center">
                    <div className="rounded-full bg-gray-100 p-3 mb-3">
                      <Plus className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="font-medium text-gray-900">Add another site</p>
                    <p className="text-sm text-gray-500">Expand your business</p>
                  </Link>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center max-w-2xl mx-auto">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Welcome! What do you want to start with?
                </h3>
                <p className="text-gray-500 text-sm">
                  Pick one &mdash; you can always add the other later.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {/* Full Website CTA */}
                <Card className="border-2 hover:border-gray-400 transition-colors flex flex-col">
                  <CardContent className="p-8 flex flex-col h-full">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
                      <Globe className="h-6 w-6 text-gray-700" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-1">Full Website</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      GBP-optimized site that ranks in the local map pack
                    </p>
                    <ul className="space-y-2 mb-6 text-sm text-gray-700 flex-1">
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                        <span>AI-generated SEO website</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                        <span>Service area landing pages</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                        <span>Lead capture forms + scheduling</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                        <span>Job Snaps included</span>
                      </li>
                    </ul>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold text-gray-900">From $147</span>
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                    <Button asChild className="w-full bg-black hover:bg-gray-800">
                      <Link href="/dashboard/sites/new">
                        Build my site
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Job Snaps CTA */}
                <Card className="border-2 border-[#00ef99]/30 hover:border-[#00ef99]/60 transition-colors flex flex-col relative overflow-hidden">
                  <div className="absolute top-3 right-3 text-xs bg-[#00ef99]/10 text-[#00ef99] px-2 py-1 rounded-full font-medium">
                    Lower commitment
                  </div>
                  <CardContent className="p-8 flex flex-col h-full">
                    <div className="w-12 h-12 rounded-xl bg-[#00ef99]/15 flex items-center justify-center mb-4">
                      <Camera className="h-6 w-6 text-[#00ef99]" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-1">Just Job Snaps</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Showcase your work on ANY website (WordPress, Next.js, anywhere)
                    </p>
                    <ul className="space-y-2 mb-6 text-sm text-gray-700 flex-1">
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-[#00ef99] mt-0.5 shrink-0" />
                        <span>AI-generated photo titles + descriptions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-[#00ef99] mt-0.5 shrink-0" />
                        <span>Push to your existing website</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-[#00ef99] mt-0.5 shrink-0" />
                        <span>Auto-post to Google Business Profile</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-[#00ef99] mt-0.5 shrink-0" />
                        <span>14-day free trial</span>
                      </li>
                    </ul>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold text-gray-900">$37</span>
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                    <Button asChild className="w-full bg-[#00ef99] hover:bg-[#00ef99]/90 text-black">
                      <Link href="/signup/job-snaps">
                        Try free for 14 days
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
