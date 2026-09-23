'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';

interface Problem { heading: string; description: string }
interface Section { h2: string; body: string; bullets: string[] }
interface Faq { question: string; answer: string }

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  h1: string | null;
  meta_title: string | null;
  meta_description: string | null;
  intro_copy: string | null;
  body_copy: string | null;
  problems: Problem[] | null;
  detailed_sections: Section[] | null;
  faqs: Faq[] | null;
}

/** Edit everything the service page shows. Saves through the services PATCH; the public page refreshes on save. */
export default function ServiceEditorPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const serviceId = params.serviceId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [h1, setH1] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [introCopy, setIntroCopy] = useState('');
  const [bodyCopy, setBodyCopy] = useState('');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/sites/${siteId}/settings/services`);
        if (!res.ok) throw new Error('Failed to load service');
        const data = await res.json();
        const svc = (data.services as ServiceRow[]).find((s) => s.id === serviceId);
        if (!svc) throw new Error('Service not found');
        setName(svc.name || '');
        setDescription(svc.description || '');
        setH1(svc.h1 || '');
        setMetaTitle(svc.meta_title || '');
        setMetaDescription(svc.meta_description || '');
        setIntroCopy(svc.intro_copy || '');
        setBodyCopy(svc.body_copy || '');
        setProblems(svc.problems || []);
        setSections((svc.detailed_sections || []).map((s) => ({ ...s, bullets: s.bullets || [] })));
        setFaqs(svc.faqs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load service');
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId, serviceId]);

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      const res = await fetch(`/api/sites/${siteId}/settings/services`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: serviceId,
          ...(name.trim() ? { name: name.trim() } : {}),
          description: description.trim() || null,
          h1, metaTitle, metaDescription, introCopy, bodyCopy,
          problems, detailedSections: sections, faqs,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Generic list helpers (move / remove) for the three repeating blocks.
  function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }
  const RowTools = ({ i, len, onMove, onRemove }: { i: number; len: number; onMove: (d: -1 | 1) => void; onRemove: () => void }) => (
    <div className="flex shrink-0 items-start gap-1">
      <Button variant="ghost" size="sm" onClick={() => onMove(-1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" onClick={() => onMove(1)} disabled={i === len - 1} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
      <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-700" aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
    </div>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/dashboard/sites/${siteId}/settings/services`} className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to Services
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit: {name || 'Service'}</h1>
          <p className="mt-1 text-gray-600">Everything the service page shows. Changes go live when you save. Regenerating content will overwrite these edits.</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-black hover:bg-gray-800 shrink-0">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Changes
        </Button>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" /> {error}</div>}
      {success && <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700"><Check className="h-4 w-4 shrink-0" /> Saved. The page has been refreshed.</div>}

      <div className="space-y-6">
        <Card>
          <CardHeader><h2 className="font-semibold">Basics</h2></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Service name</Label>
              <Input id="name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              <p className="mt-1 text-xs text-gray-500">Renaming changes the page URL.</p>
            </div>
            <div>
              <Label htmlFor="description">Short description</Label>
              <Textarea id="description" className="mt-1" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              <p className="mt-1 text-xs text-gray-500">Shown under the heading on the service page and on service cards across the site.</p>
            </div>
            <div>
              <Label htmlFor="h1">Page heading (H1)</Label>
              <Input id="h1" className="mt-1" value={h1} maxLength={120} onChange={(e) => setH1(e.target.value)} placeholder={name} />
            </div>
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
          <CardHeader><h2 className="font-semibold">Intro</h2></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="introCopy">Opening paragraph</Label>
              <Textarea id="introCopy" className="mt-1" rows={3} value={introCopy} maxLength={600} onChange={(e) => setIntroCopy(e.target.value)} />
              <p className="mt-1 text-xs text-gray-500">The first paragraph on the page, above &ldquo;Common problems we fix&rdquo;.</p>
            </div>
            <div>
              <Label htmlFor="bodyCopy">Fallback body copy</Label>
              <Textarea id="bodyCopy" className="mt-1" rows={4} value={bodyCopy} maxLength={6000} onChange={(e) => setBodyCopy(e.target.value)} />
              <p className="mt-1 text-xs text-gray-500">Only shown when the opening paragraph is empty. Separate paragraphs with a blank line.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Common problems we fix</h2>
              <Button variant="outline" size="sm" onClick={() => setProblems([...problems, { heading: '', description: '' }])}><Plus className="mr-1 h-4 w-4" /> Add</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {problems.length === 0 && <p className="text-sm text-gray-500">None. This section is hidden on the page.</p>}
            {problems.map((p, i) => (
              <div key={i} className="flex gap-2 rounded-lg border p-3">
                <div className="flex-1 space-y-2">
                  <Input value={p.heading} maxLength={120} placeholder="Problem (in the customer's words)" onChange={(e) => setProblems(problems.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)))} />
                  <Textarea rows={2} value={p.description} maxLength={600} placeholder="Usual cause and what the fix involves" onChange={(e) => setProblems(problems.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                </div>
                <RowTools i={i} len={problems.length} onMove={(d) => setProblems(move(problems, i, d))} onRemove={() => setProblems(problems.filter((_, j) => j !== i))} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Sections</h2>
              <Button variant="outline" size="sm" onClick={() => setSections([...sections, { h2: '', body: '', bullets: [] }])}><Plus className="mr-1 h-4 w-4" /> Add</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sections.length === 0 && <p className="text-sm text-gray-500">None. The fallback body copy is shown instead.</p>}
            {sections.map((s, i) => (
              <div key={i} className="flex gap-2 rounded-lg border p-3">
                <div className="flex-1 space-y-2">
                  <Input value={s.h2} maxLength={120} placeholder="Section heading" onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, h2: e.target.value } : x)))} />
                  <Textarea rows={4} value={s.body} maxLength={2000} placeholder="Section text" onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
                  <Textarea
                    rows={3}
                    value={s.bullets.join('\n')}
                    placeholder="Bullet points, one per line (optional)"
                    onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, bullets: e.target.value.split('\n') } : x)))}
                  />
                </div>
                <RowTools i={i} len={sections.length} onMove={(d) => setSections(move(sections, i, d))} onRemove={() => setSections(sections.filter((_, j) => j !== i))} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">FAQs</h2>
              <Button variant="outline" size="sm" onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}><Plus className="mr-1 h-4 w-4" /> Add</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqs.length === 0 && <p className="text-sm text-gray-500">None. The FAQ section is hidden on the page.</p>}
            {faqs.map((f, i) => (
              <div key={i} className="flex gap-2 rounded-lg border p-3">
                <div className="flex-1 space-y-2">
                  <Input value={f.question} maxLength={200} placeholder="Question" onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
                  <Textarea rows={3} value={f.answer} maxLength={1200} placeholder="Answer" onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
                </div>
                <RowTools i={i} len={faqs.length} onMove={(d) => setFaqs(move(faqs, i, d))} onRemove={() => setFaqs(faqs.filter((_, j) => j !== i))} />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-black hover:bg-gray-800">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
