'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
// Using <img> instead of next/image for logo preview — supports SVGs
// and dynamic API proxy URLs without next.config image domain config
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Palette,
  Upload,
  Trash2,
  AlertCircle,
  Check,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

interface BrandingConfig {
  brandColor: string | null;
  secondaryColor: string | null;
  ctaColor: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  siteName: string;
}

export default function BrandingSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputDarkRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<BrandingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [brandColor, setBrandColor] = useState('#00ef99');
  const [secondaryColor, setSecondaryColor] = useState('#1f2937');
  const [ctaColor, setCtaColor] = useState('#00ef99');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(null);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);

  // Fetch current branding configuration
  useEffect(() => {
    fetchBrandingConfig();
  }, [siteId]);

  const fetchBrandingConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/settings/branding`);
      if (!response.ok) {
        throw new Error('Failed to fetch branding configuration');
      }

      const data = await response.json();
      setConfig(data);
      setBrandColor(data.brandColor || '#10b981');
      setSecondaryColor(data.secondaryColor || '#1f2937');
      setCtaColor(data.ctaColor || data.brandColor || '#00ef99');
      setLogoPreview(data.logoUrl);
      setLogoDarkPreview(data.logoDarkUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    variant: 'light' | 'dark',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (variant === 'light') {
        setLogoFile(file);
        setLogoPreview(reader.result as string);
      } else {
        setLogoDarkFile(file);
        setLogoDarkPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogoDark = () => {
    setLogoDarkFile(null);
    setLogoDarkPreview(null);
    if (fileInputDarkRef.current) {
      fileInputDarkRef.current.value = '';
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('logo', file);
    const res = await fetch(`/api/sites/${siteId}/settings/branding/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to upload logo');
    }
    const data = await res.json();
    return data.url as string;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      let newLogoUrl: string | null = config?.logoUrl || null;
      let newLogoDarkUrl: string | null = config?.logoDarkUrl || null;

      if (logoFile || logoDarkFile) setUploading(true);

      if (logoFile) {
        newLogoUrl = await uploadFile(logoFile);
      }
      if (logoDarkFile) {
        newLogoDarkUrl = await uploadFile(logoDarkFile);
      }

      // Handle removals (preview cleared but config had a value)
      if (logoPreview === null && config?.logoUrl) newLogoUrl = null;
      if (logoDarkPreview === null && config?.logoDarkUrl) newLogoDarkUrl = null;

      setUploading(false);

      // Save branding settings
      const response = await fetch(`/api/sites/${siteId}/settings/branding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandColor,
          secondaryColor,
          ctaColor,
          logoUrl: newLogoUrl,
          logoDarkUrl: newLogoDarkUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      const savedData = await response.json();

      const dashboardLogoUrl = savedData.logoUrl || null;
      const dashboardLogoDarkUrl = savedData.logoDarkUrl || null;
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              brandColor,
              secondaryColor,
              ctaColor,
              logoUrl: dashboardLogoUrl,
              logoDarkUrl: dashboardLogoDarkUrl,
            }
          : null,
      );
      setLogoPreview(dashboardLogoUrl);
      setLogoDarkPreview(dashboardLogoDarkUrl);
      setLogoFile(null);
      setLogoDarkFile(null);
      setSuccess(true);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const hasChanges =
    brandColor !== (config?.brandColor || '#10b981') ||
    secondaryColor !== (config?.secondaryColor || '#1f2937') ||
    ctaColor !== (config?.ctaColor || config?.brandColor || '#00ef99') ||
    logoFile !== null ||
    logoDarkFile !== null ||
    (logoPreview === null && config?.logoUrl !== null) ||
    (logoDarkPreview === null && config?.logoDarkUrl !== null);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link
        href={`/dashboard/sites/${siteId}`}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Site
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branding Settings</h1>
        <p className="text-gray-500 mt-1">
          Customize your site&apos;s logo and brand color
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-[#00ef99]/5 border border-[#00ef99]/20 rounded-lg text-[#00ef99]">
          <Check className="h-5 w-5 flex-shrink-0" />
          <p>Branding settings saved successfully!</p>
        </div>
      )}

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Logo</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Upload your business logo. Recommended size: 200x80 pixels or larger. PNG or JPG format.
          </p>

          {logoPreview ? (
            <div className="flex items-start gap-4">
              <div className="relative w-48 h-24 bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="max-w-full max-h-full object-contain p-2"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveLogo}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#00ef99]/40 hover:bg-[#00ef99]/5 transition-colors"
            >
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PNG, JPG up to 5MB
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            onChange={(e) => handleLogoFile(e, 'light')}
            className="hidden"
          />

          {logoPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Replace Logo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dark-Background Logo */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-gray-700" />
            <h2 className="font-semibold">Dark-Background Logo <span className="text-sm font-normal text-gray-500">(optional)</span></h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            A lighter variant of your logo for use on dark surfaces like the footer.
            If left blank, the regular logo above is used everywhere. Same size guidance applies.
          </p>

          {logoDarkPreview ? (
            <div className="flex items-start gap-4">
              <div className="relative w-48 h-24 bg-gray-900 rounded-lg overflow-hidden border flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoDarkPreview}
                  alt="Dark logo preview"
                  className="max-w-full max-h-full object-contain p-2"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveLogoDark}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileInputDarkRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#00ef99]/40 hover:bg-[#00ef99]/5 transition-colors"
            >
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                Click to upload your dark-background variant
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PNG, JPG, SVG up to 5MB
              </p>
            </div>
          )}

          <input
            ref={fileInputDarkRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            onChange={(e) => handleLogoFile(e, 'dark')}
            className="hidden"
          />

          {logoDarkPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputDarkRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Replace Dark Logo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Brand Color */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Brand Color</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Choose your primary brand color. This will be used for buttons, links, and accent elements.
          </p>

          <div className="flex items-center gap-4">
            <Label htmlFor="brandColor" className="sr-only">
              Brand Color
            </Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="brandColor"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border border-gray-300"
              />
              <Input
                type="text"
                value={brandColor}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                    setBrandColor(value);
                  }
                }}
                className="w-28 font-mono"
                placeholder="#10b981"
              />
            </div>
          </div>

          {/* Color Preview */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-3">Preview:</p>
            <div className="flex items-center gap-3">
              <button
                style={{ backgroundColor: brandColor }}
                className="px-4 py-2 text-white rounded-lg text-sm font-medium"
              >
                Sample Button
              </button>
              <a
                href="#"
                style={{ color: brandColor }}
                className="text-sm font-medium hover:underline"
                onClick={(e) => e.preventDefault()}
              >
                Sample Link
              </a>
              <span
                style={{ backgroundColor: brandColor }}
                className="w-8 h-8 rounded-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Color */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-gray-500" />
            <h2 className="font-semibold">Secondary Color</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Used for headings, dark sections, and text accents. Typically a dark neutral tone.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="w-12 h-12 rounded-lg cursor-pointer border border-gray-300"
            />
            <Input
              type="text"
              value={secondaryColor}
              onChange={(e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                  setSecondaryColor(value);
                }
              }}
              className="w-28 font-mono"
              placeholder="#1f2937"
            />
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-3">Preview:</p>
            <div className="flex items-center gap-3">
              <span style={{ color: secondaryColor }} className="text-lg font-bold">
                Section Heading
              </span>
              <span style={{ backgroundColor: secondaryColor }} className="px-3 py-1 text-white rounded text-sm">
                Dark Badge
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA Color */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-orange-500" />
            <h2 className="font-semibold">CTA / Button Color</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Used for call-to-action buttons, form submit buttons, and conversion elements. Defaults to your primary brand color.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={ctaColor}
              onChange={(e) => setCtaColor(e.target.value)}
              className="w-12 h-12 rounded-lg cursor-pointer border border-gray-300"
            />
            <Input
              type="text"
              value={ctaColor}
              onChange={(e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                  setCtaColor(value);
                }
              }}
              className="w-28 font-mono"
              placeholder="#00ef99"
            />
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-3">Preview:</p>
            <div className="flex items-center gap-3">
              <button
                style={{ backgroundColor: ctaColor }}
                className="px-6 py-2.5 text-white rounded-full text-sm font-medium shadow-md"
              >
                Get Free Estimate
              </button>
              <button
                style={{ backgroundColor: ctaColor }}
                className="px-4 py-2 text-white rounded-full text-sm font-medium"
              >
                Book Online
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-black hover:bg-gray-800"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {uploading ? 'Uploading...' : 'Saving...'}
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      {/* Help Section */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="pt-6">
          <h3 className="font-medium text-gray-900 mb-2">Branding Tips</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
            <li>Use a high-contrast logo that works on both light and dark backgrounds</li>
            <li>Choose a brand color that matches your logo or business identity</li>
            <li>Changes will be visible on your public site immediately after saving</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
