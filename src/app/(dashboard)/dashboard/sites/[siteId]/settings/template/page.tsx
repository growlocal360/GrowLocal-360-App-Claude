'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, AlertCircle, ArrowLeft, LayoutTemplate } from 'lucide-react';
import { TEMPLATE_CATALOG } from '@/lib/templates/catalog';
import type { TemplateId } from '@/types/database';

export default function TemplateSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [current, setCurrent] = useState<TemplateId | null>(null);
  const [selected, setSelected] = useState<TemplateId | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/sites/${siteId}/settings/template`);
        if (!res.ok) throw new Error('Failed to load template setting');
        const data = await res.json();
        setCurrent(data.templateId);
        setSelected(data.templateId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId]);

  const save = async () => {
    if (!selected || selected === current) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      const res = await fetch(`/api/sites/${siteId}/settings/template`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selected }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save');
      }
      setCurrent(selected);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const dirty = selected !== current;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/dashboard/sites/${siteId}`} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to site
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
          <LayoutTemplate className="h-5 w-5 text-gray-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Website Template</h1>
          <p className="text-sm text-gray-500">Choose the design for your public website. Your content stays the same — only the look changes.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <Check className="h-4 w-4 shrink-0" /> Template updated. Your site is regenerating its pages now.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {TEMPLATE_CATALOG.map((tpl) => {
          const isSelected = selected === tpl.id;
          const isCurrent = current === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelected(tpl.id)}
              className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all ${
                isSelected ? 'border-[#00ef99] shadow-lg' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
            >
              {/* thumbnail */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                {tpl.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tpl.thumbnail} alt={tpl.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <LayoutTemplate className="h-10 w-10" />
                </div>
                {isCurrent && (
                  <span className="absolute left-3 top-3 rounded-full bg-gray-900/85 px-2.5 py-1 text-xs font-semibold text-white">Active</span>
                )}
                {isSelected && (
                  <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#00ef99] text-gray-900 shadow">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
              {/* meta */}
              <div className="p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-lg font-bold text-gray-900">{tpl.name}</h3>
                  <span className="text-xs font-medium text-gray-400">{tpl.tagline}</span>
                </div>
                <p className="mt-1.5 text-sm text-gray-600">{tpl.description}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {tpl.highlights.map((h) => (
                    <li key={h} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{h}</li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <Button onClick={save} disabled={!dirty || saving} className="rounded-full">
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : dirty ? 'Apply Template' : 'Saved'}
        </Button>
        {dirty && <span className="text-sm text-gray-500">Switching to <b>{TEMPLATE_CATALOG.find(t => t.id === selected)?.name}</b></span>}
      </div>
    </div>
  );
}
