'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  Briefcase,
  X,
  MapPin,
  Navigation,
  Eye,
  Lock,
  Trash2,
  ArrowLeftRight,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getActiveOrgIdClient } from '@/lib/auth/active-org-client';
import { BrandCombobox } from '@/components/job-snaps/brand-combobox';
import { ServiceCombobox } from '@/components/job-snaps/service-combobox';
import { toPublicAddress } from '@/lib/job-snaps/address';
import { toast } from 'sonner';
import type { JobStatus, JobSnapWithRelations, JobSnapMedia } from '@/types/database';

interface FormState {
  title: string;
  description: string;
  serviceType: string;
  serviceId: string | null;
  brand: string;
  /** Internal-only customer/family name. Never shown publicly. */
  clientName: string;
  equipmentType: string;
  primaryProblem: string;
  neighborhood: string;
  streetNamePublic: string;
  status: JobStatus;
  addressFull: string;
  city: string;
  state: string;
  zip: string;
}

interface SeoOverrides {
  slug: string;
  metaTitle: string;
  h1: string;
  metaDescription: string;
  altTextDefault: string;
  imageFilenameBase: string;
  publicLocationLabel: string;
}

const EDITABLE_STATUSES: { value: JobStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'queued', label: 'Queued for Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'deployed', label: 'Deployed (live)' },
  { value: 'rejected', label: 'Rejected' },
];

