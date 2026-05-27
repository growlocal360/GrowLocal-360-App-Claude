'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';

interface PendingInvite {
  token: string;
  orgName: string;
}

export function SetupForm({
  defaultName,
  invites = [],
}: {
  defaultName: string;
  invites?: PendingInvite[];
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName ? `${defaultName}'s Business` : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState<string | null>(null);

  const handleAccept = async (token: string) => {
    setAccepting(token);
    setError('');
    try {
      const res = await fetch('/api/team/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to accept invitation');
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      setAccepting(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create your business');
      }
      // New org is now the active org (cookie set server-side). Land in the dashboard.
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Image src="/grow-local-360-logo-black.svg" alt="GrowLocal360" width={200} height={35} priority />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {invites.length > 0 ? 'Welcome back' : 'Create your business'}
          </CardTitle>
          <CardDescription>
            {invites.length > 0
              ? 'You have a team invitation waiting. Rejoin that team, or create your own business below.'
              : 'Set up your own account to start building a website and capturing leads. This is separate from any team you’ve been invited to.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          {invites.length > 0 && (
            <div className="mb-6 space-y-3">
              {invites.map((invite) => (
                <Button
                  key={invite.token}
                  type="button"
                  className="w-full bg-[#00ef99] text-black hover:bg-[#00d488]"
                  disabled={accepting !== null}
                  onClick={() => handleAccept(invite.token)}
                >
                  {accepting === invite.token ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Joining…
                    </>
                  ) : (
                    <>
                      <Users className="mr-2 h-4 w-4" />
                      Accept invitation to {invite.orgName}
                    </>
                  )}
                </Button>
              ))}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">or create your own</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business name</Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g., Latours Air Conditioning"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-gray-500">You can change this later in settings.</p>
            </div>
            <Button
              type="submit"
              className="w-full bg-black hover:bg-gray-800"
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create my business'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
