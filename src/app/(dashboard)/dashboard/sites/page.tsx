'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Globe,
  Plus,
  Search,
  ExternalLink,
  Settings,
  Pause,
  Play,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { SiteStatusBadge, BuildProgressBar } from '@/components/sites/site-status-badge';
import type { SiteStatus, SiteBuildProgress } from '@/types/database';

type StatusFilter = 'all' | SiteStatus;

interface SiteWithLocations {
  id: string;
  name: string;
  slug: string;
  status: SiteStatus;
  build_progress: SiteBuildProgress | null;
  status_message: string | null;
  created_at: string;
  locations: { id: string }[];
}

export default function SitesPage() {
  const [sites, setSites] = useState<SiteWithLocations[]>([]);
  const [filteredSites, setFilteredSites] = useState<SiteWithLocations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userData, setUserData] = useState({ name: 'User', email: '', avatarUrl: undefined as string | undefined });

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: profile } = await supabase
        .from('profiles')
        .select('*, organization:organizations(*)')
        .eq('user_id', user?.id)
        .single();

      setUserData({
        name: profile?.full_name || user?.user_metadata?.full_name || 'User',
        email: user?.email || '',
        avatarUrl: profile?.avatar_url,
      });

      const { data: sitesData } = await supabase
        .from('sites')
        .select('id, name, slug, status, build_progress, status_message, created_at, locations(id)')
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false });

      setSites(sitesData as SiteWithLocations[] || []);
      setFilteredSites(sitesData as SiteWithLocations[] || []);
      setLoading(false);
    }

    loadData();
  }, [supabase]);

  useEffect(() => {
    let result = sites;

    if (searchQuery) {
      result = result.filter(site =>
        site.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(site => site.status === statusFilter);
    }

    setFilteredSites(result);
  }, [searchQuery, statusFilter, sites]);

  async function handlePauseResume(siteId: string, currentStatus: SiteStatus) {
    const newStatus = currentStatus === 'paused' ? 'active' : 'paused';
    setActionLoading(siteId);

    try {
      const response = await fetch(`/api/sites/${siteId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setSites(prev =>
          prev.map(site =>
            site.id === siteId ? { ...site, status: newStatus } : site
          )
        );
      }
    } catch (error) {
      console.error('Failed to update site status:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRetryBuild(siteId: string) {
    setActionLoading(siteId);

    try {
      const response = await fetch(`/api/sites/${siteId}/retry-build`, {
        method: 'POST',
      });

      if (response.ok) {
        setSites(prev =>
          prev.map(site =>
            site.id === siteId
              ? { ...site, status: 'building' as SiteStatus, build_progress: null }
              : site
          )
        );
      }
    } catch (error) {
      console.error('Failed to retry build:', error);
    } finally {
      setActionLoading(null);
    }
  }

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'building', label: 'Building' },
    { value: 'paused', label: 'Paused' },
    { value: 'failed', label: 'Failed' },
  ];

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';

  return (
    <div className="flex flex-col">
      <Header title="Sites" user={userData} />

      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Sites</h2>
            <p className="text-gray-500">Manage all your local service websites.</p>
          </div>
          <Button asChild className="bg-emerald-500 hover:bg-emerald-600">
            <Link href="/dashboard/sites/new">
              <Plus className="mr-2 h-4 w-4" />
              New Site
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search sites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(filter.value)}
                className={statusFilter === filter.value ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Sites List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading sites...</div>
        ) : filteredSites.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <Globe className="h-8 w-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery || statusFilter !== 'all' ? 'No sites found' : 'No sites yet'}
              </h4>
              <p className="text-gray-500 mb-4 max-w-sm">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Get started by creating your first website.'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button asChild className="bg-emerald-500 hover:bg-emerald-600">
                  <Link href="/dashboard/sites/new">
                    <Plus className="mr-2 h-4 w-4" />
                    New Site
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredSites.map((site) => (
              <Card key={site.id} className="hover:border-emerald-200 transition-colors">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Site Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{site.name}</h3>
                        <SiteStatusBadge
                          status={site.status}
                          progress={site.build_progress}
                        />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{site.locations?.length || 0} location{site.locations?.length !== 1 ? 's' : ''}</span>
                        <span>Created {new Date(site.created_at).toLocaleDateString()}</span>
                      </div>
                      {site.status === 'building' && site.build_progress && (
                        <div className="mt-2 max-w-md">
                          <BuildProgressBar progress={site.build_progress} />
                        </div>
                      )}
                      {site.status === 'failed' && site.status_message && (
                        <p className="mt-2 text-sm text-red-600">{site.status_message}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {site.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={`https://${site.slug}.${appDomain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Site
                          </a>
                        </Button>
                      )}

                      {(site.status === 'active' || site.status === 'paused') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePauseResume(site.id, site.status)}
                          disabled={actionLoading === site.id}
                        >
                          {site.status === 'paused' ? (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause className="mr-2 h-4 w-4" />
                              Pause
                            </>
                          )}
                        </Button>
                      )}

                      {site.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryBuild(site.id)}
                          disabled={actionLoading === site.id}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Retry Build
                        </Button>
                      )}

                      {site.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryBuild(site.id)}
                          disabled={actionLoading === site.id}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Regenerate
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        disabled={site.status === 'building'}
                      >
                        <Link href={`/dashboard/sites/${site.id}`}>
                          <Settings className="mr-2 h-4 w-4" />
                          Manage
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