export default function EditJobSnapPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [jobSnap, setJobSnap] = useState<JobSnapWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userData, setUserData] = useState({ name: 'User', email: '', avatarUrl: undefined as string | undefined });

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    serviceType: '',
    serviceId: null,
    brand: '',
    clientName: '',
    equipmentType: '',
    primaryProblem: '',
    neighborhood: '',
    streetNamePublic: '',
    status: 'draft',
    addressFull: '',
    city: '',
    state: '',
    zip: '',
  });
  const [originalForm, setOriginalForm] = useState<FormState | null>(null);
  const [mediaToDelete, setMediaToDelete] = useState<string[]>([]);
  const [isBeforeAfter, setIsBeforeAfter] = useState(false);
  const [mediaRoles, setMediaRoles] = useState<Record<string, { role: string; pairGroup: number | null }>>({});

  // Advanced SEO panel state
  const [seoExpanded, setSeoExpanded] = useState(false);
  const [seoOverrides, setSeoOverrides] = useState<SeoOverrides>({
    slug: '',
    metaTitle: '',
    h1: '',
    metaDescription: '',
    altTextDefault: '',
    imageFilenameBase: '',
    publicLocationLabel: '',
  });
  const [seoOverridesDirty, setSeoOverridesDirty] = useState<Partial<Record<keyof SeoOverrides, boolean>>>({});
  const [isRegenerating, setIsRegenerating] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
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

        const { data: snap, error } = await supabase
          .from('job_snaps')
          .select(`*, media:job_snap_media(*), service:services(*)`)
          .eq('id', jobId)
          .single();

        if (error || !snap) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const { data: site } = await supabase
          .from('sites')
          .select('organization_id')
          .eq('id', snap.site_id)
          .single();

        const userOrgIds = (allProfiles || []).map((p: { organization_id: string }) => p.organization_id);
        if (!site || !userOrgIds.includes(site.organization_id)) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const typedSnap = snap as unknown as JobSnapWithRelations;
        setJobSnap(typedSnap);

        const initialForm: FormState = {
          title: typedSnap.title || '',
          description: typedSnap.description || '',
          serviceType: typedSnap.service_type || '',
          serviceId: typedSnap.service_id || null,
          brand: typedSnap.brand || '',
          clientName: typedSnap.client_name || '',
          equipmentType: typedSnap.equipment_type || '',
          primaryProblem: typedSnap.primary_problem || '',
          neighborhood: typedSnap.neighborhood || '',
          streetNamePublic: typedSnap.street_name_public || '',
          status: typedSnap.status,
          addressFull: typedSnap.address_full || '',
          city: typedSnap.city || '',
          state: typedSnap.state || '',
          zip: typedSnap.zip || '',
        };
        setForm(initialForm);
        setOriginalForm(initialForm);
        setSeoOverrides({
          slug: typedSnap.slug || '',
          metaTitle: typedSnap.meta_title || '',
          h1: typedSnap.h1 || '',
          metaDescription: typedSnap.meta_description || '',
          altTextDefault: typedSnap.alt_text_default || '',
          imageFilenameBase: typedSnap.image_filename_base || '',
          publicLocationLabel: typedSnap.public_location_label || '',
        });
        setSeoOverridesDirty({});
        setIsBeforeAfter(typedSnap.is_before_after || false);

        // Initialize media roles from existing data
        const roles: Record<string, { role: string; pairGroup: number | null }> = {};
        for (const m of typedSnap.media || []) {
          if (m.role) {
            roles[m.id] = { role: m.role, pairGroup: m.pair_group ?? null };
          }
        }
        setMediaRoles(roles);
      } catch (err) {
        console.error('Failed to load job snap:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supabase, jobId]);

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (!originalForm) return false;
    if (mediaToDelete.length > 0) return true;
    if (isBeforeAfter !== (jobSnap?.is_before_after || false)) return true;
    if (Object.keys(mediaRoles).length > 0) return true;
    if (Object.values(seoOverridesDirty).some(Boolean)) return true;
    return (Object.keys(form) as (keyof FormState)[]).some(
      (key) => form[key] !== originalForm[key]
    );
  }, [form, originalForm, mediaToDelete, isBeforeAfter, jobSnap, mediaRoles, seoOverridesDirty]);

  // Unsaved changes warning on browser close/refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Public address preview (real-time, derived)
  const publicAddressPreview = useMemo(() => {
    if (!form.addressFull && !form.city && !form.state && !form.zip) return '';
    return toPublicAddress({
      address: form.addressFull,
      city: form.city,
      state: form.state,
      zip: form.zip,
    });
  }, [form.addressFull, form.city, form.state, form.zip]);

  const currentMedia = (jobSnap?.media || [])
    .slice()
    .sort((a: JobSnapMedia, b: JobSnapMedia) => a.sort_order - b.sort_order);

  const remainingMediaCount = currentMedia.length - mediaToDelete.length;
  const allMediaDeleted = remainingMediaCount <= 0 && currentMedia.length > 0;

  function field(key: keyof FormState, value: string | JobStatus) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMediaDelete(mediaId: string) {
    setMediaToDelete((prev) =>
      prev.includes(mediaId) ? prev.filter((id) => id !== mediaId) : [...prev, mediaId]
    );
  }

  function handleCancel() {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Leave without saving?')) return;
    }
    router.push(`/dashboard/job-snaps/${jobId}`);
  }

  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      'Are you sure you want to delete this job snap? This will also remove all photos and unpublish from the website. This cannot be undone.'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/job-snaps/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Job snap deleted');
        router.push('/dashboard/job-snaps');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete job snap');
    } finally {
      setIsDeleting(false);
    }
  }

  function buildPatchBody(regenerate: boolean) {
    const address_public = publicAddressPreview;
    // Only ship overrides the user explicitly touched. Untouched fields stay
    // governed by the naming engine.
    const overrides: Record<string, string> = {};
    if (seoOverridesDirty.slug) overrides.slug = seoOverrides.slug.trim();
    if (seoOverridesDirty.metaTitle) overrides.meta_title = seoOverrides.metaTitle.trim();
    if (seoOverridesDirty.h1) overrides.h1 = seoOverrides.h1.trim();
    if (seoOverridesDirty.metaDescription) overrides.meta_description = seoOverrides.metaDescription.trim();
    if (seoOverridesDirty.altTextDefault) overrides.alt_text_default = seoOverrides.altTextDefault.trim();
    if (seoOverridesDirty.imageFilenameBase) overrides.image_filename_base = seoOverrides.imageFilenameBase.trim();
    if (seoOverridesDirty.publicLocationLabel) overrides.public_location_label = seoOverrides.publicLocationLabel.trim();

    return {
      title: form.title.trim() || null,
      description: form.description.trim() || null,
      service_type: form.serviceType.trim() || null,
      service_id: form.serviceId || null,
      brand: form.brand.trim() || null,
      client_name: form.clientName.trim() || null,
      equipment_type: form.equipmentType.trim() || null,
      primary_problem: form.primaryProblem.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      street_name_public: form.streetNamePublic.trim() || null,
      status: form.status,
      address_full: form.addressFull.trim() || null,
      address_public: address_public || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      regenerate_seo_fields: regenerate,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    };
  }

  async function handleSave() {
    if (allMediaDeleted) {
      toast.error('At least one photo is required.');
      return;
    }
    if (isSaving) return;

    setIsSaving(true);

    try {
      // 1. Delete removed media from storage + DB
      if (mediaToDelete.length > 0) {
        const storagePaths = currentMedia
          .filter((m: JobSnapMedia) => mediaToDelete.includes(m.id))
          .map((m: JobSnapMedia) => m.storage_path);

        if (storagePaths.length > 0) {
          await supabase.storage.from('job-snap-media').remove(storagePaths);
        }
        await supabase.from('job_snap_media').delete().in('id', mediaToDelete);
      }

      // 2. PATCH the snap server-side so the naming engine recomputes
      //    canonical SEO fields. Permalink fields (slug, image_filename_base)
      //    are preserved by default; only the "Regenerate SEO Fields" advanced
      //    action triggers a full recompute.
      const res = await fetch(`/api/job-snaps/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPatchBody(false)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Save failed');
      }

      // 3. is_before_after + media roles still go through Supabase directly
      //    (no server-side recompute needed; these don't affect naming).
      await supabase
        .from('job_snaps')
        .update({ is_before_after: isBeforeAfter })
        .eq('id', jobId);

      for (const [mediaId, { role, pairGroup }] of Object.entries(mediaRoles)) {
        await supabase
          .from('job_snap_media')
          .update({ role, pair_group: pairGroup })
          .eq('id', mediaId);
      }

      toast.success('Changes saved');
      router.push(`/dashboard/job-snaps/${jobId}`);
    } catch (err) {
      console.error('Save failed:', err);
      toast.error(err instanceof Error ? err.message : 'Save failed. Please try again.');
      setIsSaving(false);
    }
  }

  async function handleRegenerateSeoFields() {
    const confirmed = window.confirm(
      'Regenerate SEO Fields will recompute the slug, URL, and image filename for this snap. The public URL (/work/<slug>) will change, which may break existing share links. Continue?'
    );
    if (!confirmed) return;
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/job-snaps/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPatchBody(true)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Regenerate failed');
      }
      toast.success('SEO fields regenerated');
      // Reload to surface the new permalinks
      router.refresh();
    } catch (err) {
      console.error('Regenerate failed:', err);
      toast.error(err instanceof Error ? err.message : 'Regenerate failed. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  }

  const getDisplayTitle = (snap: JobSnapWithRelations) =>
    snap.title || snap.ai_generated_title || 'Untitled Job';

  if (loading) {
    return (
      <>
        <Header title="Edit Job Snap" user={userData} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </>
    );
  }

  if (notFound || !jobSnap) {
    return (
      <>
        <Header title="Edit Job Snap" user={userData} />
        <div className="p-6 space-y-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/job-snaps">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Job Snaps
            </Link>
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-gray-100 p-4">
                <Briefcase className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Job snap not found</h3>
              <p className="mt-2 text-sm text-gray-500">
                This job snap may have been deleted or you don&apos;t have access to it.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={`Edit: ${getDisplayTitle(jobSnap)}`} user={userData} />

      <div className="p-6 space-y-6">
        {/* Back */}
        <div>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Job Snap
          </Button>
        </div>

        {/* Page header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Edit Job Snap</h2>
          <p className="mt-1 text-sm text-gray-500">
            Update photos, details, and content for this job snap.
          </p>
        </div>

        <div className="max-w-3xl space-y-6">

          {/* ── Section 1: Photos ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Photos</CardTitle>
                  <CardDescription>Remove unwanted photos. Assign roles using the dropdowns below each image.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="ba-toggle" className="text-sm text-gray-600 flex items-center gap-1.5">
                    <ArrowLeftRight className="h-4 w-4" />
                    Before & After
                  </Label>
                  <Switch
                    id="ba-toggle"
                    checked={isBeforeAfter}
                    onCheckedChange={(checked) => {
                      setIsBeforeAfter(checked);
                      if (checked) {
                        // Auto-assign pairs: pair photos in order (1st=before, 2nd=after, 3rd=before, etc.)
                        const remaining = currentMedia.filter((m: JobSnapMedia) => !mediaToDelete.includes(m.id));
                        const newRoles: Record<string, { role: string; pairGroup: number | null }> = {};
                        remaining.forEach((m: JobSnapMedia, i: number) => {
                          const pairGroup = Math.floor(i / 2) + 1;
                          const role = i % 2 === 0 ? 'before' : 'after';
                          newRoles[m.id] = { role, pairGroup };
                        });
                        setMediaRoles(newRoles);
                      } else {
                        // Clear all pair assignments
                        setMediaRoles({});
                      }
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentMedia.length === 0 ? (
                <p className="text-sm text-gray-400">No photos attached to this job snap.</p>
              ) : (
                <>
                  {allMediaDeleted && (
                    <p className="text-sm text-red-600 font-medium">
                      At least one photo is required. Restore a photo or cancel.
                    </p>
                  )}
                  {isBeforeAfter ? (
                    // ── Before & After pair layout ──
                    <div className="space-y-4">
                      {(() => {
                        const remaining = currentMedia.filter((m: JobSnapMedia) => !mediaToDelete.includes(m.id));
                        const pairs: [JobSnapMedia | null, JobSnapMedia | null][] = [];
                        for (let i = 0; i < remaining.length; i += 2) {
                          pairs.push([remaining[i] || null, remaining[i + 1] || null]);
                        }
                        if (pairs.length === 0) pairs.push([null, null]);

                        return pairs.map((pair, pairIdx) => (
                          <div key={pairIdx} className="rounded-lg border p-3">
                            <p className="text-xs font-semibold text-gray-500 mb-2">Pair {pairIdx + 1}</p>
                            <div className="grid grid-cols-2 gap-3">
                              {pair.map((m, slotIdx) => {
                                if (!m) {
                                  return (
                                    <div key={`empty-${slotIdx}`} className="relative aspect-square rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                                      <span className="text-xs text-gray-400">{slotIdx === 0 ? 'Before' : 'After'}</span>
                                    </div>
                                  );
                                }
                                const { data: urlData } = supabase.storage
                                  .from('job-snap-media')
                                  .getPublicUrl(m.storage_path);
                                const roleInfo = mediaRoles[m.id] || { role: m.role || (slotIdx === 0 ? 'before' : 'after'), pairGroup: pairIdx + 1 };

                                return (
                                  <div key={m.id} className="relative">
                                    <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                                      <Image
                                        src={urlData.publicUrl}
                                        alt={m.alt_text || m.file_name}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 640px) 50vw, 33vw"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => toggleMediaDelete(m.id)}
                                        className="absolute top-1.5 right-1.5 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
                                        title="Delete photo"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                    <Badge variant="outline" className="mt-1 w-full justify-center text-xs capitalize">
                                      {roleInfo.role}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    // ── Standard photo grid ──
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {currentMedia.map((m: JobSnapMedia) => {
                        const { data: urlData } = supabase.storage
                          .from('job-snap-media')
                          .getPublicUrl(m.storage_path);
                        const isMarked = mediaToDelete.includes(m.id);

                        return (
                          <div key={m.id} className="relative">
                            <div
                              className={`relative aspect-square overflow-hidden rounded-lg bg-gray-100 ${
                                isMarked ? 'ring-2 ring-red-400' : ''
                              }`}
                            >
                              <Image
                                src={urlData.publicUrl}
                                alt={m.alt_text || m.file_name}
                                fill
                                className={`object-cover transition-opacity ${isMarked ? 'opacity-40' : ''}`}
                                sizes="(max-width: 640px) 50vw, 33vw"
                              />
                              {isMarked && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-semibold text-red-600 bg-white/80 rounded px-2 py-0.5">
                                    Will be deleted
                                  </span>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleMediaDelete(m.id)}
                                className={`absolute top-1.5 right-1.5 rounded-full p-1 shadow transition-colors ${
                                  isMarked
                                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    : 'bg-red-500 text-white hover:bg-red-600'
                                }`}
                                title={isMarked ? 'Undo delete' : 'Delete photo'}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            {m.role && (
                              <span className="mt-1 block text-center text-xs capitalize text-gray-500">
                                {m.role}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-gray-400">
                    To add new photos, re-run AI analysis from the New Job page.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Section 2: Job Details ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job Details</CardTitle>
              <CardDescription>
                Override AI-generated content or update job metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => field('title', e.target.value)}
                  placeholder={jobSnap.ai_generated_title || 'Enter a job title…'}
                  maxLength={200}
                />
                {jobSnap.ai_generated_title && !form.title && (
                  <p className="text-xs text-gray-400">
                    Using AI title: &ldquo;{jobSnap.ai_generated_title}&rdquo;
                  </p>
                )}
                <p className="text-right text-xs text-gray-400">{form.title.length}/200</p>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => field('description', e.target.value)}
                  placeholder={jobSnap.ai_generated_description || 'Enter a job description…'}
                  rows={4}
                  maxLength={2000}
                />
                {jobSnap.ai_generated_description && !form.description && (
                  <p className="text-xs text-gray-400">
                    Using AI description.
                  </p>
                )}
                <p className="text-right text-xs text-gray-400">{form.description.length}/2000</p>
              </div>

              {/* Service Type + Brand */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="serviceType">Service Type</Label>
                  <ServiceCombobox
                    id="serviceType"
                    value={form.serviceId}
                    onChange={(serviceId, serviceName) => {
                      setForm((prev) => ({
                        ...prev,
                        serviceId,
                        serviceType: serviceName,
                      }));
                    }}
                    siteId={jobSnap?.site_id ?? ''}
                    placeholder="Select a service…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand">Brand</Label>
                  <BrandCombobox
                    id="brand"
                    value={form.brand}
                    onChange={(v) => field('brand', v)}
                    siteId={jobSnap?.site_id ?? ''}
                    placeholder="e.g. Whirlpool"
                  />
                  <p className="text-xs text-gray-400">Equipment manufacturer. Shown publicly when present.</p>
                </div>
              </div>

              {/* Client name (internal-only) + Equipment Type */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="clientName" className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-gray-400" />
                    Client Name (Internal Only)
                  </Label>
                  <Input
                    id="clientName"
                    value={form.clientName}
                    onChange={(e) => field('clientName', e.target.value)}
                    placeholder="e.g. Anderson Family"
                  />
                  <p className="text-xs text-gray-400">Never shown publicly. Used internally only.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="equipmentType">Equipment Type</Label>
                  <Input
                    id="equipmentType"
                    value={form.equipmentType}
                    onChange={(e) => field('equipmentType', e.target.value)}
                    placeholder="e.g. Dryer, Condenser Unit"
                  />
                  <p className="text-xs text-gray-400">When the job involves a specific piece of equipment.</p>
                </div>
              </div>

              {/* Primary Problem */}
              <div className="space-y-1.5">
                <Label htmlFor="primaryProblem">Primary Problem</Label>
                <Input
                  id="primaryProblem"
                  value={form.primaryProblem}
                  onChange={(e) => field('primaryProblem', e.target.value)}
                  placeholder="e.g. drum roller replacement, storm damage cleanup"
                />
                <p className="text-xs text-gray-400">
                  Short phrase describing the core issue or completed task. Drives the SEO URL and title.
                </p>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => field('status', v as JobStatus)}
                >
                  <SelectTrigger id="status" className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITABLE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {jobSnap.status === 'deployed' && (
                  <p className="text-xs text-amber-600">
                    This job is deployed. Changing status may affect its visibility on your website.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Section 3: Location ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location</CardTitle>
              <CardDescription>
                The full address is stored internally. The public-facing version automatically removes the house number.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Full address (internal) */}
              <div className="space-y-1.5">
                <Label htmlFor="addressFull" className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-gray-400" />
                  Full Address (Internal Only)
                </Label>
                <Input
                  id="addressFull"
                  value={form.addressFull}
                  onChange={(e) => field('addressFull', e.target.value)}
                  placeholder="e.g. 123 Main St"
                />
                <p className="text-xs text-gray-400">
                  Includes house number — never shown publicly.
                </p>
              </div>

              {/* City / State / ZIP */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => field('city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={(e) => field('state', e.target.value)}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input
                    id="zip"
                    value={form.zip}
                    onChange={(e) => field('zip', e.target.value)}
                    placeholder="ZIP"
                  />
                </div>
              </div>

              {/* Public address preview */}
              {publicAddressPreview && (
                <div className="rounded-md border border-[#00ef99]/30 bg-[#00ef99]/5 px-4 py-3 space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Eye className="h-3 w-3" />
                    Public-facing address (house number removed)
                  </p>
                  <p className="text-sm font-medium text-gray-800">{publicAddressPreview}</p>
                </div>
              )}

              {/* Neighborhood + Sanitized street name (public location signals) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="neighborhood">Neighborhood (Public)</Label>
                  <Input
                    id="neighborhood"
                    value={form.neighborhood}
                    onChange={(e) => field('neighborhood', e.target.value)}
                    placeholder="e.g. Graywood, South Lake Charles"
                  />
                  <p className="text-xs text-gray-400">Optional hyper-local signal. Appears in H1 and body when present.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="streetNamePublic">Public Street Name</Label>
                  <Input
                    id="streetNamePublic"
                    value={form.streetNamePublic}
                    onChange={(e) => field('streetNamePublic', e.target.value)}
                    placeholder="e.g. Kirby St"
                  />
                  <p className="text-xs text-gray-400">House number stripped. Auto-filled from address if blank.</p>
                </div>
              </div>

              {/* Read-only: location source + GPS */}
              <div className="flex flex-wrap gap-4 pt-1">
                {jobSnap.location_source && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Source:</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {jobSnap.location_source}
                    </Badge>
                  </div>
                )}
                {jobSnap.latitude != null && jobSnap.longitude != null && (
                  <div className="flex items-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {jobSnap.latitude.toFixed(6)}, {jobSnap.longitude.toFixed(6)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Advanced SEO (collapsible, power-user only) ── */}
          <Card>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setSeoExpanded((v) => !v)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Advanced SEO</CardTitle>
                  <CardDescription>
                    GL360-generated SEO fields. Source of truth for every output channel. Override only if you know what you&apos;re doing.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {seoExpanded ? 'Collapse' : 'Expand'}
                </Badge>
              </div>
            </CardHeader>
            {seoExpanded && (
              <CardContent className="space-y-5">
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-800">
                    These fields are auto-generated by the SEO naming engine. Edit only to override the default for this specific snap. Routine saves keep the slug + image filename stable; the &ldquo;Regenerate SEO Fields&rdquo; button below recomputes them from scratch.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="seo-slug">Slug</Label>
                  <Input
                    id="seo-slug"
                    value={seoOverrides.slug}
                    onChange={(e) => {
                      setSeoOverrides((prev) => ({ ...prev, slug: e.target.value }));
                      setSeoOverridesDirty((prev) => ({ ...prev, slug: true }));
                    }}
                    placeholder="cleveland-dryer-repair-whirlpool-drum-roller-replacement"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-gray-400">Public URL: /work/{seoOverrides.slug || '<slug>'}/</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="seo-meta-title">Meta Title</Label>
                    <Input
                      id="seo-meta-title"
                      value={seoOverrides.metaTitle}
                      onChange={(e) => {
                        setSeoOverrides((prev) => ({ ...prev, metaTitle: e.target.value }));
                        setSeoOverridesDirty((prev) => ({ ...prev, metaTitle: true }));
                      }}
                      maxLength={120}
                    />
                    <p className="text-xs text-gray-400">{seoOverrides.metaTitle.length}/120</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seo-h1">H1</Label>
                    <Input
                      id="seo-h1"
                      value={seoOverrides.h1}
                      onChange={(e) => {
                        setSeoOverrides((prev) => ({ ...prev, h1: e.target.value }));
                        setSeoOverridesDirty((prev) => ({ ...prev, h1: true }));
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="seo-meta-desc">Meta Description</Label>
                  <Textarea
                    id="seo-meta-desc"
                    value={seoOverrides.metaDescription}
                    onChange={(e) => {
                      setSeoOverrides((prev) => ({ ...prev, metaDescription: e.target.value }));
                      setSeoOverridesDirty((prev) => ({ ...prev, metaDescription: true }));
                    }}
                    rows={2}
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-400">{seoOverrides.metaDescription.length}/160 target</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="seo-alt">Default Alt Text</Label>
                    <Input
                      id="seo-alt"
                      value={seoOverrides.altTextDefault}
                      onChange={(e) => {
                        setSeoOverrides((prev) => ({ ...prev, altTextDefault: e.target.value }));
                        setSeoOverridesDirty((prev) => ({ ...prev, altTextDefault: true }));
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seo-loc">Public Location Label</Label>
                    <Input
                      id="seo-loc"
                      value={seoOverrides.publicLocationLabel}
                      onChange={(e) => {
                        setSeoOverrides((prev) => ({ ...prev, publicLocationLabel: e.target.value }));
                        setSeoOverridesDirty((prev) => ({ ...prev, publicLocationLabel: true }));
                      }}
                      placeholder="Graywood, Lake Charles, LA"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="seo-filename">Image Filename Base</Label>
                  <Input
                    id="seo-filename"
                    value={seoOverrides.imageFilenameBase}
                    onChange={(e) => {
                      setSeoOverrides((prev) => ({ ...prev, imageFilenameBase: e.target.value }));
                      setSeoOverridesDirty((prev) => ({ ...prev, imageFilenameBase: true }));
                    }}
                    placeholder="whirlpool-dryer-repair-cleveland-oh-8b60"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-gray-400">No extension. Per-image filenames: &lt;base&gt;-1.jpg, &lt;base&gt;-2.jpg, …</p>
                </div>

                <div className="border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={handleRegenerateSeoFields}
                    disabled={isRegenerating || isSaving}
                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Regenerating…
                      </>
                    ) : (
                      'Regenerate SEO Fields'
                    )}
                  </Button>
                  <p className="mt-2 text-xs text-gray-500">
                    Recomputes slug + image filename from scratch using current structured fields. Changes the public URL — existing share links may break.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* ── Action bar ── */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving || isDeleting}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </>
                )}
              </Button>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving || !isDirty || allMediaDeleted}
              className="bg-gray-900 hover:bg-gray-800"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
