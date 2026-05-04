'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Sparkles, Globe, Zap, Check } from 'lucide-react';

/**
 * Sales card shown on the Job Snaps page when the user has no Job Snaps
 * subscription AND no GL360 site. CTA → standalone signup at /signup/job-snaps.
 */
export function GetStartedCard() {
  const features = [
    'Snap a photo, AI writes the title + description',
    'Push to your existing website (Next.js, WordPress, anywhere)',
    'Push to Google Business Profile automatically',
    'Unlimited Job Snaps, unlimited photos',
    'API + webhooks for instant site updates',
  ];

  return (
    <Card className="border-2 border-[#00ef99]/30 overflow-hidden">
      <CardContent className="p-0">
        <div className="grid md:grid-cols-2">
          {/* Left: copy + CTA */}
          <div className="p-8 md:p-10 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00ef99]/10 px-3 py-1 text-xs font-medium text-[#00ef99]">
              <Sparkles className="h-3.5 w-3.5" />
              Job Snaps Pro
            </div>

            <h2 className="text-3xl font-bold text-gray-900 leading-tight">
              Snap a photo of your work.
              <br />
              We&apos;ll handle the rest.
            </h2>

            <p className="text-gray-600">
              AI generates the title, description, and location &mdash; then publishes to your
              website and Google Business Profile in one click. Works with any website.
            </p>

            <div className="space-y-2">
              {features.map((f) => (
                <div key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="h-4 w-4 text-[#00ef99] mt-0.5 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">$37</span>
                <span className="text-gray-500">/month</span>
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                  14-day free trial
                </span>
              </div>

              <Button
                asChild
                size="lg"
                className="w-full bg-black hover:bg-gray-800 text-base"
              >
                <Link href="/signup/job-snaps">
                  Get Job Snaps Now &rarr;
                </Link>
              </Button>

              <p className="text-xs text-gray-500 text-center">
                Cancel anytime. No charge during trial.
              </p>
            </div>
          </div>

          {/* Right: visual */}
          <div className="bg-gradient-to-br from-[#00ef99]/5 via-cyan-50 to-violet-50 p-8 md:p-10 flex items-center justify-center">
            <div className="space-y-4 max-w-sm">
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white shadow-sm mx-auto">
                <Camera className="h-10 w-10 text-[#00ef99]" />
              </div>
              <div className="space-y-3">
                <Card className="p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#00ef99]/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-[#00ef99]" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">AI-Generated Content</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Titles, descriptions, alt text &mdash; written from the photo
                      </div>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0">
                      <Globe className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Push Anywhere</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Your website + GBP &mdash; same one click
                      </div>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                      <Zap className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Instant Updates</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Webhooks trigger ISR rebuilds &mdash; live in seconds
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
