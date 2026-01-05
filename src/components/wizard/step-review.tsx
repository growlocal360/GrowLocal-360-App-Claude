'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Tag,
  Globe,
  CheckCircle2,
  Loader2,
  Sparkles,
  Map,
  Home,
  Wrench,
  CreditCard,
  Circle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  useContentGeneration,
  type GeneratedContent,
  type CategoryInput,
} from '@/lib/hooks/use-content-generation';
import { PlanSelectionModal } from '@/components/payments/plan-selection-modal';
import type { PlanName } from '@/lib/stripe';

type CreationStep =
  | 'idle'
  | 'creating_site'
  | 'saving_locations'
  | 'saving_categories'
  | 'saving_services'
  | 'generating_content'
  | 'saving_content'
  | 'complete';

export function StepReview() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [creationStep, setCreationStep] = useState<CreationStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const { progress, generateContent } = useContentGeneration();

  const {
    businessName,
    coreIndustry,
    locations,
    primaryCategory,
    secondaryCategories,
    services,
    serviceAreas,
    neighborhoods,
    websiteType,
    prevStep,
    reset,
  } = useWizardStore();

  // Open plan selection modal when user clicks "Create Site"
  const handleCreateSite = () => {
    setError(null);
    setShowPlanModal(true);
  };

  // Handle plan selection - create checkout session and redirect to Stripe
  const handlePlanSelected = async (planName: PlanName) => {
    try {
      // Prepare site data for checkout
      const siteData = {
        businessName,
        coreIndustry,
        websiteType,
        locations: locations.map((loc) => ({
          id: loc.id,
          name: loc.name,
          address: loc.address,
          city: loc.city,
          state: loc.state,
          zipCode: loc.zipCode,
          phone: loc.phone,
          isPrimary: loc.isPrimary,
          gbpPlaceId: loc.gbpPlaceId,
          latitude: loc.latitude,
          longitude: loc.longitude,
        })),
        primaryCategory: primaryCategory ? {
          gcid: primaryCategory.gcid,
          name: primaryCategory.name,
          displayName: primaryCategory.displayName,
          commonServices: primaryCategory.commonServices,
        } : null,
        secondaryCategories: secondaryCategories.map((cat) => ({
          gcid: cat.gcid,
          name: cat.name,
          displayName: cat.displayName,
          commonServices: cat.commonServices,
        })),
        services: services.filter((s) => s.isSelected).map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          description: s.description,
          categoryGcid: s.categoryGcid,
          categoryName: s.categoryName,
          isSelected: true,
          sortOrder: s.sortOrder,
        })),
        serviceAreas: serviceAreas.map((area) => ({
          id: area.id,
          name: area.name,
          state: area.state,
          placeId: area.placeId,
          distanceMiles: area.distanceMiles,
          isCustom: area.isCustom,
        })),
        neighborhoods: neighborhoods.map((n) => ({
          id: n.id,
          name: n.name,
          locationId: n.locationId,
          placeId: n.placeId,
          latitude: n.latitude,
          longitude: n.longitude,
        })),
      };

      // Create Stripe checkout session
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          siteData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      // Store wizard state in localStorage before redirect (for recovery if needed)
      localStorage.setItem('wizard_pending_checkout', JSON.stringify({
        planName,
        timestamp: Date.now(),
      }));

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err instanceof Error ? err.message : 'Failed to create checkout session');
      setShowPlanModal(false);
    }
  };

  // Legacy direct creation (keep for development/testing - can be removed later)
  const handleDirectCreateSite = async () => {
    setIsCreating(true);
    setCreationStep('creating_site');
    setError(null);

    try {
      // Create supabase client inside handler to avoid hydration issues
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get user's profile and organization
      let { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      // If profile doesn't exist, create organization and profile
      // (handles users who signed up before trigger was set up)
      if (!profile) {
        // Generate org ID client-side to avoid needing SELECT after INSERT
        const orgId = crypto.randomUUID();
        const orgSlug = (user.user_metadata?.full_name || user.email?.split('@')[0] || 'user')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 8);

        // Create organization (without .select() to avoid RLS SELECT check)
        const { error: orgError } = await supabase
          .from('organizations')
          .insert({
            id: orgId,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'My Organization',
            slug: orgSlug,
          });

        if (orgError) {
          console.error('Error creating organization:', orgError);
          throw new Error(`Failed to create organization: ${orgError.message || orgError.code || JSON.stringify(orgError)}`);
        }

        // Create profile (without .select() to avoid RLS SELECT check)
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            organization_id: orgId,
            role: 'admin',
            full_name: user.user_metadata?.full_name,
            avatar_url: user.user_metadata?.avatar_url,
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          throw new Error('Failed to create profile. Please contact support.');
        }

        profile = { organization_id: orgId };
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
          template_id: 'local-service-pro',
          is_active: true,
          settings: {
            core_industry: coreIndustry,
          },
        })
        .select()
        .single();

      if (siteError) throw siteError;

      // Create locations
      setCreationStep('saving_locations');
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

      // Create service areas
      for (let i = 0; i < serviceAreas.length; i++) {
        const area = serviceAreas[i];
        const areaSlug = area.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        await supabase.from('service_areas').insert({
          site_id: site.id,
          name: area.name,
          slug: areaSlug,
          state: area.state || null,
          place_id: area.placeId || null,
          distance_miles: area.distanceMiles || null,
          is_custom: area.isCustom || false,
          sort_order: i,
        });
      }

      // Create neighborhoods (linked to their parent locations)
      // First, we need to get the created location IDs
      const { data: createdLocations } = await supabase
        .from('locations')
        .select('id, city')
        .eq('site_id', site.id);

      const locationIdMap: Record<string, string> = {};
      createdLocations?.forEach((loc) => {
        // Map by city name (lowercase) to handle matching
        locationIdMap[loc.city.toLowerCase()] = loc.id;
      });

      for (let i = 0; i < neighborhoods.length; i++) {
        const neighborhood = neighborhoods[i];
        const neighborhoodSlug = neighborhood.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        // Find the parent location ID
        // The neighborhood.locationId from wizard is like "loc-0" or the actual location id
        // We need to map it to the actual created location
        const wizardLocation = locations.find((loc, idx) =>
          (loc.id || `loc-${idx}`) === neighborhood.locationId
        );

        const dbLocationId = wizardLocation
          ? locationIdMap[wizardLocation.city.toLowerCase()]
          : null;

        if (dbLocationId) {
          await supabase.from('neighborhoods').insert({
            site_id: site.id,
            location_id: dbLocationId,
            name: neighborhood.name,
            slug: neighborhoodSlug,
            place_id: neighborhood.placeId || null,
            latitude: neighborhood.latitude || null,
            longitude: neighborhood.longitude || null,
            sort_order: i,
            is_active: true,
          });
        }
      }

      // Save categories to site_categories table
      setCreationStep('saving_categories');
      // First, ensure GBP categories exist and get their IDs, then link to site
      const allCategories = [
        ...(primaryCategory ? [{ ...primaryCategory, isPrimary: true }] : []),
        ...secondaryCategories.map((cat) => ({ ...cat, isPrimary: false })),
      ];

      for (let i = 0; i < allCategories.length; i++) {
        const cat = allCategories[i];

        // First, upsert the GBP category (in case it doesn't exist yet)
        const { data: gbpCat, error: gbpError } = await supabase
          .from('gbp_categories')
          .upsert(
            {
              gcid: cat.gcid,
              name: cat.name,
              display_name: cat.displayName || cat.name,
              parent_gcid: null,
              service_types: cat.commonServices || [],
            },
            { onConflict: 'gcid' }
          )
          .select('id')
          .single();

        if (gbpError) {
          console.error('Error upserting GBP category:', gbpError);
          continue; // Skip this category but continue with others
        }

        // Then create the site_category link
        const { error: siteCatError } = await supabase
          .from('site_categories')
          .insert({
            site_id: site.id,
            gbp_category_id: gbpCat.id,
            is_primary: cat.isPrimary,
            sort_order: i,
          });

        if (siteCatError) {
          console.error('Error creating site category:', siteCatError);
        }
      }

      // Build a map of categoryGcid -> site_category_id for services
      const { data: siteCategoriesData } = await supabase
        .from('site_categories')
        .select('id, gbp_category_id, gbp_categories(gcid)')
        .eq('site_id', site.id);

      const siteCategoryMap: Record<string, string> = {};
      if (siteCategoriesData) {
        for (const sc of siteCategoriesData) {
          // gbp_categories can be an array or single object depending on Supabase version
          const gbpCat = sc.gbp_categories;
          const gcid = Array.isArray(gbpCat)
            ? (gbpCat[0] as { gcid: string } | undefined)?.gcid
            : (gbpCat as { gcid: string } | null)?.gcid;
          if (gcid) {
            siteCategoryMap[gcid] = sc.id;
          }
        }
      }

      // Save selected services to services table (basic info first)
      setCreationStep('saving_services');
      const selectedServices = services.filter((s) => s.isSelected);
      for (const service of selectedServices) {
        const siteCategoryId = siteCategoryMap[service.categoryGcid] || null;

        const { error: serviceError } = await supabase
          .from('services')
          .insert({
            site_id: site.id,
            site_category_id: siteCategoryId,
            name: service.name,
            slug: service.slug,
            description: service.description,
            is_active: true,
            sort_order: service.sortOrder,
          });

        if (serviceError) {
          console.error('Error creating service:', serviceError);
        }
      }

      // Generate SEO content for all pages
      setCreationStep('generating_content');
      const primaryLocation = locations.find((l) => l.isPrimary) || locations[0];

      // Build category input for content generation
      const categoryInputs: CategoryInput[] = allCategories.map((cat) => ({
        gcid: cat.gcid,
        name: cat.name,
        displayName: cat.displayName || cat.name,
        isPrimary: cat.isPrimary,
      }));

      let generatedContent: GeneratedContent | null = null;
      try {
        generatedContent = await generateContent({
          businessName,
          location: {
            city: primaryLocation.city,
            state: primaryLocation.state,
          },
          categories: categoryInputs,
          services: selectedServices.map((s) => ({
            name: s.name,
            description: s.description || '',
            categoryGcid: s.categoryGcid,
            categoryName: s.categoryName,
          })),
          serviceAreas: serviceAreas.map((a) => ({
            name: a.name,
            state: a.state,
          })),
          websiteType: websiteType || 'single_location',
        });
      } catch (contentError) {
        console.error('Error generating content (continuing without SEO content):', contentError);
        // Continue without SEO content - site is still functional
      }

      // Save generated SEO content to database
      if (generatedContent) {
        setCreationStep('saving_content');

        // Update services with generated SEO content
        for (const serviceContent of generatedContent.services) {
          await supabase
            .from('services')
            .update({
              meta_title: serviceContent.meta_title,
              meta_description: serviceContent.meta_description,
              h1: serviceContent.h1,
              body_copy: serviceContent.body_copy,
              faqs: serviceContent.faqs,
            })
            .eq('site_id', site.id)
            .eq('name', serviceContent.name);
        }

        // Create category pages in site_pages
        for (const categoryContent of generatedContent.categories) {
          const categorySlug = categoryContent.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          await supabase.from('site_pages').insert({
            site_id: site.id,
            page_type: 'category',
            slug: categorySlug,
            meta_title: categoryContent.meta_title,
            meta_description: categoryContent.meta_description,
            h1: categoryContent.h1,
            h2: categoryContent.h2,
            body_copy: categoryContent.body_copy,
          });
        }

        // Create core pages (home, about, contact)
        for (const corePage of generatedContent.corePages) {
          await supabase.from('site_pages').insert({
            site_id: site.id,
            page_type: corePage.page_type,
            slug: corePage.page_type,
            meta_title: corePage.meta_title,
            meta_description: corePage.meta_description,
            h1: corePage.h1,
            h2: corePage.h2,
            body_copy: corePage.body_copy,
          });
        }

        // Update service areas with generated content
        for (const areaContent of generatedContent.serviceAreas) {
          const areaSlug = areaContent.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          await supabase
            .from('service_areas')
            .update({
              meta_title: areaContent.meta_title,
              meta_description: areaContent.meta_description,
              h1: areaContent.h1,
              body_copy: areaContent.body_copy,
            })
            .eq('site_id', site.id)
            .eq('slug', areaSlug);
        }
      }

      setCreationStep('complete');

      // Reset wizard and redirect
      reset();
      router.push(`/dashboard/sites/${site.id}`);
    } catch (err) {
      console.error('Error creating site:', err);
      setError(err instanceof Error ? err.message : 'Failed to create site');
      setIsCreating(false);
      setCreationStep('idle');
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
          Step 8 of 8
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

      {/* Services */}
      {services.filter((s) => s.isSelected).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-gray-500" />
              Services ({services.filter((s) => s.isSelected).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {services
                .filter((s) => s.isSelected)
                .map((service) => (
                  <Badge key={service.id} variant="outline">
                    {service.name}
                  </Badge>
                ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Each service will get its own page at /services/[service-name]
            </p>
          </CardContent>
        </Card>
      )}

      {/* Service Areas */}
      {serviceAreas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Map className="h-4 w-4 text-gray-500" />
              Service Areas ({serviceAreas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {serviceAreas.map((area) => (
                <Badge key={area.id} variant="outline">
                  {area.name}{area.state && `, ${area.state}`}
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Each service area will get its own page at /service-areas/[city]
            </p>
          </CardContent>
        </Card>
      )}

      {/* Neighborhoods */}
      {neighborhoods.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Home className="h-4 w-4 text-gray-500" />
              Neighborhoods ({neighborhoods.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((neighborhood) => {
                const parentLocation = locations.find((loc, idx) =>
                  (loc.id || `loc-${idx}`) === neighborhood.locationId
                );
                return (
                  <Badge key={neighborhood.id} variant="outline">
                    {neighborhood.name}
                    {parentLocation && locations.length > 1 && (
                      <span className="ml-1 text-gray-400">({parentLocation.city})</span>
                    )}
                  </Badge>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Each neighborhood feeds geographic relevance to its parent location page
            </p>
          </CardContent>
        </Card>
      )}

      {/* What Happens Next / Progress UI */}
      {isCreating ? (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <h4 className="mb-4 flex items-center gap-2 font-semibold text-blue-900">
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating Your Site
            </h4>
            <div className="space-y-3">
              <CreationStepItem
                label="Creating site"
                status={getStepStatus('creating_site', creationStep)}
              />
              <CreationStepItem
                label="Saving locations & service areas"
                status={getStepStatus('saving_locations', creationStep)}
              />
              <CreationStepItem
                label="Linking categories"
                status={getStepStatus('saving_categories', creationStep)}
              />
              <CreationStepItem
                label="Saving services"
                status={getStepStatus('saving_services', creationStep)}
              />
              <CreationStepItem
                label="Generating SEO content"
                status={getStepStatus('generating_content', creationStep)}
                detail={
                  creationStep === 'generating_content' && progress.totalPages > 0
                    ? `${progress.completedPages}/${progress.totalPages} pages`
                    : undefined
                }
              />
              {creationStep === 'generating_content' && progress.totalPages > 0 && (
                <div className="ml-6">
                  <Progress
                    value={(progress.completedPages / progress.totalPages) * 100}
                    className="h-2"
                  />
                  <p className="mt-1 text-xs text-blue-700">{progress.currentBatch}</p>
                </div>
              )}
              <CreationStepItem
                label="Saving content to database"
                status={getStepStatus('saving_content', creationStep)}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
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
                AI will create SEO-optimized content for all service and category pages
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Service pages will include meta titles, descriptions, and FAQs
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                You can start adding Job Snaps to showcase your work
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

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
              <CreditCard className="mr-2 h-4 w-4" />
              Choose Plan & Create Site
            </>
          )}
        </Button>
      </div>

      {/* Plan Selection Modal */}
      <PlanSelectionModal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSelectPlan={handlePlanSelected}
      />
    </div>
  );
}

// Helper function to determine step status
function getStepStatus(
  step: CreationStep,
  currentStep: CreationStep
): 'pending' | 'active' | 'complete' {
  const stepOrder: CreationStep[] = [
    'idle',
    'creating_site',
    'saving_locations',
    'saving_categories',
    'saving_services',
    'generating_content',
    'saving_content',
    'complete',
  ];

  const stepIndex = stepOrder.indexOf(step);
  const currentIndex = stepOrder.indexOf(currentStep);

  if (currentIndex > stepIndex) return 'complete';
  if (currentIndex === stepIndex) return 'active';
  return 'pending';
}

// Step item component for progress UI
function CreationStepItem({
  label,
  status,
  detail,
}: {
  label: string;
  status: 'pending' | 'active' | 'complete';
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {status === 'complete' && (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      )}
      {status === 'active' && (
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      )}
      {status === 'pending' && (
        <Circle className="h-4 w-4 text-gray-400" />
      )}
      <span
        className={
          status === 'complete'
            ? 'text-emerald-700'
            : status === 'active'
              ? 'font-medium text-blue-900'
              : 'text-gray-500'
        }
      >
        {label}
        {detail && <span className="ml-2 text-sm font-normal">({detail})</span>}
      </span>
    </div>
  );
}
