'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardList, MousePointerClick, AlertCircle, Check, Loader2, ArrowLeft, ArrowUp, ArrowDown, X, Plus } from 'lucide-react';

export default function LeadFormSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [ctaText, setCtaText] = useState('');
  const [formHeading, setFormHeading] = useState('');
  const [formSubheading, setFormSubheading] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [customOption, setCustomOption] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/sites/${siteId}/settings/lead-form`);
        if (!res.ok) throw new Error();
        const d = await res.json();
        setCtaText(d.ctaText || '');
        setFormHeading(d.formHeading || '');
        setFormSubheading(d.formSubheading || '');
        setOptions(d.serviceOptions || []);
        setAvailableCategories(d.available?.categories || []);
        setAvailableServices(d.available?.services || []);
      } catch {
        setError('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId]);

  const selected = useMemo(() => new Set(options.map((o) => o.toLowerCase())), [options]);

  const toggle = (name: string) => {
    setOptions((prev) =>
      prev.some((o) => o.toLowerCase() === name.toLowerCase())
        ? prev.filter((o) => o.toLowerCase() !== name.toLowerCase())
        : [...prev, name]
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    setOptions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addCustom = () => {
    const value = customOption.trim();
    if (!value || selected.has(value.toLowerCase())) return;
    setOptions((prev) => [...prev, value]);
    setCustomOption('');
  };

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      const res = await fetch(`/api/sites/${siteId}/settings/lead-form`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctaText, formHeading, formSubheading, serviceOptions: options }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save');
      }
      const d = await res.json();
      setOptions(d.serviceOptions || []);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderChoices = (names: string[]) => (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {names.map((name) => (
        <label key={name} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={selected.has(name.toLowerCase())}
            onChange={() => toggle(name)}
          />
          <span className="text-gray-800">{name}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/dashboard/sites/${siteId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to Site
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lead Form &amp; CTA Button</h1>
        <p className="mt-1 text-gray-600">
          Change the button text, the form header, and which services visitors can pick in the form. Leave a field blank to
          use the default.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <MousePointerClick className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Button &amp; Form Header</h3>
                  <p className="text-sm text-gray-500">Shown on every page of the site</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label htmlFor="ctaText">Button text</Label>
                <Input
                  id="ctaText"
                  className="mt-1"
                  value={ctaText}
                  maxLength={40}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="Book Online"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The header, hero, and bottom-of-page buttons. Default follows your scheduling setting (&ldquo;Book
                  Online&rdquo; or &ldquo;Get Free Estimate&rdquo;).
                </p>
              </div>
              <div>
                <Label htmlFor="formHeading">Form header</Label>
                <Input
                  id="formHeading"
                  className="mt-1"
                  value={formHeading}
                  maxLength={40}
                  onChange={(e) => setFormHeading(e.target.value)}
                  placeholder={ctaText || 'Book Online'}
                />
                <p className="mt-1 text-xs text-gray-500">The large heading at the top of the form. Blank uses the button text.</p>
              </div>
              <div>
                <Label htmlFor="formSubheading">Line under the header</Label>
                <Input
                  id="formSubheading"
                  className="mt-1"
                  value={formSubheading}
                  maxLength={80}
                  onChange={(e) => setFormSubheading(e.target.value)}
                  placeholder="In less than 30 seconds"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <ClipboardList className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-semibold">&ldquo;Select a service&rdquo; options</h3>
                  <p className="text-sm text-gray-500">
                    {options.length > 0
                      ? `${options.length} option${options.length === 1 ? '' : 's'} selected`
                      : 'Nothing selected — the dropdown lists your business categories'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {options.length > 0 && (
                <div>
                  <Label>Dropdown order</Label>
                  <ul className="mt-2 divide-y rounded-lg border">
                    {options.map((o, i) => (
                      <li key={o} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span className="flex-1 text-gray-800">{o}</span>
                        <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${o} up`}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === options.length - 1} aria-label={`Move ${o} down`}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggle(o)} aria-label={`Remove ${o}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {availableServices.length > 0 && (
                <div>
                  <Label>Services</Label>
                  {renderChoices(availableServices)}
                </div>
              )}

              {availableCategories.length > 0 && (
                <div>
                  <Label>Business categories</Label>
                  {renderChoices(availableCategories)}
                </div>
              )}

              <div>
                <Label htmlFor="customOption">Add your own option</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="customOption"
                    value={customOption}
                    maxLength={80}
                    onChange={(e) => setCustomOption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustom();
                      }
                    }}
                    placeholder="e.g. Other / Not sure"
                  />
                  <Button variant="outline" onClick={addCustom} disabled={!customOption.trim()}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <Check className="h-4 w-4 shrink-0" /> Saved. Your site has been refreshed.
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="bg-black hover:bg-gray-800">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
