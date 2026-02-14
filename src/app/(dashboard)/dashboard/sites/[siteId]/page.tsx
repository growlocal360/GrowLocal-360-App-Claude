'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Globe,
  Palette,
  ExternalLink,
  ArrowLeft,
  MapPin,
  RefreshCw,
  Loader2,
  Inbox,
  Building2,
  Tag,
  Wrench,
  Map,
  Award,
} from 'lucide-react';
import { SiteStatusBadge, BuildProgressBar } from '@/components/sites/site-status-badge';
import type { SiteStatus, SiteBuildProgress } from '@/types/database';

interface SiteData {
  id: string;
  name: string;
  slug: string;
  status: SiteStatus;
  build_progress: SiteBuildProgress | null;
  status_message: string | null;
  settings: {
    brand_color?: string;
    logo_url?: string;
    phone?: string;
    email?: string;
  } | null;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  created_at: string;
  locations: { id: string; name: string }[];
  services: { id: string }[];
  service_areas: { id: string }[];
  site_categories: { id: string }[];
  site_brands: { id: string }[];
}

export default function SiteDashboardPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [userData, setUserData] = useState({
    name: 'User',
    email: '',
    avatarUrl: undefined as string | undefined,
  });

  const supabase = createClient();
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profile } = await supabase
        .from('profiles')
        .select('*, organization:organizations(*)')
        .eq('user_id', user?.id)
        .single();

      setUserData({
        name: profile?.full_name || user?.user_metadata?.full_name || 'User',
        email: user?.email || '',
        avatarUrl: profile?.avatar_url,
      });

      const { data: siteData } = await supabase
        .from('sites')
        .select(
          'id, name, slug, status, build_progress, status_message, settings, custom_domain, custom_domain_verified, created_at, locations(id, name), services(id), service_areas(id), site_categories(id), site_brands(id)'
        )
        .eq('id', siteId)
        .single();

      setSite(siteData as SiteData);
      setLoading(false);
    }

    loadData();
  }, [supabase, siteId]);

  // Poll for build progress when building
  useEffect(() => {
    if (site?.status !== 'building') return;

    const interval = setInterval(async () => {
      const { data: siteData } = await supabase
        .from('sites')
        .select('status, build_progress, status_message')
        .eq('id', siteId)
        .single();

      if (siteData) {
        setSite((prev) =>
          prev
            ? {
                ...prev,
                status: siteData.status,
                build_progress: siteData.build_progress,
                status_message: siteData.status_message,
              }
            : null
        );
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [site?.status, supabase, siteId]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const response = await fetch(`/api/sites/${siteId}/retry-build`, {
        method: 'POST',
      });

      if (response.ok) {
        setSite((prev) =>
          prev
            ? {
                ...prev,
                status: 'building' as SiteStatus,
                build_progress: null,
              }
            : null
        );
      }
    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Site Dashboard" user={userData} />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex flex-col">
        <Header title="Site Not Found" user={userData} />
        <div className="p-6">
          <p className="text-gray-500">The requested site could not be found.</p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/sites">Back to Sites</Link>
          </Button>
        </div>
      </div>
    );
  }

  const siteUrl = site.custom_domain_verified && site.custom_domain
    ? `https://${site.custom_domain}`
    : `https://${site.slug}.${appDomain}`;

  return (
    <div className="flex flex-col">
      <Header title={site.name} user={userData} />

      <div className="p-6 space-y-6">
        {/* Back Link */}
        <Link
          href="/dashboard/sites"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Sites
        </Link>

        {/* Site Overview */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
              <SiteStatusBadge status={site.status} progress={site.build_progress} />
            </div>
            <p className="text-gray-500 mt-1">
              {site.locations?.length || 0} location{site.locations?.length !== 1 ? 's' : ''}
              {' '} &bull; Created {new Date(site.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {site.status === 'active' && (
              <Button variant="outline" size="sm" asChild>
                <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Site
                </a>
              </Button>
            )}
            {(site.status === 'active' || site.status === 'failed') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Regenerate Content
              </Button>
            )}
          </div>
        </div>

        {/* Build Progress */}
        {site.status === 'building' && site.build_progress && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-2">
                {site.build_progress.current_task || 'Building your website...'}
              </p>
              <BuildProgressBar progress={site.build_progress} />
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {site.status === 'failed' && site.status_message && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-700">{site.status_message}</p>
            </CardContent>
          </Card>
        )}

        {/* Settings Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Branding */}
          <Card className="hover:border-[#00d9c0]/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: site.settings?.brand_color || '#10b981' }}
                >
                  <Palette className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Branding</h3>
                  <p className="text-sm text-gray-500">Logo & colors</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {site.settings?.logo_url
                  ? 'Logo uploaded'
                  : 'No logo uploaded yet'}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/sites/${siteId}/settings/branding`}>
                  Customize Branding
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Domain */}
          <Card className="hover:border-[#00d9c0]/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Domain</h3>
                  <p className="text-sm text-gray-500">Custom domain</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {site.custom_domain
                  ? site.custom_domain_verified
                    ? site.custom_domain
                    : `${site.custom_domain} (pending)`
                  : `${site.slug}.${appDomain}`}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/sites/${siteId}/settings/domain`}>
                  Manage Domain
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Locations */}
          <Card className="hover:border-[#00d9c0]/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Locations</h3>
                  <p className="text-sm text-gray-500">Service areas</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {site.locations?.length || 0} location{site.locations?.length !== 1 ? 's' : ''} configured
              </p>
              <Button variant="outline" size="sm" disabled>
                Manage Locations
              </Button>
            </CardContent>
          </Card>

          {/* Leads */}
          <Card className="hover:border-[#00d9c0]/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Inbox className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Leads</h3>
                  <p className="text-sm text-gray-500">Form submissions</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                View and manage leads from your website forms
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/sites/${siteId}/leads`}>
                  View Leads
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Business Info */}
          <Card className="hover:border-[#00d9c0]/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Business Info</h3>
                  <p className="text-sm text-gray-500">Name, phone & email</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {[site.settings?.phone, site.settings?.email].filter(Boolean).join(' & ') || 'Update your business details'}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/sites/${siteId}/settings/business`}>
                  Edit Info
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card className="hover:border-[#00d9c0]/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Tag className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Categories</h3>
                  <p className="text-sm text-gray-500">GBP categories</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {site.site_categories?.length || 0} categor{(site.site_categories?.length || 0) === 1 ? 'y' : 'ies'}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/sites/${siteId}/settings/categories`}>
                  Manage Categories
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Services */}
          <Card className="hover:border-[#00d9c0]/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Services</h3>
                  <p className="text-sm text-gray-500">Service pages</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {site.services?.length || 0} service{(site.services?.length || 0) !== 1 ? 's' : ''}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/sites/${siteId}/settings/services`}>
                  Manage Services
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Service Areas */}
          <Card className="hover:border-[#00d9c0]/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Map className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Service Areas</h3>
                  <p className="text-sm text-gray-500">Cities served</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {site.service_areas?.length || 0} service area{(site.service_areas?.length || 0) !== 1 ? 's' : ''}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/sites/${siteId}/settings/service-areas`}>
                  Manage Areas
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Brands */}
          <Card className="hover:border-[#00d9c0]/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
                  <Award className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Brands</h3>
                  <p className="text-sm text-gray-500">Product brands</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {(site.site_brands?.length || 0) > 0
                  ? `${site.site_brands.length} brand${site.site_brands.length !== 1 ? 's' : ''}`
                  : 'No brands yet'}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/sites/${siteId}/settings/brands`}>
                  Manage Brands
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
