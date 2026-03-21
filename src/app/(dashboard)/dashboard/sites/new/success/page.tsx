'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  RefreshCw,
  Building2,
  Users,
  MessageSquare,
  MapPin,
  ChevronRight,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import type { SiteStatus, SiteBuildProgress } from '@/types/database';

type PageStatus = 'loading' | 'building' | 'success' | 'error';

interface SiteData {
  id: string;
  name: string;
  status: SiteStatus;
  build_progress: SiteBuildProgress | null;
  status_message: string | null;
  status_updated_at: string | null;
}

const TONE_OPTIONS = [
  'Professional',
  'Friendly',
  'Authoritative',
  'Casual',
  'Technical',
  'Warm',
  'Confident',
  'Approachable',
];

const ONBOARDING_STEPS = [
  { id: 'about', label: 'About', icon: Building2 },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'voice', label: 'Voice', icon: MessageSquare },
  { id: 'local', label: 'Local', icon: MapPin },
];

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

function getTimeEstimate(buildProgress: SiteBuildProgress | null): string {
  const total = buildProgress?.total_tasks || 0;
  if (total >= 50) return '5-10 minutes';
  if (total >= 20) return '3-5 minutes';
  return '1-2 minutes';
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
  const [buildStalled, setBuildStalled] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [businessDescription, setBusinessDescription] = useState('');
  const [credentials, setCredentials] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [pointOfView, setPointOfView] = useState('');
  const [toneValues, setToneValues] = useState<string[]>([]);
  const [localDetails, setLocalDetails] = useState('');
  const [generatingLocal, setGeneratingLocal] = useState(false);

  const sessionId = searchParams.get('session_id');

  // Auto-save onboarding data
  const saveOnboardingData = useCallback(async () => {
    if (!siteData?.id) return;
    setSaving(true);
    try {
      await fetch(`/api/sites/${siteData.id}/settings/onboarding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessDescription: businessDescription || undefined,
          credentials: credentials || undefined,
          targetAudience: targetAudience || undefined,
          pointOfView: pointOfView || undefined,
          toneValues: toneValues.length > 0 ? toneValues : undefined,
          localDetails: localDetails || undefined,
        }),
      });
    } catch (err) {
      console.error('Failed to save onboarding data:', err);
    }
    setSaving(false);
  }, [siteData?.id, businessDescription, credentials, targetAudience, pointOfView, toneValues, localDetails]);

  // Auto-generate local details
  const handleGenerateLocal = async () => {
    if (!siteData?.id) return;
    setGeneratingLocal(true);
    try {
      const res = await fetch(`/api/sites/${siteData.id}/settings/local-details/generate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.localDetails) {
        setLocalDetails(data.localDetails);
      }
    } catch (err) {
      console.error('Failed to generate local details:', err);
    }
    setGeneratingLocal(false);
  };

  const toggleTone = (tone: string) => {
    setToneValues((prev) =>
      prev.includes(tone)
        ? prev.filter((t) => t !== tone)
        : [...prev, tone]
    );
  };

  const handleNext = async () => {
    await saveOnboardingData();
    if (onboardingStep < ONBOARDING_STEPS.length - 1) {
      setOnboardingStep((s) => s + 1);
    } else {
      setOnboardingComplete(true);
    }
  };

  const handleBack = () => {
    if (onboardingStep > 0) {
      setOnboardingStep((s) => s - 1);
    }
  };

  // Polling logic (same as before)
  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('No session ID found. Please try again.');
      return;
    }

    localStorage.removeItem('wizard_pending_checkout');

    const checkSiteStatus = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setStatus('error');
        setError('Please log in to view your site.');
        return;
      }

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
          const { data: site } = await supabase
            .from('sites')
            .select('id, name, status, build_progress, status_message, status_updated_at')
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

              if (site.status_updated_at) {
                const lastUpdate = new Date(site.status_updated_at).getTime();
                const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
                setBuildStalled(lastUpdate < threeMinutesAgo);
              }
            } else {
              setStatus('building');
              setProgress(5);
              setProgressMessage('Starting build process...');
            }
          }
        } else {
          setStatus('building');
          setProgress(2);
          setProgressMessage('Creating your site...');
        }
      } else {
        setStatus('loading');
        setProgress(0);
        setProgressMessage('Verifying payment...');
      }
    };

    checkSiteStatus();

    const interval = setInterval(() => {
      if (status !== 'success' && status !== 'error') {
        checkSiteStatus();
      }
    }, 2000);

    const hintTimeout = setTimeout(() => {
      setShowDashboardHint(true);
    }, 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(hintTimeout);
    };
  }, [sessionId, status]);

  const handleRetryBuild = async () => {
    if (!siteData) return;
    setRetrying(true);
    setBuildStalled(false);
    try {
      await fetch(`/api/sites/${siteData.id}/retry-build`, { method: 'POST' });
    } catch (err) {
      console.error('Retry build failed:', err);
    }
    setRetrying(false);
  };

  // Redirect to site dashboard after success (with delay for onboarding)
  useEffect(() => {
    if (status === 'success' && siteData && onboardingComplete) {
      const timer = setTimeout(() => {
        router.push(`/dashboard/sites/${siteData.id}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, siteData, onboardingComplete, router]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#00ef99]" />
            <h1 className="mt-4 text-xl font-semibold text-gray-900">
              Verifying Payment...
            </h1>
            <p className="mt-2 text-gray-600">
              Please wait while we confirm your subscription.
            </p>
            {showDashboardHint && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <p className="mb-4 text-sm text-gray-500">
                  Taking longer than expected? Your payment was successful. The site will appear in your dashboard shortly.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard/sites">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Go to Dashboard
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
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
              <Button asChild className="w-full bg-black hover:bg-gray-800">
                <Link href={siteData ? `/dashboard/sites/${siteData.id}` : '/dashboard/sites'}>
                  {siteData ? 'Go to Site Dashboard' : 'Go to Dashboard'}
                </Link>
              </Button>
              {!siteData && (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard/sites/new">Try Again</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state (build complete)
  if (status === 'success' && siteData) {
    // If onboarding was filled, show "Refresh Content" option
    const hasOnboardingData = businessDescription || credentials || targetAudience || toneValues.length > 0 || localDetails;

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#00ef99]/10">
              <CheckCircle2 className="h-10 w-10 text-[#00ef99]" />
            </div>
            <h1 className="mt-6 text-xl font-semibold text-gray-900">
              Your Website is Ready!
            </h1>
            <p className="mt-2 text-gray-600">
              <span className="font-medium">{siteData.name}</span> has been created successfully.
            </p>
            <div className="mt-6">
              <Progress value={100} className="h-2" />
            </div>

            {hasOnboardingData && !onboardingComplete && (
              <div className="mt-6 rounded-lg border border-[#00ef99]/30 bg-[#00ef99]/5 p-4">
                <p className="text-sm text-gray-700">
                  Your business details have been saved. Regenerate your site to update the content with your personalized voice and details.
                </p>
                <Button
                  onClick={async () => {
                    await saveOnboardingData();
                    router.push(`/dashboard/sites/${siteData.id}`);
                  }}
                  className="mt-3 w-full bg-[#00ef99] text-white hover:bg-[#00c4ad]"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Go to Dashboard & Regenerate
                </Button>
              </div>
            )}

            <Button
              asChild
              className={hasOnboardingData && !onboardingComplete ? 'mt-3 w-full' : 'mt-6 w-full bg-black hover:bg-gray-800'}
              variant={hasOnboardingData && !onboardingComplete ? 'outline' : 'default'}
            >
              <Link href={`/dashboard/sites/${siteData.id}`}>
                Go to Site Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Building state — main view with onboarding
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl space-y-4">
        {/* Build Progress Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12 shrink-0">
                <div className="absolute inset-0 animate-ping rounded-full bg-[#00ef99]/10" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#00ef99]">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-gray-900">
                  Building Your Website
                </h1>
                <p className="truncate text-sm text-gray-500">
                  {progressMessage}
                </p>
              </div>
              <span className="text-lg font-bold text-[#00ef99]">{progress}%</span>
            </div>
            <Progress value={progress} className="mt-4 h-2" />
            <p className="mt-2 text-xs text-gray-400">
              Estimated: {getTimeEstimate(siteData?.build_progress ?? null)}
            </p>

            {buildStalled && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-700">Build may have stalled.</p>
                <Button
                  onClick={handleRetryBuild}
                  disabled={retrying}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  {retrying ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                  Retry Build
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Onboarding Questionnaire Card */}
        {!onboardingComplete ? (
          <Card>
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  While you wait, personalize your site
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  These details help us create better, more relevant content for your business. Takes about 2 minutes.
                </p>
              </div>

              {/* Step indicators */}
              <div className="mb-6 flex items-center justify-center gap-1">
                {ONBOARDING_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const isActive = i === onboardingStep;
                  const isDone = i < onboardingStep;
                  return (
                    <button
                      key={step.id}
                      onClick={() => { if (isDone) setOnboardingStep(i); }}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-[#00ef99] text-white'
                          : isDone
                          ? 'cursor-pointer bg-[#00ef99]/10 text-[#00ef99]'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                      {step.label}
                    </button>
                  );
                })}
              </div>

              {/* Step 1: About Your Business */}
              {onboardingStep === 0 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="businessDescription" className="text-sm font-medium">
                      What does your business do? What makes you different?
                    </Label>
                    <Textarea
                      id="businessDescription"
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      placeholder="e.g., We're a family-owned HVAC company serving Lake Charles since 2005. We specialize in emergency repairs and are known for same-day service."
                      rows={3}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="credentials" className="text-sm font-medium">
                      Licenses, certifications, or years in business?
                    </Label>
                    <Input
                      id="credentials"
                      value={credentials}
                      onChange={(e) => setCredentials(e.target.value)}
                      placeholder="e.g., EPA certified, NATE certified, 20+ years experience, BBB A+ rated"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Your Customers */}
              {onboardingStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="targetAudience" className="text-sm font-medium">
                      Who are your ideal customers?
                    </Label>
                    <Input
                      id="targetAudience"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="e.g., Homeowners, property managers, small businesses, new construction"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">
                      How should we write your content?
                    </Label>
                    <Select value={pointOfView} onValueChange={setPointOfView}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select a writing style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first_person_plural">We / Our / Us (most common)</SelectItem>
                        <SelectItem value="first_person_singular">I / My / Me (solo operator)</SelectItem>
                        <SelectItem value="third_person">The Company / They (formal)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Step 3: Voice & Tone */}
              {onboardingStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">
                      What tone should your website have? (Select all that apply)
                    </Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {TONE_OPTIONS.map((tone) => (
                        <Badge
                          key={tone}
                          variant={toneValues.includes(tone) ? 'default' : 'outline'}
                          className={`cursor-pointer px-3 py-1.5 text-sm transition-colors ${
                            toneValues.includes(tone)
                              ? 'bg-[#00ef99] text-white hover:bg-[#00c4ad]'
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() => toggleTone(tone)}
                        >
                          {tone}
                        </Badge>
                      ))}
                    </div>
                    {toneValues.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500">
                        Selected: {toneValues.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Local Context */}
              {onboardingStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="localDetails" className="text-sm font-medium">
                        Local area context for your content
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateLocal}
                        disabled={generatingLocal || !siteData?.id}
                        className="text-xs"
                      >
                        {generatingLocal ? (
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="mr-1.5 h-3 w-3" />
                        )}
                        Auto-Generate
                      </Button>
                    </div>
                    <Textarea
                      id="localDetails"
                      value={localDetails}
                      onChange={(e) => setLocalDetails(e.target.value)}
                      placeholder="Climate, regional factors, local landmarks, housing styles, community details that affect your services..."
                      rows={5}
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Click &quot;Auto-Generate&quot; to have AI create local context based on your service areas, or write your own.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="mt-6 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={onboardingStep === 0}
                  className={onboardingStep === 0 ? 'invisible' : ''}
                >
                  Back
                </Button>

                <div className="flex items-center gap-2">
                  {saving && (
                    <span className="text-xs text-gray-400">Saving...</span>
                  )}
                  <Button
                    onClick={handleNext}
                    disabled={saving}
                    className="bg-[#00ef99] text-white hover:bg-[#00c4ad]"
                  >
                    {onboardingStep === ONBOARDING_STEPS.length - 1 ? (
                      <>
                        Finish
                        <CheckCircle2 className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Skip link */}
              <div className="mt-4 text-center">
                <button
                  onClick={() => setOnboardingComplete(true)}
                  className="text-xs text-gray-400 underline hover:text-gray-600"
                >
                  Skip for now — I&apos;ll fill this in later
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Onboarding completed summary */
          <Card className="border-[#00ef99]/30 bg-[#00ef99]/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-[#00ef99]" />
                <div>
                  <h3 className="font-semibold text-gray-900">Business details saved!</h3>
                  <p className="text-sm text-gray-600">
                    {status === 'building'
                      ? 'Your personalized details will enhance the next content refresh.'
                      : 'Regenerate your site from the dashboard to update content with your details.'}
                  </p>
                </div>
              </div>
              {status === 'success' && siteData && (
                <Button
                  asChild
                  className="mt-4 w-full bg-[#00ef99] text-white hover:bg-[#00c4ad]"
                >
                  <Link href={`/dashboard/sites/${siteData.id}`}>
                    Go to Site Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dashboard link */}
        <div className="text-center">
          <Button asChild variant="ghost" size="sm" className="text-gray-400">
            <Link href="/dashboard/sites">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#00ef99]" />
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
