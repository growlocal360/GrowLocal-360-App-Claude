import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteFormConfigProvider } from '@/components/templates/site-form-config';
import type { SiteSettings } from '@/types/database';

export const metadata: Metadata = {
  title: {
    default: '',
    template: '%s',
  },
};

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Settings-only lookup (same slug resolution as getSiteBySlug) for the CTA /
  // lead form overrides every page shares.
  const supabase = createAdminClient();
  const { data: sites } = await supabase
    .from('sites')
    .select('settings')
    .eq('slug', slug)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  const settings = (sites?.[0]?.settings || {}) as SiteSettings;

  return (
    <SiteFormConfigProvider
      value={{
        ctaText: settings.cta_text || null,
        formHeading: settings.form_heading || null,
        formSubheading: settings.form_subheading || null,
        formServiceOptions: settings.form_service_options?.length ? settings.form_service_options : null,
      }}
    >
      {children}
    </SiteFormConfigProvider>
  );
}
