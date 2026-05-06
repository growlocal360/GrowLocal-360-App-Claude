'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
} from 'lucide-react';

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

      <div className="p-6 max-w-3xl mx-auto w-full space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Job Snaps for another business</h1>
          <p className="text-gray-500 mt-1">
            Adds a new Job Snaps workspace under your current account. Use it for an existing
            website (Next.js, WordPress, anywhere) — totally separate from your other sites.
          </p>
        </div>

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
