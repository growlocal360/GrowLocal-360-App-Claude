'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, AlertCircle, Check, Loader2, ArrowLeft, Sparkles } from 'lucide-react';

export default function LocalDetailsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [localDetails, setLocalDetails] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [siteId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/settings/local-details`);
      if (!response.ok) throw new Error('Failed to fetch local details');
      const data = await response.json();
      setOriginal(data.localDetails || '');
      setLocalDetails(data.localDetails || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/settings/local-details/generate`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate');
      }
      const data = await response.json();
      setLocalDetails(data.localDetails || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate local details');
    } finally {
      setGenerating(false);
    }
  };

  const hasChanges = localDetails !== original;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch(`/api/sites/${siteId}/settings/local-details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localDetails }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setOriginal(localDetails);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded" />
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

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Local Details</h1>
          <p className="text-gray-500 mt-1">
            Provide local context to make generated content more relevant
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          variant="outline"
          className="flex items-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </>
          )}
        </Button>
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
          <p>Local details saved successfully!</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Local Area Context</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="localDetails">Local details and context</Label>
            <Textarea
              id="localDetails"
              value={localDetails}
              onChange={(e) => setLocalDetails(e.target.value)}
              placeholder={`Describe local details that make your business unique to the area. For example:\n\n- Local landmarks or neighborhoods you serve\n- Regional weather patterns that affect your services\n- Community events you participate in\n- Local regulations or building codes you're familiar with\n- Popular local references (sports teams, landmarks, culture)`}
              className="mt-1"
              rows={10}
            />
            <p className="text-xs text-gray-400 mt-1">
              This information helps the AI create content that feels locally relevant and authentic
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-black hover:bg-gray-800"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
