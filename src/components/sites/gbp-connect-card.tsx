'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface GBPLocation {
  name: string; // Business name
  gbpLocationId: string; // "locations/123456"
  accountId?: string; // "accounts/123456"
}

interface GBPConnectCardProps {
  siteId: string;
}

export function GBPConnectCard({ siteId }: GBPConnectCardProps) {
  const [status, setStatus] = useState<{
    isConnected: boolean;
    hasToken: boolean;
    accountName: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<GBPLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Load current connection status
  useEffect(() => {
    fetch(`/api/sites/${siteId}/connect-gbp`)
      .then(r => r.json())
      .then(data => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId]);

  const handleConnect = async () => {
    // First check if we have a valid Google session
    setLoadingLocations(true);
    try {
      const res = await fetch('/api/gbp/locations');
      const data = await res.json();

      if (res.status === 400 || !data.locations) {
        // No token — need to re-authenticate with Google
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            scopes: 'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/webmasters.readonly',
            redirectTo: `${window.location.origin}/oauth2callback?siteId=${siteId}&next=${encodeURIComponent(window.location.pathname)}`,
            queryParams: {
              prompt: 'consent',
              access_type: 'offline',
            },
          },
        });
        return;
      }

      // We have locations — show the picker
      setLocations(data.locations || []);
      setShowPicker(true);
    } catch {
      toast.error('Failed to load GBP locations');
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleSave = async () => {
    if (!selectedLocation) return;

    const loc = locations.find(l => l.gbpLocationId === selectedLocation);
    if (!loc) return;

    setSaving(true);
    try {
      const accountName = loc.accountId || '';

      if (!accountName) {
        // Fallback: fetch accounts
        const accountsRes = await fetch('/api/gbp/accounts');
        const accountsData = await accountsRes.json();
        const fallbackAccount = accountsData.accounts?.[0]?.name || '';
        if (!fallbackAccount) {
          toast.error('Could not determine GBP account');
          setSaving(false);
          return;
        }
      }

      const res = await fetch(`/api/sites/${siteId}/connect-gbp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: loc.accountId || accountName,
          locationName: loc.gbpLocationId,
          locationTitle: loc.name,
        }),
      });

      if (res.ok) {
        setStatus({
          isConnected: true,
          hasToken: true,
          accountName: loc.name,
        });
        setShowPicker(false);
        toast.success(`Connected to ${loc.name}`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save connection');
      }
    } catch {
      toast.error('Failed to save connection');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="hover:border-[#00d9c0]/20 transition-colors">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#2563eb">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold">Google Business Profile</h3>
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
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#2563eb">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold">Google Business Profile</h3>
            <p className="text-sm text-gray-500">Post updates to GBP</p>
          </div>
          {status?.isConnected && (
            <Badge variant="outline" className="ml-auto text-green-600 border-green-200 bg-green-50">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {status?.isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {status.accountName || 'GBP location linked'}
            </p>
            {!status.hasToken && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" />
                Token expired — reconnect to push posts
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={loadingLocations}
            >
              {loadingLocations ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : null}
              Reconnect
            </Button>
          </div>
        ) : showPicker ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Select your GBP location:
            </p>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.gbpLocationId} value={loc.gbpLocationId}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!selectedLocation || saving}
                className="bg-gray-900 hover:bg-gray-800"
              >
                {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                Save Connection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPicker(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Connect to push Job Snaps as GBP posts
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={loadingLocations}
            >
              {loadingLocations ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : null}
              Connect GBP
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
