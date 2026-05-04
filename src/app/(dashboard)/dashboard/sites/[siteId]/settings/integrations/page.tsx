'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
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
import type { ApiKeyPublic, WebhookEndpointPublic } from '@/types/database';

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

export default function IntegrationsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [keys, setKeys] = useState<ApiKeyPublic[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpointPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reveal-once state for newly created secrets
  const [newKey, setNewKey] = useState<{ name: string; fullKey: string } | null>(null);
  const [newSecret, setNewSecret] = useState<{ url: string; secret: string } | null>(null);

  // Form state
  const [keyName, setKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [siteId]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [keysRes, hooksRes] = await Promise.all([
        fetch(`/api/sites/${siteId}/settings/api-keys`),
        fetch(`/api/sites/${siteId}/settings/webhooks`),
      ]);
      const keysData = await keysRes.json();
      const hooksData = await hooksRes.json();
      setKeys(keysData.keys || []);
      setEndpoints(hooksData.endpoints || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!keyName.trim()) return;
    setCreatingKey(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/settings/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim() }),
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
    await fetch(`/api/sites/${siteId}/settings/api-keys?id=${id}`, { method: 'DELETE' });
    await fetchAll();
  }

  async function createWebhook() {
    if (!webhookUrl.trim()) return;
    setCreatingWebhook(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/settings/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl.trim() }),
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
    await fetch(`/api/sites/${siteId}/settings/webhooks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    await fetchAll();
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook endpoint?')) return;
    await fetch(`/api/sites/${siteId}/settings/webhooks?id=${id}`, { method: 'DELETE' });
    await fetchAll();
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Link
        href={`/dashboard/sites/${siteId}`}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Site
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Connect Your Website</h1>
        <p className="text-gray-500 mt-1">
          Display your Job Snaps on any external website — Next.js, WordPress, HighLevel, or any
          site that can run JavaScript.
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
              <h2 className="font-semibold text-amber-900">
                Your new API key &mdash; copy it now
              </h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-amber-800">
              This key will <strong>never be shown again</strong>. Store it in your environment
              variables (e.g. <code className="bg-amber-100 px-1 rounded">JOBSNAPS_API_KEY</code>).
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
              <h2 className="font-semibold text-amber-900">
                Webhook signing secret &mdash; copy it now
              </h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-amber-800">
              Use this secret on your server to verify incoming webhook signatures. Will
              <strong> never be shown again</strong>.
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
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="nextjs">Next.js</TabsTrigger>
          <TabsTrigger value="wordpress">WordPress</TabsTrigger>
          <TabsTrigger value="embed">Embed Script</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        {/* ── NEXT.JS ───────────────────────────────────────────────── */}
        <TabsContent value="nextjs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-[#00ef99]" />
                <h2 className="font-semibold">Drop into your Next.js site</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-2">1. Add your API key to .env.local</h3>
                <CodeBlock>{`JOBSNAPS_API_KEY=your_api_key_here`}</CodeBlock>
              </div>

              <div>
                <h3 className="font-medium text-sm mb-2">
                  2. Fetch and render snaps in a Server Component
                </h3>
                <CodeBlock>{`// app/work/page.tsx
export default async function WorkPage() {
  const res = await fetch('${APP_URL}/api/v1/job-snaps?limit=20', {
    headers: { 'X-API-Key': process.env.JOBSNAPS_API_KEY! },
    next: { revalidate: 3600 }, // ISR — 1 hour
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

              <div>
                <h3 className="font-medium text-sm mb-2">
                  3. (Optional) Add a webhook endpoint for instant updates
                </h3>
                <CodeBlock>{`// app/api/jobsnaps-webhook/route.ts
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  // Verify signature (recommended — use the secret from your dashboard)
  // const signature = req.headers.get('x-webhook-signature');
  // ...verifyWebhookSignature(body, signature, process.env.JOBSNAPS_WEBHOOK_SECRET)

  revalidatePath('/work');
  return Response.json({ ok: true });
}`}</CodeBlock>
                <p className="text-xs text-gray-500 mt-2">
                  Then register{' '}
                  <code className="bg-gray-100 px-1 rounded">
                    https://yoursite.com/api/jobsnaps-webhook
                  </code>{' '}
                  in the Webhooks section below.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── WORDPRESS ─────────────────────────────────────────────── */}
        <TabsContent value="wordpress" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-[#00ef99]" />
                <h2 className="font-semibold">WordPress Plugin</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center">
                <p className="text-sm text-gray-600">
                  WordPress plugin coming soon.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  In the meantime, the Embed Script tab works on any WordPress site.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── EMBED SCRIPT ──────────────────────────────────────────── */}
        <TabsContent value="embed" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-[#00ef99]" />
                <h2 className="font-semibold">Embed on any website</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Paste this snippet anywhere you want a Job Snaps gallery to appear &mdash;
                Squarespace, Wix, HighLevel, raw HTML, anywhere.
              </p>
              <CodeBlock>{`<div id="jobsnaps-gallery"></div>
<script
  src="${APP_URL}/embed.js"
  data-api-key="your_api_key_here"
  data-target="#jobsnaps-gallery"
  data-limit="20"
></script>`}</CodeBlock>
              <p className="text-xs text-gray-500">
                Embed script ships with default styling that works on dark or light backgrounds.
                Coming soon &mdash; for now, use the API tab to fetch directly.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── API ───────────────────────────────────────────────────── */}
        <TabsContent value="api" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-[#00ef99]" />
                <h2 className="font-semibold">Public REST API</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Endpoint</h3>
                <CodeBlock>{`GET ${APP_URL}/api/v1/job-snaps`}</CodeBlock>
              </div>
              <div>
                <h3 className="font-medium text-sm mb-2">Authentication</h3>
                <CodeBlock>{`# Either header works:
X-API-Key: your_api_key_here
Authorization: Bearer your_api_key_here`}</CodeBlock>
              </div>
              <div>
                <h3 className="font-medium text-sm mb-2">curl example</h3>
                <CodeBlock>{`curl -H "X-API-Key: your_api_key_here" \\
  "${APP_URL}/api/v1/job-snaps?limit=20"`}</CodeBlock>
              </div>
              <div>
                <h3 className="font-medium text-sm mb-2">Query params</h3>
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                  <li>
                    <code className="bg-gray-100 px-1 rounded">limit</code> &mdash; default 20, max
                    100
                  </li>
                  <li>
                    <code className="bg-gray-100 px-1 rounded">offset</code> &mdash; pagination
                    offset
                  </li>
                  <li>
                    <code className="bg-gray-100 px-1 rounded">brand</code> &mdash; filter by
                    detected brand
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

      {/* ── API KEYS LIST ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#00ef99]" />
              <h2 className="font-semibold">API Keys</h2>
              <Badge variant="secondary">{keys.length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Key name (e.g. WordPress site, Next.js site)"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
            <Button
              onClick={createKey}
              disabled={!keyName.trim() || creatingKey}
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

      {/* ── WEBHOOKS LIST ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Webhooks</h2>
            <Badge variant="secondary">{endpoints.length}</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Get notified when a Job Snap is published, updated, or unpublished &mdash; perfect for
            triggering ISR rebuilds on your Next.js site.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://yoursite.com/api/jobsnaps-webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <Button
              onClick={createWebhook}
              disabled={!webhookUrl.trim() || creatingWebhook}
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
                      <Power className={`h-4 w-4 ${ep.is_active ? 'text-[#00ef99]' : 'text-gray-400'}`} />
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
