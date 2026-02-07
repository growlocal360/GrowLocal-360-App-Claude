import { Header } from '@/components/layout/header';
import { SiteWizard } from '@/components/wizard';
import { createClient } from '@/lib/supabase/server';

export default async function NewSitePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user?.id)
    .single();

  const userData = {
    name: profile?.full_name || user?.user_metadata?.full_name || 'User',
    email: user?.email || '',
    avatarUrl: profile?.avatar_url,
  };

  return (
    <div className="flex flex-col">
      <Header title="New Site" user={userData} />

      <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100/30 p-6">
        <SiteWizard />
      </div>
    </div>
  );
}
