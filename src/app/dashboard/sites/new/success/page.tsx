'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/lib/supabase/client';

type PageStatus = 'loading' | 'success' | 'creating' | 'error';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('No session ID found. Please try again.');
      return;
    }

    // Clear the pending checkout from localStorage
    localStorage.removeItem('wizard_pending_checkout');

    // Poll for site creation status
    const checkSiteStatus = async () => {
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setStatus('error');
        setError('Please log in to view your site.');
        return;
      }

      // Check if subscription exists for this user (site creation happens via webhook)
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('id, site_id, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (subError) {
        console.error('Error checking subscription:', subError);
        return;
      }

      if (subscriptions && subscriptions.length > 0) {
        const subscription = subscriptions[0];

        if (subscription.site_id) {
          // Site is created
          setSiteId(subscription.site_id);
          setStatus('success');
          setProgress(100);
        } else {
          // Subscription exists but site not yet created (webhook still processing)
          setStatus('creating');
          setProgress((prev) => Math.min(prev + 10, 90));
        }
      } else {
        // No subscription yet - webhook may not have processed
        setStatus('creating');
        setProgress((prev) => Math.min(prev + 5, 50));
      }
    };

    // Initial check
    checkSiteStatus();

    // Poll every 2 seconds
    const interval = setInterval(() => {
      if (status !== 'success' && status !== 'error') {
        checkSiteStatus();
      }
    }, 2000);

    // Timeout after 2 minutes
    const timeout = setTimeout(() => {
      if (status === 'creating' || status === 'loading') {
        setStatus('error');
        setError('Site creation is taking longer than expected. Please check your dashboard in a few minutes.');
      }
    }, 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [sessionId, status]);

  // Redirect to site dashboard after success
  useEffect(() => {
    if (status === 'success' && siteId) {
      const timer = setTimeout(() => {
        router.push(`/dashboard/sites/${siteId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, siteId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-500" />
              <h1 className="mt-4 text-xl font-semibold text-gray-900">
                Verifying Payment...
              </h1>
              <p className="mt-2 text-gray-600">
                Please wait while we confirm your subscription.
              </p>
            </>
          )}

          {status === 'creating' && (
            <>
              <div className="relative mx-auto h-16 w-16">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <h1 className="mt-6 text-xl font-semibold text-gray-900">
                Creating Your Website
              </h1>
              <p className="mt-2 text-gray-600">
                We&apos;re setting up your site and generating SEO content...
              </p>
              <div className="mt-6">
                <Progress value={progress} className="h-2" />
                <p className="mt-2 text-sm text-gray-500">
                  This usually takes 30-60 seconds
                </p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h1 className="mt-6 text-xl font-semibold text-gray-900">
                Payment Successful!
              </h1>
              <p className="mt-2 text-gray-600">
                Your website has been created. Redirecting to your dashboard...
              </p>
              <div className="mt-6">
                <Progress value={100} className="h-2" />
              </div>
              <Button
                asChild
                className="mt-6 bg-emerald-500 hover:bg-emerald-600"
              >
                <Link href={`/dashboard/sites/${siteId}`}>
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h1 className="mt-6 text-xl font-semibold text-gray-900">
                Something Went Wrong
              </h1>
              <p className="mt-2 text-gray-600">
                {error || 'There was an issue creating your site.'}
              </p>
              <div className="mt-6 space-y-3">
                <Button
                  asChild
                  className="w-full bg-emerald-500 hover:bg-emerald-600"
                >
                  <Link href="/dashboard">
                    Go to Dashboard
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <Link href="/dashboard/sites/new">
                    Try Again
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-500" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Loading...
          </h1>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
