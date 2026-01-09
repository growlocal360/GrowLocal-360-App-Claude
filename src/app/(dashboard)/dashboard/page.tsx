import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Briefcase, Users, Plus } from 'lucide-react';
import { SiteStatusBadge, BuildProgressBar } from '@/components/sites/site-status-badge';
import type { SiteStatus, SiteBuildProgress } from '@/types/database';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get profile and org
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organization:organizations(*)')
    .eq('user_id', user?.id)
    .single();

  // Get stats
  const { count: sitesCount } = await supabase
    .from('sites')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile?.organization_id);

  const { count: jobsCount } = await supabase
    .from('job_snaps')
    .select('*', { count: 'exact', head: true })
    .in('site_id', (await supabase
      .from('sites')
      .select('id')
      .eq('organization_id', profile?.organization_id)
    ).data?.map(s => s.id) || []);

  const { count: teamCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', profile?.organization_id);

  // Get sites with status and build progress
  const { data: sites } = await supabase
    .from('sites')
    .select('*, locations(*), status, build_progress, status_message')
    .eq('organization_id', profile?.organization_id)
    .order('created_at', { ascending: false });

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
          <Button asChild className="bg-emerald-500 hover:bg-emerald-600">
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
              <div className="rounded-lg bg-emerald-50 p-3">
                <Globe className="h-6 w-6 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Jobs</p>
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
            <Link href="/dashboard/sites" className="text-sm text-emerald-600 hover:text-emerald-700">
              View all sites
            </Link>
          </div>

          {sites && sites.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sites.map((site) => (
                <Card key={site.id} className="hover:border-emerald-200 transition-colors">
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
              <Card className="border-dashed border-2 hover:border-emerald-300 transition-colors cursor-pointer">
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
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="rounded-full bg-gray-100 p-4 mb-4">
                  <Plus className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  Create your first site
                </h4>
                <p className="text-gray-500 mb-4 max-w-sm">
                  Get started by connecting your Google Business Profile or manually setting up your first website.
                </p>
                <Button asChild className="bg-emerald-500 hover:bg-emerald-600">
                  <Link href="/dashboard/sites/new">
                    <Plus className="mr-2 h-4 w-4" />
                    New Site
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
