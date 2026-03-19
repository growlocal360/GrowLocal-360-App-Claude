'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Sparkles, Loader2, Building2 } from 'lucide-react';
import { getActiveOrgIdClient } from '@/lib/auth/active-org-client';
import { PhotoUpload } from '@/components/job-snaps/photo-upload';
import { ImagePreviewGrid, type LocalImage } from '@/components/job-snaps/image-preview-grid';
import { JobLocationCard, type JobLocation } from '@/components/job-snaps/job-location-card';
import { AnalysisReviewPanel } from '@/components/job-snaps/analysis-review-panel';
import { extractExifGps } from '@/lib/job-snaps/exif';
import { getDevicePosition, reverseGeocode } from '@/lib/job-snaps/geolocation';
import { analyzeJobSnap, type JobSnapAnalysisResult } from '@/lib/job-snaps/analyze';
import { resizeAndEncode } from '@/lib/job-snaps/image-utils';
import { toast } from 'sonner';

export default function NewJobSnapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteIdParam = searchParams.get('siteId');
  const fromParam = searchParams.get('from');

  const [userData, setUserData] = useState({ name: 'User', email: '', avatarUrl: undefined as string | undefined });
  const [images, setImages] = useState<LocalImage[]>([]);
  const [location, setLocation] = useState<JobLocation | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysis, setAnalysis] = useState<JobSnapAnalysisResult | null>(null);
  const [analysisStale, setAnalysisStale] = useState(false);

  // Track site context for AI and save
  const [siteContext, setSiteContext] = useState<{ siteId: string; name: string; category: string } | null>(null);
  // All sites for the org — used to show selector when no siteId param and org has 2+ sites
  const [allSites, setAllSites] = useState<{ siteId: string; name: string; category: string }[]>([]);

  const reviewRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Load user data + site context
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      const activeOrgId = getActiveOrgIdClient();
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*, organization:organizations(*)')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      const profile = (activeOrgId
        ? allProfiles?.find((p: { organization_id: string }) => p.organization_id === activeOrgId)
        : allProfiles?.[0]) || allProfiles?.[0] || null;

      setUserData({
        name: profile?.full_name || user?.user_metadata?.full_name || 'User',
        email: user?.email || '',
        avatarUrl: profile?.avatar_url,
      });

      // Load site(s) for business context
      // All org IDs this user belongs to (needed for cross-org siteId lookup)
      const orgIds = (allProfiles || []).map((p: { organization_id: string }) => p.organization_id);

      if (orgIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapSite = (s: any) => {
          const primaryCat = (s.site_categories as { is_primary: boolean; gbp_category: { name: string } | null }[])
            ?.find((c) => c.is_primary);
          return { siteId: s.id as string, name: s.name as string, category: primaryCat?.gbp_category?.name || '' };
        };

        if (siteIdParam) {
          // Specific site requested — verify user has access to it through any of their orgs
          const { data: sites } = await supabase
            .from('sites')
            .select(`id, name, site_categories(is_primary, gbp_category:gbp_categories(name))`)
            .eq('id', siteIdParam)
            .in('organization_id', orgIds)
            .limit(1);

          if (sites && sites.length > 0) {
            const ctx = mapSite(sites[0]);
            setAllSites([ctx]);
            setSiteContext(ctx);
          }
        } else if (activeOrgId) {
          // No specific site — load all sites for the active org so user can pick
          const { data: sites } = await supabase
            .from('sites')
            .select(`id, name, site_categories(is_primary, gbp_category:gbp_categories(name))`)
            .eq('organization_id', activeOrgId);

          if (sites && sites.length > 0) {
            const mapped = sites.map(mapSite);
            setAllSites(mapped);
            if (mapped.length === 1) {
              // Single site org — auto-select
              setSiteContext(mapped[0]);
            }
            // Multi-site without param: leave siteContext null; selector will appear
          }
        }
      }
    }
    loadUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, siteIdParam]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add photos with EXIF extraction
  const handleAddPhotos = useCallback(
    async (files: File[]) => {
      const newImages: LocalImage[] = await Promise.all(
        files.map(async (file) => {
          const gps = await extractExifGps(file);
          return {
            file,
            preview: URL.createObjectURL(file),
            gpsCoords: gps,
            label: gps ? ('gps_found' as const) : ('no_gps' as const),
          };
        })
      );

      setImages((prev) => [...prev, ...newImages]);

      // Mark analysis as stale when photos change — don't clear it so the user
      // can still see the previous results until they explicitly re-analyze
      if (analysis) {
        setAnalysisStale(true);
      }

      // Auto-set location from first EXIF GPS
      const firstWithGps = newImages.find((img) => img.gpsCoords !== null);
      if (firstWithGps?.gpsCoords) {
        setLocation((prevLocation) => {
          if (
            !prevLocation ||
            prevLocation.source === 'manual' ||
            prevLocation.source === 'device'
          ) {
            resolveExifLocation(firstWithGps.gpsCoords!.lat, firstWithGps.gpsCoords!.lng);
            return {
              address: 'Resolving address from photo GPS...',
              city: '',
              state: '',
              zip: '',
              lat: firstWithGps.gpsCoords!.lat,
              lng: firstWithGps.gpsCoords!.lng,
              source: 'exif',
            };
          }
          return prevLocation;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analysis]
  );

  // Reverse geocode EXIF coordinates
  const resolveExifLocation = useCallback(async (lat: number, lng: number) => {
    try {
      const geo = await reverseGeocode(lat, lng);
      setLocation({
        address: geo.address,
        city: geo.city,
        state: geo.state,
        zip: geo.zip,
        lat,
        lng,
        source: 'exif',
      });
      toast.success('Location found from photo GPS data');
    } catch {
      setLocation({
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        city: '',
        state: '',
        zip: '',
        lat,
        lng,
        source: 'exif',
      });
    }
  }, []);

  // Remove photo
  const handleRemovePhoto = useCallback(
    (index: number) => {
      setImages((prev) => {
        const removed = prev[index];
        if (removed) URL.revokeObjectURL(removed.preview);
        const updated = prev.filter((_, i) => i !== index);

        if (removed?.gpsCoords && location?.source === 'exif') {
          const anotherWithGps = updated.find((img) => img.gpsCoords !== null);
          if (!anotherWithGps) {
            setLocation(null);
          }
        }

        return updated;
      });

      // Mark analysis stale when a photo is removed
      if (analysis) {
        setAnalysisStale(true);
      }
    },
    [location, analysis]
  );

  // Use current device location
  const handleUseCurrentLocation = useCallback(async () => {
    setIsLoadingLocation(true);

    try {
      const pos = await getDevicePosition();
      const geo = await reverseGeocode(pos.lat, pos.lng);

      setLocation({
        address: geo.address,
        city: geo.city,
        state: geo.state,
        zip: geo.zip,
        lat: pos.lat,
        lng: pos.lng,
        source: 'device',
      });
      setIsEditing(false);
      toast.success('Device location captured');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to get location.');
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  // Save manual address (receives full location from autocomplete or raw text)
  const handleSaveManualAddress = useCallback((loc: JobLocation) => {
    setLocation(loc);
    setIsEditing(false);
    toast.success('Location saved');
  }, []);

  // Edit location
  const handleEditLocation = useCallback(() => {
    setLocation(null);
    setIsEditing(true);
  }, []);

  /**
   * Analyze with AI — sends images + location to the analysis endpoint.
   */
  const handleAnalyzeWithAI = useCallback(async () => {
    if (images.length === 0) {
      toast.error('Please upload at least one image.');
      return;
    }

    if (isAnalyzing) return; // Prevent duplicate submissions

    setIsAnalyzing(true);
    setAnalysis(null);
    setAnalysisStale(false);

    try {
      const result = await analyzeJobSnap({
        images,
        location,
        businessName: siteContext?.name,
        businessCategory: siteContext?.category,
      });

      setAnalysis(result);

      // Update image labels from AI-assigned roles
      if (result.imageRoles.length > 0) {
        setImages((prev) =>
          prev.map((img, idx) => {
            const role = result.imageRoles.find((r: { index: number; role: string }) => r.index === idx);
            if (role) {
              const labelMap: Record<string, LocalImage['label']> = {
                primary: 'primary',
                before: 'before',
                after: 'after',
                process: 'process',
                detail: 'detail',
              };
              return { ...img, label: labelMap[role.role] || img.label };
            }
            return img;
          })
        );
      }

      toast.success('AI analysis complete');

      // Scroll the main container so the analysis panel is visible
      setTimeout(() => {
        if (!reviewRef.current) return;
        const el = reviewRef.current;
        const scrollParent = el.closest('main') || el.parentElement;
        if (scrollParent) {
          const elTop = el.getBoundingClientRect().top;
          const parentTop = scrollParent.getBoundingClientRect().top;
          scrollParent.scrollBy({ top: elTop - parentTop - 16, behavior: 'smooth' });
        }
      }, 150);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Analysis failed. Please try again.', { duration: 6000 });
    } finally {
      setIsAnalyzing(false);
    }
  }, [images, location, siteContext, isAnalyzing, analysisStale]);

  // Save job snap to database — receives the (potentially edited) analysis from the panel
  const handleContinueToSave = useCallback(async (editedAnalysis: JobSnapAnalysisResult) => {
    if (images.length === 0) {
      toast.error('Please upload at least one image.');
      return;
    }
    if (!siteContext?.siteId) {
      toast.error('No site found. Please refresh and try again.');
      return;
    }
    if (isSaving) return;

    setIsSaving(true);

    try {
      // Resize and compress images before sending (avoids 413 Content Too Large)
      const imagePayload = await Promise.all(
        images.map(async (img, i) => {
          const { base64, mimeType } = await resizeAndEncode(img.file);

          // Map LocalImage label to role
          const labelToRole: Record<string, 'primary' | 'before' | 'after' | 'process' | 'detail'> = {
            primary: 'primary',
            before: 'before',
            after: 'after',
          };
          const role = img.label && labelToRole[img.label] ? labelToRole[img.label] : undefined;

          // Use AI-assigned role from analysis if available
          const aiRole = editedAnalysis.imageRoles.find((r: { index: number; role: string }) => r.index === i)?.role;

          return {
            base64,
            mimeType,
            fileName: img.file.name,
            role: aiRole ?? role,
            sortOrder: i,
          };
        })
      );

      // Preserve original AI values separately; user-edited values go into title/description
      const body = {
        siteId: siteContext.siteId,
        title: editedAnalysis.title ?? undefined,
        description: editedAnalysis.description ?? undefined,
        aiGeneratedTitle: analysis?.title ?? undefined,
        aiGeneratedDescription: analysis?.description ?? undefined,
        serviceType: editedAnalysis.serviceType ?? undefined,
        brand: editedAnalysis.brand ?? undefined,
        location: location
          ? {
              addressFull: location.address,
              city: location.city,
              state: location.state,
              zip: location.zip,
              lat: location.lat,
              lng: location.lng,
              source: location.source,
            }
          : null,
        images: imagePayload,
      };

      const res = await fetch('/api/job-snaps/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.jobSnapId) {
        throw new Error(data.error || 'Save failed');
      }

      toast.success('Job snap saved!');
      router.push(`/dashboard/job-snaps/${data.jobSnapId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [images, location, analysis, siteContext, isSaving, router]);

  return (
    <div className="flex flex-col">
      <Header title="New Job" user={userData} />

      <div className="mx-auto w-full max-w-2xl p-6 space-y-6">
        {/* Back button */}
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={fromParam ? `/dashboard/sites/${fromParam}/job-snaps` : '/dashboard/job-snaps'}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Job Snaps
            </Link>
          </Button>
        </div>

        {/* 0. Site selector — only shown when org has 2+ sites and no siteId in URL */}
        {!siteIdParam && allSites.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              Company
            </label>
            <Select
              value={siteContext?.siteId || ''}
              onValueChange={(value) => {
                const site = allSites.find((s) => s.siteId === value);
                if (site) setSiteContext(site);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a company for this job" />
              </SelectTrigger>
              <SelectContent>
                {allSites.map((s) => (
                  <SelectItem key={s.siteId} value={s.siteId}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 1. Photo Upload */}
        <PhotoUpload
          currentCount={images.length}
          onAdd={handleAddPhotos}
        />

        {/* 2. Job Location */}
        <JobLocationCard
          location={isEditing ? null : location}
          onUseCurrentLocation={handleUseCurrentLocation}
          onSaveManualAddress={handleSaveManualAddress}
          onEdit={handleEditLocation}
          isLoadingLocation={isLoadingLocation}
        />

        {/* 3. Analyze with AI */}
        {analysisStale && analysis && (
          <p className="text-center text-xs text-amber-600">
            Photos changed since last analysis — click Analyze to update results.
          </p>
        )}
        <Button
          onClick={handleAnalyzeWithAI}
          disabled={images.length === 0 || isAnalyzing || !siteContext}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white py-6 text-lg font-medium rounded-xl disabled:opacity-50"
          size="lg"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Analyze with AI
            </>
          )}
        </Button>

        {/* 4. AI Analysis Review */}
        {analysis && (
          <div ref={reviewRef}>
            <AnalysisReviewPanel
              analysis={analysis}
              location={location}
              siteId={siteContext?.siteId ?? ''}
              onContinue={handleContinueToSave}
              onReanalyze={handleAnalyzeWithAI}
              isLoading={isAnalyzing || isSaving}
            />
          </div>
        )}

        {/* 5. Uploaded Images Preview */}
        <ImagePreviewGrid
          images={images}
          onRemove={handleRemovePhoto}
        />
      </div>
    </div>
  );
}
