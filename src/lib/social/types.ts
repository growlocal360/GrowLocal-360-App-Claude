/**
 * Shared shapes for social fan-out (Facebook Pages, Instagram Business).
 * Free of server-only imports so dashboard client components can use them.
 */

export type SocialPlatform = 'facebook' | 'instagram';

export const SOCIAL_PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
};

/** What a queued social post is about. Stored in pending_actions.context. */
export interface SocialPostContext {
  platform: SocialPlatform;
  connection_id: string;
  /** Page id (Facebook) or IG user id (Instagram). */
  account_id: string;
  account_name: string;
  source: 'snap' | 'gbp_post';
  /** work_item id for snaps, pending_action id for Google posts. */
  source_id: string | null;
  source_label: string;
  /** Page on the website the post points at. Facebook gets it as a link; Instagram shows the domain in the caption. */
  link: string;
  /** Public JPEG URLs, first is the lead image. Instagram needs at least one. */
  image_urls: string[];
}

/** Published result, merged into pending_actions.payload. */
export interface SocialPostResult {
  external_post_id?: string;
  post_url?: string;
}

/** A connection as the dashboard sees it (no tokens). */
export interface SocialConnectionView {
  id: string;
  platform: SocialPlatform;
  account_id: string;
  account_name: string;
  is_active: boolean;
  picture: string | null;
  /** Instagram: the Facebook Page it is linked through. */
  page_name: string | null;
  connected_at: string;
}

export interface SocialSettings {
  /** Re-post Job Snaps when they are published to the website. */
  snaps: boolean;
  /** Re-post weekly Google Business Profile posts. */
  gbpPosts: boolean;
}
