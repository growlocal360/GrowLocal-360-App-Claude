/**
 * Setup-prompt generators for the "Copy AI Setup Prompt" feature.
 *
 * The Connect Your Website panel offers per-framework AI prompts that
 * customers paste into their AI coding tool (Claude Code, Cursor, etc.)
 * to scaffold the integration in their own project. Pre-filled with
 * the customer's actual API host, webhook URL, and credential placeholders.
 *
 * Goal: a non-technical agency owner can hand the prompt to a developer
 * (or their AI tool directly) and get a working integration in <10 min.
 */

export type SetupPromptFramework = 'nextjs' | 'wordpress' | 'api';

export interface SetupPromptParams {
  framework: SetupPromptFramework;
  apiBase: string;                 // e.g. https://admin.goleadflow.com
  apiKey?: string | null;          // optional: actual API key OR prefix-only hint
  webhookUrl?: string | null;      // optional: customer's https://site.com/api/jobsnaps-webhook
  webhookSecret?: string | null;   // optional: actual whsec_... OR placeholder
  businessName?: string | null;    // optional: for tailored copy
  databaseChoice?: 'supabase' | 'vercel-postgres' | 'neon' | 'turso' | null;
}

/**
 * Build the complete prompt as a string ready to copy to the clipboard.
 * Missing values get clearly-marked placeholders so the customer (or AI)
 * knows what to fill in.
 */
