'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
// <img> (not next/image) for preview — supports API proxy URLs + data URIs
// without next.config image-domain config.
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Upload, Trash2, AlertCircle, Check, Loader2, ArrowLeft } from 'lucide-react';

export default function AboutPersonSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null); // saved URL (proxy path)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null); // data URI for a new pick
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/sites/${siteId}/settings/about-person`);
        if (res.ok) {
          const d = await res.json();
          setName(d.name || '');
          setTitle(d.title || '');
          setPhotoUrl(d.photoUrl || null);
        }
      } catch {
        setError('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId]);

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoFile(file);
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('photo', file);
    const res = await fetch(`/api/sites/${siteId}/settings/about-person/upload`, { method: 'POST', body: fd });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || 'Failed to upload photo');
    }
    return (await res.json()).url as string;
  };

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      let newPhoto: string | null = photoUrl;
      if (photoFile) newPhoto = await uploadPhoto(photoFile);

      const res = await fetch(`/api/sites/${siteId}/settings/about-person`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, title, photoUrl: newPhoto }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save');
      }
      const d = await res.json();
      setPhotoUrl(d.photoUrl || null);
      setPhotoFile(null);
      setPhotoPreview(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const clearFeatured = async () => {
    setName('');
    setTitle('');
    removePhoto();
    try {
      setSaving(true);
      const res = await fetch(`/api/sites/${siteId}/settings/about-person`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', title: '', photoUrl: null }),
      });
      if (!res.ok) throw new Error('Failed to clear');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Failed to clear');
    } finally {
      setSaving(false);
    }
  };

  const currentPhoto = photoPreview || photoUrl;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/dashboard/sites/${siteId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to Site
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">About Page — Featured Person</h1>
        <p className="mt-1 text-gray-600">
          The person shown in the &ldquo;Our Story&rdquo; headshot on this site&rsquo;s About page. Set the client&rsquo;s
          business owner here so your own account doesn&rsquo;t appear on their site. Leave blank to fall back to the account owner.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <User className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold">Business Owner / Featured Person</h3>
              <p className="text-sm text-gray-500">Name, title, and photo</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {/* Photo */}
              <div>
                <Label>Photo</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-gray-50">
                    {currentPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={currentPhoto} alt="Featured person" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-gray-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> Upload photo
                    </Button>
                    {currentPhoto && (
                      <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={removePhoto}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-400">PNG, JPG, or WEBP. Square images look best. Max 10MB.</p>
              </div>

              {/* Name */}
              <div>
                <Label htmlFor="fp-name">Name</Label>
                <Input id="fp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Smith" className="mt-1" />
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="fp-title">Title (optional)</Label>
                <Input id="fp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Owner &amp; Founder" className="mt-1" />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  <Check className="h-4 w-4" /> Saved. The About page will update shortly.
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-4">
                <Button type="button" variant="ghost" size="sm" className="text-gray-500" onClick={clearFeatured} disabled={saving}>
                  Clear (use account owner)
                </Button>
                <Button type="button" onClick={save} disabled={saving || !name.trim()}>
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Save'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
