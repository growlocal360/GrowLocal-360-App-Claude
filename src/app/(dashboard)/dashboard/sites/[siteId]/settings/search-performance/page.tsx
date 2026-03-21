'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  TrendingUp,
  MousePointerClick,
  Eye,
  ArrowUpDown,
  LogIn,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface GSCProperty {
  siteUrl: string;
  permissionLevel: string;
}

interface GSCQueryRow {
  id: string;
  query: string;
  page_url: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

type SortField = 'impressions' | 'clicks' | 'ctr' | 'position';

export default function SearchPerformancePage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Connection state
  const [gscPropertyUrl, setGscPropertyUrl] = useState<string | null>(null);
  const [gscConnected, setGscConnected] = useState(false);
  const [gscLastSyncedAt, setGscLastSyncedAt] = useState<string | null>(null);

  // Properties
  const [properties, setProperties] = useState<GSCProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [savingProperty, setSavingProperty] = useState(false);

  // Queries
  const [queries, setQueries] = useState<GSCQueryRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [sortField, setSortField] = useState<SortField>('impressions');
  const [sortAsc, setSortAsc] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);

  useEffect(() => {
    fetchData();
  }, [siteId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sites/${siteId}/settings/search-performance`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();

      setGscPropertyUrl(data.gscPropertyUrl);
      setGscConnected(data.gscConnected);
      setGscLastSyncedAt(data.gscLastSyncedAt);
      setSelectedProperty(data.gscPropertyUrl || '');
      setQueries(data.queries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      setLoadingProperties(true);
      setError(null);
      setNeedsReauth(false);
      const response = await fetch(`/api/sites/${siteId}/settings/search-performance/properties`);

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.error || 'Failed to fetch properties';
        if (response.status === 401 || errorMsg.toLowerCase().includes('authenticate') || errorMsg.toLowerCase().includes('token')) {
          setNeedsReauth(true);
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setProperties(data.properties || []);
      setNeedsReauth(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load properties';
      if (msg.toLowerCase().includes('authenticate') || msg.toLowerCase().includes('token')) {
        setNeedsReauth(true);
      }
      setError(msg);
    } finally {
      setLoadingProperties(false);
    }
  };

  const handleReauthenticate = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/webmasters.readonly',
        redirectTo: `${window.location.origin}/oauth2callback?next=${encodeURIComponent(window.location.pathname)}`,
        queryParams: {
          prompt: 'consent',
          access_type: 'offline',
        },
      },
    });
  };

  const handleSaveProperty = async () => {
    try {
      setSavingProperty(true);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/settings/search-performance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gscPropertyUrl: selectedProperty || null }),
      });

      if (!response.ok) throw new Error('Failed to save');

      setGscPropertyUrl(selectedProperty || null);
      setGscConnected(!!selectedProperty);
      setSuccess('Property saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingProperty(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/settings/search-performance/sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.error || 'Sync failed';
        if (response.status === 401 || errorMsg.toLowerCase().includes('authenticate') || errorMsg.toLowerCase().includes('token')) {
          setNeedsReauth(true);
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setSuccess(`Synced ${data.queriesImported} queries from Search Console`);
      setTimeout(() => setSuccess(null), 5000);

      // Refresh the data
      await fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      if (msg.toLowerCase().includes('authenticate') || msg.toLowerCase().includes('token')) {
        setNeedsReauth(true);
      }
      setError(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedQueries = [...queries].sort((a, b) => {
    const multiplier = sortAsc ? 1 : -1;
    return (a[sortField] - b[sortField]) * multiplier;
  });

  // Aggregate queries (combine across pages) for the top queries view
  const aggregatedQueries = Object.values(
    queries.reduce<Record<string, { query: string; clicks: number; impressions: number; ctr: number; position: number; count: number }>>((acc, q) => {
      if (!acc[q.query]) {
        acc[q.query] = { query: q.query, clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 };
      }
      acc[q.query].clicks += q.clicks;
      acc[q.query].impressions += q.impressions;
      acc[q.query].position += q.position;
      acc[q.query].count += 1;
      return acc;
    }, {})
  ).map((q) => ({
    ...q,
    ctr: q.impressions > 0 ? q.clicks / q.impressions : 0,
    position: q.position / q.count,
  }));

  const sortedAggregated = aggregatedQueries.sort((a, b) => {
    const multiplier = sortAsc ? 1 : -1;
    return (a[sortField] - b[sortField]) * multiplier;
  }).slice(0, 50);

  // Content opportunities: high impressions, poor position
  const opportunities = aggregatedQueries
    .filter((q) => q.impressions >= 10 && q.position > 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Link
        href={`/dashboard/sites/${siteId}`}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Site
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Performance</h1>
        <p className="text-gray-500 mt-1">
          Connect Google Search Console to see what people search to find your site
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
            {needsReauth && (
              <Button
                onClick={handleReauthenticate}
                variant="outline"
                size="sm"
                className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Re-authenticate with Google
              </Button>
            )}
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-[#00ef99]/5 border border-[#00ef99]/20 rounded-lg text-[#00ef99]">
          <Check className="h-5 w-5 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Connect Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Google Search Console Property</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Property</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                {properties.length > 0 ? (
                  <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a property..." />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.siteUrl} value={p.siteUrl}>
                          {p.siteUrl} ({p.permissionLevel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-gray-500 border rounded-md p-2.5">
                    {gscPropertyUrl || 'No properties loaded. Click "Load Properties" to start.'}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                onClick={fetchProperties}
                disabled={loadingProperties}
              >
                {loadingProperties ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Load Properties'
                )}
              </Button>
            </div>
          </div>

          {properties.length > 0 && (
            <div className="flex justify-end">
              <Button
                onClick={handleSaveProperty}
                disabled={savingProperty}
                className="bg-black hover:bg-gray-800"
              >
                {savingProperty ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Save Property
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Card */}
      {gscConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-[#00ef99]" />
                <h2 className="font-semibold">Data Sync</h2>
              </div>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-black hover:bg-gray-800"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              {gscLastSyncedAt
                ? `Last synced: ${new Date(gscLastSyncedAt).toLocaleDateString()} at ${new Date(gscLastSyncedAt).toLocaleTimeString()}`
                : 'Not synced yet. Click "Sync Now" to import search data.'}
            </p>
            {queries.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {queries.length} query/page combinations stored (last 28 days)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top Queries Table */}
      {sortedAggregated.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#00ef99]" />
              <h2 className="font-semibold">Top Search Queries</h2>
              <Badge variant="secondary">
                {aggregatedQueries.length} queries
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Query</th>
                    <th
                      className="text-right py-2 px-2 font-medium text-gray-500 cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('clicks')}
                    >
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="h-3.5 w-3.5" />
                        Clicks
                        {sortField === 'clicks' && <ArrowUpDown className="h-3 w-3" />}
                      </span>
                    </th>
                    <th
                      className="text-right py-2 px-2 font-medium text-gray-500 cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('impressions')}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        Impressions
                        {sortField === 'impressions' && <ArrowUpDown className="h-3 w-3" />}
                      </span>
                    </th>
                    <th
                      className="text-right py-2 px-2 font-medium text-gray-500 cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('ctr')}
                    >
                      <span className="inline-flex items-center gap-1">
                        CTR
                        {sortField === 'ctr' && <ArrowUpDown className="h-3 w-3" />}
                      </span>
                    </th>
                    <th
                      className="text-right py-2 px-2 font-medium text-gray-500 cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('position')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Position
                        {sortField === 'position' && <ArrowUpDown className="h-3 w-3" />}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAggregated.map((q, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium truncate max-w-xs">{q.query}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{q.clicks}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{q.impressions}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{(q.ctr * 100).toFixed(1)}%</td>
                      <td className="py-2 px-2 text-right tabular-nums">{q.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Opportunities */}
      {opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <h2 className="font-semibold">Content Opportunities</h2>
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                {opportunities.length} opportunities
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Queries with high impressions but poor ranking (position &gt; 10). Optimizing content for these terms could drive more traffic.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {opportunities.map((q, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg border bg-amber-50/50 border-amber-100"
                >
                  <div>
                    <span className="font-medium text-sm">{q.query}</span>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      <span>{q.impressions} impressions</span>
                      <span>{q.clicks} clicks</span>
                      <span>Avg position: {q.position.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {gscConnected && queries.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-1">No search data yet</h3>
            <p className="text-sm text-gray-500">
              Click &quot;Sync Now&quot; to import your search query data from Google Search Console.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
