'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Bell, AlertCircle, Check, Loader2, ArrowLeft, Send, Mail, Phone } from 'lucide-react';

interface NotificationData {
  leadNotificationEmail: string;
  leadNotificationPhone: string;
  resolvedEmail: string;
  fallbackSource: 'explicit' | 'scheduling_config' | 'auth_user' | 'none';
}

export default function NotificationsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [data, setData] = useState<NotificationData | null>(null);
  const [original, setOriginal] = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sites/${siteId}/settings/notifications`);
      if (!response.ok) throw new Error('Failed to load notification settings');
      const payload: NotificationData = await response.json();
      setData(payload);
      setOriginal(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = data && original && (
    data.leadNotificationEmail !== original.leadNotificationEmail ||
    data.leadNotificationPhone !== original.leadNotificationPhone
  );

  const handleSave = async () => {
    if (!data) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const response = await fetch(`/api/sites/${siteId}/settings/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadNotificationEmail: data.leadNotificationEmail,
          leadNotificationPhone: data.leadNotificationPhone,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save');
      }
      setSuccess('Notification settings saved');
      setTimeout(() => setSuccess(null), 3000);
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    try {
      setTesting(true);
      setError(null);
      setSuccess(null);
      const response = await fetch(`/api/sites/${siteId}/settings/notifications`, {
        method: 'POST',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to send test lead');
      }
      setSuccess('Test lead sent. Check your inbox within a few seconds — also visible on the Leads page.');
      setTimeout(() => setSuccess(null), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test lead');
    } finally {
      setTesting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const fallbackLabel = {
    explicit: 'this exact address',
    scheduling_config: 'falling back to your booking notification email',
    auth_user: 'falling back to your account email',
    none: 'no recipient resolved — you will not receive emails until one is set',
  }[data.fallbackSource];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link
        href={`/dashboard/sites/${siteId}`}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Site
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lead Notifications</h1>
        <p className="text-gray-500 mt-1">
          Get notified the instant someone fills out a form on your website.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 p-4 bg-[#00ef99]/5 border border-[#00ef99]/20 rounded-lg text-[#00b478]">
          <Check className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{success}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Where to send alerts</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="email" className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-gray-500" />
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={data.resolvedEmail || 'you@example.com'}
              value={data.leadNotificationEmail}
              onChange={(e) => setData({ ...data, leadNotificationEmail: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to use the fallback. Currently sending to <strong>{data.resolvedEmail || '(no address)'}</strong> ({fallbackLabel}).
            </p>
          </div>

          <div>
            <Label htmlFor="phone" className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-gray-500" />
              SMS phone (optional)
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 555 555 0100"
              value={data.leadNotificationPhone}
              onChange={(e) => setData({ ...data, leadNotificationPhone: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              SMS only fires if your site has a provisioned Twilio number (set up under Scheduling).
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <Button
          onClick={handleSendTest}
          disabled={testing}
          variant="outline"
          className="flex items-center gap-2"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending test lead…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send test lead
            </>
          )}
        </Button>

        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-black hover:bg-gray-800"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
