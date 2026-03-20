'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface ReputationCardProps {
  siteId: string;
}

interface ReputationData {
  averageRating: number | null;
  totalReviews: number | null;
  storedReviewCount: number;
  lastFetchedDate: string | null;
  hasGoogleConnection: boolean;
}

export function ReputationCard({ siteId }: ReputationCardProps) {
  const [data, setData] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const [{ data: site }, { count: reviewCount }, { data: latestReview }, { data: connections }] =
      await Promise.all([
        supabase
          .from('sites')
          .select('settings')
          .eq('id', siteId)
          .single(),
        supabase
          .from('google_reviews')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('is_visible', true),
        supabase
          .from('google_reviews')
          .select('review_date, created_at')
          .eq('site_id', siteId)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('social_connections')
          .select('id')
          .eq('site_id', siteId)
          .eq('platform', 'google_business')
          .eq('is_active', true)
          .limit(1),
      ]);

    const settings = site?.settings as Record<string, unknown> | null;

    setData({
      averageRating: (settings?.google_average_rating as number) ?? null,
      totalReviews: (settings?.google_total_reviews as number) ?? null,
      storedReviewCount: reviewCount ?? 0,
      lastFetchedDate: latestReview?.[0]?.created_at ?? null,
      hasGoogleConnection: (connections?.length ?? 0) > 0,
    });
    setLoading(false);
  }, [siteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: { type: 'reviews' } }),
      });

      if (!res.ok) {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to refresh reviews');
        return;
      }

      // Wait a moment for the Inngest function to complete, then re-fetch
      // The generate endpoint is async (Inngest), so we poll briefly
      await new Promise(resolve => setTimeout(resolve, 5000));
      await fetchData();
      toast.success(
        data?.storedReviewCount
          ? `Reviews refreshed — ${data.storedReviewCount} reviews stored`
          : 'Reviews refreshed'
      );
    } catch {
      toast.error('Failed to refresh reviews. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Card className="hover:border-[#00d9c0]/20 transition-colors">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold">Reputation</h3>
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="hover:border-[#00d9c0]/20 transition-colors">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <Star className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-semibold">Reputation</h3>
            <p className="text-sm text-gray-500">Reviews & ratings</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data?.averageRating ? (
          <div className="space-y-3">
            {/* Rating display */}
            <div className="flex items-center gap-2">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.round(data.averageRating!)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-gray-200 text-gray-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {data.averageRating.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">
                ({data.totalReviews ?? data.storedReviewCount} review{(data.totalReviews ?? data.storedReviewCount) !== 1 ? 's' : ''})
              </span>
            </div>

            {/* Stored count + last fetched */}
            <p className="text-xs text-gray-400">
              {data.storedReviewCount} review{data.storedReviewCount !== 1 ? 's' : ''} stored
              {data.lastFetchedDate && (
                <> &middot; Last synced {formatDate(data.lastFetchedDate)}</>
              )}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-600 mb-1">
            No reviews fetched yet
          </p>
        )}

        {/* Refresh button */}
        <div className="mt-4">
          {data?.hasGoogleConnection ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3 w-3" />
              )}
              {refreshing ? 'Refreshing...' : 'Refresh Reviews'}
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="h-3 w-3" />
              Connect GBP first to fetch reviews
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}
