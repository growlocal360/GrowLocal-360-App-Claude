'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Code2,
  Copy,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  Globe,
  KeyRound,
  Webhook,
  Loader2,
  Power,
} from 'lucide-react';
import { HighLevelConnectCard } from '@/components/integrations/highlevel-connect-card';
import { SetupPromptDialog } from '@/components/integrations/setup-prompt-dialog';

interface ApiKeyRow {
  id: string;
  site_id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
  site_name: string;
}

interface WebhookRow {
  id: string;
  site_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret_preview: string;
  created_at: string;
  site_name: string;
}

interface SiteOption {
  id: string;
  name: string;
  workspace_only?: boolean;
}

/** Append a clear ·-suffix so dropdown entries with identical names
 *  (e.g. "Latour's HVAC" exists as both a GL360 site AND a Job Snaps
 *  workspace) are unambiguous. */
function siteLabel(s: SiteOption): string {
  return `${s.name} · ${s.workspace_only ? 'Job Snaps' : 'Site'}`;
}

const APP_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://app.growlocal360.com';

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {label && <span className="ml-2">{copied ? 'Copied' : label}</span>}
    </Button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
        <code>{children}</code>
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton value={children} />
      </div>
    </div>
  );
}

interface IntegrationsPanelProps {
  /** Currently-selected workspace id from the Job Snaps page. When set,
   *  the HighLevel tab targets that workspace. Pass undefined or 'all'
   *  to show a "pick a workspace" message in the HL tab. */
  selectedSiteId?: string;
}

