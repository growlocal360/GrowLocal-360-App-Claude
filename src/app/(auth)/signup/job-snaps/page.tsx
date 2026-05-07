'use client';

import { Suspense, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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

export default function JobSnapsSignupPage() {
  return (
    <Suspense>
      <JobSnapsSignupForm />
    </Suspense>
  );
}

function JobSnapsSignupForm() {
  const supabase = useMemo(() => createClient(), []);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'verify' | 'choose-google'>('form');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 1. Sign up the user
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/oauth2callback?redirect=${encodeURIComponent(
          `/signup/job-snaps/checkout?business=${encodeURIComponent(businessName)}&industry=${encodeURIComponent(industry)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&phone=${encodeURIComponent(phone)}`
        )}`,
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    // If we already have a session (auto-confirm enabled), offer the optional
    // Google connect step before checkout. They can connect now or skip.
    if (data.session) {
      setStep('choose-google');
      setLoading(false);
      return;
    }

    // Otherwise show "check your email" state
    setStep('verify');
    setLoading(false);
  };

  const handleConnectGoogle = async () => {
    setLoading(true);
    setError('');

    // Stash the form data so resume-checkout can pick it up after OAuth round-trip.
    sessionStorage.setItem(
      'jobsnaps_signup_data',
      JSON.stringify({ businessName, industry, city, state, phone })
    );

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes:
          'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/webmasters.readonly',
        redirectTo: `${window.location.origin}/oauth2callback?redirect=${encodeURIComponent(
          '/signup/job-snaps/resume-checkout'
        )}`,
        queryParams: {
          prompt: 'consent',
          access_type: 'offline',
        },
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
    // No further action — Google OAuth navigates away from this page.
  };

  const goToCheckout = async () => {
    try {
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName: 'jobsnaps_pro',
          siteData: {
            // Webhook reads these from session metadata
            businessName,
            industry,
            city,
            state,
            phone,
          },
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

  if (step === 'verify') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-[#00ef99]/10 p-3 w-14 h-14 flex items-center justify-center">
              <Check className="h-7 w-7 text-[#00ef99]" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Check your email
            </CardTitle>
            <CardDescription>
              We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click the link
              to verify your account &mdash; we&apos;ll then take you to checkout to start
              your 14-day free trial.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" asChild>
              <Link href="/login">Back to Login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (step === 'choose-google') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              Where do you want your snaps to go?
            </CardTitle>
            <CardDescription className="mt-2">
              Job Snaps pushes to your existing website automatically &mdash; that&apos;s
              included. Optionally connect Google Business Profile to also auto-post snaps to
              your GBP. You can do this later from your dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <Button
              onClick={handleConnectGoogle}
              disabled={loading}
              variant="outline"
              size="lg"
              className="w-full justify-start text-left h-auto py-4"
            >
              <svg className="mr-3 h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Connect Google</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Auto-post snaps to your Google Business Profile
                </div>
              </div>
            </Button>

            <Button
              onClick={goToCheckout}
              disabled={loading}
              variant="outline"
              size="lg"
              className="w-full justify-start text-left h-auto py-4"
            >
              {loading ? (
                <Loader2 className="mr-3 h-5 w-5 shrink-0 animate-spin" />
              ) : (
                <Camera className="mr-3 h-5 w-5 text-gray-700 shrink-0" />
              )}
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Continue without Google</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Push snaps to your website only — connect Google later anytime
                </div>
              </div>
            </Button>

            <p className="text-xs text-center text-gray-500 pt-2">
              Either option starts your 14-day free trial. You won&apos;t be charged today.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center gap-2">
            <Image
              src="/grow-local-360-logo-black.svg"
              alt="GrowLocal360"
              width={160}
              height={28}
              priority
            />
            <span className="text-gray-300">×</span>
            <div className="flex items-center gap-1.5">
              <Camera className="h-5 w-5 text-[#00ef99]" />
              <span className="font-bold text-gray-900">Job Snaps</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Start your 14-day free trial
          </CardTitle>
          <CardDescription>
            $37/mo after trial &mdash; cancel anytime. No card charged today if you cancel
            before day 14.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            {/* Account fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Your Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <p className="text-xs text-gray-500">Minimum 8 characters</p>
            </div>

            {/* Business fields */}
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">About Your Business</h3>

              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  placeholder="Smith Plumbing"
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
            </div>

            <Button
              type="submit"
              className="w-full bg-black hover:bg-gray-800"
              disabled={loading || !industry}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Continue to Checkout'
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              You&apos;ll be redirected to Stripe to enter your payment details. Your card
              won&apos;t be charged until your 14-day trial ends.
            </p>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-[#00ef99] hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
