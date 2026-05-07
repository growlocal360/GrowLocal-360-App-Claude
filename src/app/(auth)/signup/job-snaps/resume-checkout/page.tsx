'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * Lands here after the user completed Google OAuth from the signup flow.
 * Reads the form data we stashed in sessionStorage before the redirect,
 * triggers Stripe Checkout, and redirects to Stripe.
 */
export default function ResumeCheckoutPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resumeCheckout() {
      try {
        const stashed = sessionStorage.getItem('jobsnaps_signup_data');
        if (!stashed) {
          setError(
            'Your signup session timed out. Please start signup again.'
          );
          return;
        }
        const formData = JSON.parse(stashed);
        sessionStorage.removeItem('jobsnaps_signup_data');

        const res = await fetch('/api/payments/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planName: 'jobsnaps_pro',
            siteData: formData,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.url) {
          setError(data.error || 'Failed to start checkout. Please try again.');
          return;
        }

        window.location.href = data.url;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error — please try again.');
      }
    }

    resumeCheckout();
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-red-50 p-3 w-14 h-14 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Checkout couldn&apos;t resume
            </CardTitle>
            <CardDescription className="mt-2">{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="bg-black hover:bg-gray-800">
              <Link href="/signup/job-snaps">Start Signup Again</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-[#00ef99]/10 p-3 w-14 h-14 flex items-center justify-center">
            <Loader2 className="h-7 w-7 text-[#00ef99] animate-spin" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Google connected — sending you to checkout
          </CardTitle>
          <CardDescription className="mt-2">
            Hang tight, we&apos;re preparing your 14-day free trial.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
