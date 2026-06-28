'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, MapPinned, Loader2, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Candidate { city: string; state: string | null }
interface PMConfig {
  travelStrategy: string | null;
  primaryMarketCity: string | null;
  primaryMarketState: string | null;
  homepageIsPrimaryMarket: boolean;
  websiteType: string;
  candidates: Candidate[];
}

const TRAVEL_OPTIONS = [
  { value: 'local', label: 'Local (0–15 mi)', hint: 'One market. Your homepage can double as your market page.' },
  { value: 'regional', label: 'Regional (15–30 mi)', hint: 'Brand homepage + a market hub + nearby city pages.' },
  { value: 'metro', label: 'Metro (30+ mi)', hint: 'Broader metro coverage with more city pages.' },
  { value: 'multi-market', label: 'Multi-market', hint: 'Multiple market hubs, each with its own city structure.' },
];

export default function PrimaryMarketSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [config, setConfig] = useState<PMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('');
  const [travelStrategy, setTravelStrategy] = useState('');
  const [homepageIsPM, setHomepageIsPM] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNeedsRegen, setSavedNeedsRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/sites/${siteId}/settings/primary-market`)
      .then((r) => r.json())
      .then((data: PMConfig) => {
        setConfig(data);
        setCity(data.primaryMarketCity || '');
        setTravelStrategy(data.travelStrategy || '');
        setHomepageIsPM(data.homepageIsPrimaryMarket);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId]);

  const dirty = !!config && (
    city !== (config.primaryMarketCity || '') ||
    travelStrategy !== (config.travelStrategy || '') ||
    homepageIsPM !== config.homepageIsPrimaryMarket
  );

  async function handleSave() {
    setConfirmOpen(false);
    setSaving(true);
    try {
      const state = config?.candidates.find((c) => c.city === city)?.state ?? config?.primaryMarketState ?? null;
      const res = await fetch(`/api/sites/${siteId}/settings/primary-market`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryMarketCity: city || undefined,
          primaryMarketState: state ?? undefined,
          travelStrategy: travelStrategy || undefined,
          homepageIsPrimaryMarket: homepageIsPM,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      toast.success('Primary Market settings saved');
      setSavedNeedsRegen(true);
      setConfig((prev) => prev && { ...prev, primaryMarketCity: city, travelStrategy, homepageIsPrimaryMarket: homepageIsPM });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/retry-build`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to start regeneration');
      }
      toast.success('Regeneration started — your new structure will be live shortly.');
      setSavedNeedsRegen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-2xl p-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <Link href={`/dashboard/sites/${siteId}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
          <MapPinned className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Primary Market</h1>
          <p className="text-sm text-gray-500">Your main target city and how the site is structured around it.</p>
        </div>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Target city</h2></CardHeader>
        <CardContent className="space-y-2">
          <Label>Primary Market city</Label>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger><SelectValue placeholder="Choose your main city..." /></SelectTrigger>
            <SelectContent>
              {(config?.candidates || []).map((c) => (
                <SelectItem key={c.city} value={c.city}>{c.state ? `${c.city}, ${c.state}` : c.city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">The city you most want to win customers in. Your GBP &ldquo;website&rdquo; link should point at this market.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Travel strategy</h2></CardHeader>
        <CardContent className="space-y-2">
          <Select value={travelStrategy} onValueChange={setTravelStrategy}>
            <SelectTrigger><SelectValue placeholder="How far do you travel for work?" /></SelectTrigger>
            <SelectContent>
              {TRAVEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            {TRAVEL_OPTIONS.find((o) => o.value === travelStrategy)?.hint || 'Controls how many city pages get built.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Homepage structure</h2></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="homepage-pm">Use my homepage as my Primary Market page</Label>
              <p className="text-xs text-gray-500 mt-1">
                ON: your homepage targets &ldquo;{config?.primaryMarketCity || 'your city'}&rdquo; directly (best for a single, local market).<br />
                OFF: your homepage is brand-level and a separate market page targets your city (best when you serve a region and want to rank multiple cities).
              </p>
            </div>
            <Switch id="homepage-pm" checked={homepageIsPM} onCheckedChange={setHomepageIsPM} />
          </div>
          {homepageIsPM && travelStrategy && travelStrategy !== 'local' && (
            <div className="flex items-start gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Heads up: using the homepage as your market page is usually best paired with a Local travel strategy.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => setConfirmOpen(true)} disabled={!dirty || saving || !city} className="bg-gray-900 hover:bg-gray-800">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
        {!dirty && !savedNeedsRegen && <span className="text-sm text-gray-400">No changes</span>}
      </div>

      {savedNeedsRegen && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Settings saved — regenerate to apply</p>
                <p className="text-sm text-gray-600">Your new URL structure takes effect once the site is regenerated.</p>
              </div>
            </div>
            <Button onClick={handleRegenerate} disabled={regenerating} size="sm">
              {regenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Regenerate now
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Changing your URL structure can affect local GBP rankings
            </AlertDialogTitle>
            <AlertDialogDescription>
              Updating your Primary Market, travel strategy, or homepage structure can move your pages to new
              URLs. This can temporarily affect how you rank in Google&rsquo;s local results while Google
              re-crawls the site. The change takes effect after you regenerate. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} className="bg-gray-900 hover:bg-gray-800">
              I understand — save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
