/**
 * Setup-prompt generators for the "Copy AI Setup Prompt" feature.
 *
 * The Connect Your Website panel offers per-framework AI prompts that
 * customers paste into their AI coding tool (Claude Code, Cursor, etc.)
 * to scaffold the integration in their own project. Pre-filled with
 * the customer's actual API host, webhook URL, and credential placeholders.
 *
 * IMPORTANT: every prompt below directs the customer's webhook handler to
 * use the GL360-generated SEO fields verbatim. GL360 is the canonical
 * source of truth for slug, meta_title, h1, meta_description, alt_text,
 * image_filename, and public_location_label. Customer handlers should
 * NOT recompute these — they should consume them directly from the
 * webhook payload. Overrides remain possible but should be deliberate.
 */

export type SetupPromptFramework = 'nextjs' | 'astro' | 'wordpress' | 'api';

export interface SetupPromptParams {
  framework: SetupPromptFramework;
  apiBase: string;                 // e.g. https://app.growlocal360.com
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
    case 'astro':
      return astroPrompt(p);
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

const PAYLOAD_REFERENCE_BLOCK = `\`\`\`typescript
type WebhookEvent = {
  id: string;
  type: 'job_snap.published' | 'job_snap.updated' | 'job_snap.unpublished';
  created_at: string;
  data: {
    // ── Identity ───────────────────────────────────────────────────
    id: string;
    short_id: string | null;        // 4-char hex used as collision suffix

    // ── Generated SEO fields (GL360 = source of truth) ─────────────
    // Use these directly. Do NOT regenerate slug/meta_title/etc. unless
    // the customer has explicitly configured a per-field override.
    slug: string | null;            // 'cleveland-dryer-repair-whirlpool-drum-roller-replacement'
    url_path: string | null;        // '/work/<slug>/'
    meta_title: string | null;      // <title> tag content
    h1: string | null;              // H1 heading
    meta_description: string | null;
    alt_text: string | null;        // default <img alt> for the snap
    image_filename: string | null;  // primary image's SEO-safe filename
    public_location_label: string | null;

    // ── Structured fields (for indexing + advanced overrides) ──────
    title: string | null;
    description: string | null;
    service_type: string | null;
    brand: string | null;
    primary_problem: string | null;
    equipment_type: string | null;

    // Technician credited for the work (snapshot — may be null).
    technician: {
      name: string;
      title: string | null;
      avatar_url: string | null;
    } | null;

    // Multi-page attachments — every taxonomy row this snap is linked to in
    // GL360. Most customer integrations don't need this; filtering by
    // service_type / brand / city above usually suffices. IDs are stable
    // GL360 UUIDs; resolve them via the GL360 admin if you want names.
    attachments: Array<{
      type: 'service' | 'category' | 'brand' | 'service_area';
      id: string;
    }>;

    location: {
      address: string | null;       // street name only, no house number
      city: string | null;
      state: string | null;
      state_abbr: string | null;    // 2-char ('OH', 'LA')
      zip: string | null;
      neighborhood: string | null;
      street_name_public: string | null;
    };

    // ── Media ──────────────────────────────────────────────────────
    media: Array<{
      url: string;                  // source URL on GL360's Supabase
      filename: string | null;      // SEO-safe key to use when uploading
                                    // to your bucket: '<base>-<index>.<ext>'
      alt: string;                  // per-image alt (falls back to alt_text)
      width: number | null;
      height: number | null;
      role: 'primary' | 'before' | 'after' | 'process' | 'detail' | null;
    }>;

    // ── Timestamps ─────────────────────────────────────────────────
    published_at: string;
    created_at: string;
  };
};
\`\`\``;

// ── Next.js prompt (the main one) ───────────────────────────────────────

function nextjsPrompt(p: SetupPromptParams): string {
  const apiBase = p.apiBase;
  const apiKey = placeholder(p.apiKey, 'PASTE_YOUR_API_KEY_HERE');
  const webhookUrl = placeholder(p.webhookUrl, 'YOUR_SITE_URL/api/jobsnaps-webhook');
  const webhookSecret = placeholder(p.webhookSecret, 'PASTE_YOUR_WEBHOOK_SIGNING_SECRET_HERE');
  const business = p.businessName ? ` for ${p.businessName}` : '';

  return `# Job Snaps integration${business} — Next.js setup

I need to integrate with **Job Snaps** from GrowLocal 360. They push job snap data to my Next.js site via webhook. I want each snap to render as a server-rendered page on my site for SEO.

GL360 has already computed canonical SEO-safe values for every snap (slug, meta_title, h1, meta_description, alt_text, image_filename, public_location_label). **Use those fields verbatim** — do not regenerate them on my side unless explicitly overriding for a specific reason.

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
- \`short_id\` TEXT
- \`slug\` TEXT UNIQUE NOT NULL
- \`url_path\` TEXT
- \`title\` TEXT
- \`description\` TEXT
- \`meta_title\` TEXT
- \`h1\` TEXT
- \`meta_description\` TEXT
- \`alt_text\` TEXT
- \`public_location_label\` TEXT
- \`service_type\` TEXT
- \`brand\` TEXT
- \`primary_problem\` TEXT
- \`equipment_type\` TEXT
- \`location\` JSONB  (\`{ address, city, state, state_abbr, zip, neighborhood, street_name_public }\`)
- \`media\` JSONB  (array of \`{ url, filename, alt, width, height, role }\` — URLs point to MY Supabase storage after mirroring)
- \`published_at\` TIMESTAMPTZ
- \`created_at\` TIMESTAMPTZ
- \`updated_at\` TIMESTAMPTZ DEFAULT NOW()

Index on \`slug\` and \`published_at\`.

## Image storage — mirror to my own infrastructure (CRITICAL for SEO + ownership)

The incoming webhook payload contains image URLs that point to GrowLocal's storage. **Don't render those directly** — for SEO and data ownership, mirror each image into my own Supabase storage.

1. Create a public Storage bucket called \`snaps\` in my Supabase project (20 MB per-file limit; allowed MIME types: image/jpeg, image/png, image/webp). Public read, authenticated write.
2. In the webhook handler, for each item in \`payload.data.media\`:
   - \`fetch(item.url)\` to download the image bytes
   - Upload to the \`snaps\` bucket using **\`payload.data.media[i].filename\`** as the storage key when present (GL360 has pre-computed an SEO-safe filename). If \`filename\` is null (legacy snap), fall back to \`\\\`\${payload.data.slug}-\${index}.jpg\\\`\`. Always prefix with the snap id so deletes are easy: \`\\\`\${snap.id}/\${filename}\\\`\`.
   - Use \`upsert: true\` so re-publishes overwrite the existing file at the same path (no duplicates accumulate).
   - Get back the public URL via \`supabase.storage.from('snaps').getPublicUrl(path)\`
   - Replace \`item.url\` with the new URL before upserting into the \`snaps\` table.
3. On \`job_snap.unpublished\` events, also call \`supabase.storage.from('snaps').remove([...])\` for that snap's directory to clean up the mirrored files.
4. Handle fetch failures gracefully — if a single image download fails, skip that media item but still upsert the snap.

## Webhook handler

Create \`app/api/jobsnaps-webhook/route.ts\` that:

1. Reads the raw request body (do not parse first — signature verification needs the raw bytes).
2. Reads the \`X-Webhook-Signature\` header. Format: \`t=<unix_timestamp>,v1=<hex_sha256>\`.
3. Verifies the signature: HMAC-SHA256(secret, \`<timestamp>.<rawBody>\`) must equal the \`v1\` hex value. Use \`crypto.timingSafeEqual\` for the comparison. Reject with 401 if invalid.
4. Reject if the timestamp is older than 5 minutes (replay protection).
5. Parses the body as JSON. The webhook event shape:

${PAYLOAD_REFERENCE_BLOCK}

6. On \`job_snap.published\` or \`job_snap.updated\`: upsert into the \`snaps\` table. **Use \`payload.data.slug\` directly** as the row's slug — GL360 already computed an SEO-safe slug per a canonical scheme. Do not regenerate it.
7. On \`job_snap.unpublished\`: delete the row + clean up storage.
8. Call \`revalidatePath('/work')\` and \`revalidatePath(\\\`/work/\${payload.data.slug}\\\`)\` after each successful upsert/delete.
9. Return \`{ ok: true }\` with status 200.

## Pages

**Use \`next/image\` for ALL snap photos.** Even though the URLs now point to my own Supabase, rendering through \`next/image\` means the browser sees \`<my-domain>/_next/image?url=...\` — that gives me Next.js image optimization (WebP/AVIF, lazy loading, responsive sizes) AND keeps the public-facing image URL on my domain for SEO.

Update \`next.config.js\` (or \`next.config.mjs\`) to allow the Supabase storage hostname:

\`\`\`js
images: {
  remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
}
\`\`\`

Create \`app/work/page.tsx\`:
- Server component that queries \`snaps\` ordered by \`published_at DESC\`.
- Renders a responsive grid of cards (3 columns desktop, 1 mobile). Each card: featured image via \`<Image>\` with **\`alt={snap.alt_text}\`**, \`snap.h1\` (or \`snap.title\`), truncated description (3 lines), \`snap.public_location_label\`.
- Each card links to \`snap.url_path\` (already \`/work/<slug>/\`).
- Add page-level \`<title>\` and meta description.

Create \`app/work/[slug]/page.tsx\`:
- Server component that loads the snap by slug.
- If not found, call \`notFound()\`.
- Render \`snap.h1\` as the page H1, all photos in a gallery (each via \`<Image>\` with proper width/height + \`priority\` on the featured image), \`snap.description\`, \`snap.public_location_label\`.
- Set page metadata via \`generateMetadata\`: \`title = snap.meta_title\`, \`description = snap.meta_description\`, OG image = first media url, OG title = snap.meta_title.
- Add JSON-LD structured data (Article schema) using the structured fields directly: \`brand\`, \`service_type\`, \`primary_problem\`, \`location.city\`, \`location.state_abbr\`, etc.

## Override (advanced)

GL360-generated fields are the recommended defaults. If for some reason I need to override naming for a specific snap or for ALL snaps, the structured fields (\`brand\`, \`primary_problem\`, \`city\`, \`state_abbr\`, etc.) are available in the payload — but only do this if I have a real business reason. Default to using the generated SEO fields verbatim.

## Styling

Match the existing site's brand. Use Tailwind if it's set up; otherwise inherit the project's existing CSS approach. Don't introduce new dependencies for styling.

## Deliverables

1. The webhook route handler at \`app/api/jobsnaps-webhook/route.ts\`.
2. The database migration (or SQL setup script).
3. \`app/work/page.tsx\` and \`app/work/[slug]/page.tsx\`.
4. Any helper utilities (signature verification, image mirroring).
5. Update \`README.md\` with the env var setup + how Job Snaps works.

## Test

After setup, when a snap is published in GrowLocal admin, it should appear at \`/work\` within seconds and have its own \`/work/<slug>\` detail page. The detail page must be server-rendered HTML (curl-testable) for SEO, and the \`<title>\`/\`<meta name="description">\`/\`<h1>\`/\`<img alt>\` values must match what GL360 generated.
`;
}

// ── Astro prompt ────────────────────────────────────────────────────────

function astroPrompt(p: SetupPromptParams): string {
  const apiBase = p.apiBase;
  const apiKey = placeholder(p.apiKey, 'PASTE_YOUR_API_KEY_HERE');
  const webhookUrl = placeholder(p.webhookUrl, 'YOUR_SITE_URL/api/jobsnaps-webhook');
  const webhookSecret = placeholder(p.webhookSecret, 'PASTE_YOUR_WEBHOOK_SIGNING_SECRET_HERE');
  const business = p.businessName ? ` for ${p.businessName}` : '';

  return `# Job Snaps integration${business} — Astro setup

I need to integrate with **Job Snaps** from GrowLocal 360 into my Astro site. They push job snap data to my site via webhook. I want each snap to render as a server-rendered page on my site for SEO.

GL360 has already computed canonical SEO-safe values for every snap (slug, meta_title, h1, meta_description, alt_text, image_filename, public_location_label). **Use those fields verbatim** — do not regenerate them on my side unless explicitly overriding for a specific reason.

## Credentials

Add these to my \`.env\` (Astro auto-loads .env in dev; in Vercel, add via Project → Settings → Environment Variables):

\`\`\`
JOBSNAPS_API_KEY=${apiKey}
JOBSNAPS_WEBHOOK_SECRET=${webhookSecret}
JOBSNAPS_API_BASE=${apiBase}
\`\`\`

The webhook will be POSTed to: \`${webhookUrl}\` (already configured on the GrowLocal side).

## Astro configuration

Update \`astro.config.mjs\` so the site can run API routes + on-request rendering of snap pages:

\`\`\`js
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
});
\`\`\`

If the project is currently configured with \`@astrojs/vercel/static\`, switch to \`@astrojs/vercel/serverless\` so the webhook handler can run as a serverless function. (Static pages still render statically; only the API routes and dynamic snap routes use SSR.)

**Note on image rendering:** Snap photos render via plain HTML \`<img>\` tags pointing directly at my own Supabase storage URLs. Supabase serves images via Cloudflare's CDN, which is already globally edge-cached and plenty fast for SEO. We're intentionally NOT routing through Vercel's image optimizer because:
- Astro's \`<Image>\` component has known issues generating malformed \`src\` attributes for dynamic remote URLs
- Vercel's optimizer rejects long Supabase URLs with \`INVALID_IMAGE_OPTIMIZE_REQUEST\` in some adapter version combinations
- WebP/AVIF conversion is a small win that doesn't justify the engineering pain for a service-business work portfolio

If you ever want to add the optimizer later, it's a 10-minute follow-up — see "Optional: Vercel image optimization" at the bottom.

## Database

${dbHint(p.databaseChoice)}

Create a \`snaps\` table with these columns:

- \`id\` TEXT PRIMARY KEY
- \`short_id\` TEXT
- \`slug\` TEXT UNIQUE NOT NULL
- \`url_path\` TEXT
- \`title\` TEXT
- \`description\` TEXT
- \`meta_title\` TEXT
- \`h1\` TEXT
- \`meta_description\` TEXT
- \`alt_text\` TEXT
- \`public_location_label\` TEXT
- \`service_type\` TEXT
- \`brand\` TEXT
- \`primary_problem\` TEXT
- \`equipment_type\` TEXT
- \`location\` JSONB
- \`media\` JSONB
- \`published_at\` TIMESTAMPTZ
- \`created_at\` TIMESTAMPTZ
- \`updated_at\` TIMESTAMPTZ DEFAULT NOW()

Index on \`slug\` and \`published_at\`.

## Image storage — mirror to my own infrastructure (CRITICAL for SEO + ownership)

The incoming webhook payload contains image URLs that point to GrowLocal's storage. **Don't render those directly** — for SEO and data ownership, mirror each image into my own Supabase storage.

1. Create a public Storage bucket called \`snaps\` in my Supabase project (20 MB per-file limit; allowed MIME types: image/jpeg, image/png, image/webp). Public read, authenticated write.
2. In the webhook handler, for each item in \`payload.data.media\`:
   - \`fetch(item.url)\` to download the image bytes
   - Upload to the \`snaps\` bucket using **\`payload.data.media[i].filename\`** as the storage key when present (GL360 has pre-computed an SEO-safe filename). Always prefix with the snap id so deletes are easy: \`\\\`\${snap.id}/\${filename}\\\`\`.
   - Use \`upsert: true\` so re-publishes overwrite the existing file at the same path.
   - Get back the public URL via \`supabase.storage.from('snaps').getPublicUrl(path)\`
   - Replace \`item.url\` with the new URL before upserting the snap row.
3. On \`job_snap.unpublished\` events, also call \`supabase.storage.from('snaps').remove([...])\` for that snap's directory.
4. Handle fetch failures gracefully — if a single image download fails, skip that media item but still upsert the snap.

## Webhook handler

Create \`src/pages/api/jobsnaps-webhook.ts\` (Astro API route — receives the standard \`Request\` object and returns a standard \`Response\`):

1. Read the raw request body with \`await request.text()\`. Don't parse first — signature verification needs the raw bytes.
2. Read the \`X-Webhook-Signature\` header. Format: \`t=<unix_timestamp>,v1=<hex_sha256>\`.
3. Verify the signature with Node's \`crypto\`: HMAC-SHA256(secret, \`\\\`\${timestamp}.\${rawBody}\\\`\`) must equal the \`v1\` hex value. Use \`crypto.timingSafeEqual\` for the comparison. Return \`new Response('Invalid signature', { status: 401 })\` if invalid.
4. Reject if the timestamp is older than 5 minutes (replay protection).
5. Parse the body as JSON. The webhook event shape:

${PAYLOAD_REFERENCE_BLOCK}

6. On \`job_snap.published\` or \`job_snap.updated\`: upsert into the \`snaps\` table. **Use \`payload.data.slug\` directly** as the row's slug.
7. On \`job_snap.unpublished\`: delete the row + clean up storage files.
8. Return \`new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })\`.

Add \`export const prerender = false;\` at the top of the file so the route runs as a serverless function (Astro defaults to prerendering everything otherwise).

## Pages

Snap pages should run in SSR mode so updates appear immediately without rebuild/revalidation. Add \`export const prerender = false;\` at the top of each \`.astro\` page below.

### \`src/pages/work/index.astro\` — list page

Frontmatter queries \`snaps\` ordered by \`published_at DESC\`. Renders a responsive grid of cards (3 columns desktop, 1 mobile). Each card: featured image as a plain \`<img>\` tag with \`alt={snap.alt_text}\`, \`snap.h1\` (or \`snap.title\`), truncated description (3 lines), \`snap.public_location_label\`. Each card links to \`snap.url_path\` (already \`/work/<slug>/\`).

Set page-level \`<title>\` and \`<meta name="description">\` in the layout slot.

### \`src/pages/work/[slug].astro\` — detail page

Use \`Astro.params.slug\` to look up the snap by slug. If not found, return a 404 response (\`return new Response(null, { status: 404 })\`).

Render \`snap.h1\` as the page H1, all photos in a gallery (each as a plain \`<img>\` tag with proper width/height; use \`loading="eager"\` on the featured image and \`loading="lazy"\` on the rest), \`snap.description\`, \`snap.public_location_label\`.

Set page metadata in the frontmatter: \`title = snap.meta_title\`, \`description = snap.meta_description\`. Add Open Graph tags for image (= first media url), title, and description. Add JSON-LD structured data (Article schema) inside a \`<script type="application/ld+json">\` tag using the structured fields directly.

### Image rendering — branded URLs via Vercel rewrite

Snap photos are stored in my own Supabase bucket, but I don't want the rendered \`<img src="...">\` to point at \`*.supabase.co\` — that leaks my backend hostname and weakens domain-level image SEO. Instead, proxy every snap image through my own domain using a Vercel edge rewrite.

**1. Create \`vercel.json\` at the project root** (or merge into the existing one):

\`\`\`json
{
  "rewrites": [
    {
      "source": "/public/snaps/:path*",
      "destination": "https://<MY-SUPABASE-PROJECT-REF>.supabase.co/storage/v1/object/public/snaps/:path*"
    }
  ]
}
\`\`\`

Replace \`<MY-SUPABASE-PROJECT-REF>\` with my actual Supabase project ref (the same hostname prefix you see in \`SUPABASE_URL\`). The rewrite runs at Vercel's edge — every \`/public/snaps/...\` request gets transparently proxied to Supabase and edge-cached. Zero serverless function cost.

**2. Add a URL-rewrite helper** at \`src/lib/snap-image-url.ts\`:

\`\`\`ts
const SUPABASE_SNAPS_PREFIX = 'https://<MY-SUPABASE-PROJECT-REF>.supabase.co/storage/v1/object/public/snaps/';

/**
 * Rewrites a snap image's Supabase URL to a branded path on this domain.
 * Combined with the Vercel rewrite in vercel.json, the browser sees a
 * URL on our own domain instead of the Supabase hostname.
 */
export function brandedSnapImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith(SUPABASE_SNAPS_PREFIX)) {
    return '/public/snaps/' + url.slice(SUPABASE_SNAPS_PREFIX.length);
  }
  return url; // unrecognized URL — leave as-is
}
\`\`\`

**3. Use plain HTML \`<img>\` tags with the helper everywhere a snap photo renders.** Do NOT import or use Astro's \`<Image>\` component from \`astro:assets\` — its handling of dynamic remote URLs produces malformed src attributes when combined with the Vercel adapter's image optimizer.

\`\`\`astro
---
import { brandedSnapImageUrl } from '../lib/snap-image-url';
const img = snap.media[0];
---
<img
  src={brandedSnapImageUrl(img.url)}
  alt={snap.alt_text}
  width={img.width ?? 1200}
  height={img.height ?? 800}
  loading="eager"
  decoding="async"
/>
\`\`\`

For lazy-loaded gallery images on the detail page, use \`loading="lazy"\` and skip the explicit width/height if the layout doesn't need them.

**Test it:** after deploy, visit \`/work\`, inspect any snap image. The \`src\` attribute should read \`/public/snaps/...\` (relative) or \`https://<my-domain>/public/snaps/...\` (absolute). It should NOT contain \`supabase.co\`. The image bytes still come from Supabase's CDN — but the URL is on my domain.

## Override (advanced)

GL360-generated fields are the recommended defaults. Structured fields (\`brand\`, \`primary_problem\`, \`city\`, \`state_abbr\`, etc.) are available in the payload if there's a real reason to override naming for a specific site, but otherwise use the pre-computed values verbatim.

## Styling

Match the existing site's brand. Use the project's existing styling approach (Tailwind, CSS modules, scoped \`<style>\` blocks, etc.) — don't introduce new dependencies.

## Deliverables

1. The webhook route handler at \`src/pages/api/jobsnaps-webhook.ts\`.
2. The database migration (or SQL setup script).
3. \`src/pages/work/index.astro\` and \`src/pages/work/[slug].astro\` using plain \`<img>\` tags + the \`brandedSnapImageUrl()\` helper.
4. Updated \`astro.config.mjs\` with \`output: 'server'\` and the \`@astrojs/vercel/serverless\` adapter.
5. \`vercel.json\` at the project root with the \`/public/snaps/:path*\` rewrite.
6. \`src/lib/snap-image-url.ts\` with the \`brandedSnapImageUrl()\` helper.
7. Any helper utilities (signature verification, image mirroring) in \`src/lib/\`.
8. Update \`README.md\` with the env var setup + how Job Snaps works.

## Test

After setup, when a snap is published in GrowLocal admin, it should appear at \`/work\` within seconds and have its own \`/work/<slug>\` detail page. The detail page must be server-rendered HTML (curl-testable) for SEO, and the \`<title>\`/\`<meta name="description">\`/\`<h1>\`/\`<img alt>\` values must match what GL360 generated. Inspect any snap photo on the live site — the \`<img src>\` should point at my own domain (\`/public/snaps/...\`), not at \`supabase.co\`.

## Optional: Vercel image optimization (advanced, can skip)

If you later want WebP/AVIF conversion and responsive \`srcset\` for snap images, you can wire up Vercel's image optimizer. **Don't do this on initial setup** — it adds debugging surface area (Astro \`<Image>\` quirks, adapter version mismatches) for a small performance win on already-fast Supabase-CDN images.

When you do want it:

1. In \`astro.config.mjs\`, add the \`imageService\` + \`imagesConfig\` blocks to the adapter call AND a top-level \`image.remotePatterns\` block. Include both \`**.supabase.co\` (for the raw mirrored URLs) AND your own deployed hostname (for the rewritten \`/public/snaps/\` paths) so the optimizer can fetch from either form.
2. Swap \`<img>\` tags back to \`<Image>\` from \`astro:assets\`. Confirm rendering on \`/work\` — if the \`src\` attribute comes out malformed (path starting with \`/F...\` or missing the optimizer prefix), revert. The optimizer isn't worth fighting for.

## Optional: Full static rendering / SSG (advanced, can skip)

By default the snap pages run SSR — the page function queries Supabase on each request and returns fresh HTML. New snaps appear within ~1 second of publishing. This is the recommended mode because the customer-facing "publish and see it instantly" UX is part of the product magic.

If you later want maximum performance (truly static \`.html\` files served from CDN, ~50ms TTFB), the trade-off is that **every new snap requires a site rebuild** (~30–60 seconds before the new page goes live). For low-volume use (a few snaps per week), this is fine. For agencies publishing many snaps in a row, it's a UX regression.

When you do want it:

1. Remove \`export const prerender = false;\` from \`src/pages/work/index.astro\` and \`src/pages/work/[slug].astro\` so they prerender (Astro's default).
2. In \`[slug].astro\`, add a \`getStaticPaths()\` function in the frontmatter that queries Supabase at build time and returns one path per snap slug. (Keep \`output: 'server'\` so the webhook route still works as a serverless function.)
3. **Create a Vercel Deploy Hook** in the project (Settings → Git → Deploy Hooks → "Create Hook" named \`jobsnaps-rebuild\` targeting \`main\`). Copy the resulting URL into env var \`JOBSNAPS_DEPLOY_HOOK_URL\`.
4. In the webhook handler, after the upsert (and after the delete for \`job_snap.unpublished\`), POST to that deploy hook URL to trigger a rebuild:
   \`\`\`ts
   if (process.env.JOBSNAPS_DEPLOY_HOOK_URL) {
     await fetch(process.env.JOBSNAPS_DEPLOY_HOOK_URL, { method: 'POST' });
   }
   \`\`\`
5. Watch the Vercel Deployments tab — each published snap should trigger a build that completes in under a minute.

Both modes are equivalent for Googlebot indexing (each serves real HTML). SSG wins marginally on Core Web Vitals; SSR wins on the customer-facing "instant publish" UX.
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

GL360 has already computed canonical SEO-safe values for every snap (slug, meta_title, h1, meta_description, alt_text, image_filename, public_location_label). **Use those fields verbatim** when setting post slug, title, content, and image alts — do NOT regenerate them.

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
   - Verifies HMAC-SHA256 using \`hash_hmac('sha256', $timestamp . '.' . $body, JOBSNAPS_WEBHOOK_SECRET)\`. Use \`hash_equals()\`.
   - Rejects if signature invalid or timestamp older than 5 minutes.
   - Parses JSON body.

3. **On \`job_snap.published\` or \`job_snap.updated\`**:
   - Find existing post by meta key \`jobsnaps_id\` = the snap id, or create new \`job_snap\` post.
   - **\`post_name\` (slug) = \`payload.data.slug\`** — GL360's canonical slug. Do NOT slugify the title yourself.
   - \`post_title\` = \`payload.data.h1\` if present, else \`payload.data.title\`.
   - \`post_content\` = \`payload.data.description\` (let Yoast/Rank Math use \`payload.data.meta_title\` + \`payload.data.meta_description\` if available).
   - \`post_status\` = 'publish'.
   - Save metadata: \`jobsnaps_id\`, \`meta_title\`, \`meta_description\`, \`h1\`, \`alt_text\`, \`service_type\`, \`brand\`, \`primary_problem\`, \`equipment_type\`, full \`location\` object, all media URLs.
   - Sideload the first media item as the featured image — use \`payload.data.media[0].filename\` as the saved filename hint when calling \`media_sideload_image\`, and set the alt attachment meta to \`payload.data.alt_text\`.
   - When sideloading the rest, rename to \`payload.data.media[i].filename\` if present.

4. **On \`job_snap.unpublished\`**:
   - Find post by \`jobsnaps_id\` meta.
   - Delete it (\`wp_delete_post($id, true)\`).
   - Delete all attached media files.

5. **Add a shortcode** \`[jobsnaps_gallery]\` that queries recent \`job_snap\` posts and renders a responsive grid. Optional attributes: limit, location, service_type.

## Webhook payload reference

${PAYLOAD_REFERENCE_BLOCK}

## Override (advanced)

GL360-generated fields are the recommended defaults. The structured fields are available in the payload if you need to compute custom naming for a specific site, but only do so deliberately.

## Deliverables

1. The plugin file (or functions.php additions) implementing the CPT + webhook endpoint.
2. The shortcode for gallery rendering.
3. A template file \`single-job_snap.php\` for individual snap detail pages.
4. A template file \`archive-job_snap.php\` for the /work archive.

## Test

After setup, publish a Job Snap in GrowLocal admin. Within seconds, a new \`job_snap\` post should appear in WordPress at \`/work/<slug>\`. The slug, page title, H1, and image alts should match GL360's generated values exactly.
`;
}

// ── Generic API prompt ──────────────────────────────────────────────────

function apiPrompt(p: SetupPromptParams): string {
  const apiBase = p.apiBase;
  const apiKey = placeholder(p.apiKey, 'PASTE_YOUR_API_KEY_HERE');
  const business = p.businessName ? ` for ${p.businessName}` : '';

  return `# Job Snaps API integration${business}

I want to consume the **Job Snaps** REST API from GrowLocal 360 in my application.

GL360 pre-computes canonical SEO-safe values for every snap (slug, meta_title, h1, meta_description, alt_text, image_filename, public_location_label). **Use those fields verbatim** when rendering — do NOT regenerate them.

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

${PAYLOAD_REFERENCE_BLOCK.replace(/^type WebhookEvent[^;]+;\s*\n*\s*type/m, 'type').replace(/^type = \{/m, 'type JobSnap = {').replace(/\}\s*\};\s*$/m, '};')}

\`\`\`typescript
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
5. **When rendering snaps, prefer the pre-computed SEO fields** (\`slug\`, \`url_path\`, \`meta_title\`, \`h1\`, \`meta_description\`, \`alt_text\`, \`public_location_label\`, \`image_filename\`). Structured fields are there for filtering, faceting, or advanced customization only.

## Tip — for SEO, prefer webhooks over live API fetches

If my project will display job snaps to public users, server-rendered pages give the best SEO. Recommend setting up a webhook handler on my side to cache snaps locally instead of fetching live on each render. Webhook configuration is available in the GrowLocal admin → Connect Your Website → Webhooks. The signing secret format is \`whsec_...\` and signatures use the format \`t=<ts>,v1=<HMAC-SHA256(secret, '<ts>.<body>')>\`.
`;
}
