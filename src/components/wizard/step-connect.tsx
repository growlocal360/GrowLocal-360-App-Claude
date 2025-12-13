'use client';

import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Link2, PenLine } from 'lucide-react';

export function StepConnect() {
  const { setConnectionType, nextStep, connectionType } = useWizardStore();

  const handleGoogleConnect = async () => {
    setConnectionType('google');
    // TODO: Implement Google OAuth flow for GBP
    // For now, we'll simulate the connection
    nextStep();
  };

  const handleManualEntry = () => {
    setConnectionType('manual');
    nextStep();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Import from Google Business Profile
        </h2>
        <p className="mt-2 text-gray-500">
          We&apos;ll import your business details, photos, and hours to build your website automatically.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Google Connect Option */}
        <Card
          className={`cursor-pointer transition-all hover:border-emerald-300 hover:shadow-md ${
            connectionType === 'google' ? 'border-emerald-500 ring-2 ring-emerald-200' : ''
          }`}
          onClick={handleGoogleConnect}
        >
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <svg className="h-8 w-8" viewBox="0 0 24 24">
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
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Connect Google Account
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Import categories, locations, photos, reviews, and hours automatically
            </p>
            <Button className="mt-4 w-full bg-blue-500 hover:bg-blue-600">
              <Link2 className="mr-2 h-4 w-4" />
              Connect Google Business
            </Button>
          </CardContent>
        </Card>

        {/* Manual Entry Option */}
        <Card
          className={`cursor-pointer transition-all hover:border-emerald-300 hover:shadow-md ${
            connectionType === 'manual' ? 'border-emerald-500 ring-2 ring-emerald-200' : ''
          }`}
          onClick={handleManualEntry}
        >
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <PenLine className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Add Manually
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              No Google Profile? We&apos;ll help you pick categories and set up your site structure
            </p>
            <Button variant="outline" className="mt-4 w-full">
              <ArrowRight className="mr-2 h-4 w-4" />
              Start Fresh
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-sm text-gray-400">
        You can always connect your Google Business Profile later
      </p>
    </div>
  );
}
