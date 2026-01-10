'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, AlertCircle, ArrowRight, Sparkles, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/lib/supabase/client';
import type { SiteStatus, SiteBuildProgress } from '@/types/database';

type PageStatus = 'loading' | 'building' | 'success' | 'error';

interface SiteData {
  id: string;
  name: string;
  status: SiteStatus;
  build_progress: SiteBuildProgress | null;
  status_message: string | null;
}

function getProgressPercentage(buildProgress: SiteBuildProgress | null): number {
  if (!buildProgress) return 5;
  const { total_tasks, completed_tasks } = buildProgress;
  if (total_tasks === 0) return 10;
  return Math.round((completed_tasks / total_tasks) * 100);
}

function getProgressMessage(buildProgress: SiteBuildProgress | null): string {
  if (!buildProgress) return 'Initializing...';
  const { current_task, completed_tasks, total_tasks } = buildProgress;

  if (current_task) {
    return `${current_task} (${completed_tasks}/${total_tasks})`;
  }

  return `Building your website (${completed_tasks}/${total_tasks})...`;
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Verifying payment...');
  const [showDashboardHint, setShowDashboardHint] = useState(false);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('No session ID found. Please try again.');
      return;
    }

    // Clear the pending checkout from localStorage
    localStorage.removeItem('wizard_pending_checkout');

    // Poll for site creation and build status
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
          // Site exists - check its build status
          const { data: site } = await supabase
            .from('sites')
            .select('id, name, status, build_progress, status_message')
            .eq('id', subscription.site_id)
            .single();

          if (site) {
            setSiteData(site as SiteData);

            if (site.status === 'active') {
              setStatus('success');
              setProgress(100);
              setProgressMessage('Your website is ready!');
            } else if (site.status === 'failed') {
              setStatus('error');
              setError(site.status_message || 'There was an error building your site. You can retry from the dashboard.');
            } else if (site.status === 'building') {
              setStatus('building');
              const buildProgress = site.build_progress as SiteBuildProgress | null;
              setProgress(getProgressPercentage(buildProgress));
              setProgressMessage(getProgressMessage(buildProgress));
            } else {
              // Pending or other status
              setStatus('building');
              setProgress(5);
              setProgressMessage('Starting build process...');
            }
          }
        } else {
          // Subscription exists but site not yet created (webhook still processing)
          setStatus('building');
          setProgress(2);
          setProgressMessage('Creating your site...');
        }
      } else {
        // No subscription yet - webhook may not have processed
        setStatus('loading');
        setProgress(0);
        setProgressMessage('Verifying payment...');
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

    // Show dashboard hint after 15 seconds (7-8 polls)
    const hintTimeout = setTimeout(() => {
      setShowDashboardHint(true);
    }, 15000);

    // Timeout after 5 minutes (content generation can take up to 5 min)
    const timeout = setTimeout(() => {
      if (status === 'building' || status === 'loading') {
        // Don't error - just suggest checking dashboard
        setProgressMessage('This is taking a while. Feel free to check your dashboard.');
      }
    }, 300000);

    return () => {
      clearInterval(interval);
      clearTimeout(hintTimeout);
      clearTimeout(timeout);
    };
  }, [sessionId, status]);

  // Redirect to site dashboard after success
  useEffect(() => {
    if (status === 'success' && siteData) {
      const timer = setTimeout(() => {
        router.push(`/dashboard/sites/${siteData.id}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, siteData, router]);

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
              {showDashboardHint && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="text-sm text-gray-500 mb-4">
                    Taking longer than expected? Your payment was successful. The site will appear in your dashboard shortly.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                  >
                    <Link href="/dashboard/sites">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Go to Dashboard
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}

          {status === 'building' && (
            <>
              <div className="relative mx-auto h-16 w-16">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <h1 className="mt-6 text-xl font-semibold text-gray-900">
                Building Your Website
              </h1>
              <p className="mt-2 text-gray-600">
                {progressMessage}
              </p>
              <div className="mt-6">
                <Progress value={progress} className="h-2" />
                <p className="mt-2 text-sm text-gray-500">
                  This typically takes 2-3 minutes
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-4">
                  Your site will continue building in the background. Feel free to explore your dashboard while you wait.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <Link href="/dashboard/sites">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Go to Dashboard
                  </Link>
                </Button>
              </div>
            </>
          )}

          {status === 'success' && siteData && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h1 className="mt-6 text-xl font-semibold text-gray-900">
                Your Website is Ready!
              </h1>
              <p className="mt-2 text-gray-600">
                <span className="font-medium">{siteData.name}</span> has been created successfully. Redirecting to your dashboard...
              </p>
              <div className="mt-6">
                <Progress value={100} className="h-2" />
              </div>
              <Button
                asChild
                className="mt-6 bg-emerald-500 hover:bg-emerald-600"
              >
                <Link href={`/dashboard/sites/${siteData.id}`}>
                  Go to Site Dashboard
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
                  <Link href={siteData ? `/dashboard/sites/${siteData.id}` : '/dashboard/sites'}>
                    {siteData ? 'Go to Site Dashboard' : 'Go to Dashboard'}
                  </Link>
                </Button>
                {!siteData && (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                  >
                    <Link href="/dashboard/sites/new">
                      Try Again
                    </Link>
                  </Button>
                )}
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
