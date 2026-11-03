'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Grid3x3, MapPin, Loader2, RefreshCw, AlertCircle, Plus, X, Bot, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { rankTone, type ScannedPoint, type ScanSummary, fitZoom, mapPercent, aiModelLabel } from '@/lib/rank/grid';

interface ScanRow { id: string; keyword: string; grid_size: number; spacing_miles: number; center_lat: number; center_lng: number; points: ScannedPoint[]; summary: ScanSummary; scanned_at: string; cost_usd: number | null; failed_points: number }
interface AiCheckRow { model: string; model_id: string; prompt: string; mentioned: boolean; position: number | null; competitors: string[]; answered?: boolean; error: string | null }
interface RankingsResponse {
  settings: { enabled: boolean; keywords: string[]; gridSize: number; spacingMiles: number; keywordsAreDefaults: boolean };
  providerConfigured: boolean;
  aiModels: string[];
  hasCenter: boolean;
  lastRun: { at: string; ok: boolean; message: string; scanned: number; failed: number } | null;
  center: { lat: number; lng: number; city: string | null } | null;
  scans: { keyword: string; latest: ScanRow; previous: ScanRow | null }[];
  ai: { batchAt: string; mentionedShare: number; previousShare: number | null; byModel: { model: string; mentionedShare: number; checks: AiCheckRow[] }[]; topCompetitors: { name: string; count: number }[] } | null;
  estimatedCostPerScan: number;
  credits: { balance: number; perManualScan: number; packs: { id: string; credits: number; priceCents: number; label: string; note: string }[]; orgName: string | null };
  pendingRun: { at: string; keywords: string[] } | null;
}

const TONE_CLASS: Record<ReturnType<typeof rankTone>, string> = {
  top3: 'bg-emerald-500 text-white',
  top10: 'bg-amber-400 text-gray-900',
  top20: 'bg-orange-500 text-white',
  none: 'bg-red-500/80 text-white',
};

function fmt(d: string | null | undefined) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; }
}

const MAP_PX = 400; // CSS width the static map is requested at; it scales down responsively

/** Rank dots placed by true lat/lng over a muted street map centred on the business. Falls back to a plain grid if the map cannot load. */
function Heatmap({ scan, siteId }: { scan: ScanRow; siteId: string }) {
  const [mapFailed, setMapFailed] = useState(false);
  const size = scan.grid_size;
  const hasCenter = typeof scan.center_lat === 'number' && typeof scan.center_lng === 'number';
  if (mapFailed || !hasCenter) {
    return (
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, maxWidth: size * 44 }}>
        {scan.points.map((p) => (
          <div key={`${p.row}-${p.col}`} title={`${p.rank === null ? 'Not in top 20' : `#${p.rank}`} at ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`} className={`flex aspect-square items-center justify-center rounded text-[11px] font-semibold ${TONE_CLASS[rankTone(p.rank)]}`}>
            {p.rank === null ? '20+' : p.rank}
          </div>
        ))}
      </div>
    );
  }
  const zoom = fitZoom(scan.points, MAP_PX);
  const dotPct = (82 / Math.max(1, size - 1)) * 0.6; // dot diameter as % of map width: 60% of the gap between points, so streets stay readable
  const src = `/api/sites/${siteId}/rankings/map?lat=${scan.center_lat}&lng=${scan.center_lng}&zoom=${zoom}&size=${MAP_PX}`;
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100" style={{ maxWidth: MAP_PX, aspectRatio: '1 / 1' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setMapFailed(true)} draggable={false} />
      {scan.points.map((p) => {
        const pos = mapPercent(p.lat, p.lng, scan.center_lat, scan.center_lng, zoom, MAP_PX);
        return (
          <div
            key={`${p.row}-${p.col}`}
            title={`${p.rank === null ? 'Not in top 20' : `#${p.rank}`} at ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.35)] ring-2 ring-white/90 ${TONE_CLASS[rankTone(p.rank)]}`}
            style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: `${dotPct}%`, aspectRatio: '1 / 1' }}
          >
            {p.rank === null ? '20+' : p.rank}
          </div>
        );
      })}
      <MapPin className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-full fill-gray-900 text-white drop-shadow" aria-label="Business location" />
    </div>
  );
}

