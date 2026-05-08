'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  ExternalLink,
} from 'lucide-react';

interface HighLevelConnectCardProps {
  siteId: string;
}

interface Status {
  connected: boolean;
  locationName?: string | null;
  blogName?: string | null;
  postCount?: number;
  connectedAt?: string;
}

export function HighLevelConnectCard({ siteId }: HighLevelConnectCardProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Connect form state
  const [token, setToken] = useState('');
  const [locationId, setLocationId] = useState('');
  const [blogId, setBlogId] = useState('');
  const [blogName, setBlogName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, [siteId]);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/integrations/highlevel`);
      const data = await res.json();
      setStatus(data);
    } catch {
      setError('Failed to load connection status');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    if (!token.trim() || !locationId.trim() || !blogId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/integrations/highlevel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          locationId: locationId.trim(),
          blogId: blogId.trim(),
          blogName: blogName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connection failed');
        return;
      }
      // Reset, refresh status
      setToken('');
      setLocationId('');
      setBlogId('');
      setBlogName('');
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        'Disconnect HighLevel? Future snap publishes will stop pushing to HL. Existing HL blog posts will remain.'
      )
    )
      return;
    await fetch(`/api/sites/${siteId}/integrations/highlevel`, { method: 'DELETE' });
    await fetchStatus();
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <h3 className="font-semibold">HighLevel</h3>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // ── Connected state ───────────────────────────────────────────────────
  if (status?.connected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-[#00ef99]" />
            <h3 className="font-semibold">HighLevel</h3>
            <Badge variant="outline" className="ml-auto text-[#00ef99] border-[#00ef99]/30 bg-[#00ef99]/5">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-gray-500">Location:</span>
              <span className="font-medium">{status.locationName || '—'}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-gray-500">Target blog:</span>
              <span className="font-medium">{status.blogName || '—'}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-gray-500">Snaps synced:</span>
              <span className="font-medium">{status.postCount ?? 0}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 pt-2 border-t">
            Published Job Snaps will appear automatically as blog posts on your HighLevel
            site at <code className="bg-gray-100 px-1 rounded">/work/&lt;slug&gt;</code>.
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Disconnect
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Not connected — show connect form ─────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5 text-[#00ef99]" />
          <h3 className="font-semibold">Connect HighLevel</h3>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Auto-publish Job Snaps as <strong>real, server-rendered blog posts</strong> on your
          HighLevel site. Each post lives on your domain at{' '}
          <code className="bg-gray-100 px-1 rounded">/work/&lt;slug&gt;</code>, gets indexed by
          Google, and counts toward your domain authority.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="hl-token">HighLevel Private Integration Token</Label>
          <Input
            id="hl-token"
            type="password"
            placeholder="pit-xxxxxxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-xs text-gray-500">
            Generate in HighLevel: Settings → Integrations → Private Integrations →
            <strong> create a token with the <code>blogs/post.write</code> scope.</strong>{' '}
            <a
              href="https://help.gohighlevel.com/support/solutions/articles/155000005467-private-integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00ef99] hover:underline inline-flex items-center gap-0.5"
            >
              HL docs <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="hl-location">HighLevel Location ID</Label>
          <Input
            id="hl-location"
            placeholder="abc123XYZ..."
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-xs text-gray-500">
            Find in HighLevel: Settings → Business Profile → Location ID.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="hl-blog">HighLevel Blog ID</Label>
          <Input
            id="hl-blog"
            placeholder="abc123XYZ..."
            value={blogId}
            onChange={(e) => setBlogId(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-xs text-gray-500">
            Find in HighLevel: Sites → Blogs → click your blog. The Blog ID is in the URL,
            usually after <code className="bg-gray-100 px-1 rounded">/blogs/</code> (e.g.{' '}
            <code className="bg-gray-100 px-1 rounded">.../blogs/abc123xyz/posts</code> →
            blog ID is <code className="bg-gray-100 px-1 rounded">abc123xyz</code>).
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="hl-blog-name">Blog Name <span className="text-gray-400 font-normal">(optional, for display)</span></Label>
          <Input
            id="hl-blog-name"
            placeholder="Our Work"
            value={blogName}
            onChange={(e) => setBlogName(e.target.value)}
          />
        </div>

        <Button
          onClick={handleConnect}
          disabled={!token.trim() || !locationId.trim() || !blogId.trim() || saving}
          className="bg-black hover:bg-gray-800"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Connect HighLevel
        </Button>

        <p className="text-xs text-gray-500">
          We&apos;ll verify the token + location, then save your connection. Published Job
          Snaps will start syncing to your blog immediately after.
        </p>
      </CardContent>
    </Card>
  );
}
