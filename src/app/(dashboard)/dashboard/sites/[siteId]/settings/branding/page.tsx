'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
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
} from 'lucide-react';

interface BrandingConfig {
  brandColor: string | null;
  logoUrl: string | null;
  siteName: string;
}

export default function BrandingSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<BrandingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [brandColor, setBrandColor] = useState('#10b981'); // Default emerald-500
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

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
      setLogoPreview(data.logoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setLogoFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
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

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // If there's a new logo file, upload it first
      let newLogoUrl = config?.logoUrl || null;

      if (logoFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append('logo', logoFile);

        const uploadResponse = await fetch(`/api/sites/${siteId}/settings/branding/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const data = await uploadResponse.json();
          throw new Error(data.error || 'Failed to upload logo');
        }

        const uploadData = await uploadResponse.json();
        newLogoUrl = uploadData.url;
        setUploading(false);
      }

      // Handle logo removal (if preview is null but config had a logo)
      if (logoPreview === null && config?.logoUrl) {
        newLogoUrl = null;
      }

      // Save branding settings
      const response = await fetch(`/api/sites/${siteId}/settings/branding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandColor,
          logoUrl: newLogoUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      // Update local state
      setConfig((prev) =>
        prev ? { ...prev, brandColor, logoUrl: newLogoUrl } : null
      );
      setLogoFile(null);
      setSuccess(true);

      // Clear success message after 3 seconds
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
    logoFile !== null ||
    (logoPreview === null && config?.logoUrl !== null);

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
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
          <Check className="h-5 w-5 flex-shrink-0" />
          <p>Branding settings saved successfully!</p>
        </div>
      )}

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-emerald-600" />
            <h2 className="font-semibold">Logo</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Upload your business logo. Recommended size: 200x80 pixels or larger. PNG or JPG format.
          </p>

          {logoPreview ? (
            <div className="flex items-start gap-4">
              <div className="relative w-48 h-24 bg-gray-100 rounded-lg overflow-hidden border">
                <Image
                  src={logoPreview}
                  alt="Logo preview"
                  fill
                  className="object-contain p-2"
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
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
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
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileSelect}
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

      {/* Brand Color */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-emerald-600" />
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

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-emerald-500 hover:bg-emerald-600"
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
