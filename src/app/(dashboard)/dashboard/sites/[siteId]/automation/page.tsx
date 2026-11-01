'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Bot, Check, X, Loader2, RefreshCw, Star, AlertCircle, Inbox, History, MessageSquare, Mail, Phone, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { PendingAction, ReviewReplyContext, ReviewRequestContext } from '@/types/database';

interface AutomationState {
  automationMode: 'approve' | 'autopilot';
  reviewReplies: boolean;
  gbpLinked: boolean;
  gbpConnected: boolean;
  counts: Record<string, number>;
  unansweredRecent: number;
  unansweredOlder: number;
  reviewRequests: { enabled: boolean; delayHours: number; followUp: boolean; followUpDays: number };
  reviewRequestsSent: number;
  smsReady: boolean;
  lastReviewSync: {
    at: string;
    imported: number;
    drafted: number;
    auto_published: number;
    skipped: string | null;
    errors: string[];
  } | null;
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  return fmt(iso);
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />
      ))}
    </span>
  );
}

function fmt(d: string | null | undefined): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; }
}

const STATUS_STYLE: Record<string, string> = {
  published: 'bg-green-100 text-green-800',
  rejected: 'bg-gray-100 text-gray-700',
  failed: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
};

export default function AutomationPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [state, setState] = useState<AutomationState | null>(null);
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, 'approve' | 'reject'>>({});

  const loadState = useCallback(async () => {
    const res = await fetch(`/api/sites/${siteId}/automation`);
    if (res.ok) setState(await res.json());
  }, [siteId]);

  const loadActions = useCallback(async (which: 'pending' | 'history') => {
    const res = await fetch(`/api/sites/${siteId}/automation/queue?status=${which}`);
    if (res.ok) {
      const data = await res.json();
      setActions(data.actions || []);
    }
  }, [siteId]);

  useEffect(() => {
    async function init() {
      await Promise.all([loadState(), loadActions('pending')]);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const switchTab = async (which: 'pending' | 'history') => {
    setTab(which);
    setLoading(true);
    await loadActions(which);
    setLoading(false);
  };

  const patch = async (body: Record<string, unknown>) => {
    setSavingMode(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/automation`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      await loadState();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingMode(false);
    }
  };

  const [backfilling, setBackfilling] = useState(false);
  const syncNow = async (includeOlder = false) => {
    const setFlag = includeOlder ? setBackfilling : setSyncing;
    setFlag(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/automation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeOlder }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Sync failed to start');
      toast.success(includeOlder
        ? 'Drafting replies for older reviews. They land in the list below over the next minute or two.'
        : 'Checking Google for new reviews. New drafts show up here in about a minute.');
      // Drafting takes a few seconds per review; refresh a couple of times.
      [20000, 50000, 90000].forEach((ms) => setTimeout(async () => { await Promise.all([loadState(), loadActions(tab)]); }, ms));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setFlag(false);
    }
  };

  const decide = async (action: PendingAction, decision: 'approve' | 'reject') => {
    setBusy((b) => ({ ...b, [action.id]: decision }));
    try {
      const edited = drafts[action.id];
      const isRequest = action.action_type === 'review_request';
      const res = await fetch(`/api/sites/${siteId}/automation/queue/${action.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRequest ? { decision, sms: edited } : { decision, reply: edited }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(decision === 'reject'
        ? 'Dismissed.'
        : isRequest
          ? `Review request sent by ${(data.channels || []).join(' and ') || 'email'}.`
          : 'Reply posted to Google.');
      setActions((prev) => prev.filter((a) => a.id !== action.id));
      await loadState();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
      await loadActions(tab);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[action.id]; return n; });
    }
  };

  const [reqForm, setReqForm] = useState({ name: '', phone: '', email: '' });
  const [sendingReq, setSendingReq] = useState(false);
  const sendManualRequest = async () => {
    setSendingReq(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/automation/review-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reqForm, sendNow: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send');
      toast.success(`Review request sent to ${reqForm.name.trim() || 'the customer'}.`);
      setReqForm({ name: '', phone: '', email: '' });
      await Promise.all([loadState(), loadActions(tab)]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send');
    } finally {
      setSendingReq(false);
    }
  };

  const pendingCount = state?.counts?.pending || 0;
  const ready = !!state?.gbpLinked && !!state?.gbpConnected;
  const rr = state?.reviewRequests;

  return (
    <div className="flex flex-col">
      <div className="p-6 space-y-6 max-w-4xl">
        <Link href={`/dashboard/sites/${siteId}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to site
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Bot className="h-6 w-6 text-[#00b875]" /> Automation</h1>
            <p className="text-gray-500 mt-1">Review replies and review requests today. GBP posts, photos and social next. Everything lands here first unless autopilot is on.</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => syncNow(false)} disabled={syncing || backfilling || !ready}>
                {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Check for new reviews
              </Button>
              {(state?.unansweredOlder || 0) > 0 && (
                <Button size="sm" onClick={() => syncNow(true)} disabled={syncing || backfilling || !ready || !state?.reviewReplies} className="bg-[#00ef99] text-gray-900 hover:bg-[#00d98a]">
                  {backfilling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                  Draft replies for {state!.unansweredOlder} older review{state!.unansweredOlder === 1 ? '' : 's'}
                </Button>
              )}
            </div>
            {state?.lastReviewSync && (
              <p className="text-xs text-gray-500">
                Last checked {ago(state.lastReviewSync.at)}: {state.lastReviewSync.imported} review{state.lastReviewSync.imported === 1 ? '' : 's'} on Google,
                {' '}{state.lastReviewSync.drafted} new draft{state.lastReviewSync.drafted === 1 ? '' : 's'}
                {state.lastReviewSync.auto_published > 0 ? `, ${state.lastReviewSync.auto_published} posted on autopilot` : ''}
                {state.lastReviewSync.skipped ? ` (${state.lastReviewSync.skipped})` : ''}
                {state.lastReviewSync.errors?.length ? <span className="text-red-600"> · {state.lastReviewSync.errors[0]}</span> : null}
              </p>
            )}
          </div>
        </div>

        {state && !ready && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {!state.gbpLinked ? 'This site has no Google Business Profile location linked. ' : 'Google is not connected for this site. '}
              <Link href={`/dashboard/sites/${siteId}/connect-gbp`} className="underline">Connect the Business Profile</Link> to import reviews and post replies.
            </span>
          </div>
        )}

        {/* Settings */}
        <Card>
          <CardHeader><h2 className="font-semibold">How it runs</h2></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium text-gray-900">Autopilot</div>
                <p className="text-sm text-gray-500 mt-0.5">
                  On: replies to 4 and 5 star reviews post on their own. Replies to 3 stars and below always wait here for you.
                  Off: every draft waits for your approval.
                </p>
              </div>
              <Switch
                checked={state?.automationMode === 'autopilot'}
                disabled={!state || savingMode}
                onCheckedChange={(v) => patch({ automationMode: v ? 'autopilot' : 'approve' })}
                aria-label="Autopilot"
              />
            </div>
            <div className="flex items-start justify-between gap-4 border-t pt-5">
              <div>
                <div className="font-medium text-gray-900">Draft review replies</div>
                <p className="text-sm text-gray-500 mt-0.5">Checks Google every hour for new reviews (last 60 days) and writes a reply in your voice. 1 and 2 star reviews also email you right away. Older unanswered reviews can be drafted on demand with the button above.</p>
              </div>
              <Switch
                checked={!!state?.reviewReplies}
                disabled={!state || savingMode}
                onCheckedChange={(v) => patch({ reviewReplies: v })}
                aria-label="Draft review replies"
              />
            </div>
            <div className="flex items-start justify-between gap-4 border-t pt-5">
              <div className="flex-1">
                <div className="font-medium text-gray-900">Ask customers for reviews</div>
                <p className="text-sm text-gray-500 mt-0.5">
                  When an appointment is marked completed, text and email the customer a link to your Google review form.
                  Autopilot sends it; otherwise it waits here. You can also send one by hand below or from any lead.
                </p>
                {rr?.enabled && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-700">
                    <label className="flex items-center gap-2">
                      Wait
                      <select
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                        value={rr.delayHours}
                        disabled={savingMode}
                        onChange={(e) => patch({ reviewRequests: { delayHours: Number(e.target.value) } })}
                      >
                        <option value={0}>no time</option>
                        <option value={1}>1 hour</option>
                        <option value={2}>2 hours</option>
                        <option value={4}>4 hours</option>
                        <option value={24}>1 day</option>
                      </select>
                      after completion
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch checked={rr.followUp} disabled={savingMode} onCheckedChange={(v) => patch({ reviewRequests: { followUp: v } })} aria-label="Follow up" />
                      One follow-up after {rr.followUpDays} days if no new review arrives
                    </label>
                  </div>
                )}
                {rr?.enabled && !state?.smsReady && (
                  <p className="mt-2 text-xs text-amber-700">Texting is not set up for this site, so requests go by email only. Add a texting number under Scheduling → Settings.</p>
                )}
              </div>
              <Switch
                checked={!!rr?.enabled}
                disabled={!state || savingMode}
                onCheckedChange={(v) => patch({ reviewRequests: { enabled: v } })}
                aria-label="Ask customers for reviews"
              />
            </div>
          </CardContent>
        </Card>

        {/* Manual review request */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4 text-gray-500" /> Request a review</h2>
            <p className="text-sm text-gray-500">Just finished a job? Send the customer the review link now. Needs a mobile number or an email.</p>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
              onSubmit={(e) => { e.preventDefault(); sendManualRequest(); }}
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Customer name</label>
                <Input value={reqForm.name} onChange={(e) => setReqForm((f) => ({ ...f, name: e.target.value }))} placeholder="Maria Lopez" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Mobile</label>
                <Input value={reqForm.phone} onChange={(e) => setReqForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(941) 555-0142" inputMode="tel" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                <Input value={reqForm.email} onChange={(e) => setReqForm((f) => ({ ...f, email: e.target.value }))} placeholder="maria@example.com" inputMode="email" />
              </div>
              <Button type="submit" disabled={sendingReq || !ready || !reqForm.name.trim() || (!reqForm.phone.trim() && !reqForm.email.trim())} className="bg-[#00ef99] text-gray-900 hover:bg-[#00d98a]">
                {sendingReq ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send
              </Button>
            </form>
            {(state?.reviewRequestsSent || 0) > 0 && (
              <p className="mt-3 text-xs text-gray-500">{state!.reviewRequestsSent} request{state!.reviewRequestsSent === 1 ? '' : 's'} sent so far.</p>
            )}
          </CardContent>
        </Card>

        {/* Queue */}
        <div className="flex items-center gap-2">
          <Button variant={tab === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => switchTab('pending')} className={tab === 'pending' ? 'bg-[#00ef99] text-gray-900 hover:bg-[#00d98a]' : ''}>
            <Inbox className="mr-2 h-4 w-4" /> Waiting for you{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Button>
          <Button variant={tab === 'history' ? 'default' : 'outline'} size="sm" onClick={() => switchTab('history')} className={tab === 'history' ? 'bg-[#00ef99] text-gray-900 hover:bg-[#00d98a]' : ''}>
            <History className="mr-2 h-4 w-4" /> History
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : actions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              {tab !== 'pending'
                ? 'No history yet.'
                : (state?.unansweredOlder || 0) > 0
                  ? `Nothing waiting. ${state!.unansweredOlder} older review${state!.unansweredOlder === 1 ? ' has' : 's have'} no reply yet. New reviews are checked hourly; use the button above to catch up on the older ones.`
                  : 'Nothing waiting. New reviews are checked every hour and drafts appear here.'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {actions.map((action) => {
              const isPending = action.status === 'pending' || action.status === 'failed';
              if (action.action_type === 'review_request') {
                const rq = action.context as unknown as ReviewRequestContext;
                const sms = drafts[action.id] ?? String((action.payload as { sms?: string }).sms || '');
                const sentVia = (action.payload as { channels?: string[] }).channels;
                return (
                  <Card key={action.id}>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">Review request · {rq.customer_name}</span>
                            <span className="text-xs text-gray-400">{fmt(action.created_at)}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                            {rq.customer_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {rq.customer_phone}</span>}
                            {rq.customer_email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {rq.customer_email}</span>}
                            <span>{rq.source === 'appointment_completed' ? 'after completed appointment' : rq.source === 'lead' ? 'from a lead' : 'manual'}</span>
                            {sentVia?.length ? <span>sent by {sentVia.join(' and ')}</span> : null}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[action.status] || ''}`}>
                          {action.status === 'published' ? (action.auto_published ? 'sent · autopilot' : 'sent') : action.status}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Text message</div>
                        {isPending ? (
                          <Textarea value={sms} onChange={(e) => setDrafts((d) => ({ ...d, [action.id]: e.target.value }))} rows={3} className="text-sm" />
                        ) : (
                          <p className="text-sm text-gray-700 rounded-lg bg-gray-50 p-3">{sms}</p>
                        )}
                        {rq.customer_email && <p className="mt-1 text-xs text-gray-400">The email version uses the same link with a button.</p>}
                        {action.error && <p className="mt-1 text-xs text-red-600">{action.error}</p>}
                      </div>
                      {isPending && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => decide(action, 'approve')} disabled={!!busy[action.id]} className="bg-[#00ef99] text-gray-900 hover:bg-[#00d98a]">
                            {busy[action.id] === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Send request
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => decide(action, 'reject')} disabled={!!busy[action.id]}>
                            {busy[action.id] === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }
              const ctx = action.context as unknown as ReviewReplyContext;
              const reply = drafts[action.id] ?? String((action.payload as { reply?: string }).reply || '');
              return (
                <Card key={action.id}>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Stars rating={ctx.rating} />
                          <span className="font-medium text-gray-900">{ctx.author_name}</span>
                          <span className="text-xs text-gray-400">{fmt(ctx.review_date)}</span>
                        </div>
                        {ctx.comment ? (
                          <p className="mt-2 text-sm text-gray-700 italic">&ldquo;{ctx.comment}&rdquo;</p>
                        ) : (
                          <p className="mt-2 text-sm text-gray-400">Rating only, no written comment.</p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[action.status] || ''}`}>
                        {action.status === 'published' && action.auto_published ? 'autopilot' : action.status}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Reply</div>
                      {isPending ? (
                        <Textarea
                          value={reply}
                          onChange={(e) => setDrafts((d) => ({ ...d, [action.id]: e.target.value }))}
                          rows={3}
                          className="text-sm"
                        />
                      ) : (
                        <p className="text-sm text-gray-700 rounded-lg bg-gray-50 p-3">{reply}</p>
                      )}
                      {action.error && <p className="mt-1 text-xs text-red-600">{action.error}</p>}
                    </div>

                    {isPending && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decide(action, 'approve')} disabled={!!busy[action.id] || !ready} className="bg-[#00ef99] text-gray-900 hover:bg-[#00d98a]">
                          {busy[action.id] === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                          Post reply
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => decide(action, 'reject')} disabled={!!busy[action.id]}>
                          {busy[action.id] === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
