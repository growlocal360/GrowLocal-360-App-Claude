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
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#00d9c0]" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Welcome to the team!</h2>
            <p className="mt-2 text-sm text-gray-500">Redirecting to your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00d9c0]/10">
            <Users className="h-7 w-7 text-[#00d9c0]" />
          </div>
          <CardTitle>Team Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-600">
              {invitation?.inviter?.full_name || 'A team member'} has invited you to join
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {invitation?.organization?.name || 'their team'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              as {invitation?.role === 'admin' ? 'an' : 'a'}{' '}
              <span className="font-medium capitalize">{invitation?.role}</span>
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          {isAuthenticated ? (
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full hover:opacity-90"
              style={{ backgroundColor: '#00d9c0' }}
            >
              {accepting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Accept Invitation
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 text-center">
                Sign in or create an account to accept this invitation.
              </p>
              <Button asChild className="w-full" style={{ backgroundColor: '#00d9c0' }}>
                <Link href={`/login?redirect=/invite/${token}`}>
                  Sign In
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/signup?redirect=/invite/${token}`}>
                  Create Account
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
