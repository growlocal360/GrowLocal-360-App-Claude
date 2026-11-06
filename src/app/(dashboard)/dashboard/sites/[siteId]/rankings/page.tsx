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
import { rankTone, sourceLabel, type RankSource, type ScannedPoint, type ScanSummary, fitZoom, mapPercent, aiModelLabel } from '@/lib/rank/grid';

interface ScanRow { id: string; keyword: string; source: RankSource; grid_size: number; spacing_miles: number; center_lat: number; center_lng: number; points: ScannedPoint[]; summary: ScanSummary; scanned_at: string; cost_usd: number | null; failed_points: number }
interface AiCheckRow { model: string; model_id: string; prompt: string; mentioned: boolean; position: number | null; competitors: string[]; answered?: boolean; error: string | null }
interface RankingsResponse {
  settings: { enabled: boolean; keywords: string[]; gridSize: number; spacingMiles: number; sources: RankSource[]; keywordsAreDefaults: boolean };
  providerConfigured: boolean;
  aiModels: string[];
  hasCenter: boolean;
  lastRun: { at: string; ok: boolean; message: string; scanned: number; failed: number } | null;
  center: { lat: number; lng: number; city: string | null } | null;
  scans: { keyword: string; source: RankSource; latest: ScanRow; previous: ScanRow | null }[];
  ai: { batchAt: string; mentionedShare: number; previousShare: number | null; byModel: { model: string; mentionedShare: number; checks: AiCheckRow[] }[]; topCompetitors: { name: string; count: number }[] } | null;
  estimatedCostPerScan: number;
  credits: { balance: number; perManualScan: number; perAiCheck: number; aiMinHours: number; packs: { id: string; credits: number; priceCents: number; label: string; note: string }[]; orgName: string | null };
  pendingRun: { at: string; keywords: string[]; sources?: RankSource[] } | null;
}

const TONE_CLASS: Record<ReturnType<typeof rankTone>, string> = {
  top3: 'bg-emerald-500 text-white',
  top10: 'bg-amber-400 text-gray-900',
  top20: 'bg-orange-500 text-white',
  none: 'bg-red-500/80 text-white',
  nopack: 'bg-gray-300 text-gray-600',
};

/** What a dot means, in the words of its source. */
function pointLabel(p: ScannedPoint, source: RankSource): string {
  if (source === 'local_pack') return p.noPack ? 'No Local Pack shown here' : p.rank === null ? 'Not in the Local Pack' : `Pack spot #${p.rank}`;
  if (source === 'organic') return p.rank === null ? 'Website not on page 1' : `Website at #${p.rank} on page 1`;
  return p.rank === null ? 'Not in top 20' : `#${p.rank}`;
}
function pointText(p: ScannedPoint, source: RankSource): string {
  if (source === 'local_pack') return p.noPack ? '–' : p.rank === null ? '✕' : String(p.rank);
  if (source === 'organic') return p.rank === null ? '10+' : String(p.rank);
  return p.rank === null ? '20+' : String(p.rank);
}

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
          <div key={`${p.row}-${p.col}`} title={`${pointLabel(p, scan.source)} at ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`} className={`flex aspect-square items-center justify-center rounded text-[11px] font-semibold ${TONE_CLASS[rankTone(p.rank, p.noPack)]}`}>
            {pointText(p, scan.source)}
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
            title={`${pointLabel(p, scan.source)} at ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.35)] ring-2 ring-white/90 ${TONE_CLASS[rankTone(p.rank, p.noPack)]}`}
            style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: `${dotPct}%`, aspectRatio: '1 / 1' }}
          >
            {pointText(p, scan.source)}
          </div>
        );
      })}
      <MapPin className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-full fill-gray-900 text-white drop-shadow" aria-label="Business location" />
    </div>
  );
}

