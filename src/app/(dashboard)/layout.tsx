import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';

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

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const userData = {
    name: profile?.full_name || user.user_metadata?.full_name || 'User',
    email: user.email || '',
    avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url,
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={userData} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
