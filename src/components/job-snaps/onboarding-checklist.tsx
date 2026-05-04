'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Camera, Globe, Code2, Sparkles } from 'lucide-react';

interface OnboardingChecklistProps {
  hasSnaps: boolean;
  hasGbpConnection?: boolean;
  hasApiKey?: boolean;
  onConnectClick?: () => void;
}

/**
 * Lightweight onboarding checklist shown on the Job Snaps dashboard
 * for new users (or any user with zero snaps + no integrations set up).
 * Each item is optional — they can use Job Snaps without any of them.
 */
export function OnboardingChecklist({
  hasSnaps,
  hasGbpConnection,
  hasApiKey,
  onConnectClick,
}: OnboardingChecklistProps) {
  const items = [
    {
      id: 'account',
      label: 'Account created',
      done: true,
      cta: null,
    },
    {
      id: 'first-snap',
      label: 'Take your first Job Snap',
      done: hasSnaps,
      cta: hasSnaps ? null : (
        <Button asChild size="sm" className="bg-black hover:bg-gray-800">
          <Link href="/dashboard/job-snaps/new">
            <Camera className="h-4 w-4 mr-2" />
            Upload a photo
          </Link>
        </Button>
      ),
      icon: Camera,
    },
    {
      id: 'gbp',
      label: 'Connect Google Business Profile',
      sublabel: 'Auto-post snaps to GBP',
      done: !!hasGbpConnection,
      cta: hasGbpConnection ? null : (
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/sites">Connect</Link>
        </Button>
      ),
      icon: Globe,
    },
    {
      id: 'website',
      label: 'Connect your website',
      sublabel: 'Display snaps on Next.js, WordPress, or any site',
      done: !!hasApiKey,
      cta: hasApiKey ? null : (
        <Button variant="outline" size="sm" onClick={onConnectClick}>
          <Code2 className="h-4 w-4 mr-2" />
          Show me how
        </Button>
      ),
      icon: Code2,
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;

  if (completedCount === totalCount) return null;

  return (
    <Card className="border-2 border-[#00ef99]/20 bg-gradient-to-br from-[#00ef99]/[0.03] to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#00ef99]" />
            <h3 className="font-semibold text-gray-900">Welcome! Let&apos;s get you set up</h3>
          </div>
          <span className="text-sm text-gray-500">
            {completedCount}/{totalCount} complete
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white border"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  item.done ? 'bg-[#00ef99]/15' : 'bg-gray-100'
                }`}
              >
                {item.done ? (
                  <Check className="h-4 w-4 text-[#00ef99]" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                )}
              </div>
              <div className="min-w-0">
                <div
                  className={`text-sm font-medium ${
                    item.done ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}
                >
                  {item.label}
                </div>
                {item.sublabel && !item.done && (
                  <div className="text-xs text-gray-500 mt-0.5">{item.sublabel}</div>
                )}
              </div>
            </div>
            {item.cta && <div className="shrink-0">{item.cta}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
