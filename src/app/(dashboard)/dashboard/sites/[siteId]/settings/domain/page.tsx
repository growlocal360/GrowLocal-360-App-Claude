'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Check,
  X,
  Copy,
  RefreshCw,
  ExternalLink,
  Trash2,
  AlertCircle,
} from 'lucide-react';

interface DNSRecord {
  type: string;
  name: string;
  value: string;
}

interface DomainConfig {
  subdomain: string;
  customDomain: string | null;
  customDomainVerified: boolean;
  dnsInstructions: {
    configured: boolean;
    records: DNSRecord[];
    verification?: {
      type: string;
      domain: string;
      value: string;
    };
  } | null;
  vercelConfigured: boolean;
}

export default function DomainSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [config, setConfig] = useState<DomainConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newDomain, setNewDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  // Fetch current domain configuration
  useEffect(() => {
    fetchDomainConfig();
  }, [siteId]);

  const fetchDomainConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/domain`);
      if (!response.ok) {
        throw new Error('Failed to fetch domain configuration');
      }

      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domain settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    try {
      setIsAdding(true);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add domain');
      }

      setNewDomain('');
      await fetchDomainConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add domain');
    } finally {
      setIsAdding(false);
    }
  };

  const handleVerifyDomain = async () => {
    try {
      setIsVerifying(true);
      setVerifyMessage(null);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/domain/verify`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setVerifyMessage(data.message);

      if (data.verified) {
        await fetchDomainConfig();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!confirm('Are you sure you want to remove this custom domain?')) return;

    try {
      setIsRemoving(true);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/domain`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove domain');
      }

      await fetchDomainConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove domain');
    } finally {
      setIsRemoving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Domain Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage your site&apos;s subdomain and custom domain
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Subdomain (Always Active) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-[#00d9c0]" />
              <h2 className="font-semibold">Subdomain</h2>
            </div>
            <Badge className="bg-[#00d9c0]/10 text-[#00d9c0]">Active</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            Your site is always available at this subdomain:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
              {config?.subdomain}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(`https://${config?.subdomain}`)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={`https://${config?.subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Domain */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold">Custom Domain</h2>
            </div>
            {config?.customDomain && (
              <Badge
                className={
                  config.customDomainVerified
                    ? 'bg-[#00d9c0]/10 text-[#00d9c0]'
                    : 'bg-yellow-100 text-yellow-700'
                }
              >
                {config.customDomainVerified ? 'Verified' : 'Pending DNS'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {config?.customDomain ? (
            <>
              {/* Current custom domain */}
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
                  {config.customDomain}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyDomain}
                  disabled={isVerifying || config.customDomainVerified}
                >
                  {isVerifying ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : config.customDomainVerified ? (
                    <Check className="h-4 w-4 text-[#00d9c0]" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveDomain}
                  disabled={isRemoving}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {verifyMessage && (
                <p
                  className={`text-sm ${
                    config.customDomainVerified
                      ? 'text-[#00d9c0]'
                      : 'text-yellow-600'
                  }`}
                >
                  {verifyMessage}
                </p>
              )}

              {/* DNS Instructions */}
              {!config.customDomainVerified && config.dnsInstructions && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">
                    DNS Configuration Required
                  </h3>
                  <p className="text-sm text-blue-700 mb-4">
                    Add the following DNS record to your domain provider:
                  </p>
                  <div className="space-y-2">
                    {config.dnsInstructions.records.map((record, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-white p-2 rounded border"
                      >
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {record.type}
                        </span>
                        <span className="font-mono text-sm">
                          {record.name}
                        </span>
                        <span className="text-gray-400">→</span>
                        <code className="flex-1 font-mono text-sm truncate">
                          {record.value}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(record.value)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-600 mt-3">
                    DNS changes can take up to 48 hours to propagate.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Add custom domain form */
            <form onSubmit={handleAddDomain} className="space-y-4">
              <div>
                <Label htmlFor="domain">Domain Name</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Enter your custom domain (e.g., yourbusiness.com)
                </p>
                <div className="flex gap-2">
                  <Input
                    id="domain"
                    type="text"
                    placeholder="yourbusiness.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isAdding || !newDomain.trim()}>
                    {isAdding ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Add Domain
                  </Button>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="pt-6">
          <h3 className="font-medium text-gray-900 mb-2">
            How Custom Domains Work
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Enter your domain name above</li>
            <li>Add the DNS records to your domain provider (GoDaddy, Namecheap, etc.)</li>
            <li>Click &quot;Verify&quot; to check your DNS configuration</li>
            <li>Once verified, your site will be live at your custom domain</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
