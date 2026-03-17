'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { getActiveOrgIdClient } from '@/lib/auth/active-org-client';
import { PhotoUpload } from '@/components/job-snaps/photo-upload';
import { ImagePreviewGrid, type LocalImage } from '@/components/job-snaps/image-preview-grid';
import { JobLocationCard, type JobLocation } from '@/components/job-snaps/job-location-card';
import { AnalysisReviewPanel } from '@/components/job-snaps/analysis-review-panel';
import { extractExifGps } from '@/lib/job-snaps/exif';
import { getDevicePosition, reverseGeocode } from '@/lib/job-snaps/geolocation';
import { analyzeJobSnap, type JobSnapAnalysisResult } from '@/lib/job-snaps/analyze';
import { toast } from 'sonner';

export default function NewJobSnapPage() {
  const router = useRouter();
  const [userData, setUserData] = useState({ name: 'User', email: '', avatarUrl: undefined as string | undefined });
  const [images, setImages] = useState<LocalImage[]>([]);
  const [location, setLocation] = useState<JobLocation | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysis, setAnalysis] = useState<JobSnapAnalysisResult | null>(null);

  // Track site context for AI and save
  const [siteContext, setSiteContext] = useState<{ siteId: string; name: string; category: string } | null>(null);

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

      // Load first site for business context (single-site orgs)
      if (activeOrgId) {
        const { data: sites } = await supabase
          .from('sites')
          .select(`
            id,
            name,
            site_categories(
              is_primary,
              gbp_category:gbp_categories(name)
            )
          `)
          .eq('organization_id', activeOrgId)
          .limit(1);

        if (sites?.[0]) {
          const site = sites[0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const primaryCat = (site.site_categories as any[])?.find(
            (c: { is_primary: boolean }) => c.is_primary
          );
          setSiteContext({
            siteId: site.id,
            name: site.name,
            category: primaryCat?.gbp_category?.name || '',
          });
        }
      }
    }
    loadUser();
  }, [supabase]);

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

      // Clear previous analysis when new images are added
      if (analysis) {
        setAnalysis(null);
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

      // Clear analysis when images change
      if (analysis) {
        setAnalysis(null);
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

  // Save manual address
  const handleSaveManualAddress = useCallback((address: string) => {
    setLocation({
      address,
      city: '',
      state: '',
      zip: '',
      lat: null,
      lng: null,
      source: 'manual',
    });
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
              // Map AI role to display label
              const labelMap: Record<string, LocalImage['label']> = {
                primary: 'primary',
                before: 'before',
                after: 'after',
                process: 'gps_found', // reuse existing label style for now
                detail: img.gpsCoords ? 'gps_found' : 'no_gps',
              };
              return { ...img, label: labelMap[role.role] || img.label };
            }
            return img;
          })
        );
      }

      toast.success('AI analysis complete');

      // Scroll to review panel
      setTimeout(() => {
        reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [images, location, siteContext, isAnalyzing]);

  // Save job snap to database
  const handleContinueToSave = useCallback(async () => {
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
      // Convert File objects to base64
      const imagePayload = await Promise.all(
        images.map(async (img, i) => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]); // strip data URL prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(img.file);
          });

          // Map LocalImage label to role
          const labelToRole: Record<string, 'primary' | 'before' | 'after' | 'process' | 'detail'> = {
            primary: 'primary',
            before: 'before',
            after: 'after',
          };
          const role = img.label && labelToRole[img.label] ? labelToRole[img.label] : undefined;

          // Use AI-assigned role from analysis if available
          const aiRole = analysis?.imageRoles.find((r) => r.index === i)?.role;

          return {
            base64,
            mimeType: img.file.type as 'image/jpeg' | 'image/png' | 'image/webp',
            fileName: img.file.name,
            role: aiRole ?? role,
            sortOrder: i,
          };
        })
      );

      const body = {
        siteId: siteContext.siteId,
        aiGeneratedTitle: analysis?.title ?? undefined,
        aiGeneratedDescription: analysis?.description ?? undefined,
        serviceType: analysis?.serviceType ?? undefined,
        brand: analysis?.brand ?? undefined,
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
            <Link href="/dashboard/job-snaps">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Job Snaps
            </Link>
          </Button>
        </div>

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
        <Button
          onClick={handleAnalyzeWithAI}
          disabled={images.length === 0 || isAnalyzing}
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
