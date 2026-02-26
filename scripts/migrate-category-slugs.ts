/**
 * One-time migration script to update category page slugs in site_pages.
 *
 * After switching from the old slugification (verbatim lowercase-hyphenated)
 * to normalizeCategorySlug (smart suffix stripping), existing site_pages rows
 * need their slug column updated to match the new format.
 *
 * Usage:
 *   npx tsx scripts/migrate-category-slugs.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 * Run against staging first, then production.
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeCategorySlug } from '../src/lib/utils/slugify';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Old slugification logic (what was previously used)
function oldSlugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function migrate() {
  console.log('Fetching category site_pages...\n');

  // Get all category pages
  const { data: categoryPages, error: pagesError } = await supabase
    .from('site_pages')
    .select('id, site_id, slug, category_id')
    .eq('page_type', 'category');

  if (pagesError) {
    console.error('Error fetching site_pages:', pagesError.message);
    process.exit(1);
  }

  if (!categoryPages || categoryPages.length === 0) {
    console.log('No category pages found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${categoryPages.length} category page(s).\n`);

  // Get all site_categories with gbp_category data
  const categoryIds = [...new Set(categoryPages.map(p => p.category_id).filter(Boolean))];

  const { data: siteCategories, error: catError } = await supabase
    .from('site_categories')
    .select('id, gbp_category:gbp_categories(display_name)')
    .in('id', categoryIds);

  if (catError) {
    console.error('Error fetching site_categories:', catError.message);
    process.exit(1);
  }

  // Build lookup: category_id → display_name
  const displayNameMap = new Map<string, string>();
  for (const cat of siteCategories || []) {
    const displayName = Array.isArray(cat.gbp_category)
      ? cat.gbp_category[0]?.display_name
      : (cat.gbp_category as { display_name: string } | null)?.display_name;
    if (displayName) {
      displayNameMap.set(cat.id, displayName);
    }
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const page of categoryPages) {
    const displayName = page.category_id ? displayNameMap.get(page.category_id) : null;

    if (!displayName) {
      console.log(`  SKIP [${page.id}] — no display_name found (category_id: ${page.category_id})`);
      skipped++;
      continue;
    }

    const newSlug = normalizeCategorySlug(displayName);
    const currentSlug = page.slug;

    if (newSlug === currentSlug) {
      skipped++;
      continue;
    }

    console.log(`  UPDATE [site:${page.site_id}] "${displayName}": "${currentSlug}" → "${newSlug}"`);

    const { error: updateError } = await supabase
      .from('site_pages')
      .update({ slug: newSlug })
      .eq('id', page.id);

    if (updateError) {
      console.error(`  ERROR updating ${page.id}: ${updateError.message}`);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\nMigration complete.`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