export function IntegrationsPanel({ selectedSiteId }: IntegrationsPanelProps = {}) {
  // Resolved further down once `sites` is loaded — used for tailored prompt copy.
  // (Declared via a getter so it picks up the latest sites/selectedSiteId on render.)
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookRow[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reveal-once state
  const [newKey, setNewKey] = useState<{ name: string; fullKey: string } | null>(null);
  const [newSecret, setNewSecret] = useState<{ url: string; secret: string } | null>(null);

  // Form state
  const [keyName, setKeyName] = useState('');
  const [keySiteId, setKeySiteId] = useState<string>('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSiteId, setWebhookSiteId] = useState<string>('');
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [keysRes, hooksRes, sitesRes] = await Promise.all([
        fetch(`/api/integrations/api-keys`),
        fetch(`/api/integrations/webhooks`),
        fetch(`/api/integrations/sites`),
      ]);
      const keysData = await keysRes.json();
      const hooksData = await hooksRes.json();
      const sitesData = await sitesRes.json();
      setKeys(keysData.keys || []);
      setEndpoints(hooksData.endpoints || []);
      setSites(sitesData.sites || []);
      // Auto-select first site if exactly one exists
      const list: SiteOption[] = sitesData.sites || [];
      if (list.length > 0) {
        setKeySiteId((prev) => prev || list[0].id);
        setWebhookSiteId((prev) => prev || list[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!keyName.trim() || !keySiteId) return;
    setCreatingKey(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim(), siteId: keySiteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setNewKey({ name: keyName.trim(), fullKey: data.fullKey });
      setKeyName('');
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setCreatingKey(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key? Sites using it will immediately lose access.')) return;
    await fetch(`/api/integrations/api-keys?id=${id}`, { method: 'DELETE' });
    await fetchAll();
  }

  async function createWebhook() {
    if (!webhookUrl.trim() || !webhookSiteId) return;
    setCreatingWebhook(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl.trim(), siteId: webhookSiteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setNewSecret({ url: webhookUrl.trim(), secret: data.secret });
      setWebhookUrl('');
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create webhook');
    } finally {
      setCreatingWebhook(false);
    }
  }

  async function toggleWebhook(id: string, isActive: boolean) {
    await fetch(`/api/integrations/webhooks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    await fetchAll();
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook endpoint?')) return;
    await fetch(`/api/integrations/webhooks?id=${id}`, { method: 'DELETE' });
    await fetchAll();
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="p-8 text-center">
          <Globe className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">No site or workspace yet</h3>
          <p className="text-sm text-gray-500">
            You need a site or Job Snaps workspace before you can generate API keys.
          </p>
        </CardContent>
      </Card>
    );
  }

  const showSiteSelector = sites.length > 1;

  // Resolve the selected workspace's name for tailored prompt copy.
  const selectedSiteName =
    selectedSiteId && selectedSiteId !== 'all'
      ? sites.find((s) => s.id === selectedSiteId)?.name || null
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Connect Your Website</h2>
        <p className="text-sm text-gray-500 mt-1">
          Display your Job Snaps on any external website &mdash; Next.js, WordPress, HighLevel, or
          any site that can run JavaScript.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* One-time reveal banners */}
      {newKey && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-900">
                Your new API key &mdash; copy it now
              </h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-amber-800">
              This key will <strong>never be shown again</strong>. Store it in your environment
              variables.
            </p>
            <div className="flex gap-2 items-center">
              <Input value={newKey.fullKey} readOnly className="font-mono text-xs bg-white" />
              <CopyButton value={newKey.fullKey} label="Copy" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewKey(null)}
              className="text-amber-700"
            >
              I&apos;ve saved it &mdash; dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {newSecret && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-900">
                Webhook signing secret &mdash; copy it now
              </h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-amber-800">
              Use this secret on your server to verify incoming webhook signatures. Will{' '}
              <strong>never be shown again</strong>.
            </p>
            <div className="text-xs text-amber-700">URL: {newSecret.url}</div>
            <div className="flex gap-2 items-center">
              <Input value={newSecret.secret} readOnly className="font-mono text-xs bg-white" />
              <CopyButton value={newSecret.secret} label="Copy" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewSecret(null)}
              className="text-amber-700"
            >
              I&apos;ve saved it &mdash; dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="nextjs">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="nextjs">Next.js</TabsTrigger>
          <TabsTrigger value="wordpress">WordPress</TabsTrigger>
          <TabsTrigger value="highlevel">HighLevel</TabsTrigger>
          <TabsTrigger value="embed">Embed Script</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="nextjs" className="space-y-4 mt-4">
          {/* ── AI Setup Prompt — instant integration ──────────────────── */}
          <Card className="bg-linear-to-br from-[#00ef99]/5 via-violet-50 to-cyan-50 border-[#00ef99]/30">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">Skip the docs &mdash; have AI build it</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Generate a complete setup prompt to paste into Claude Code, Cursor, or any AI
                  coding tool inside your Next.js project. Pre-fill your credentials below for a
                  ready-to-paste prompt.
                </p>
              </div>
              <SetupPromptDialog
                framework="nextjs"
                apiBase={APP_URL}
                businessName={selectedSiteName}
                triggerVariant="default"
                initialApiKey={newKey?.fullKey || null}
                initialWebhookUrl={newSecret?.url || null}
                initialWebhookSecret={newSecret?.secret || null}
              />
            </CardContent>
          </Card>

          {/* ── Production-grade pattern (recommended) ───────────────────── */}
          <Card className="border-[#00ef99]/40">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-[#00ef99]" />
                <h3 className="font-semibold">Production setup &mdash; webhook + local DB</h3>
                <Badge variant="outline" className="ml-auto text-[#00ef99] border-[#00ef99]/30 bg-[#00ef99]/5">
                  Recommended
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Webhook stores each snap in <strong>your</strong> database. Pages render from
                local data — fast, persistent, and your snaps stay forever even if you cancel
                your subscription. ~30 min setup.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">1. Webhook handler — receives snap events</h4>
                <CodeBlock>{`// app/api/jobsnaps-webhook/route.ts
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import crypto from 'crypto';

const SECRET = process.env.JOBSNAPS_WEBHOOK_SECRET!;

function verifySignature(body: string, header: string | null): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const expected = crypto.createHmac('sha256', SECRET)
    .update(\`\${parts.t}.\${body}\`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!verifySignature(body, req.headers.get('x-webhook-signature'))) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { type, data } = JSON.parse(body);
  if (type === 'job_snap.published' || type === 'job_snap.updated') {
    await db.snaps.upsert({
      where: { id: data.id },
      create: { id: data.id, ...data },
      update: data,
    });
  } else if (type === 'job_snap.unpublished') {
    await db.snaps.delete({ where: { id: data.id } });
  }

  revalidatePath('/work');
  return Response.json({ ok: true });
}`}</CodeBlock>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">
                  2. Render from your local DB (no external API call)
                </h4>
                <CodeBlock>{`// app/work/page.tsx
import { db } from '@/lib/db';

export default async function WorkPage() {
  const snaps = await db.snaps.findMany({
    orderBy: { published_at: 'desc' },
    take: 20,
  });

  return (
    <div className="grid grid-cols-3 gap-4">
      {snaps.map((snap) => (
        <article key={snap.id}>
          {snap.media[0] && <img src={snap.media[0].url} alt={snap.media[0].alt} />}
          <h2>{snap.title}</h2>
          <p>{snap.description}</p>
          <span>{snap.location.city}, {snap.location.state}</span>
        </article>
      ))}
    </div>
  );
}`}</CodeBlock>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">3. Configure</h4>
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                  <li>Register your webhook URL in the <strong>Webhooks</strong> section below</li>
                  <li>Add <code className="bg-gray-100 px-1 rounded">JOBSNAPS_WEBHOOK_SECRET</code> to your env vars (the signing secret shown when you create the webhook)</li>
                  <li>Run a DB migration to create a <code className="bg-gray-100 px-1 rounded">snaps</code> table matching the snap shape</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* ── Quick start (live fetch) ───────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold">Quick start &mdash; live fetch</h3>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Fetch from our API on every ISR rebuild. Works in 5 minutes, no database
                needed. <strong>Trade-off:</strong> snaps disappear from your site if you cancel
                your subscription (the API key gets revoked).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">1. Add your API key to .env.local</h4>
                <CodeBlock>{`JOBSNAPS_API_KEY=your_api_key_here`}</CodeBlock>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">
                  2. Fetch and render snaps in a Server Component
                </h4>
                <CodeBlock>{`// app/work/page.tsx
export default async function WorkPage() {
  const res = await fetch('${APP_URL}/api/v1/job-snaps?limit=20', {
    headers: { 'X-API-Key': process.env.JOBSNAPS_API_KEY! },
    next: { revalidate: 3600 },
  });
  const { data: snaps } = await res.json();

  return (
    <div className="grid grid-cols-3 gap-4">
      {snaps.map((snap) => (
        <article key={snap.id}>
          {snap.media[0] && (
            <img src={snap.media[0].url} alt={snap.media[0].alt} />
          )}
          <h2>{snap.title}</h2>
          <p>{snap.description}</p>
          <span>{snap.location.city}, {snap.location.state}</span>
        </article>
      ))}
    </div>
  );
}`}</CodeBlock>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wordpress" className="space-y-4 mt-4">
          {/* ── AI Setup Prompt — works today even without the plugin ───── */}
          <Card className="bg-linear-to-br from-[#00ef99]/5 via-violet-50 to-cyan-50 border-[#00ef99]/30">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">
                  Have AI build a WordPress integration today
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Skip waiting for the plugin. Generate an AI prompt that walks Claude/Cursor/etc.
                  through registering a Custom Post Type + webhook handler in your theme&apos;s
                  <code className="bg-gray-100 px-1 rounded ml-1">functions.php</code> or as a
                  small custom plugin. Server-rendered, SEO-friendly, indexed by Google.
                </p>
              </div>
              <SetupPromptDialog
                framework="wordpress"
                apiBase={APP_URL}
                businessName={selectedSiteName}
                triggerVariant="default"
                initialApiKey={newKey?.fullKey || null}
                initialWebhookUrl={newSecret?.url || null}
                initialWebhookSecret={newSecret?.secret || null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-[#00ef99]" />
                <h3 className="font-semibold">WordPress Plugin</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center">
                <p className="text-sm text-gray-600">Official WordPress plugin coming soon.</p>
                <p className="text-xs text-gray-500 mt-1">
                  In the meantime, use the AI Setup Prompt above (works today) or the Embed
                  Script tab.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highlevel" className="space-y-4 mt-4">
          {selectedSiteId && selectedSiteId !== 'all' ? (
            <HighLevelConnectCard siteId={selectedSiteId} />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-[#00ef99]" />
                  <h3 className="font-semibold">HighLevel Integration</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center space-y-2">
                  <p className="text-sm text-gray-700 font-medium">
                    Pick a workspace from the dropdown above to connect HighLevel
                  </p>
                  <p className="text-xs text-gray-500">
                    HighLevel connections are per-workspace — published Job Snaps from a
                    workspace become real blog posts on that workspace&apos;s HighLevel site.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="embed" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-[#00ef99]" />
                <h3 className="font-semibold">Embed on any website</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Paste this snippet anywhere &mdash; Squarespace, Wix, HighLevel, raw HTML.
              </p>
              <CodeBlock>{`<div id="jobsnaps-gallery"></div>
<script
  src="${APP_URL}/embed.js"
  data-api-key="your_api_key_here"
  data-target="#jobsnaps-gallery"
  data-limit="20"
></script>`}</CodeBlock>
              <p className="text-xs text-gray-500">
                Optional <code className="bg-gray-100 px-1 rounded">data-theme=&quot;dark&quot;</code> for
                dark backgrounds. Styles are scoped so they won&apos;t conflict with your site&apos;s CSS.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4 mt-4">
          {/* ── AI Setup Prompt ─────────────────────────────────────── */}
          <Card className="bg-linear-to-br from-[#00ef99]/5 via-violet-50 to-cyan-50 border-[#00ef99]/30">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">Have AI integrate this for you</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Generate an AI prompt with the API spec + your credentials baked in. Paste
                  into your AI coding tool and it&apos;ll wire up the integration in the right
                  place for your stack.
                </p>
              </div>
              <SetupPromptDialog
                framework="api"
                apiBase={APP_URL}
                businessName={selectedSiteName}
                triggerVariant="default"
                initialApiKey={newKey?.fullKey || null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-[#00ef99]" />
                <h3 className="font-semibold">Public REST API</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Endpoint</h4>
                <CodeBlock>{`GET ${APP_URL}/api/v1/job-snaps`}</CodeBlock>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Authentication</h4>
                <CodeBlock>{`X-API-Key: your_api_key_here
Authorization: Bearer your_api_key_here`}</CodeBlock>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">curl example</h4>
                <CodeBlock>{`curl -H "X-API-Key: your_api_key_here" \\
  "${APP_URL}/api/v1/job-snaps?limit=20"`}</CodeBlock>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Query params</h4>
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                  <li>
                    <code className="bg-gray-100 px-1 rounded">limit</code> &mdash; default 20, max
                    100
                  </li>
                  <li>
                    <code className="bg-gray-100 px-1 rounded">offset</code> &mdash; pagination
                  </li>
                  <li>
                    <code className="bg-gray-100 px-1 rounded">brand</code> &mdash; filter by brand
                  </li>
                  <li>
                    <code className="bg-gray-100 px-1 rounded">service_type</code> &mdash; filter
                    by service type
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* API KEYS LIST */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#00ef99]" />
              <h3 className="font-semibold">API Keys</h3>
              <Badge variant="secondary">{keys.length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Key name (e.g. WordPress site, Next.js site)"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="flex-1"
            />
            {showSiteSelector && (
              <Select value={keySiteId} onValueChange={setKeySiteId}>
                <SelectTrigger className="sm:w-48">
                  <SelectValue placeholder="Site..." />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {siteLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={createKey}
              disabled={!keyName.trim() || !keySiteId || creatingKey}
              className="bg-black hover:bg-gray-800"
            >
              {creatingKey ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Generate Key
            </Button>
          </div>

          {keys.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No keys yet. Generate one to start using the API.
            </p>
          ) : (
            <div className="divide-y border rounded-lg">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium text-sm">{k.name}</div>
                    <div className="font-mono text-xs text-gray-500 mt-0.5">
                      {k.key_prefix}…
                      {showSiteSelector && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {k.site_name}
                        </Badge>
                      )}
                      {k.revoked_at && (
                        <Badge variant="secondary" className="ml-2 bg-red-50 text-red-700">
                          Revoked
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Created {new Date(k.created_at).toLocaleDateString()}
                      {k.last_used_at && (
                        <> &middot; Last used {new Date(k.last_used_at).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  {!k.revoked_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeKey(k.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* WEBHOOKS LIST */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-[#00ef99]" />
            <h3 className="font-semibold">Webhooks</h3>
            <Badge variant="secondary">{endpoints.length}</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Get notified when a Job Snap is published, updated, or unpublished &mdash; perfect for
            triggering ISR rebuilds on your Next.js site.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="https://yoursite.com/api/jobsnaps-webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1"
            />
            {showSiteSelector && (
              <Select value={webhookSiteId} onValueChange={setWebhookSiteId}>
                <SelectTrigger className="sm:w-48">
                  <SelectValue placeholder="Site..." />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {siteLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={createWebhook}
              disabled={!webhookUrl.trim() || !webhookSiteId || creatingWebhook}
              className="bg-black hover:bg-gray-800"
            >
              {creatingWebhook ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Endpoint
            </Button>
          </div>

          {endpoints.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No webhook endpoints. Add one to receive event notifications.
            </p>
          ) : (
            <div className="divide-y border rounded-lg">
              {endpoints.map((ep) => (
                <div key={ep.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <Label className="block">
                      <div className="font-mono text-sm truncate">{ep.url}</div>
                    </Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ep.events.map((e) => (
                        <Badge key={e} variant="secondary" className="text-xs">
                          {e}
                        </Badge>
                      ))}
                      {showSiteSelector && (
                        <Badge variant="secondary" className="text-xs">
                          {ep.site_name}
                        </Badge>
                      )}
                      {!ep.is_active && (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleWebhook(ep.id, ep.is_active)}
                      title={ep.is_active ? 'Disable' : 'Enable'}
                    >
                      <Power
                        className={`h-4 w-4 ${
                          ep.is_active ? 'text-[#00ef99]' : 'text-gray-400'
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteWebhook(ep.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
