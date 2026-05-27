'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  Sparkles,
  AlertCircle,
  MapPin,
} from 'lucide-react';

/** A GBP location as returned by /api/gbp/locations (gbpLocationToAppLocation shape). */
interface GbpLocation {
  name: string;
  city: string;
  state: string;
  phone: string;
  gbpLocationId?: string;
  accountId?: string;
  accountName?: string;
  primaryCategory?: { displayName?: string };
}

/** Best-effort map a GBP primary category to one of our INDUSTRIES options. */
function matchIndustry(categoryName: string | undefined): string {
  if (!categoryName) return '';
  const c = categoryName.toLowerCase();
  return (
    INDUSTRIES.find((ind) => ind !== 'Other' && (c.includes(ind.toLowerCase()) || ind.toLowerCase().includes(c))) || ''
  );
}

const INDUSTRIES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Roofing',
  'Landscaping',
  'Cleaning',
  'Painting',
  'Pest Control',
  'Pool Service',
  'Auto Repair',
  'Construction / Remodeling',
  'Appliance Repair',
  'Garage Door',
  'Locksmith',
  'Window Cleaning',
  'Tree Service',
  'Pressure Washing',
  'Other',
];

type Tier = 'jobsnaps_pro' | 'jobsnaps_max';

const TIER_INFO = {
  jobsnaps_pro: {
    name: 'Job Snaps Pro',
    price: 37,
    features: [
      'AI-generated photo titles + descriptions',
      'Push to your existing website',
      'Push to Google Business Profile',
      'Push to Facebook, Instagram, TikTok',
      'Unlimited Job Snaps',
      'API + Webhooks',
    ],
  },
  jobsnaps_max: {
    name: 'Job Snaps Max',
    price: 67,
    features: [
      'Everything in Job Snaps Pro',
      'Auto-generated flip-through videos',
      'YouTube Shorts publishing',
      'Branded video outros + music',
      'Priority support',
    ],
  },
} as const;

