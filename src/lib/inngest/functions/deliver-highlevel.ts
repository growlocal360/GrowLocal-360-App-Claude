import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/integrations/crypto';
import * as hl from '@/lib/highlevel/client';
import { snapToBlogPost } from '@/lib/highlevel/snap-to-blog-post';
import type { PublicJobSnap } from '@/lib/api-keys/serialize-snap';

interface JobSnapEvent {
  data: {
    siteId: string;
    eventType: 'job_snap.published' | 'job_snap.updated' | 'job_snap.unpublished';
    payload: PublicJobSnap;
  };
}

/**
 * Deliver Job Snap events to HighLevel as Blog Posts.
 *
 * Listens to webhook/dispatch events and, for any site that has a
 * HighLevel integration connected, creates/updates/deletes a HL blog
 * post to mirror the Job Snap state.
 *
 * Mapping of snap_id → hl_post_id is stored in the integration's
 * metadata.posts JSONB so we can update or delete the right post on
 * subsequent events.
 *
 * Inngest auto-retries failed runs (network blips, HL rate limits,
 * temporary token issues) up to 4 times with exponential backoff.
 */
export const deliverHighLevel = inngest.createFunction(
  { id: 'deliver-highlevel-blog-post', name: 'Deliver Job Snap to HighLevel', retries: 4 },
  { event: 'webhook/dispatch' },
  async ({ event, step }: { event: JobSnapEvent; step: any }) => {
    const { siteId, eventType, payload } = event.data;

    // Only handle Job Snap events; other webhook/dispatch events (future)
    // should be ignored by this handler.
    if (
      eventType !== 'job_snap.published' &&
      eventType !== 'job_snap.updated' &&
      eventType !== 'job_snap.unpublished'
    ) {
      return { skipped: true, reason: 'unsupported event type' };
    }

    const supabase = createAdminClient();

    // Look up HL credentials for this site
    const cred = await step.run('load-hl-credentials', async () => {
      const { data } = await supabase
        .from('integration_credentials')
        .select('*')
        .eq('site_id', siteId)
        .eq('provider', 'highlevel')
        .maybeSingle();
      return data;
    });

    if (!cred) {
      return { skipped: true, reason: 'no HighLevel connection for this site' };
    }

    const meta = (cred.metadata || {}) as {
      location_id?: string;
      blog_id?: string;
      url_prefix?: string;
      posts?: Record<string, string>; // snap_id → hl_post_id
    };

    if (!meta.location_id || !meta.blog_id) {
      return {
        skipped: true,
        reason: 'HighLevel connection missing location_id or blog_id',
      };
    }

    // Decrypt token (only inside this function — never leaves Inngest)
    const token = decrypt(cred.access_token);

    const snapId = payload.id;
    const existingPostId = meta.posts?.[snapId];

    // ── Branch on event type ─────────────────────────────────────────────

    if (eventType === 'job_snap.unpublished') {
      // Delete the HL blog post if we have a mapping for it.
      if (!existingPostId) {
        return { skipped: true, reason: 'no HL post to delete (never created)' };
      }

      await step.run('delete-hl-post', async () => {
        try {
          await hl.deleteBlogPost(token, existingPostId);
        } catch (err: any) {
          // 404 = already gone in HL; treat as success.
          if (err?.status !== 404) throw err;
        }
      });

      // Drop the snap_id from the mapping
      await step.run('drop-mapping', async () => {
        const newPosts = { ...(meta.posts || {}) };
        delete newPosts[snapId];
        await supabase
          .from('integration_credentials')
          .update({
            metadata: { ...meta, posts: newPosts },
          })
          .eq('id', cred.id);
      });

      return { deleted: true, postId: existingPostId };
    }

    // PUBLISHED or UPDATED → upsert blog post
    const blogPostInput = snapToBlogPost({
      snap: payload,
      locationId: meta.location_id,
      blogId: meta.blog_id,
      urlPrefix: meta.url_prefix || 'work',
    });

    if (existingPostId) {
      // Update path
      const updated = await step.run('update-hl-post', async () => {
        try {
          return await hl.updateBlogPost(token, existingPostId, blogPostInput);
        } catch (err: any) {
          // If HL says the post is gone (e.g., manually deleted there),
          // fall through to create a new one.
          if (err?.status === 404) {
            return null;
          }
          throw err;
        }
      });

      if (updated) {
        return { updated: true, postId: updated.id };
      }
      // 404 fall-through → create
    }

    // Create path (first publish OR existing post was 404'd)
    const created = await step.run('create-hl-post', async () => {
      return hl.createBlogPost(token, blogPostInput);
    });

    // Save mapping so future updates/deletes find the right post
    await step.run('save-mapping', async () => {
      const newPosts = { ...(meta.posts || {}), [snapId]: created.id };
      await supabase
        .from('integration_credentials')
        .update({
          metadata: { ...meta, posts: newPosts },
        })
        .eq('id', cred.id);
    });

    return { created: true, postId: created.id };
  }
);
