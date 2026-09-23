import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Safety net for new sites. The build is normally kicked off by the success
 * page once onboarding finishes, but that is a browser-side trigger: if the
 * tab closes, the request fails, or the form is finished before the site
 * record has loaded, nothing fires and the site sits at 0% forever.
 *
 * The payments webhook sends `site/build.ensure` right after creating the
 * site. This waits, then starts the build itself if it never started.
 */
export const ensureSiteBuild = inngest.createFunction(
  { id: 'ensure-site-build', retries: 1 },
  { event: 'site/build.ensure' },
  async ({ event, step }) => {
    const siteId = event.data.siteId as string;
    const waitFor = (event.data.waitFor as string) || '10m';

    await step.sleep('give-onboarding-time', waitFor);

    const state = await step.run('check-build-state', async () => {
      const supabase = createAdminClient();
      const { data: site } = await supabase
        .from('sites')
        .select('status, build_progress')
        .eq('id', siteId)
        .single();
      const bp = site?.build_progress as { completed_tasks?: number } | null;
      return {
        status: site?.status ?? null,
        completed: bp?.completed_tasks ?? 0,
      };
    });

    if (state.status !== 'building' || state.completed > 0) {
      return { started: false, reason: `status=${state.status} completed=${state.completed}` };
    }

    await step.run('log-fallback', async () => {
      const supabase = createAdminClient();
      await supabase.from('build_logs').insert({
        site_id: siteId,
        step: 'ensure-site-build',
        level: 'info',
        message: 'Build had not started after onboarding; starting it automatically.',
      });
    });

    // No Google token here (no user session), so review import is skipped;
    // the dashboard's Regenerate picks reviews up later.
    await step.sendEvent('start-build', {
      name: 'site/content.generate',
      data: { siteId, googleAccessToken: null },
    });

    return { started: true };
  }
);