export default function AddJobSnapsPage() {
  const [tier, setTier] = useState<Tier>('jobsnaps_pro');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Google Business Profile connect + prefill ──────────────────────────
  const supabase = useMemo(() => createClient(), []);
  const [gbpLoading, setGbpLoading] = useState(false);
  const [gbpLocations, setGbpLocations] = useState<GbpLocation[]>([]);
  const [gbpConnected, setGbpConnected] = useState(false);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);

  const fetchGbpLocations = async () => {
    setGbpLoading(true);
    try {
      const res = await fetch('/api/gbp/locations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load Google locations');
      setGbpConnected(true);
      setGbpLocations(data.locations || []);
      // Auto-prefill when there's exactly one listing
      if ((data.locations || []).length === 1) {
        applyLocation(data.locations[0]);
      }
    } catch {
      // No GBP / token issue — user can still enter details manually
      setGbpConnected(false);
    } finally {
      setGbpLoading(false);
    }
  };

  // If the user already authenticated with Google (session has a provider
  // token), surface their GBP listings automatically.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) {
        fetchGbpLocations();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const handleConnectGoogle = async () => {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/oauth2callback?next=/dashboard/sites/new/jobsnaps`,
        scopes: 'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/webmasters.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (oauthError) setError(oauthError.message);
  };

  const applyLocation = async (loc: GbpLocation) => {
    setBusinessName(loc.name || '');
    setCity(loc.city || '');
    setState((loc.state || '').toUpperCase().slice(0, 2));
    setPhone(loc.phone || '');
    const matched = matchIndustry(loc.primaryCategory?.displayName);
    if (matched) setIndustry(matched);
    setImportedFrom(loc.name || 'Google Business Profile');

    // Persist the connection at the org level so the new workspace is auto-wired
    // for GBP publishing and a future "Add a New Site" reuses it.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/google/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: session?.provider_token,
          refreshToken: session?.provider_refresh_token,
          expiresIn: 3600,
          accountId: loc.accountId,
          accountName: loc.accountName,
          location: loc,
        }),
      });
    } catch {
      // Non-fatal — prefill already happened; publishing can be connected later.
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName: tier,
          siteData: { businessName, industry, city, state, phone },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || 'Failed to start checkout');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="Add Job Snaps" user={{ name: '', email: '' }} />

      {/* Full-width gradient hero */}
      <div className="border-b border-gray-100 bg-gradient-to-br from-[#00ef99]/10 via-cyan-50 to-violet-50">
        <div className="px-6 py-10 md:py-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[#00b478] shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Job Snaps
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Add Job Snaps for another business
          </h1>
          <p className="mt-3 max-w-2xl text-base text-gray-600 md:text-lg">
            Snap a photo of your work, AI writes the post, and it publishes to your website and
            Google Business Profile in one click. This adds a new workspace under your current
            account — works with any existing site (Next.js, WordPress, anywhere) and stays
            totally separate from your other sites.
          </p>
        </div>
      </div>

      <div className="px-6 py-8 w-full space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Tier picker ───────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Choose a tier</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {(Object.keys(TIER_INFO) as Tier[]).map((t) => {
                const info = TIER_INFO[t];
                const selected = tier === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    className={`text-left rounded-xl border-2 transition-all p-5 ${
                      selected
                        ? 'border-[#00ef99] bg-[#00ef99]/5 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {t === 'jobsnaps_pro' ? (
                          <Camera className="h-5 w-5 text-[#00ef99]" />
                        ) : (
                          <Sparkles className="h-5 w-5 text-violet-600" />
                        )}
                        <span className="font-semibold text-gray-900">{info.name}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selected
                            ? 'border-[#00ef99] bg-[#00ef99]'
                            : 'border-gray-300'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold text-gray-900">${info.price}</span>
                      <span className="text-sm text-gray-500">/mo</span>
                    </div>
                    <ul className="space-y-1.5">
                      {info.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                          <Check className="h-3.5 w-3.5 text-[#00ef99] mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Includes 14-day free trial. Cancel anytime.
            </p>
          </div>

          {/* ── Connect Google Business Profile (prefill + auto-wire publishing) ─ */}
          <Card className="border-[#00ef99]/30 bg-gradient-to-br from-[#00ef99]/5 via-cyan-50/40 to-violet-50/40">
            <CardContent className="p-5">
              <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-gray-900">Connect Google Business Profile</h2>
                <p className="text-sm text-gray-600">
                  Pull your business details straight from Google and auto-connect publishing —
                  so Job Snaps can post to your Google Business Profile without setting it up twice.
                </p>
              </div>

              {!gbpConnected && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 bg-white"
                  onClick={handleConnectGoogle}
                  disabled={gbpLoading}
                >
                  {gbpLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting…</>
                  ) : (
                    <>Connect Google Business Profile</>
                  )}
                </Button>
              )}

              {gbpLoading && gbpConnected && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your listings…
                </div>
              )}

              {gbpConnected && !gbpLoading && gbpLocations.length > 1 && (
                <div className="mt-4 space-y-2">
                  <Label>Pick the listing to import</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {gbpLocations.map((loc) => (
                      <button
                        key={loc.gbpLocationId || loc.name}
                        type="button"
                        onClick={() => applyLocation(loc)}
                        className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:border-[#00ef99] ${
                          importedFrom === loc.name ? 'border-[#00ef99] bg-white' : 'border-gray-200 bg-white/70'
                        }`}
                      >
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#00ef99]" />
                        <span>
                          <span className="font-medium text-gray-900">{loc.name}</span>
                          {(loc.city || loc.state) && (
                            <span className="block text-xs text-gray-500">
                              {[loc.city, loc.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gbpConnected && !gbpLoading && gbpLocations.length === 0 && (
                <p className="mt-4 text-sm text-gray-500">
                  No Google Business Profile found for this account — just enter your details below.
                </p>
              )}

              {importedFrom && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#00ef99]/10 px-3 py-2 text-sm text-[#00b478]">
                  <Check className="h-4 w-4" />
                  Imported from <strong>{importedFrom}</strong>. Review the details below.
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Business basics ──────────────────────────────── */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">About this business</h2>
              <p className="text-sm text-gray-500">
                Used to generate AI captions for the photos you upload.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  placeholder="e.g. Smith Plumbing of Austin"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select value={industry} onValueChange={setIndustry} required>
                    <SelectTrigger id="industry">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind}>
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="city">Primary Service Area City</Label>
                  <Input
                    id="city"
                    placeholder="Austin"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="TX"
                    maxLength={2}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Submit ────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard">Cancel</Link>
            </Button>
            <Button
              type="submit"
              size="lg"
              className="bg-black hover:bg-gray-800"
              disabled={loading || !industry}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting checkout...
                </>
              ) : (
                <>Continue to Checkout &rarr;</>
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            You&apos;ll be redirected to Stripe to enter payment details. Your card won&apos;t be
            charged until your 14-day trial ends.
          </p>
        </form>
      </div>
    </div>
  );
}
