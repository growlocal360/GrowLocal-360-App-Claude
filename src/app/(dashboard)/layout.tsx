import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import type { UserRole } from '@/types/database';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile — use limit(1) to handle users with multiple profiles (multi-org)
  // Prefer the profile in an org that has sites (invited org), fall back to most recent
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Pick the non-owner profile first (invited org), then fall back to the first one
  const profile = profiles?.find(p => p.role !== 'owner') || profiles?.[0] || null;

  const userData = {
    name: profile?.full_name || user.user_metadata?.full_name || 'User',
    email: user.email || '',
    avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url,
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={userData} role={(profile?.role as UserRole) || 'user'} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
