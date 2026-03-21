'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Users, FileText, ListChecks, AlertCircle, Check, Loader2, ArrowLeft, X } from 'lucide-react';

const TONE_OPTIONS = [
  'Professional',
  'Friendly',
  'Authoritative',
  'Casual',
  'Technical',
  'Warm',
  'Confident',
  'Empathetic',
  'Direct',
  'Educational',
];

const POV_OPTIONS = [
  { value: 'first_person_plural', label: 'We/Our (recommended)' },
  { value: 'first_person_singular', label: 'I/My' },
  { value: 'third_person', label: 'They/The company' },
];

interface ContentSettings {
  toneValues: string[];
  pointOfView: string;
  wordsToUse: string;
  wordsToAvoid: string;
  targetAudience: string;
  writingSamples: string;
  onboardingNotes: string;
  specificRequests: string;
}

export default function ContentSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [original, setOriginal] = useState<ContentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [toneValues, setToneValues] = useState<string[]>([]);
  const [pointOfView, setPointOfView] = useState('');
  const [wordsToUse, setWordsToUse] = useState('');
  const [wordsToAvoid, setWordsToAvoid] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [writingSamples, setWritingSamples] = useState('');
  const [onboardingNotes, setOnboardingNotes] = useState('');
  const [specificRequests, setSpecificRequests] = useState('');

  useEffect(() => {
    fetchSettings();
  }, [siteId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/settings/content`);
      if (!response.ok) throw new Error('Failed to fetch content settings');
      const data: ContentSettings = await response.json();
      setOriginal(data);
      setToneValues(data.toneValues || []);
      setPointOfView(data.pointOfView || '');
      setWordsToUse(data.wordsToUse || '');
      setWordsToAvoid(data.wordsToAvoid || '');
      setTargetAudience(data.targetAudience || '');
      setWritingSamples(data.writingSamples || '');
      setOnboardingNotes(data.onboardingNotes || '');
      setSpecificRequests(data.specificRequests || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    JSON.stringify(toneValues) !== JSON.stringify(original?.toneValues || []) ||
    pointOfView !== (original?.pointOfView || '') ||
    wordsToUse !== (original?.wordsToUse || '') ||
    wordsToAvoid !== (original?.wordsToAvoid || '') ||
    targetAudience !== (original?.targetAudience || '') ||
    writingSamples !== (original?.writingSamples || '') ||
    onboardingNotes !== (original?.onboardingNotes || '') ||
    specificRequests !== (original?.specificRequests || '');

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch(`/api/sites/${siteId}/settings/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toneValues,
          pointOfView,
          wordsToUse,
          wordsToAvoid,
          targetAudience,
          writingSamples,
          onboardingNotes,
          specificRequests,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setOriginal({
        toneValues,
        pointOfView,
        wordsToUse,
        wordsToAvoid,
        targetAudience,
        writingSamples,
        onboardingNotes,
        specificRequests,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleTone = (tone: string) => {
    setToneValues((prev) =>
      prev.includes(tone) ? prev.filter((t) => t !== tone) : [...prev, tone]
    );
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

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Content Settings</h1>
        <p className="text-gray-500 mt-1">
          Control how AI generates content for your site
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
          <p>Content settings saved successfully!</p>
        </div>
      )}

      {/* Voice & Tone */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Voice & Tone</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tone (select up to 3)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {TONE_OPTIONS.map((tone) => {
                const isSelected = toneValues.includes(tone);
                const isDisabled = !isSelected && toneValues.length >= 3;
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => !isDisabled && toggleTone(tone)}
                    disabled={isDisabled}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'bg-[#00ef99]/10 border-[#00ef99] text-[#00ef99]'
                        : isDisabled
                          ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {tone}
                    {isSelected && <X className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="pov">Point of View</Label>
            <Select value={pointOfView} onValueChange={setPointOfView}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select point of view" />
              </SelectTrigger>
              <SelectContent>
                {POV_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="wordsToUse">Words & Phrases to Use</Label>
            <Textarea
              id="wordsToUse"
              value={wordsToUse}
              onChange={(e) => setWordsToUse(e.target.value)}
              placeholder="e.g., reliable, family-owned, trusted, certified..."
              className="mt-1"
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1">
              Comma-separated words or phrases the AI should try to include
            </p>
          </div>

          <div>
            <Label htmlFor="wordsToAvoid">Words & Phrases to Avoid</Label>
            <Textarea
              id="wordsToAvoid"
              value={wordsToAvoid}
              onChange={(e) => setWordsToAvoid(e.target.value)}
              placeholder="e.g., cheap, discount, budget..."
              className="mt-1"
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1">
              Comma-separated words or phrases the AI should never use
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Target Audience */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Target Audience</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="targetAudience">Who is your ideal customer?</Label>
            <Textarea
              id="targetAudience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., Homeowners in the Dallas-Fort Worth area, ages 30-65, who value quality and reliability over the cheapest price..."
              className="mt-1"
              rows={4}
            />
            <p className="text-xs text-gray-400 mt-1">
              Describe your target customer demographics, needs, and preferences
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Reference Material */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Reference Material</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="writingSamples">Writing Samples</Label>
            <Textarea
              id="writingSamples"
              value={writingSamples}
              onChange={(e) => setWritingSamples(e.target.value)}
              placeholder="Paste examples of your existing content, marketing copy, or website text that represents your brand voice..."
              className="mt-1 font-mono text-sm"
              rows={6}
            />
            <p className="text-xs text-gray-400 mt-1">
              Examples of content that matches your desired voice and style
            </p>
          </div>

          <div>
            <Label htmlFor="onboardingNotes">Onboarding Notes</Label>
            <Textarea
              id="onboardingNotes"
              value={onboardingNotes}
              onChange={(e) => setOnboardingNotes(e.target.value)}
              placeholder="Any additional context about the business, unique selling points, competitive advantages, special certifications..."
              className="mt-1"
              rows={4}
            />
            <p className="text-xs text-gray-400 mt-1">
              Background information to help the AI better understand your business
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Specific Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Specific Requests</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="specificRequests">Content generation instructions</Label>
            <Textarea
              id="specificRequests"
              value={specificRequests}
              onChange={(e) => setSpecificRequests(e.target.value)}
              placeholder="e.g., Always mention our 24/7 emergency service, Include a mention of our satisfaction guarantee on every page, Emphasize our 20+ years of experience..."
              className="mt-1"
              rows={4}
            />
            <p className="text-xs text-gray-400 mt-1">
              Specific instructions the AI should follow when generating any content
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
