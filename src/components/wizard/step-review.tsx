'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Tag,
  Globe,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function StepReview() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const {
    businessName,
    coreIndustry,
    locations,
    primaryCategory,
    secondaryCategories,
    websiteType,
    prevStep,
    reset,
  } = useWizardStore();

  const handleCreateSite = async () => {
    setIsCreating(true);
    setError(null);

    try {

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get user's profile and organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        throw new Error('Profile not found');
      }

      // Generate slug from business name
      const slug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Create the site
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .insert({
          organization_id: profile.organization_id,
          name: businessName,
          slug: slug,
          website_type: websiteType,
          is_active: true,
          settings: {
            core_industry: coreIndustry,
          },
        })
        .select()
        .single();

      if (siteError) throw siteError;

      // Create locations
      for (const location of locations) {
        const locationSlug = location.city
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');

        await supabase.from('locations').insert({
          site_id: site.id,
          name: location.name,
          slug: locationSlug,
          address_line1: location.address,
          city: location.city,
          state: location.state,
          zip_code: location.zipCode,
          phone: location.phone,
          is_primary: location.isPrimary,
          gbp_place_id: location.gbpPlaceId,
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }

      // Note: In production, you'd also insert categories into gbp_categories table
      // and link them via site_categories. For now, we store the IDs.

      // Reset wizard and redirect
      reset();
      router.push(`/dashboard/sites/${site.id}`);
    } catch (err) {
      console.error('Error creating site:', err);
      setError(err instanceof Error ? err.message : 'Failed to create site');
      setIsCreating(false);
    }
  };

  const websiteTypeLabels = {
    single_location: 'Single Location',
    multi_location: 'Multi-Location',
    microsite: 'Microsite (EMD)',
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
          Step 5 of 5
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">Review & Create</h2>
        <p className="mt-1 text-gray-500">
          Review your site configuration before we generate the structure.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Business Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-gray-500" />
              Business
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-gray-900">{businessName}</p>
            <p className="text-sm text-gray-500">{coreIndustry}</p>
          </CardContent>
        </Card>

        {/* Website Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-gray-500" />
              Website Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-gray-900">
              {websiteType ? websiteTypeLabels[websiteType] : '-'}
            </p>
            <p className="text-sm text-gray-500">
              {locations.length} location{locations.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Locations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-gray-500" />
            Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {locations.map((location, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{location.name}</p>
                  <p className="text-sm text-gray-500">
                    {location.city}, {location.state} {location.zipCode}
                  </p>
                </div>
                {location.isPrimary && (
                  <Badge variant="outline" className="text-emerald-600">
                    Primary
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-gray-500" />
            GBP Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-500">Primary Category</p>
            {primaryCategory && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                <Sparkles className="mr-1 h-3 w-3" />
                {primaryCategory.displayName}
              </Badge>
            )}
          </div>

          {/* Secondary */}
          {secondaryCategories.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-500">
                Secondary Categories ({secondaryCategories.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {secondaryCategories.map((category) => (
                  <Badge key={category.gcid} variant="outline">
                    {category.displayName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* What Happens Next */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="p-4">
          <h4 className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
            <CheckCircle2 className="h-5 w-5" />
            What happens next
          </h4>
          <ul className="space-y-2 text-sm text-emerald-800">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              We&apos;ll generate your GBP-first website structure based on your categories
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Location pages will be created with proper URL structure
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Service pages will be organized under their respective category silos
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              You can start adding Job Snaps to showcase your work
            </li>
          </ul>
        </CardContent>
      </Card>

      <Separator />

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={prevStep} disabled={isCreating}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleCreateSite}
          disabled={isCreating}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Site...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Create Site
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