/** One heatmap card: a keyword's latest scan on the overview, or one dated scan in the per-keyword history. */
function ScanCard({ title, latest, previous, siteId, onPick }: { title: string; latest: ScanRow; previous: ScanRow | null; siteId: string; onPick?: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            {onPick ? (
              <button type="button" onClick={onPick} className="text-left font-semibold text-gray-900 underline-offset-2 hover:underline" title="Show every scan of this keyword">{title}</button>
            ) : (
              <h3 className="font-semibold text-gray-900">{title}</h3>
            )}
            <p className="text-xs text-gray-400">{onPick ? `${fmt(latest.scanned_at)} · ` : ''}{latest.grid_size}×{latest.grid_size} grid, {latest.spacing_miles} mi{latest.failed_points ? ` · ${latest.failed_points} points failed` : ''}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-gray-900">{latest.summary.visibility}<span className="text-sm font-medium text-gray-400">/100</span></div>
            <div className="text-[11px] text-gray-500">visibility</div>
            <Change now={latest.summary.visibility} before={previous?.summary.visibility} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Heatmap scan={latest} siteId={siteId} />
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div><div className="font-semibold text-gray-900">{latest.summary.top3Points}/{latest.summary.totalPoints}</div><div className="text-xs text-gray-500">spots in top 3</div><Change now={latest.summary.top3Points} before={previous?.summary.top3Points} /></div>
          <div><div className="font-semibold text-gray-900">{latest.summary.top10Points}/{latest.summary.totalPoints}</div><div className="text-xs text-gray-500">in top 10</div><Change now={latest.summary.top10Points} before={previous?.summary.top10Points} /></div>
          <div><div className="font-semibold text-gray-900">{latest.summary.averageRank ?? '–'}</div><div className="text-xs text-gray-500">avg. rank when found</div><Change now={latest.summary.averageRank} before={previous?.summary.averageRank} invert /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function Change({ now, before, invert = false, suffix = '' }: { now: number | null; before: number | null | undefined; invert?: boolean; suffix?: string }) {
  if (now === null || before === null || before === undefined) return null;
  const diff = now - before;
  if (diff === 0) return <span className="text-xs text-gray-400">no change</span>;
  const good = invert ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good ? 'text-emerald-700' : 'text-red-600'}`}><Icon className="h-3 w-3" />{Math.abs(Math.round(diff * 10) / 10)}{suffix} vs last scan</span>;
}

export default function RankingsPage() {
  const params = useParams();
  const search = useSearchParams();
  const siteId = params.siteId as string;
  const [data, setData] = useState<RankingsResponse | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [showPacks, setShowPacks] = useState(false);
  useEffect(() => {
    const c = search.get('credits');
    if (c === 'purchased') toast.success('Credits added. Thank you!');
    if (c === 'cancelled') toast.message('Purchase cancelled.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const buy = async (packId: string) => {
    setBuying(packId);
    try {
      const r = await fetch(`/api/sites/${siteId}/rankings/credits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packId }) });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error || 'Could not start checkout');
      window.location.href = d.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start checkout');
      setBuying(null);
    }
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [newKw, setNewKw] = useState('');
  // Heatmap filter: 'all' shows the latest scan per keyword; a keyword shows its whole history for comparison.
  const [filterKeyword, setFilterKeyword] = useState<string>('all');
  const [history, setHistory] = useState<ScanRow[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/sites/${siteId}/rankings`);
    if (r.ok) { const d: RankingsResponse = await r.json(); setData(d); return d; }
    return null;
  }, [siteId]);

  // The run being watched: when it started and how many keywords it covers, so progress can be shown.
  const [run, setRun] = useState<{ startedAt: number; keywords: number } | null>(null);

  /** Poll until the run records its outcome (up to 30 minutes); heatmaps land one keyword at a time meanwhile. */
  const watchRun = useCallback((startedAt: number, keywords: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setScanning(true);
    setRun({ startedAt, keywords });
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      const d = await load();
      const finished = d?.lastRun && new Date(d.lastRun.at).getTime() >= startedAt;
      if (finished || tries > 360) {
        if (pollRef.current) clearInterval(pollRef.current);
        setScanning(false);
        setRun(null);
        if (finished && d?.lastRun) {
          if (d.lastRun.ok) toast.success(d.lastRun.message);
          else toast.error(`Scan did not complete: ${d.lastRun.message}${d.lastRun.failed ? ' Credits for failed keywords were returned.' : ''}`);
        } else if (!finished) {
          toast.error('The scan has not reported back after 30 minutes. Reload this page later; results appear when it finishes.');
        }
      }
    }, 5000);
  }, [load]);

  useEffect(() => {
    load().then((d) => {
      setLoading(false);
      // A scan started earlier (maybe from another tab) is still running: keep showing it.
      if (d?.pendingRun) watchRun(new Date(d.pendingRun.at).getTime(), d.pendingRun.keywords.length);
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load, watchRun]);

  useEffect(() => {
    if (filterKeyword === 'all') { setHistory(null); return; }
    let cancelled = false;
    setHistoryLoading(true);
    fetch(`/api/sites/${siteId}/rankings?keyword=${encodeURIComponent(filterKeyword)}`)
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((d: { history: ScanRow[] }) => { if (!cancelled) setHistory(d.history || []); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [filterKeyword, siteId, data?.scans]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/sites/${siteId}/rankings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error || 'Save failed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = async () => {
    const k = newKw.trim().toLowerCase();
    if (!k || !data) return;
    if (data.settings.keywords.length >= 10) { toast.error('Up to 10 keywords.'); return; }
    await patch({ keywords: [...data.settings.keywords, k] });
    setNewKw('');
  };
  // Removing a suggested keyword saves the remaining suggestions as the site's own list.
  // Removing the last keyword brings the suggestions back (an empty list means "use defaults").
  const removeKeyword = async (k: string) => {
    if (!data) return;
    const rest = data.settings.keywords.filter((x) => x !== k);
    if (rest.length === 0) toast.message('No keywords left, so the suggestions are back. Add your own or remove the ones you do not want.');
    await patch({ keywords: rest });
  };

  // Keywords the site tracks that have never been scanned (added since the last run).
  const unscanned = data ? data.settings.keywords.filter((k) => !data.scans.some((sc) => sc.keyword === k)) : [];

  /** Scan every keyword, or only `only` (e.g. the ones added since the last scan). */
  const scanNow = async (only?: string[]) => {
    setScanning(true);
    const startedAt = Date.now();
    try {
      const r = await fetch(`/api/sites/${siteId}/rankings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(only?.length ? { keywords: only, ai: false } : {}) });
      const d = await r.json();
      if (r.status === 402) { setShowPacks(true); throw new Error(d.error || 'Not enough credits'); }
      if (!r.ok) throw new Error(d.error || 'Could not start');
      toast.success(`Scanning ${d.charged} keyword${d.charged === 1 ? '' : 's'} across the grid (${d.charged} credit${d.charged === 1 ? '' : 's'}, ${d.balance} left). Each heatmap appears as its keyword finishes; a full scan takes a few minutes.`);
      watchRun(startedAt, d.charged || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start');
      setScanning(false);
    }
  };

  const s = data?.settings;

  return (
    <div className="flex flex-col">
      <div className="p-6 space-y-6 max-w-5xl">
        <Link href={`/dashboard/sites/${siteId}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4 mr-1" /> Back to site</Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Grid3x3 className="h-6 w-6 text-rose-600" /> Rankings</h1>
            <p className="text-gray-500 mt-1">Where the business shows up on Google Maps from different spots around town, and whether AI assistants recommend it. Scanned every Monday; scan any time with credits.</p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="flex gap-2">
              {unscanned.length > 0 && unscanned.length < (data?.settings.keywords.length || 0) && (
                <Button size="sm" onClick={() => scanNow(unscanned)} disabled={scanning || !data?.providerConfigured || !data?.hasCenter || !s?.enabled} className="bg-[#00ef99] text-gray-900 hover:bg-[#00d98a]" title={`Only: ${unscanned.join(', ')}`}>
                  {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Scan {unscanned.length} new keyword{unscanned.length === 1 ? '' : 's'} · {unscanned.length} credit{unscanned.length === 1 ? '' : 's'}
                </Button>
              )}
              <Button size="sm" variant={unscanned.length > 0 && unscanned.length < (data?.settings.keywords.length || 0) ? 'outline' : 'default'} onClick={() => scanNow()} disabled={scanning || !data?.providerConfigured || !data?.hasCenter || !s?.enabled} className={unscanned.length > 0 && unscanned.length < (data?.settings.keywords.length || 0) ? '' : 'bg-[#00ef99] text-gray-900 hover:bg-[#00d98a]'}>
                {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Scan all{data ? ` · ${data.credits.perManualScan} credit${data.credits.perManualScan === 1 ? '' : 's'}` : ''}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowPacks((v) => !v)}>Buy credits</Button>
            </div>
            {data && (
              <span className="text-xs text-gray-500">
                {data.credits.balance} credit{data.credits.balance === 1 ? '' : 's'} left{data.credits.orgName ? ` for ${data.credits.orgName}` : ''} · one balance for every site in this account · weekly scans are included, manual scans use 1 credit per keyword
              </span>
            )}
          </div>
        </div>

        {showPacks && data && (
          <Card>
            <CardHeader><h2 className="font-semibold">Scan credits</h2><p className="text-sm text-gray-500">One credit scans one keyword across your whole grid, right now. The Monday scan never uses credits.</p></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {data.credits.packs.map((p) => (
                  <button key={p.id} type="button" onClick={() => buy(p.id)} disabled={buying !== null} className="rounded-xl border p-4 text-left hover:border-gray-900 disabled:opacity-60">
                    <div className="text-2xl font-extrabold text-gray-900">${(p.priceCents / 100).toFixed(0)}</div>
                    <div className="font-medium text-gray-900">{p.label}</div>
                    <div className="text-xs text-gray-500">{p.note}</div>
                    {buying === p.id && <Loader2 className="mt-2 h-4 w-4 animate-spin text-gray-400" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data && !data.providerConfigured && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Map scans need a DataForSEO account connected to the app (DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD). Until then keywords and settings can be prepared here, and AI visibility checks still run.</span>
          </div>
        )}
        {scanning && run && data && (() => {
          const done = data.scans.filter((sc) => new Date(sc.latest.scanned_at).getTime() >= run.startedAt).length;
          const mins = Math.round((Date.now() - run.startedAt) / 60000);
          return (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              <span>
                Scanning: {done} of {run.keywords} keyword{run.keywords === 1 ? '' : 's'} done{mins >= 1 ? ` · started ${mins} min ago` : ''}.
                {done === 0 ? ' The first heatmap usually appears within a minute or two; right after an app update it can take 10 to 15 minutes to get going.' : ' Each heatmap appears below as its keyword finishes.'} You can leave this page and come back.
              </span>
            </div>
          );
        })()}
        {data?.lastRun && !data.lastRun.ok && !scanning && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Last scan ({new Date(data.lastRun.at).toLocaleString()}) did not complete: {data.lastRun.message}{data.lastRun.failed ? ' Credits for the failed keywords were returned.' : ''}</span>
          </div>
        )}
        {data && !data.hasCenter && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>No coordinates for the business address. Add a street address under <Link href={`/dashboard/sites/${siteId}/settings/locations`} className="underline">Locations</Link> so the grid has a centre.</span>
          </div>
        )}

        {loading || !data || !s ? (
          <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            {/* Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">What to track</h2>
                  <label className="flex items-center gap-2 text-sm text-gray-700"><Switch checked={s.enabled} disabled={saving} onCheckedChange={(v) => patch({ enabled: v })} aria-label="Rank tracking" /> Weekly scans</label>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 text-sm font-medium text-gray-700">
                    <span>Keywords {s.keywordsAreDefaults && <span className="font-normal text-gray-400">(suggested from your services; remove any you do not want, or add your own)</span>}</span>
                    {!s.keywordsAreDefaults && <button type="button" onClick={() => patch({ keywords: [] })} disabled={saving} className="text-xs font-normal text-gray-400 underline-offset-2 hover:text-gray-700 hover:underline">Reset to suggestions</button>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.keywords.map((k) => (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-sm text-gray-800">
                        {k}
                        <button type="button" onClick={() => removeKeyword(k)} disabled={saving} className="text-gray-400 hover:text-red-600" aria-label={`Remove ${k}`}><X className="h-3.5 w-3.5" /></button>
                      </span>
                    ))}
                  </div>
                  <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addKeyword(); }}>
                    <Input value={newKw} onChange={(e) => setNewKw(e.target.value)} placeholder="e.g. dryer repair" className="max-w-xs" />
                    <Button type="submit" variant="outline" size="sm" disabled={saving || !newKw.trim()}><Plus className="mr-1 h-4 w-4" /> Add</Button>
                  </form>
                  <p className="mt-1 text-xs text-gray-400">Search phrases without the city; each grid point already searches from inside town. Up to 10.</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-700">
                  <label className="flex items-center gap-2">Grid
                    <select className="rounded border border-gray-300 px-2 py-1 text-sm" value={s.gridSize} disabled={saving} onChange={(e) => patch({ gridSize: Number(e.target.value) })}>
                      <option value={5}>5 × 5</option><option value={7}>7 × 7</option><option value={9}>9 × 9</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">Spacing
                    <select className="rounded border border-gray-300 px-2 py-1 text-sm" value={s.spacingMiles} disabled={saving} onChange={(e) => patch({ spacingMiles: Number(e.target.value) })}>
                      <option value={0.5}>½ mile</option><option value={1}>1 mile</option><option value={2}>2 miles</option><option value={3}>3 miles</option>
                    </select>
                  </label>
                  {data.center && <span className="text-xs text-gray-400">Centred on the business{data.center.city ? ` in ${data.center.city}` : ''} · covers about {(s.gridSize - 1) * s.spacingMiles} × {(s.gridSize - 1) * s.spacingMiles} miles</span>}
                </div>
              </CardContent>
            </Card>

            {/* Heatmaps */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-900">Google Maps heatmaps</h2>
                {data.scans.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    Show
                    <select className="rounded border border-gray-300 bg-white px-2 py-1 text-sm" value={filterKeyword} onChange={(e) => setFilterKeyword(e.target.value)}>
                      <option value="all">All keywords · latest scan</option>
                      {data.scans.map((sc) => <option key={sc.keyword} value={sc.keyword}>{sc.keyword} · every scan</option>)}
                    </select>
                  </label>
                )}
              </div>
              {data.scans.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-gray-500">{scanning ? 'Scanning now. The first heatmap appears here as soon as its keyword finishes.' : `No scans yet. ${data.providerConfigured ? 'Click Scan all, or wait for the included Monday scan.' : 'Connect DataForSEO to start scanning.'}`}</CardContent></Card>
              ) : filterKeyword !== 'all' ? (
                historyLoading && !history ? (
                  <Card><CardContent className="py-10 text-center text-gray-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></CardContent></Card>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">{history?.length || 0} scan{history?.length === 1 ? '' : 's'} of &ldquo;{filterKeyword}&rdquo;, newest first. Each card compares with the scan before it.</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(history || []).map((scan, i) => (
                        <ScanCard key={scan.id} title={fmt(scan.scanned_at)} latest={scan} previous={history?.[i + 1] || null} siteId={siteId} />
                      ))}
                    </div>
                  </>
                )
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {data.scans.map(({ keyword, latest, previous }) => (
                    <ScanCard key={keyword} title={keyword} latest={latest} previous={previous} siteId={siteId} onPick={() => setFilterKeyword(keyword)} />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500" /> Top 3</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-400" /> 4 to 10</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-orange-500" /> 11 to 20</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500/80" /> Not in top 20</span>
              </div>
            </section>

            {/* AI visibility */}
            <section className="space-y-3">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Bot className="h-4 w-4 text-gray-500" /> Do AI assistants recommend you?</h2>
                <p className="mt-1 text-xs text-gray-500">Each assistant is asked with web search on and the searcher placed in your city, the way the apps answer real customers. Checked every other week.</p>
              </div>
              {!data.ai ? (
                <Card><CardContent className="py-8 text-center text-gray-500 text-sm">No checks yet. They run every other week with the Monday scan{data.aiModels.length ? ` (${data.aiModels.map(aiModelLabel).join(', ')})` : ''}, or with Scan now.</CardContent></Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex flex-wrap items-end gap-6">
                      <div>
                        <div className="text-3xl font-extrabold text-gray-900">{data.ai.mentionedShare}%</div>
                        <div className="text-sm text-gray-600">of customer-style questions named this business</div>
                        <Change now={data.ai.mentionedShare} before={data.ai.previousShare} suffix=" pts" />
                      </div>
                      {data.ai.byModel.map((m) => (
                        <div key={m.model}><div className="text-xl font-bold text-gray-900">{m.mentionedShare}%</div><div className="text-xs text-gray-500">{aiModelLabel(m.model)}</div></div>
                      ))}
                      <div className="text-xs text-gray-400">checked {fmt(data.ai.batchAt)}</div>
                    </div>
                    {data.ai.topCompetitors.length > 0 && (
                      <div className="text-sm text-gray-700"><span className="font-medium">Other businesses the assistants named:</span> {data.ai.topCompetitors.map((c) => `${c.name} (${c.count})`).join(', ')}</div>
                    )}
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-600">See each question</summary>
                      <div className="mt-2 space-y-2">
                        {data.ai.byModel.flatMap((m) => m.checks.map((c, i) => (
                          <div key={`${m.model}-${i}`} className="rounded-lg border p-2.5">
                            <div className="text-xs text-gray-400">{aiModelLabel(m.model)} · {c.prompt}</div>
                            <div className={`mt-1 font-medium ${c.mentioned ? 'text-emerald-700' : 'text-gray-700'}`}>{c.error ? `Error: ${c.error}` : c.mentioned ? `Named${c.position ? `, #${c.position} in the list` : ''}` : c.answered === false ? 'Declined to name any business' : 'Not named'}</div>
                            {c.competitors.length > 0 && <div className="text-xs text-gray-500">Also named: {c.competitors.join(', ')}</div>}
                          </div>
                        )))}
                      </div>
                    </details>
                  </CardContent>
                </Card>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
