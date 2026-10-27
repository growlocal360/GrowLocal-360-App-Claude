'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Check, AlertCircle, ImageIcon, X as XIcon, Plus, Trash2 } from 'lucide-react';

type PageType = 'home' | 'about' | 'contact' | 'privacy' | 'terms';
interface Pair { title: string; description: string }
interface Block { heading: string; paragraphs: string[] }

const TITLES: Record<PageType, string> = { home: 'Home page', about: 'About page', contact: 'Contact page', privacy: 'Privacy Policy', terms: 'Terms of Service' };
const isLegal = (p: PageType) => p === 'privacy' || p === 'terms';

/** Textarea helpers: paragraphs are separated by a blank line; lists by newlines. */
const joinParas = (p: string[] | undefined) => (p || []).join('\n\n');
const splitParas = (s: string) => s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const joinLines = (p: string[] | undefined) => (p || []).join('\n');
const splitLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

/** Edit the text and hero image of a core page. Saves write the site_pages row and refresh the live site. */
export default function CorePageEditor() {
  const params = useParams();
  const siteId = params.siteId as string;
  const pageType = params.pageType as PageType;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [h1, setH1] = useState('');
  const [h2, setH2] = useState('');
  const [heroDescription, setHeroDescription] = useState('');
  const [bodyCopy, setBodyCopy] = useState('');
  const [bodyCopy2, setBodyCopy2] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  // home blocks
  const [processHeading, setProcessHeading] = useState('');
  const [processSteps, setProcessSteps] = useState<Pair[]>([]);
  const [whyHeading, setWhyHeading] = useState('');
  const [whyIntro, setWhyIntro] = useState('');
  const [whyPoints, setWhyPoints] = useState<Pair[]>([]);
  // about blocks
  const [story, setStory] = useState<Block>({ heading: '', paragraphs: [] });
  const [mission, setMission] = useState<Block>({ heading: '', paragraphs: [] });
  const [experience, setExperience] = useState<Block & { highlights: string[] }>({ heading: '', paragraphs: [], highlights: [] });
  const [local, setLocal] = useState<Block>({ heading: '', paragraphs: [] });
  const [trustHeading, setTrustHeading] = useState('');
  const [trustPoints, setTrustPoints] = useState<Pair[]>([]);
  const [ctaHeading, setCtaHeading] = useState('');
  const [ctaDescription, setCtaDescription] = useState('');

  // hero image
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [generatedHeroUrl, setGeneratedHeroUrl] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [usingDefaults, setUsingDefaults] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/sites/${siteId}/settings/pages/${pageType}`);
        if (!res.ok) throw new Error('Failed to load page');
        const d = await res.json();
        setH1(d.h1 || ''); setH2(d.h2 || ''); setHeroDescription(d.heroDescription || '');
        setBodyCopy(d.bodyCopy || ''); setBodyCopy2(d.bodyCopy2 || '');
        setMetaTitle(d.metaTitle || ''); setMetaDescription(d.metaDescription || '');
        setHeroImageUrl(d.heroImageUrl || null); setGeneratedHeroUrl(d.generatedHeroUrl || null);
        setUsingDefaults(!!d.usingDefaults);
        const s = d.sections || {};
        setProcessHeading(s.process?.heading || ''); setProcessSteps(s.process?.steps || []);
        setWhyHeading(s.why?.heading || ''); setWhyIntro(s.why?.intro || ''); setWhyPoints(s.why?.points || []);
        setStory({ heading: s.founder_story?.heading || '', paragraphs: s.founder_story?.paragraphs || [] });
        setMission({ heading: s.mission_values?.heading || '', paragraphs: s.mission_values?.paragraphs || [] });
        setExperience({ heading: s.experience_credentials?.heading || '', paragraphs: s.experience_credentials?.paragraphs || [], highlights: s.experience_credentials?.highlights || [] });
        setLocal({ heading: s.local_connection?.heading || '', paragraphs: s.local_connection?.paragraphs || [] });
        setTrustHeading(s.trust_points?.heading || ''); setTrustPoints(s.trust_points?.points || []);
        setCtaHeading(s.cta?.heading || ''); setCtaDescription(s.cta?.description || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load page');
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId, pageType]);

  const sectionsPayload = () => {
    if (pageType === 'home') {
      return {
        process: { heading: processHeading, steps: processSteps },
        why: { heading: whyHeading, intro: whyIntro, points: whyPoints },
      };
    }
    if (pageType === 'about') {
      return {
        founder_story: story, mission_values: mission, experience_credentials: experience, local_connection: local,
        trust_points: { heading: trustHeading, points: trustPoints },
        cta: { heading: ctaHeading, description: ctaDescription },
      };
    }
    return undefined;
  };

  const save = async (extra: Record<string, unknown> = {}) => {
    try {
      setSaving(true); setError(null); setSuccess(false);
      const res = await fetch(`/api/sites/${siteId}/settings/pages/${pageType}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ h1, h2, heroDescription, bodyCopy, bodyCopy2, metaTitle, metaDescription, sections: sectionsPayload(), ...extra }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save');
      setSuccess(true); setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleHeroFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be smaller than 10MB'); return; }
    try {
      setImageBusy(true); setError(null);
      const fd = new FormData(); fd.append('photo', file);
      const up = await fetch(`/api/sites/${siteId}/settings/pages/hero-image`, { method: 'POST', body: fd });
      if (!up.ok) throw new Error((await up.json().catch(() => ({}))).error || 'Failed to upload image');
      const { url } = await up.json();
      await save({ heroImageUrl: url });
      setHeroImageUrl(url.startsWith('/public/assets/') ? `/api/sites/${siteId}/${url.replace('/public/', '')}` : url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to upload image'); }
    finally { setImageBusy(false); }
  };
  const removeHeroImage = async () => {
    setImageBusy(true);
    await save({ heroImageUrl: null });
    setHeroImageUrl(null);
    setImageBusy(false);
  };

  const PairList = ({ items, onChange, titlePh, descPh, max }: { items: Pair[]; onChange: (p: Pair[]) => void; titlePh: string; descPh: string; max: number }) => (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 rounded-lg border p-3">
          <div className="flex-1 space-y-2">
            <Input value={it.title} placeholder={titlePh} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <Textarea rows={2} value={it.description} placeholder={descPh} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700" aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      {items.length < max && (
        <Button variant="outline" size="sm" onClick={() => onChange([...items, { title: '', description: '' }])}><Plus className="mr-1 h-4 w-4" /> Add</Button>
      )}
    </div>
  );

  const BlockEditor = ({ label, value, onChange, hint }: { label: string; value: Block; onChange: (b: Block) => void; hint?: string }) => (
    <Card>
      <CardHeader><h2 className="font-semibold">{label}</h2></CardHeader>
      <CardContent className="space-y-3">
        <Input value={value.heading} placeholder="Section heading" onChange={(e) => onChange({ ...value, heading: e.target.value })} />
        <Textarea rows={6} value={joinParas(value.paragraphs)} placeholder="Paragraphs, separated by a blank line" onChange={(e) => onChange({ ...value, paragraphs: splitParas(e.target.value) })} />
        <p className="text-xs text-gray-500">{hint || 'Leave empty to hide this section.'}</p>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-8 flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/dashboard/sites/${siteId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to Site
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit: {TITLES[pageType]}</h1>
          <p className="mt-1 text-gray-600">Changes go live when you save. Regenerating content will overwrite these edits.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {(['home', 'about', 'contact', 'privacy', 'terms'] as PageType[]).filter((p) => p !== pageType && isLegal(p) === isLegal(pageType)).map((p) => (
            <Button key={p} variant="ghost" size="sm" asChild><Link href={`/dashboard/sites/${siteId}/settings/pages/${p}`}>{TITLES[p]}</Link></Button>
          ))}
          <Button onClick={() => save()} disabled={saving} className="bg-black hover:bg-gray-800">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Changes
          </Button>
        </div>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" /> {error}</div>}
      {success && <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700"><Check className="h-4 w-4 shrink-0" /> Saved. The page has been refreshed.</div>}
      {isLegal(pageType) && usingDefaults && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This page is showing GrowLocal&apos;s default text, built from your business details. It is general boilerplate, not legal advice. Edit anything below and Save to replace it.
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader><h2 className="font-semibold">{isLegal(pageType) ? 'Heading' : 'Heading & hero'}</h2></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="h1">Page heading (H1)</Label>
              <Input id="h1" className="mt-1" value={h1} maxLength={140} onChange={(e) => setH1(e.target.value)} />
            </div>
            {pageType === 'home' && (
              <div>
                <Label htmlFor="h2">Subheading (H2)</Label>
                <Input id="h2" className="mt-1" value={h2} maxLength={160} onChange={(e) => setH2(e.target.value)} />
              </div>
            )}
            {!isLegal(pageType) && (
            <div>
              <Label htmlFor="hero">Hero text</Label>
              <Textarea id="hero" className="mt-1" rows={3} value={heroDescription} maxLength={600} onChange={(e) => setHeroDescription(e.target.value)} />
              <p className="mt-1 text-xs text-gray-500">The sentence or two under the heading.</p>
            </div>
            )}
            {pageType === 'home' && (
              <div>
                <Label>Hero image</Label>
                <div className="mt-1 flex items-center gap-4">
                  <label className="relative flex h-28 w-44 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-gray-400" title={heroImageUrl ? 'Replace hero image' : 'Upload hero image'}>
                    {heroImageUrl || generatedHeroUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={heroImageUrl || generatedHeroUrl || ''} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                    )}
                    {imageBusy && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin" /></span>}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={imageBusy} onChange={(e) => { handleHeroFile(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  <div className="text-xs text-gray-500">
                    <p>{heroImageUrl ? 'Your uploaded photo is shown behind the hero.' : generatedHeroUrl ? 'Currently showing the generated image. Upload your own to replace it.' : 'No hero image yet. Upload one (wide, landscape).'}</p>
                    <p className="mt-1">Uploads save immediately.</p>
                    {heroImageUrl && (
                      <button type="button" onClick={removeHeroImage} disabled={imageBusy} className="mt-2 inline-flex items-center gap-1 text-red-600 hover:text-red-700"><XIcon className="h-3 w-3" /> Remove and use the generated image</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold">Search listing</h2></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="metaTitle">Title tag <span className="text-gray-400 font-normal">({metaTitle.length}/60)</span></Label>
              <Input id="metaTitle" className="mt-1" value={metaTitle} maxLength={70} onChange={(e) => setMetaTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="metaDescription">Meta description <span className="text-gray-400 font-normal">({metaDescription.length}/155)</span></Label>
              <Textarea id="metaDescription" className="mt-1" rows={2} value={metaDescription} maxLength={200} onChange={(e) => setMetaDescription(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold">{pageType === 'contact' ? 'Intro copy' : isLegal(pageType) ? 'Policy text' : 'Body copy'}</h2></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="bodyCopy">{pageType === 'home' ? 'Main copy' : pageType === 'about' ? 'Story (fallback when the sections below are empty)' : isLegal(pageType) ? 'Full text' : 'Intro paragraph'}</Label>
              <Textarea id="bodyCopy" className="mt-1" rows={isLegal(pageType) ? 22 : 6} value={bodyCopy} onChange={(e) => setBodyCopy(e.target.value)} />
              <p className="mt-1 text-xs text-gray-500">Separate paragraphs with a blank line.</p>
            </div>
            {pageType !== 'contact' && !isLegal(pageType) && (
              <div>
                <Label htmlFor="bodyCopy2">Second block</Label>
                <Textarea id="bodyCopy2" className="mt-1" rows={4} value={bodyCopy2} onChange={(e) => setBodyCopy2(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        {pageType === 'home' && (
          <>
            <Card>
              <CardHeader><h2 className="font-semibold">How it works</h2></CardHeader>
              <CardContent className="space-y-3">
                <Input value={processHeading} placeholder="Section heading" onChange={(e) => setProcessHeading(e.target.value)} />
                <PairList items={processSteps} onChange={setProcessSteps} titlePh="Step title" descPh="What happens in this step" max={3} />
                <p className="text-xs text-gray-500">Three steps. Leave empty to use the template default.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><h2 className="font-semibold">Why choose us</h2></CardHeader>
              <CardContent className="space-y-3">
                <Input value={whyHeading} placeholder="Section heading" onChange={(e) => setWhyHeading(e.target.value)} />
                <Input value={whyIntro} placeholder="One-line intro" onChange={(e) => setWhyIntro(e.target.value)} />
                <PairList items={whyPoints} onChange={setWhyPoints} titlePh="Point" descPh="One sentence" max={3} />
              </CardContent>
            </Card>
          </>
        )}

        {pageType === 'about' && (
          <>
            <BlockEditor label="Our story" value={story} onChange={setStory} />
            <BlockEditor label="Mission / how we work" value={mission} onChange={setMission} />
            <Card>
              <CardHeader><h2 className="font-semibold">Experience &amp; credentials</h2></CardHeader>
              <CardContent className="space-y-3">
                <Input value={experience.heading} placeholder="Section heading" onChange={(e) => setExperience({ ...experience, heading: e.target.value })} />
                <Textarea rows={5} value={joinParas(experience.paragraphs)} placeholder="Paragraphs, separated by a blank line" onChange={(e) => setExperience({ ...experience, paragraphs: splitParas(e.target.value) })} />
                <Textarea rows={3} value={joinLines(experience.highlights)} placeholder="Highlights, one per line (e.g. Licensed & insured). Only list what is true." onChange={(e) => setExperience({ ...experience, highlights: splitLines(e.target.value) })} />
              </CardContent>
            </Card>
            <BlockEditor label="Local connection" value={local} onChange={setLocal} />
            <Card>
              <CardHeader><h2 className="font-semibold">Why customers choose us</h2></CardHeader>
              <CardContent className="space-y-3">
                <Input value={trustHeading} placeholder="Section heading" onChange={(e) => setTrustHeading(e.target.value)} />
                <PairList items={trustPoints} onChange={setTrustPoints} titlePh="Point" descPh="One or two sentences" max={6} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><h2 className="font-semibold">Closing call to action</h2></CardHeader>
              <CardContent className="space-y-3">
                <Input value={ctaHeading} placeholder="Heading" onChange={(e) => setCtaHeading(e.target.value)} />
                <Textarea rows={2} value={ctaDescription} placeholder="One or two sentences" onChange={(e) => setCtaDescription(e.target.value)} />
              </CardContent>
            </Card>
          </>
        )}

        <div className="flex justify-end">
          <Button onClick={() => save()} disabled={saving} className="bg-black hover:bg-gray-800">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
