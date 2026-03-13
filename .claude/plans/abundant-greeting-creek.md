# Rich AI-Generated Neighborhood Page Content

## Context

Neighborhood pages currently render generic template text — the same "We are your trusted provider..." copy for every neighborhood. There's no AI generation in the pipeline for neighborhoods (unlike service areas which get full Claude-generated content). The goal is to make each neighborhood page unique with real local data: nearby schools, landmarks, housing character, community features, and neighborhood-specific FAQs.

## What Changes

### Step 1: Database Migration

**New file:** `supabase/migrations/022_add_neighborhood_content_fields.sql`

Add content fields to the existing `neighborhoods` table:

```sql
ALTER TABLE neighborhoods
  ADD COLUMN IF NOT EXISTS h1 TEXT,
  ADD COLUMN IF NOT EXISTS body_copy TEXT,
  ADD COLUMN IF NOT EXISTS local_features JSONB,
  ADD COLUMN IF NOT EXISTS faqs JSONB;
```

The existing `description` field (user-provided HTML) is untouched — it continues to take priority as a manual override.

---

### Step 2: TypeScript Types

**Modify:** `src/types/database.ts`

Add `NeighborhoodLocalFeatures` interface and extend `Neighborhood`:

```typescript
export interface NeighborhoodLocalFeatures {
  landmarks: { name: string; description: string }[];
  schools: { name: string; description: string }[];
  housing: string;
  community: string;
  why_choose_us: string[];
}
```

Add to `Neighborhood` interface: `h1`, `body_copy`, `local_features`, `faqs`.

---

### Step 3: Content Generation in Inngest Pipeline

**Modify:** `src/lib/inngest/functions/generate-site-content.ts`

1. **Load neighborhoods** in the `load-site-data` step (~line 79) — add to the parallel Supabase fetch
2. **Count neighborhoods** in total task calculation (~line 228)
3. **Add generation step** after brands, before FAQ hub — batch 10 at a time (same pattern as service areas at ~line 518)

**Prompt design** — instructs Claude to generate per neighborhood:
- `meta_title`, `meta_description`, `h1` (SEO)
- `body_copy` (2-3 paragraphs, 200-350 words about the neighborhood's character + service relevance)
- `local_features` (structured):
  - `landmarks`: 2-3 real landmarks/parks with descriptions
  - `schools`: 2-3 nearby schools with descriptions
  - `housing`: paragraph about housing types and architecture
  - `community`: paragraph about community character
  - `why_choose_us`: 4-6 neighborhood-specific reasons (not generic)
- `faqs`: 3-4 neighborhood-specific Q&As

Key: prompt includes lat/lng when available for geographic context, and instructs Claude to use real local knowledge (actual school names, real landmarks).

---

### Step 4: Template Updates

**Modify:** `src/components/templates/local-service-pro/neighborhood-page-single.tsx`

Content priority (3-tier fallback):
1. `neighborhood.description` (user HTML) → render as-is (existing behavior)
2. `neighborhood.body_copy` (AI-generated) → render paragraphs
3. Generic fallback text (existing, for neighborhoods without any content)

**New sections when `local_features` exists:**
- **Landmarks & Parks** — card grid with name + description
- **Nearby Schools** — card grid with name + description
- **Housing Character** — paragraph section
- **Community** — paragraph section

**Why Choose Us** — use `local_features.why_choose_us` array when available, fall back to current hardcoded bullets.

**FAQs** — render `neighborhood.faqs` as Q&A section before CTA (when present).

**H1** — use `neighborhood.h1` when available, fall back to `"{industry} in {neighborhood.name}"`.

**Modify:** `src/components/templates/local-service-pro/neighborhood-page.tsx` — same changes for multi-location variant.

---

### Step 5: Revalidation

**Modify:** `src/lib/sites/revalidate.ts`

Add neighborhoods to the parallel data fetch (line 16) and revalidate each neighborhood path after the service areas loop (line 72):

```typescript
for (const n of neighborhoods || []) {
  revalidatePath(`${base}/neighborhoods/${n.slug}`, 'page');
}
```

---

## Files Summary

| Action | File |
|--------|------|
| Create | `supabase/migrations/022_add_neighborhood_content_fields.sql` |
| Modify | `src/types/database.ts` |
| Modify | `src/lib/inngest/functions/generate-site-content.ts` |
| Modify | `src/components/templates/local-service-pro/neighborhood-page-single.tsx` |
| Modify | `src/components/templates/local-service-pro/neighborhood-page.tsx` |
| Modify | `src/lib/sites/revalidate.ts` |

## Reuse

- **Service area generation pattern** (`generate-site-content.ts` ~lines 518-581) — batching, DB upsert, progress tracking
- **`buildContentDirectives()`** + **`buildGSCContext()`** (`src/lib/content/generators.ts`) — injected into prompt
- **`withRetry()`** + **`parseJsonResponse()`** (`src/lib/content/generators.ts`) — Claude call wrapper
- **`createAnthropicClient()`** (`src/lib/content/generators.ts`) — Anthropic SDK setup

## Verification

1. Run migration SQL in Supabase
2. `npm run build` passes
3. Regenerate a site with neighborhoods → verify `neighborhoods` table has populated `h1`, `body_copy`, `local_features`, `faqs`
4. Visit a neighborhood page → should show unique content with landmarks, schools, housing info
5. Visit a neighborhood with no generated content → should show existing fallback (no regression)
6. Visit a neighborhood with user-provided `description` → should still render the user's HTML (override preserved)