export function generateSetupPrompt(p: SetupPromptParams): string {
  switch (p.framework) {
    case 'nextjs':
      return nextjsPrompt(p);
    case 'wordpress':
      return wordpressPrompt(p);
    case 'api':
      return apiPrompt(p);
    default:
      return '';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function placeholder(value: string | null | undefined, fallback: string): string {
  if (value && value.trim().length > 0) return value;
  return `<${fallback}>`;
}

function dbHint(choice: SetupPromptParams['databaseChoice']): string {
  switch (choice) {
    case 'supabase':
      return 'Use Supabase Postgres. Use the @supabase/supabase-js client. The customer already has a Supabase project linked to this Next.js app — connection env vars are configured.';
    case 'vercel-postgres':
      return 'Use Vercel Postgres (Neon under the hood). Use the @vercel/postgres client. Connection env vars are auto-configured by Vercel.';
    case 'neon':
      return 'Use Neon serverless Postgres. Use either the @neondatabase/serverless or pg client.';
    case 'turso':
      return 'Use Turso (libSQL/SQLite). Use the @libsql/client driver.';
    default:
      return 'Use whatever lightweight database the project already has set up (Supabase, Vercel Postgres, Neon, Turso, or similar). If none, default to Supabase Postgres because the GrowLocal admin app already uses it.';
  }
}

// ── Next.js prompt (the main one) ───────────────────────────────────────

function nextjsPrompt(p: SetupPromptParams): string {
  const apiBase = p.apiBase;
  const apiKey = placeholder(p.apiKey, 'PASTE_YOUR_API_KEY_HERE');
  const webhookUrl = placeholder(p.webhookUrl, 'YOUR_SITE_URL/api/jobsnaps-webhook');
  const webhookSecret = placeholder(p.webhookSecret, 'PASTE_YOUR_WEBHOOK_SIGNING_SECRET_HERE');
  const business = p.businessName ? ` for ${p.businessName}` : '';

  return `# Job Snaps integration${business} — Next.js setup

I need to integrate with **Job Snaps** from GrowLocal 360. They push job snap data to my Next.js site via webhook. I want each snap to render as a server-rendered page on my site for SEO.

## Credentials

Add these to my \`.env.local\` and to my Vercel project's Environment Variables:

\`\`\`
JOBSNAPS_API_KEY=${apiKey}
JOBSNAPS_WEBHOOK_SECRET=${webhookSecret}
JOBSNAPS_API_BASE=${apiBase}
\`\`\`

The webhook will be POSTed to: \`${webhookUrl}\` (already configured on the GrowLocal side).

## Database

${dbHint(p.databaseChoice)}

Create a \`snaps\` table with these columns:

- \`id\` TEXT PRIMARY KEY
- \`title\` TEXT
- \`slug\` TEXT UNIQUE NOT NULL
- \`description\` TEXT
- \`service_type\` TEXT
- \`brand\` TEXT
- \`location\` JSONB  ({ address, city, state, zip })
- \`media\` JSONB  (array of { url, alt, width, height, role })  ← URLs will point to MY Supabase storage, not the source API
- \`published_at\` TIMESTAMPTZ
- \`created_at\` TIMESTAMPTZ
- \`updated_at\` TIMESTAMPTZ DEFAULT NOW()

Index on \`slug\` and \`published_at\`.

## Image storage — mirror to my own infrastructure (CRITICAL for SEO + ownership)

The incoming webhook payload contains image URLs that point to GrowLocal's storage. **Don't render those directly** — for SEO and data ownership, mirror each image into my own Supabase storage:

1. Create a public Storage bucket called \`snaps\` in my Supabase project (5 MB file size limit, allowed mime types: image/jpeg, image/png, image/webp). Public read, authenticated write.
2. In the webhook handler, for each item in \`payload.data.media\`:
   - \`fetch(item.url)\` to download the image bytes
   - Upload to the \`snaps\` bucket with a deterministic key like \`<snap_id>/<index>.<ext>\` (so re-publishes overwrite the same file instead of accumulating duplicates)
   - Get back the public URL via \`supabase.storage.from('snaps').getPublicUrl(path)\`
   - Replace \`item.url\` with the new URL before upserting
3. On \`job_snap.unpublished\` events, also call \`supabase.storage.from('snaps').remove([...])\` to clean up the mirrored files (no orphan storage cost).
4. Handle fetch failures gracefully — if the image download fails, skip that media item but still upsert the snap (better partial data than no data).

## Webhook handler

Create \`app/api/jobsnaps-webhook/route.ts\` that:

1. Reads the raw request body (do not parse first — signature verification needs the raw bytes).
2. Reads the \`X-Webhook-Signature\` header. Format: \`t=<unix_timestamp>,v1=<hex_sha256>\`.
3. Verifies the signature: HMAC-SHA256(secret, \`<timestamp>.<rawBody>\`) must equal the \`v1\` hex value. Use \`crypto.timingSafeEqual\` for the comparison. Reject with 401 if invalid.
4. Reject if the timestamp is older than 5 minutes (replay protection).
5. Parses the body as JSON. Shape:

\`\`\`typescript
type WebhookEvent = {
  id: string;
  type: 'job_snap.published' | 'job_snap.updated' | 'job_snap.unpublished';
  created_at: string;
  data: {
    id: string;
    title: string | null;
    description: string | null;
    service_type: string | null;
    brand: string | null;
    location: { address: string | null; city: string | null; state: string | null; zip: string | null };
    media: Array<{ url: string; alt: string; width: number | null; height: number | null; role: string | null }>;
    published_at: string;
    created_at: string;
  };
};
\`\`\`

6. On \`job_snap.published\` or \`job_snap.updated\`: upsert into the \`snaps\` table. Generate a slug from the title (kebab-case, deduplicate on collision).
7. On \`job_snap.unpublished\`: delete the row.
8. Call \`revalidatePath('/work')\` and \`revalidatePath(\\\`/work/\${slug}\\\`)\` after each successful upsert/delete.
9. Return \`{ ok: true }\` with status 200.

## Pages

**Use \`next/image\` for ALL snap photos.** Even though the URLs now point to my own Supabase, rendering through \`next/image\` means the browser sees \`<my-domain>/_next/image?url=...\` — that gives me Next.js image optimization (WebP/AVIF, lazy loading, responsive sizes) AND keeps the public-facing image URL on my domain for SEO.

Update \`next.config.js\` (or \`next.config.mjs\`) to allow the Supabase storage hostname:

\`\`\`js
images: {
  remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
}
\`\`\`

Create \`app/work/page.tsx\`:
- Server component that queries \`snaps\` ordered by \`published_at DESC\`.
- Renders a responsive grid of cards (3 columns desktop, 1 mobile). Each card: featured image via \`<Image>\`, title, truncated description (3 lines), location.
- Each card links to \`/work/<slug>\`.
- Add page-level \`<title>\` and meta description.

Create \`app/work/[slug]/page.tsx\`:
- Server component that loads the snap by slug.
- If not found, call \`notFound()\`.
- Render full title, description, all photos in a gallery (each via \`<Image>\` with proper width/height + \`priority\` on the featured image), location.
- Add JSON-LD structured data (Article schema) with the snap's data — use the original Supabase URL as the schema's image (not the optimized \`/_next/image?\` path) so search engines can crawl it directly.
- Set page metadata via \`generateMetadata\` (title, description, OG image = first media url).

## Styling

Match the existing site's brand. Use Tailwind if it's set up; otherwise inherit the project's existing CSS approach. Don't introduce new dependencies for styling.

## Deliverables

1. The webhook route handler at \`app/api/jobsnaps-webhook/route.ts\`.
2. The database migration (or SQL setup script).
3. \`app/work/page.tsx\` and \`app/work/[slug]/page.tsx\`.
4. Any helper utilities (signature verification, slug generation).
5. Update \`README.md\` with the env var setup + how Job Snaps works.

## Test

After setup, when a snap is published in GrowLocal admin, it should appear at \`/work\` within seconds and have its own \`/work/<slug>\` detail page. The detail page must be server-rendered HTML (curl-testable) for SEO.
`;
}

// ── WordPress prompt (alt approach since plugin not yet available) ──────

function wordpressPrompt(p: SetupPromptParams): string {
  const apiBase = p.apiBase;
  const apiKey = placeholder(p.apiKey, 'PASTE_YOUR_API_KEY_HERE');
  const webhookUrl = placeholder(p.webhookUrl, 'YOUR_SITE_URL/wp-json/jobsnaps/v1/webhook');
  const webhookSecret = placeholder(p.webhookSecret, 'PASTE_YOUR_WEBHOOK_SIGNING_SECRET_HERE');
  const business = p.businessName ? ` for ${p.businessName}` : '';

  return `# Job Snaps integration${business} — WordPress setup

I need to integrate **Job Snaps** from GrowLocal 360 into my WordPress site. Snaps should appear as a Custom Post Type so they're indexed by SEO plugins (Yoast/Rank Math) and can be styled by my theme.

## Credentials

Set these in \`wp-config.php\` (or use environment variables via a plugin like Sequoia):

\`\`\`php
define('JOBSNAPS_API_KEY', '${apiKey}');
define('JOBSNAPS_WEBHOOK_SECRET', '${webhookSecret}');
define('JOBSNAPS_API_BASE', '${apiBase}');
\`\`\`

Webhook URL (already configured on the GrowLocal side): \`${webhookUrl}\`

## Plugin / functions.php approach

Build a small WordPress plugin (or add to a child theme's \`functions.php\`):

1. **Register a Custom Post Type \`job_snap\`** with:
   - public: true
   - has_archive: true (for /work archive)
   - rewrite: ['slug' => 'work']
   - supports: ['title', 'editor', 'thumbnail', 'custom-fields']
   - menu_icon: dashicons-camera

2. **Register a REST endpoint** at \`/wp-json/jobsnaps/v1/webhook\` (POST) that:
   - Reads the raw request body.
   - Reads the \`X-Webhook-Signature\` header. Format: \`t=<timestamp>,v1=<hex_sha256>\`.
   - Verifies HMAC-SHA256 using \`hash_hmac('sha256', $timestamp . '.' . $body, JOBSNAPS_WEBHOOK_SECRET)\`. Use \`hash_equals()\` for comparison.
   - Rejects if signature invalid or timestamp older than 5 minutes.
   - Parses JSON body.

3. **On \`job_snap.published\` or \`job_snap.updated\`**:
   - Find existing post by meta key \`jobsnaps_id\` = the snap id, or create new \`job_snap\` post.
   - Set post_title to the snap title.
   - Set post_content to the description + rendered media gallery HTML.
   - Set post_status to 'publish'.
   - Save metadata: snap id, service_type, brand, location (city, state, address), all media URLs.
   - Sideload the first media item as the featured image (using \`media_sideload_image\`).
   - Set post_name (slug) from the snap title.

4. **On \`job_snap.unpublished\`**:
   - Find post by \`jobsnaps_id\` meta.
   - Delete it (\`wp_delete_post($id, true)\`).

5. **Add a shortcode** \`[jobsnaps_gallery]\` that queries recent \`job_snap\` posts and renders a responsive grid. Optional attributes: limit, location, service_type.

## Webhook payload reference

\`\`\`json
{
  "id": "evt_...",
  "type": "job_snap.published" | "job_snap.updated" | "job_snap.unpublished",
  "created_at": "2026-05-09T...",
  "data": {
    "id": "snap_...",
    "title": "Garage Cleanout in Lake Charles",
    "description": "...",
    "service_type": "Junk Removal",
    "brand": null,
    "location": { "address": "...", "city": "Lake Charles", "state": "LA", "zip": "70601" },
    "media": [{ "url": "https://...", "alt": "...", "width": 1920, "height": 1080, "role": "primary" }],
    "published_at": "2026-05-09T...",
    "created_at": "2026-05-08T..."
  }
}
\`\`\`

## Deliverables

1. The plugin file (or functions.php additions) implementing the CPT + webhook endpoint.
2. The shortcode for gallery rendering.
3. A template file \`single-job_snap.php\` for individual snap detail pages.
4. A template file \`archive-job_snap.php\` for the /work archive.

## Test

After setup, publish a Job Snap in GrowLocal admin. Within seconds, a new \`job_snap\` post should appear in WordPress. The single-snap URL (\`/work/<slug>\`) should be indexable HTML.
`;
}

// ── Generic API prompt ──────────────────────────────────────────────────

function apiPrompt(p: SetupPromptParams): string {
  const apiBase = p.apiBase;
  const apiKey = placeholder(p.apiKey, 'PASTE_YOUR_API_KEY_HERE');
  const business = p.businessName ? ` for ${p.businessName}` : '';

  return `# Job Snaps API integration${business}

I want to consume the **Job Snaps** REST API from GrowLocal 360 in my application.

## Credentials

\`\`\`
JOBSNAPS_API_KEY=${apiKey}
JOBSNAPS_API_BASE=${apiBase}
\`\`\`

## Endpoints

\`\`\`
GET ${apiBase}/api/v1/job-snaps
GET ${apiBase}/api/v1/job-snaps/{id}
\`\`\`

Authentication: \`X-API-Key: <api-key>\` header (or \`Authorization: Bearer <api-key>\`).

Query params for the list endpoint:
- \`limit\` (default 20, max 100)
- \`offset\` (pagination)
- \`brand\` (exact match filter)
- \`service_type\` (exact match filter)

## Response shape

\`\`\`typescript
type JobSnap = {
  id: string;
  title: string | null;
  description: string | null;
  service_type: string | null;
  brand: string | null;
  location: { address: string | null; city: string | null; state: string | null; zip: string | null };
  media: Array<{ url: string; alt: string; width: number | null; height: number | null; role: string | null }>;
  published_at: string;
  created_at: string;
};

type ListResponse = {
  data: JobSnap[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
};
\`\`\`

## Goal

Please integrate this API into my application. Consider:

1. Where in my app would Job Snaps best fit (gallery, portfolio section, dynamic content, etc.)?
2. Suggest the cleanest integration pattern based on my stack.
3. If there's caching available (Redis, KV, etc.), use it — recommended TTL is 5 minutes.
4. If this is a frontend app, fetch server-side or via an API route to keep the API key off the browser.

## Tip — for SEO, consider webhooks

If my project will display job snaps to public users, server-rendered pages give the best SEO. Recommend setting up a webhook handler on my side to cache snaps locally instead of fetching live on each render. Webhook configuration is available in the GrowLocal admin → Connect Your Website → Webhooks. The signing secret format is \`whsec_...\` and signatures use the format \`t=<ts>,v1=<HMAC-SHA256(secret, '<ts>.<body>')>\`.
`;
}
