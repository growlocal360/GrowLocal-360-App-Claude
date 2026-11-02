'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart3, Loader2, RefreshCw, Star, AlertCircle, ArrowUpRight, ArrowDownRight, Minus, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { MonthlyReportData } from '@/lib/reports/monthly';

interface ReportResponse {
  period: string;
  report: { period_key: string; data: MonthlyReportData; generated_at: string; emailed_at: string | null } | null;
  months: { period_key: string; generated_at: string }[];
}

function monthKeys(count = 12): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) + (i === 0 ? ' (so far)' : '') });
  }
  return out;
}

function Delta({ current, previous, available = true }: { current: number; previous: number; available?: boolean }) {
  if (!available || !previous) return <span className="text-xs text-gray-400">{previous === 0 && available ? 'no data last month' : ''}</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  const color = pct > 0 ? 'text-emerald-700' : pct < 0 ? 'text-red-600' : 'text-gray-500';
  return <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}><Icon className="h-3 w-3" />{Math.abs(pct)}% vs last month</span>;
}

function Tile({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-3xl font-extrabold tracking-tight text-gray-900">{value}</div>
      <div className="mt-1 text-sm text-gray-600">{label}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; }
}

export default function ReportsPage() {
  const params = useParams();
  const search = useSearchParams();
  const siteId = params.siteId as string;
  const months = monthKeys();
  const initial = search.get('period') && /^\d{4}-\d{2}$/.test(search.get('period')!) ? search.get('period')! : months[0].key;

  const [period, setPeriod] = useState(initial);
  const [resp, setResp] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (p: string) => {
    const r = await fetch(`/api/sites/${siteId}/reports?period=${p}`);
    if (r.ok) {
      const data: ReportResponse = await r.json();
      setResp(data);
      return data;
    }
    return null;
  }, [siteId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load(period).then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [period, load]);

  const generate = async () => {
    setGenerating(true);
    const before = resp?.report?.generated_at || null;
    try {
      const r = await fetch(`/api/sites/${siteId}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period }) });
      if (!r.ok) throw new Error((await r.json()).error || 'Could not start');
      toast.success('Pulling the numbers from Google. This takes about half a minute.');
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries += 1;
        const data = await load(period);
        const after = data?.report?.generated_at || null;
        if ((after && after !== before) || tries > 30) {
          if (pollRef.current) clearInterval(pollRef.current);
          setGenerating(false);
          if (!(after && after !== before)) toast.error('Still working. Refresh the page in a minute.');
        }
      }, 3000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start');
      setGenerating(false);
    }
  };

  const d = resp?.report?.data || null;

  return (
    <div className="flex flex-col">
      <div className="p-6 space-y-6 max-w-5xl">
        <Link href={`/dashboard/sites/${siteId}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to site
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="h-6 w-6 text-indigo-600" /> Monthly Report</h1>
            <p className="text-gray-500 mt-1">What Google showed, what customers did, and what was done for you.</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {d ? 'Refresh' : 'Generate'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !d ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No report for this month yet. Click Generate to pull it now. Closed months are generated and emailed automatically on the 1st.
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-xs text-gray-400">
              {d.period.label}{d.period.monthToDate ? ' so far' : ''} · {d.period.start} to {d.period.end} · generated {fmtDate(d.generatedAt)}
              {resp?.report?.emailed_at ? <> · <Mail className="inline h-3 w-3" /> emailed {fmtDate(resp.report.emailed_at)}</> : null}
            </p>

            {d.notes.length > 0 && (
              <div className="space-y-1">
                {d.notes.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      {n}
                      {/Search Console/.test(n) && <> <Link href={`/dashboard/sites/${siteId}/settings/search-performance`} className="underline">Connect it</Link>.</>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Google Business Profile */}
            <section className="space-y-3">
              <h2 className="font-semibold text-gray-900">On Google Search and Maps</h2>
              {d.google.available ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Tile label="People who saw the listing" value={d.google.impressions.toLocaleString()} sub={`${d.google.impressionsSearch.toLocaleString()} search · ${d.google.impressionsMaps.toLocaleString()} maps`} delta={<Delta current={d.google.impressions} previous={d.previous.google.impressions} available={d.previous.google.available} />} />
                  <Tile label="Calls from the listing" value={String(d.google.calls)} delta={<Delta current={d.google.calls} previous={d.previous.google.calls} available={d.previous.google.available} />} />
                  <Tile label="Website clicks" value={String(d.google.websiteClicks)} delta={<Delta current={d.google.websiteClicks} previous={d.previous.google.websiteClicks} available={d.previous.google.available} />} />
                  <Tile label="Direction requests" value={String(d.google.directions)} delta={<Delta current={d.google.directions} previous={d.previous.google.directions} available={d.previous.google.available} />} />
                </div>
              ) : (
                <Card><CardContent className="py-6 text-sm text-gray-500">{d.google.reason}</CardContent></Card>
              )}
            </section>

            {/* Search */}
            <section className="space-y-3">
              <h2 className="font-semibold text-gray-900">Website in Google Search</h2>
              {d.search.available ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Tile label="Clicks to the website" value={d.search.clicks.toLocaleString()} delta={<Delta current={d.search.clicks} previous={d.previous.search.clicks} available={d.previous.search.available} />} />
                    <Tile label="Times shown in results" value={d.search.impressions.toLocaleString()} delta={<Delta current={d.search.impressions} previous={d.previous.search.impressions} available={d.previous.search.available} />} />
                    <Tile label="Average position" value={d.search.position != null ? String(d.search.position) : '–'} sub={`${(d.search.ctr * 100).toFixed(1)}% click-through`} />
                  </div>
                  {d.search.topQueries.length > 0 && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader><h3 className="text-sm font-semibold">What people searched</h3></CardHeader>
                        <CardContent>
                          <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2 font-medium">Search</th><th className="pb-2 text-right font-medium">Clicks</th><th className="pb-2 text-right font-medium">Shown</th><th className="pb-2 text-right font-medium">Pos.</th></tr></thead>
                            <tbody>
                              {d.search.topQueries.map((q) => (
                                <tr key={q.query} className="border-t"><td className="py-1.5 pr-2 text-gray-800">{q.query}</td><td className="py-1.5 text-right">{q.clicks}</td><td className="py-1.5 text-right text-gray-500">{q.impressions}</td><td className="py-1.5 text-right text-gray-500">{q.position}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader><h3 className="text-sm font-semibold">Pages that brought visitors</h3></CardHeader>
                        <CardContent>
                          <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2 font-medium">Page</th><th className="pb-2 text-right font-medium">Clicks</th><th className="pb-2 text-right font-medium">Shown</th></tr></thead>
                            <tbody>
                              {d.search.topPages.map((p) => (
                                <tr key={p.page} className="border-t"><td className="py-1.5 pr-2 text-gray-800 truncate max-w-[260px]" title={p.page}>{p.page.replace(/^https?:\/\/[^/]+/, '') || '/'}</td><td className="py-1.5 text-right">{p.clicks}</td><td className="py-1.5 text-right text-gray-500">{p.impressions}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </>
              ) : (
                <Card><CardContent className="py-6 text-sm text-gray-500">{d.search.reason}</CardContent></Card>
              )}
            </section>

            {/* Leads, bookings, reviews */}
            <section className="space-y-3">
              <h2 className="font-semibold text-gray-900">Customers</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Tile label="Leads from the website" value={String(d.leads.total)} delta={<Delta current={d.leads.total} previous={d.previous.leads} />} />
                <Tile label="Bookings made" value={String(d.bookings.created)} sub={`${d.bookings.completed} completed`} delta={<Delta current={d.bookings.created} previous={d.previous.bookings} />} />
                <Tile label="New Google reviews" value={String(d.reviews.newCount)} sub={d.reviews.newAverage ? `${d.reviews.newAverage} star average` : undefined} delta={<Delta current={d.reviews.newCount} previous={d.previous.newReviews} />} />
                <Tile label="Overall rating" value={d.reviews.averageRating ? d.reviews.averageRating.toFixed(1) : '–'} sub={d.reviews.totalCount ? `${d.reviews.totalCount} reviews total` : undefined} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {d.leads.byService.length > 0 && (
                  <Card>
                    <CardHeader><h3 className="text-sm font-semibold">What leads asked for</h3></CardHeader>
                    <CardContent className="space-y-1.5">
                      {d.leads.byService.map((s) => (
                        <div key={s.name} className="flex items-center justify-between text-sm"><span className="text-gray-800">{s.name}</span><span className="text-gray-500">{s.count}</span></div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {d.reviews.latest.length > 0 && (
                  <Card>
                    <CardHeader><h3 className="text-sm font-semibold">New reviews</h3></CardHeader>
                    <CardContent className="space-y-3">
                      {d.reviews.latest.map((r, i) => (
                        <div key={i} className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className={`h-3.5 w-3.5 ${k < r.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />)}</span>
                            <span className="font-medium text-gray-900">{r.author}</span>
                            <span className="text-xs text-gray-400">{fmtDate(r.date)}</span>
                          </div>
                          {r.comment && <p className="mt-0.5 text-gray-600 line-clamp-2">{r.comment}</p>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>

            {/* Activity */}
            <section className="space-y-3">
              <h2 className="font-semibold text-gray-900">Done for you</h2>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Tile label="Review replies posted" value={String(d.activity.repliesPosted)} />
                <Tile label="Review requests sent" value={String(d.activity.requestsSent)} />
                <Tile label="Google posts published" value={String(d.activity.postsPublished)} />
                <Tile label="Photos added to Google" value={String(d.activity.photosAdded)} />
                <Tile label="Jobs published to the site" value={String(d.activity.jobsPublished)} />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
