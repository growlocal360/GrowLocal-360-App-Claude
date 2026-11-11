'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, Users } from 'lucide-react';

interface InvitationData {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  organization: { name: string } | null;
  inviter: { full_name: string } | null;
  /** Businesses the invite covers; empty = every site in the org. */
  site_names?: string[];
  /** Whether the invited email already has a GrowLocal 360 login. */
  has_account?: boolean;
}

/** "Acme Plumbing", "Acme Plumbing and Acme Roofing", "Acme, Beta and Gamma". */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadInvitation() {
      // Check auth status
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      setCurrentEmail(user?.email?.toLowerCase() || null);

      // Fetch invitation details (public lookup by token)
      const res = await fetch(`/api/team/invitations/lookup?token=${token}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Invalid or expired invitation');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setInvitation(data.invitation);
      setLoading(false);
    }

    loadInvitation();
  }, [token, supabase]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch('/api/team/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to accept invitation');
        setAccepting(false);
        return;
      }

      setAccepted(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch {
      setError('Something went wrong');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-400" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Invalid Invitation</h2>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <Button asChild className="mt-6">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#00ef99]" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Welcome to the team!</h2>
            <p className="mt-2 text-sm text-gray-500">Redirecting to your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invitedEmail = (invitation?.email || '').toLowerCase();
  const hasAccount = invitation?.has_account === true;
  const emailMismatch = !!currentEmail && !!invitedEmail && currentEmail !== invitedEmail;
  const siteLabel = invitation?.site_names?.length
    ? listNames(invitation.site_names)
    : invitation?.organization?.name || 'their team';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00ef99]/10">
            <Users className="h-7 w-7 text-[#00ef99]" />
          </div>
          <CardTitle>Team Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-600">
              {invitation?.inviter?.full_name || 'Someone'} invited you to help run
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {siteLabel}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              as {invitation?.role === 'admin' ? 'an' : 'a'}{' '}
              <span className="font-medium capitalize">{invitation?.role}</span>
              {invitation?.role === 'admin'
                ? ' — you can manage the website, reviews, rankings and Job Snaps'
                : ' — you can add Job Snaps and see your schedule'}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          {isAuthenticated ? (
            <div className="space-y-3">
              {emailMismatch && (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  You&apos;re signed in as <strong>{currentEmail}</strong>, but this invitation was sent to{' '}
                  <strong>{invitedEmail}</strong>. You can still accept it with this login, or sign out and
                  use the invited address.
                </p>
              )}
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full hover:opacity-90"
                style={{ backgroundColor: '#00ef99' }}
              >
                {accepting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Accept Invitation
              </Button>
            </div>
          ) : hasAccount ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">
                This invitation is for <strong>{invitedEmail}</strong>, which already has a GrowLocal 360
                login. Sign in with it and the invitation is accepted automatically.
              </p>
              <Button asChild className="w-full" style={{ backgroundColor: '#00ef99' }}>
                <Link href={`/login?redirect=/invite/${token}&email=${encodeURIComponent(invitedEmail)}`}>
                  Sign In to Accept
                </Link>
              </Button>
              <p className="text-center text-xs text-gray-500">
                Forgot your password?{' '}
                <Link href="/forgot-password" className="font-medium text-gray-700 underline">
                  Reset it here
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">
                This invitation is for <strong>{invitedEmail}</strong>. You don&apos;t have a login yet, so
                create one with that email. It&apos;s free, takes a minute, and brings you straight back here.
              </p>
              <Button asChild className="w-full" style={{ backgroundColor: '#00ef99' }}>
                <Link href={`/signup?redirect=/invite/${token}&email=${encodeURIComponent(invitedEmail)}`}>
                  Create Your Account
                </Link>
              </Button>
              <p className="text-center text-xs text-gray-500">
                Already have a GrowLocal 360 login?{' '}
                <Link href={`/login?redirect=/invite/${token}&email=${encodeURIComponent(invitedEmail)}`} className="font-medium text-gray-700 underline">
                  Sign in instead
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
