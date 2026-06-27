'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, CheckCircle2, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface GbpListing {
  name: string;
  city?: string;
  state?: string;
  gbpLocationId?: string;
  accountId?: string;
  accountName?: string;
}

interface Props {
  siteId: string;
  siteName: string;
  nextPath: string;
}

export function ConnectGbpForm({ siteId, siteName, nextPath }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [phase, setPhase] = useState<'checking' | 'needs-oauth' | 'pick' | 'no-listings' | 'done'>('checking');
  const [listings, setListings] = useState<GbpListing[]>([]);
  const [picked, setPicked] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // On mount: see if we already have a token + listings. If yes, go straight
  // to the picker. If no, prompt to Connect with Google.
  useEffect(() => {
    (async () => {
      try {
        // Quick check: do we currently have a Google session token available?
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.provider_token) {
          // No session token — but the org may have a saved token. /api/gbp/locations
          // will fall back to it. Try once; if it fails, we'll prompt for OAuth.
        }
        const res = await fetch(`/api/gbp/locations?siteId=${encodeURIComponent(siteId)}`);
        if (res.ok) {
          const data = await res.json();
          const locs: GbpListing[] = data.locations || [];
          setListings(locs);
          if (locs.length === 0) {
            setPhase('no-listings');
          } else {
            setPhase('pick');
            if (locs.length === 1 && locs[0].gbpLocationId) {
              setPicked(locs[0].gbpLocationId);
            }
          }
        } else {
          // 400 = no token at all; 401 = not authed (shouldn't happen here)
          setPhase('needs-oauth');
        }
      } catch {
        setPhase('needs-oauth');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleOAuth() {
    setConnecting(true);
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/webmasters.readonly',
        redirectTo: `${window.location.origin}/oauth2callback?siteId=${encodeURIComponent(siteId)}&next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        queryParams: { prompt: 'consent', access_type: 'offline' },
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setConnecting(false);
    }
    // On success the browser navigates away.
  }

  async function handleSave() {
    const loc = listings.find((l) => l.gbpLocationId === picked);
    if (!loc) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/connect-gbp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: loc.accountId || '',
          locationName: loc.gbpLocationId,
          locationTitle: loc.name,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save listing');
      }
      setPhase('done');
      toast.success(`Linked to ${loc.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save listing');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <Link href={nextPath} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Connect Google Business Profile</CardTitle>
          <CardDescription>
            Connect your Google Business Profile to <strong>{siteName}</strong> so Job Snaps can post your work to Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMsg && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
          )}

          {phase === 'checking' && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your Google connection…
            </div>
          )}

          {phase === 'needs-oauth' && (
            <>
              <p className="text-sm text-gray-600">Sign in with Google and grant Business Profile access to continue.</p>
              <Button onClick={handleOAuth} disabled={connecting} className="bg-blue-600 text-white hover:bg-blue-700">
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continue with Google
              </Button>
            </>
          )}

          {phase === 'pick' && (
            <>
              <p className="text-sm text-gray-600">Pick the listing this site should post to:</p>
              <Select value={picked} onValueChange={setPicked}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose your business listing…" />
                </SelectTrigger>
                <SelectContent>
                  {listings.map((l) => (
                    <SelectItem key={l.gbpLocationId || l.name} value={l.gbpLocationId || l.name}>
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        {l.name}
                        {l.city ? <span className="text-gray-500"> — {l.city}{l.state ? `, ${l.state}` : ''}</span> : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={saving || !picked} className="bg-black text-white hover:bg-gray-800">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Link this listing
                </Button>
                <Button variant="ghost" onClick={handleOAuth} disabled={connecting}>
                  Use a different Google account
                </Button>
              </div>
            </>
          )}

          {phase === 'no-listings' && (
            <>
              <p className="text-sm text-gray-700">
                The Google account you connected doesn&apos;t own any verified Business Profile listings.
              </p>
              <p className="text-sm text-gray-500">
                Try connecting with a different Google account — the one that manages this business on Google.
              </p>
              <Button onClick={handleOAuth} disabled={connecting} variant="outline">
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Connect a different Google account
              </Button>
            </>
          )}

          {phase === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-[#00ef99]/10 px-3 py-2 text-sm text-[#00b478]">
                <CheckCircle2 className="h-5 w-5" />
                <span>Connected. Push to GBP will now work for this site.</span>
              </div>
              <Button onClick={() => router.push(nextPath)} className="bg-black text-white hover:bg-gray-800">
                Take me back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