/** Small label naming the surface a heatmap came from. The pack is the one customers see first, so it reads darker. */
function SourceBadge({ source }: { source: RankSource }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${source === 'local_pack' ? 'bg-gray-900 text-white' : source === 'organic' ? 'border border-gray-300 bg-white text-gray-600' : 'bg-gray-100 text-gray-600'}`}>{sourceLabel(source)}</span>;
}

/** One heatmap card: a keyword × source's latest scan on the overview, or one dated scan in the per-keyword history. */
function ScanCard({ title, latest, previous, siteId, onPick, note }: { title: string; latest: ScanRow; previous: ScanRow | null; siteId: string; onPick?: () => void; note?: string }) {
  const isPack = latest.source === 'local_pack';
  const isWeb = latest.source === 'organic';
  const sum = latest.summary;
  const shown = isPack ? (sum.packShownPoints ?? sum.totalPoints) : sum.totalPoints;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge source={latest.source} />
              {onPick ? (
                <button type="button" onClick={onPick} className="text-left font-semibold text-gray-900 underline-offset-2 hover:underline" title="Show every scan of this keyword">{title}</button>
              ) : (
                <h3 className="font-semibold text-gray-900">{title}</h3>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">{onPick ? `${fmt(latest.scanned_at)} · ` : ''}{latest.grid_size}×{latest.grid_size} grid, {latest.spacing_miles} mi{latest.failed_points ? ` · ${latest.failed_points} points failed` : ''}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-gray-900">{sum.visibility}<span className="text-sm font-medium text-gray-400">{isPack ? '%' : '/100'}</span></div>
            <div className="text-[11px] text-gray-500">{isPack ? 'of spots in the pack' : 'visibility'}</div>
            <Change now={sum.visibility} before={previous?.summary.visibility} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Heatmap scan={latest} siteId={siteId} />
        {isPack ? (
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><div className="font-semibold text-gray-900">{sum.foundPoints}/{shown}</div><div className="text-xs text-gray-500">spots in the pack</div><Change now={sum.foundPoints} before={previous?.summary.foundPoints} /></div>
            <div><div className="font-semibold text-gray-900">{sum.averageRank ?? '–'}</div><div className="text-xs text-gray-500">avg. pack spot</div><Change now={sum.averageRank} before={previous?.summary.averageRank} invert /></div>
            <div><div className="font-semibold text-gray-900">{sum.totalPoints - shown}</div><div className="text-xs text-gray-500">spots with no pack</div></div>
          </div>
        ) : isWeb ? (
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><div className="font-semibold text-gray-900">{sum.foundPoints}/{sum.totalPoints}</div><div className="text-xs text-gray-500">spots on page 1</div><Change now={sum.foundPoints} before={previous?.summary.foundPoints} /></div>
            <div><div className="font-semibold text-gray-900">{sum.top3Points}/{sum.totalPoints}</div><div className="text-xs text-gray-500">in the top 3 links</div><Change now={sum.top3Points} before={previous?.summary.top3Points} /></div>
            <div><div className="font-semibold text-gray-900">{sum.averageRank ?? '–'}</div><div className="text-xs text-gray-500">avg. position when found</div><Change now={sum.averageRank} before={previous?.summary.averageRank} invert /></div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><div className="font-semibold text-gray-900">{sum.top3Points}/{sum.totalPoints}</div><div className="text-xs text-gray-500">spots in top 3</div><Change now={sum.top3Points} before={previous?.summary.top3Points} /></div>
            <div><div className="font-semibold text-gray-900">{sum.top10Points}/{sum.totalPoints}</div><div className="text-xs text-gray-500">in top 10</div><Change now={sum.top10Points} before={previous?.summary.top10Points} /></div>
            <div><div className="font-semibold text-gray-900">{sum.averageRank ?? '–'}</div><div className="text-xs text-gray-500">avg. rank when found</div><Change now={sum.averageRank} before={previous?.summary.averageRank} invert /></div>
          </div>
        )}
        {note && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">{note}</p>}
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

  // The run being watched: when it started and how many heatmaps (keywords × sources) it makes, so progress can be shown.
  const [run, setRun] = useState<{ startedAt: number; heatmaps: number } | null>(null);

  /** Poll until the run records its outcome (up to 30 minutes); heatmaps land one at a time meanwhile. */
  const watchRun = useCallback((startedAt: number, heatmaps: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setScanning(true);
    setRun({ startedAt, heatmaps });
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
          else toast.error(`Scan did not complete: ${d.lastRun.message}${d.lastRun.failed ? ' Credits for failed heatmaps were returned.' : ''}`);
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
      if (d?.pendingRun) watchRun(new Date(d.pendingRun.at).getTime(), d.pendingRun.keywords.length * (d.pendingRun.sources?.length || 1));
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
  const nSources = data?.settings.sources.length || 1;
  const unscannedCredits = unscanned.length * nSources;

  // Overview rows: one per keyword; latest pack, Maps and website scans side by side (pack first).
  const keywordRows = data
    ? Array.from(new Set(data.scans.map((sc) => sc.keyword))).map((keyword) => ({
        keyword,
        pack: data.scans.find((sc) => sc.keyword === keyword && sc.source === 'local_pack') || null,
        maps: data.scans.find((sc) => sc.keyword === keyword && sc.source === 'maps') || null,
        web: data.scans.find((sc) => sc.keyword === keyword && sc.source === 'organic') || null,
      }))
    : [];
  /**
   * A strong pack with a missing website usually means Google reads the phrase as
   * research or a job search on the web ("graphic designer" → job boards) while
   * still treating it as a local-business search in the pack. Say so, with a phrase
   * that reads as a service search.
   */
  const intentNote = (row: (typeof keywordRows)[number]): string | undefined => {
    if (!row.web || !row.pack) return undefined;
    if (row.pack.latest.summary.visibility >= 50 && row.web.latest.summary.foundPoints === 0) {
      return `The pack shows the business here but the website is not on page 1. Google likely reads "${row.keyword}" on the web as a job or research search, not a hire-someone search. For the website, a phrase like "${row.keyword} near me"${data?.center?.city ? ` or "${row.keyword} ${data.center.city.toLowerCase()}"` : ''} is the realistic one to track.`;
    }
    return undefined;
  };
  // Headline numbers across every keyword's latest scan.
  const headline = (() => {
    if (!data) return null;
    const packs = data.scans.filter((sc) => sc.source === 'local_pack');
    const maps = data.scans.filter((sc) => sc.source === 'maps');
    const web = data.scans.filter((sc) => sc.source === 'organic');
    const avg = (list: typeof packs, f: (sum: ScanSummary) => number) => (list.length ? Math.round(list.reduce((t, sc) => t + f(sc.latest.summary), 0) / list.length) : null);
    const avgPrev = (list: typeof packs, f: (sum: ScanSummary) => number) => { const withPrev = list.filter((sc) => sc.previous); return withPrev.length ? Math.round(withPrev.reduce((t, sc) => t + f(sc.previous!.summary), 0) / withPrev.length) : null; };
    const top3Share = (sum: ScanSummary) => (sum.totalPoints ? Math.round((sum.top3Points / sum.totalPoints) * 100) : 0);
    return {
      pack: avg(packs, (x) => x.visibility),
      packPrev: avgPrev(packs, (x) => x.visibility),
      mapsTop3: avg(maps, top3Share),
      mapsTop3Prev: avgPrev(maps, top3Share),
      mapsVisibility: avg(maps, (x) => x.visibility),
      mapsVisibilityPrev: avgPrev(maps, (x) => x.visibility),
      web: avg(web, (x) => (x.totalPoints ? Math.round((x.foundPoints / x.totalPoints) * 100) : 0)),
      webPrev: avgPrev(web, (x) => (x.totalPoints ? Math.round((x.foundPoints / x.totalPoints) * 100) : 0)),
    };
  })();

  /** Scan every keyword, or only `only` (e.g. the ones added since the last scan). */
  const scanNow = async (only?: string[]) => {
    setScanning(true);
    const startedAt = Date.now();
    try {
      const r = await fetch(`/api/sites/${siteId}/rankings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(only?.length ? { keywords: only, ai: false } : {}) });
      const d = await r.json();
      if (r.status === 402) { setShowPacks(true); throw new Error(d.error || 'Not enough credits'); }
      if (!r.ok) throw new Error(d.error || 'Could not start');
      const srcs = (d.sources as RankSource[] | undefined) || [];
      toast.success(`Scanning ${d.keywords} keyword${d.keywords === 1 ? '' : 's'} on ${srcs.length > 1 ? 'the Local Pack and Google Maps' : sourceLabel(srcs[0] || 'maps')} (${d.charged} credit${d.charged === 1 ? '' : 's'}, ${d.balance} left). Each heatmap appears as it finishes; a full scan takes a few minutes.`);
      watchRun(startedAt, d.charged || 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start');
      setScanning(false);
    }
  };

  // "Re-check AI": only the AI visibility check, paid with credits. Polls until a newer batch lands.
  const [aiChecking, setAiChecking] = useState(false);
  const aiPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (aiPollRef.current) clearInterval(aiPollRef.current); }, []);
  const recheckAi = async () => {
    setAiChecking(true);
    try {
      const r = await fetch(`/api/sites/${siteId}/rankings/ai`, { method: 'POST' });
      const d = await r.json();
      if (r.status === 402) { setShowPacks(true); throw new Error(d.error || 'Not enough credits'); }
      if (!r.ok) throw new Error(d.error || 'Could not start');
      const startedAt = new Date(d.startedAt).getTime();
      toast.success(`Asking the assistants now (${d.charged} credits, ${d.balance} left). Answers land in a minute or two.`);
      if (aiPollRef.current) clearInterval(aiPollRef.current);
      let tries = 0;
      aiPollRef.current = setInterval(async () => {
        tries += 1;
        const fresh = await load();
        const done = fresh?.ai && new Date(fresh.ai.batchAt).getTime() >= startedAt;
        if (done || tries > 60) {
          if (aiPollRef.current) clearInterval(aiPollRef.current);
          setAiChecking(false);
          if (done) toast.success(`AI check finished: ${fresh!.ai!.mentionedShare}% of questions named the business.`);
          else toast.error('The AI check has not reported back after 5 minutes. If no assistant answered, the credits were returned. Reload this page later.');
        }
      }, 5000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start');
      setAiChecking(false);
    }
  };
  // Inside the no-repeat window the server refuses the re-check without charging; say so on the button instead.
  const aiAgeHours = data?.ai ? (Date.now() - new Date(data.ai.batchAt).getTime()) / 3_600_000 : Infinity;
  const aiTooRecent = !!data && aiAgeHours < data.credits.aiMinHours;

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
                  Scan {unscanned.length} new keyword{unscanned.length === 1 ? '' : 's'} · {unscannedCredits} credit{unscannedCredits === 1 ? '' : 's'}
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
                {data.credits.balance} credit{data.credits.balance === 1 ? '' : 's'} left{data.credits.orgName ? ` for ${data.credits.orgName}` : ''} · one balance for every site in this account · weekly scans are included, manual scans use 1 credit per keyword per source, an AI re-check uses {data.credits.perAiCheck}
              </span>
            )}
          </div>
        </div>

        {showPacks && data && (
          <Card>
            <CardHeader><h2 className="font-semibold">Scan credits</h2><p className="text-sm text-gray-500">One credit scans one keyword across your whole grid on one source (Local Pack or Maps), right now. The Monday scan never uses credits.</p></CardHeader>
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
          const done = data.scans.filter((sc) => sc.source !== 'organic' && new Date(sc.latest.scanned_at).getTime() >= run.startedAt).length;
          const mins = Math.round((Date.now() - run.startedAt) / 60000);
          return (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              <span>
                Scanning: {done} of {run.heatmaps} heatmap{run.heatmaps === 1 ? '' : 's'} done{mins >= 1 ? ` · started ${mins} min ago` : ''}.
                {done === 0 ? ' The first heatmap usually appears within a minute or two; right after an app update it can take 10 to 15 minutes to get going.' : ' Each heatmap appears below as it finishes.'} You can leave this page and come back.
              </span>
            </div>
          );
        })()}
        {data?.lastRun && !data.lastRun.ok && !scanning && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Last scan ({new Date(data.lastRun.at).toLocaleString()}) did not complete: {data.lastRun.message}{data.lastRun.failed ? ' Credits for the failed heatmaps were returned.' : ''}</span>
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
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Where to look</div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: 'both', label: 'Both', sources: ['local_pack', 'maps'] as RankSource[], hint: 'The pack customers see, plus the full Maps ladder behind it' },
                      { id: 'local_pack', label: 'Local Pack only', sources: ['local_pack'] as RankSource[], hint: 'The 3-business box in a Google search' },
                      { id: 'maps', label: 'Google Maps only', sources: ['maps'] as RankSource[], hint: 'The full ranked list in the Maps app' },
                    ]).map((opt) => {
                      const active = opt.sources.length === s.sources.length && opt.sources.every((x) => s.sources.includes(x));
                      return (
                        <button key={opt.id} type="button" disabled={saving} onClick={() => patch({ sources: opt.sources })} title={opt.hint} className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-gray-900 bg-gray-900 text-white' : 'bg-white text-gray-700 hover:border-gray-400'}`}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">The Local Pack is the three businesses shown first in a Google search; Google Maps is the full list. They share an index but can differ at the same spot. Each is its own heatmap and its own credit on manual scans. A Local Pack scan also reads where the website sits among the regular links on the same page, free, as a third heatmap.</p>
                </div>
              </CardContent>
            </Card>

            {/* Heatmaps */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-900">Heatmaps</h2>
                {data.scans.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    Show
                    <select className="rounded border border-gray-300 bg-white px-2 py-1 text-sm" value={filterKeyword} onChange={(e) => setFilterKeyword(e.target.value)}>
                      <option value="all">All keywords · latest scan</option>
                      {keywordRows.map((row) => <option key={row.keyword} value={row.keyword}>{row.keyword} · every scan</option>)}
                    </select>
                  </label>
                )}
              </div>
              {headline && data.scans.length > 0 && filterKeyword === 'all' && (
                <Card>
                  <CardContent className="flex flex-wrap items-end gap-x-10 gap-y-4 pt-6">
                    {headline.pack !== null && (
                      <div>
                        <div className="text-3xl font-extrabold text-gray-900">{headline.pack}%</div>
                        <div className="text-sm text-gray-600">of spots show the business in the <span className="font-medium text-gray-900">Local Pack</span></div>
                        <Change now={headline.pack} before={headline.packPrev} suffix=" pts" />
                      </div>
                    )}
                    {headline.mapsTop3 !== null && (
                      <div>
                        <div className="text-xl font-bold text-gray-900">{headline.mapsTop3}%</div>
                        <div className="text-xs text-gray-500">of spots in the Google Maps top 3</div>
                        <Change now={headline.mapsTop3} before={headline.mapsTop3Prev} suffix=" pts" />
                      </div>
                    )}
                    {headline.mapsVisibility !== null && (
                      <div>
                        <div className="text-xl font-bold text-gray-900">{headline.mapsVisibility}<span className="text-sm font-medium text-gray-400">/100</span></div>
                        <div className="text-xs text-gray-500">Maps visibility</div>
                        <Change now={headline.mapsVisibility} before={headline.mapsVisibilityPrev} />
                      </div>
                    )}
                    {headline.web !== null && (
                      <div>
                        <div className="text-xl font-bold text-gray-900">{headline.web}%</div>
                        <div className="text-xs text-gray-500">of spots with the website on page 1</div>
                        <Change now={headline.web} before={headline.webPrev} suffix=" pts" />
                      </div>
                    )}
                    <div className="text-xs text-gray-400">averaged over every keyword&apos;s latest scan</div>
                  </CardContent>
                </Card>
              )}
              {data.scans.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-gray-500">{scanning ? 'Scanning now. The first heatmap appears here as soon as its keyword finishes.' : `No scans yet. ${data.providerConfigured ? 'Click Scan all, or wait for the included Monday scan.' : 'Connect DataForSEO to start scanning.'}`}</CardContent></Card>
              ) : filterKeyword !== 'all' ? (
                historyLoading && !history ? (
                  <Card><CardContent className="py-10 text-center text-gray-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></CardContent></Card>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">{history?.length || 0} scan{history?.length === 1 ? '' : 's'} of &ldquo;{filterKeyword}&rdquo;, newest first. Each card compares with the scan before it on the same source.</p>
                    {(['local_pack', 'maps', 'organic'] as RankSource[]).map((src) => {
                      const list = (history || []).filter((h) => h.source === src);
                      if (list.length === 0) return null;
                      return (
                        <div key={src} className="space-y-2">
                          <h3 className="text-sm font-semibold text-gray-700">{sourceLabel(src)}</h3>
                          <div className="grid gap-4 md:grid-cols-2">
                            {list.map((scan, i) => (
                              <ScanCard key={scan.id} title={fmt(scan.scanned_at)} latest={scan} previous={list[i + 1] || null} siteId={siteId} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )
              ) : (
                <div className="space-y-4">
                  {keywordRows.map((row) => (
                    <div key={row.keyword} className={`grid gap-4 md:grid-cols-2 ${[row.pack, row.maps, row.web].filter(Boolean).length > 2 ? 'xl:grid-cols-3' : ''}`}>
                      {row.pack && <ScanCard title={row.keyword} latest={row.pack.latest} previous={row.pack.previous} siteId={siteId} onPick={() => setFilterKeyword(row.keyword)} />}
                      {row.maps && <ScanCard title={row.keyword} latest={row.maps.latest} previous={row.maps.previous} siteId={siteId} onPick={() => setFilterKeyword(row.keyword)} />}
                      {row.web && <ScanCard title={row.keyword} latest={row.web.latest} previous={row.web.previous} siteId={siteId} onPick={() => setFilterKeyword(row.keyword)} note={intentNote(row)} />}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500" /> Top 3</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-400" /> 4 to 10</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-orange-500" /> 11 to 20</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500/80" /> Not in top 20 / not in the pack / website not on page 1</span>
                <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-gray-300" /> No pack shown</span>
              </div>
            </section>

            {/* AI visibility */}
            <section className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Bot className="h-4 w-4 text-gray-500" /> Do AI assistants recommend you?</h2>
                  <p className="mt-1 text-xs text-gray-500">Each assistant is asked with web search on and the searcher placed in your city, the way the apps answer real customers. Checked every other week; re-check any time with credits.</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={recheckAi}
                  disabled={aiChecking || aiTooRecent || data.aiModels.length === 0}
                  title={data.aiModels.length === 0 ? 'No AI assistant is configured' : aiTooRecent ? `Checked ${Math.max(1, Math.round(aiAgeHours))} hour${Math.round(aiAgeHours) === 1 ? '' : 's'} ago. Answers rarely change within a day, so a re-check opens after ${data.credits.aiMinHours} hours.` : `Ask ${data.aiModels.map(aiModelLabel).join(', ')} again now`}
                  className="shrink-0"
                >
                  {aiChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {aiChecking ? 'Asking…' : `Re-check AI · ${data.credits.perAiCheck} credits`}
                </Button>
              </div>
              {!data.ai ? (
                <Card><CardContent className="py-8 text-center text-gray-500 text-sm">No checks yet. They run every other week with the Monday scan{data.aiModels.length ? ` (${data.aiModels.map(aiModelLabel).join(', ')})` : ''}, or now with Re-check AI.</CardContent></Card>
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
