import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateSite } from '@/lib/sites/revalidate';
import Anthropic from '@anthropic-ai/sdk';
import { GBPClient, starRatingToNumber } from '@/lib/google/gbp-client';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { createAnthropicClient, withRetry, parseJsonResponse, buildContentDirectives, buildGSCContext } from '@/lib/content/generators';
import type { SiteSettings } from '@/types/database';

// Types

interface SiteBuildProgress {
  total_tasks: number;
  completed_tasks: number;
  current_task: string;
  started_at: string;
}

interface GenerateSiteContentEvent {
  name: 'site/content.generate';
  data: {
    siteId: string;
    googleAccessToken: string | null;
  };
}

// Inngest function: generate all content for a site
export const generateSiteContent = inngest.createFunction(
  {
    id: 'generate-site-content',
    retries: 0,
    onFailure: async ({ event }) => {
      const siteId = event.data.event.data.siteId;
      const errorMessage = event.data.error?.message || 'Unknown error';
      const supabase = createAdminClient();

      // Fetch current site to check status
      const { data: site } = await supabase
        .from('sites')
        .select('status, build_progress')
        .eq('id', siteId)
        .single();

      if (!site) return;

      // Mark build_progress as failed so dashboard stops showing "Regenerating"
      const updates: Record<string, unknown> = {
        build_progress: {
          ...(site.build_progress || { total_tasks: 0, completed_tasks: 0 }),
          current_task: 'Failed',
          started_at: site.build_progress?.started_at || new Date().toISOString(),
        },
        status_updated_at: new Date().toISOString(),
        status_message: `Build failed: ${errorMessage}`,
      };

      // If site was in 'building' status, mark it as failed
      if (site.status === 'building') {
        updates.status = 'failed';
      }

      await supabase.from('sites').update(updates).eq('id', siteId);

      // Log failure
      await supabase.from('build_logs').insert({
        site_id: siteId,
        level: 'error',
        message: `Content generation failed: ${errorMessage}`,
        metadata: { error: errorMessage },
      });
    },
  },
  { event: 'site/content.generate' },
  async ({ event, step }) => {
    const { siteId, googleAccessToken } = event.data;
    const supabase = createAdminClient();

    // Step 1: Load site data
    const siteData = await step.run('load-site-data', async () => {
      const [
        { data: site },
        { data: locations },
        { data: services },
        { data: serviceAreas },
        { data: siteCategories },
        { data: brands },
        { data: neighborhoods },
      ] = await Promise.all([
        supabase
          .from('sites')
          .select('id, name, website_type, settings, status, organization_id, build_progress')
          .eq('id', siteId)
          .single(),
        supabase.from('locations').select('*').eq('site_id', siteId),
        supabase.from('services').select('*').eq('site_id', siteId),
        supabase.from('service_areas').select('*').eq('site_id', siteId),
        supabase
          .from('site_categories')
          .select('*, gbp_categories(*)')
          .eq('site_id', siteId),
        supabase
          .from('site_brands')
          .select('*')
          .eq('site_id', siteId)
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('neighborhoods')
          .select('*')
          .eq('site_id', siteId)
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      if (!site) throw new Error('Site not found');

      const primaryLocation = locations?.find((l) => l.is_primary) || locations?.[0];
      const primaryCategory = siteCategories?.find((c) => c.is_primary);

      if (!primaryLocation || !primaryCategory) {
        throw new Error('Site missing required data (location or category)');
      }

      return {
        site,
        primaryLocation,
        primaryCategory,
        allServices: services || [],
        allServiceAreas: serviceAreas || [],
        siteCategories: siteCategories || [],
        allBrands: (brands || []).map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          h1: b.h1 || null,
        })),
        allNeighborhoods: (neighborhoods || []).map((n) => ({
          id: n.id,
          name: n.name,
          slug: n.slug,
          latitude: n.latitude,
          longitude: n.longitude,
        })),
      };
    });

    const {
      site,
      primaryLocation,
      primaryCategory,
      allServiceAreas,
      siteCategories,
      allBrands,
      allNeighborhoods,
    } = siteData;
    let { allServices } = siteData;

    const wasAlreadyActive = site.status === 'active';
    const categoryName = getCategoryName(primaryCategory);
    const contentDirectives = buildContentDirectives((site.settings || {}) as SiteSettings)
      + await buildGSCContext(siteId);

    // Step 1b: Auto-fix orphaned services (null site_category_id)
    const orphanedServices = allServices.filter((s) => !s.site_category_id);
    if (orphanedServices.length > 0) {
      allServices = await step.run('fix-orphaned-services', async () => {
        const primaryCatId = siteCategories.find((c) => c.is_primary)?.id;

        // Build matching helpers from categories
        const categoryMatchers = siteCategories.map((sc) => {
          const gbp = Array.isArray(sc.gbp_categories) ? sc.gbp_categories[0] : sc.gbp_categories;
          const displayName: string = gbp?.display_name || '';
          const serviceTypes: string[] = (gbp?.service_types || []) as string[];
          const normalizedServiceTypes = serviceTypes.map((st: string) => st.toLowerCase().trim());
          const categoryKeywords = displayName.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter((w: string) => w.length > 2 && !['and', 'the', 'for', 'service', 'repair'].includes(w));
          return { id: sc.id, isPrimary: sc.is_primary, displayName, normalizedServiceTypes, categoryKeywords };
        });

        let fixedCount = 0;
        for (const service of orphanedServices) {
          const nameLower = service.name.toLowerCase();
          let matchedId: string | null = null;

          // Method 1: exact match against service_types
          for (const cat of categoryMatchers) {
            if (cat.normalizedServiceTypes.some((st: string) => st === nameLower)) {
              matchedId = cat.id; break;
            }
          }
          // Method 2: fuzzy match (contains)
          if (!matchedId) {
            for (const cat of categoryMatchers) {
              if (cat.normalizedServiceTypes.some((st: string) => nameLower.includes(st) || st.includes(nameLower))) {
                matchedId = cat.id; break;
              }
            }
          }
          // Method 3: keyword overlap
          if (!matchedId) {
            const serviceWords = nameLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/)
              .filter((w: string) => w.length > 2 && !['and', 'the', 'for', 'service', 'repair', 'professional'].includes(w));
            let bestScore = 0;
            for (const cat of categoryMatchers) {
              const overlap = serviceWords.filter((w: string) => cat.categoryKeywords.includes(w)).length;
              if (overlap > bestScore) { bestScore = overlap; matchedId = cat.id; }
            }
          }
          // Method 4: single category
          if (!matchedId && categoryMatchers.length === 1) {
            matchedId = categoryMatchers[0].id;
          }
          // Method 5: primary fallback
          if (!matchedId) {
            matchedId = primaryCatId || null;
          }

          if (matchedId) {
            await supabase.from('services').update({ site_category_id: matchedId }).eq('id', service.id);
            fixedCount++;
          }
        }

        await supabase.from('build_logs').insert({
          site_id: siteId,
          level: 'info',
          step: 'fix-orphaned-services',
          message: `Auto-fixed ${fixedCount}/${orphanedServices.length} orphaned services`,
        });

        // Re-fetch services with updated category assignments
        const { data: refreshedServices } = await supabase
          .from('services')
          .select('*')
          .eq('site_id', siteId);
        return refreshedServices || [];
      });
    }

    // Calculate totals
    const serviceCount = allServices.length;
    const serviceAreaCount = allServiceAreas.length;
    const categoryCount = siteCategories.length;
    const brandCount = allBrands.length;
    const neighborhoodCount = allNeighborhoods.length;
    const corePageCount = 3;
    const totalTasks = serviceCount + serviceAreaCount + categoryCount + corePageCount + brandCount + neighborhoodCount;

    // Step 2: Initialize build progress
    await step.run('init-build-progress', async () => {
      const initialProgress: SiteBuildProgress = {
        total_tasks: totalTasks,
        completed_tasks: 0,
        current_task: 'Initializing content generation...',
        started_at: new Date().toISOString(),
      };

      const statusUpdate: Record<string, unknown> = {
        build_progress: initialProgress,
        status_message: null,
        status_updated_at: new Date().toISOString(),
      };
      if (!wasAlreadyActive) {
        statusUpdate.status = 'building';
      }

      await supabase.from('sites').update(statusUpdate).eq('id', siteId);

      await supabase.from('build_logs').insert({
        site_id: siteId,
        level: 'info',
        step: 'init',
        message: `Content generation started (${totalTasks} tasks)`,
        metadata: { totalTasks, serviceCount, serviceAreaCount, categoryCount, brandCount, neighborhoodCount },
      });
    });

    // Helper to log build progress
    const log = async (
      message: string,
      stepName?: string,
      level: 'info' | 'warn' | 'error' = 'info',
      metadata?: Record<string, unknown>
    ) => {
      await supabase.from('build_logs').insert({
        site_id: siteId,
        level,
        step: stepName,
        message,
        metadata,
      });
    };

    // Step 3: Fetch Google Reviews (non-fatal)
    await step.run('fetch-google-reviews', async () => {
      if (
        !googleAccessToken ||
        !primaryLocation.gbp_account_id ||
        !primaryLocation.gbp_location_id
      ) {
        return { skipped: true };
      }

      try {
        const gbpClient = new GBPClient(googleAccessToken);
        const reviewsResponse = await gbpClient.getReviews(
          primaryLocation.gbp_account_id,
          primaryLocation.gbp_location_id
        );

        if (reviewsResponse.reviews?.length) {
          const reviewRows = reviewsResponse.reviews.map((r) => ({
            site_id: siteId,
            location_id: primaryLocation.id,
            google_review_id: r.reviewId,
            author_name: r.reviewer.isAnonymous
              ? 'Anonymous'
              : r.reviewer.displayName || 'Customer',
            author_photo_url: r.reviewer.profilePhotoUrl || null,
            rating: starRatingToNumber(r.starRating),
            comment: r.comment || null,
            review_date: r.createTime,
            review_reply: r.reviewReply?.comment || null,
            reply_date: r.reviewReply?.updateTime || null,
          }));

          await supabase.from('google_reviews').upsert(reviewRows, {
            onConflict: 'site_id,google_review_id',
          });
        }

        if (reviewsResponse.averageRating) {
          await supabase
            .from('sites')
            .update({
              settings: {
                ...((site.settings as Record<string, unknown>) || {}),
                google_average_rating: reviewsResponse.averageRating,
                google_total_reviews: reviewsResponse.totalReviewCount || 0,
              },
            })
            .eq('id', siteId);
        }

        await log(`Fetched ${reviewsResponse.reviews?.length || 0} Google Reviews`, 'fetch-google-reviews');
        return { reviewCount: reviewsResponse.reviews?.length || 0 };
      } catch (error) {
        console.error('Failed to fetch Google Reviews (non-fatal):', error);
        await log('Failed to fetch Google Reviews (non-fatal)', 'fetch-google-reviews', 'warn');
        return { error: 'Failed to fetch reviews' };
      }
    });

    // Track completed tasks across steps
    let completedTasks = 0;

    // Step 4: Generate core pages
    completedTasks = await step.run('generate-core-pages', async () => {
      let completed = completedTasks;
      const anthropic = createAnthropicClient();

      await updateProgress(supabase, siteId, totalTasks, completed, 'Generating core pages...');

      const coreContent = await generateCorePages(
        anthropic,
        site.name,
        primaryLocation.city,
        primaryLocation.state,
        categoryName,
        site.website_type,
        contentDirectives
      );

      for (const page of coreContent) {
        await supabase.from('site_pages').upsert(
          {
            site_id: siteId,
            page_type: page.page_type,
            slug: page.page_type,
            meta_title: page.meta_title,
            meta_description: page.meta_description,
            h1: page.h1,
            h2: page.h2,
            hero_description: page.hero_description || null,
            body_copy: page.body_copy,
            body_copy_2: page.body_copy_2 || null,
            is_active: true,
          },
          { onConflict: 'site_id,slug' }
        );
        completed++;
        await updateProgress(supabase, siteId, totalTasks, completed, `Generated ${page.page_type} page`);
        await log(`Generated ${page.page_type} page`, 'generate-core-pages');
      }

      return completed;
    });

    // Step 5: Generate category pages (one step per category for granularity)
    for (const category of siteCategories) {
      completedTasks = await step.run(
        `generate-category-${category.id}`,
        async () => {
          let completed = completedTasks;
          const anthropic = createAnthropicClient();

          const catName = getCategoryName(category);
          await updateProgress(
            supabase,
            siteId,
            totalTasks,
            completed,
            `Generating ${catName} category page...`
          );

          const categoryContent = await generateCategoryPage(
            anthropic,
            site.name,
            primaryLocation.city,
            primaryLocation.state,
            catName,
            category.is_primary,
            contentDirectives
          );

          const catSlug = normalizeCategorySlug(catName);

          await supabase.from('site_pages').upsert(
            {
              site_id: siteId,
              category_id: category.id,
              page_type: 'category',
              slug: catSlug,
              meta_title: categoryContent.meta_title,
              meta_description: categoryContent.meta_description,
              h1: categoryContent.h1,
              h2: categoryContent.h2,
              hero_description: categoryContent.hero_description || null,
              body_copy: categoryContent.body_copy,
              body_copy_2: categoryContent.body_copy_2 || null,
              is_active: true,
            },
            { onConflict: 'site_id,slug' }
          );

          await log(`Generated ${catName} category page`, `generate-category-${category.id}`);
          completed++;
          return completed;
        }
      );
    }

    // Step 6: Generate service pages (batched by category, 2 at a time)
    const servicesBySiteCategory = new Map<string, typeof allServices>();
    for (const service of allServices) {
      const key = service.site_category_id || 'uncategorized';
      if (!servicesBySiteCategory.has(key)) {
        servicesBySiteCategory.set(key, []);
      }
      servicesBySiteCategory.get(key)!.push(service);
    }

    for (const [siteCategoryId, categoryServices] of servicesBySiteCategory) {
      const siteCat = siteCategories.find((c) => c.id === siteCategoryId);
      const catNameForServices = siteCat ? getCategoryName(siteCat) : 'Services';

      const batchSize = 2;
      for (let i = 0; i < categoryServices.length; i += batchSize) {
        const batch = categoryServices.slice(i, i + batchSize);
        const batchLabel = batch.map((s) => s.name).join(', ');

        completedTasks = await step.run(
          `generate-services-${batch[0].id}`,
          async () => {
            let completed = completedTasks;
            const anthropic = createAnthropicClient();

            await updateProgress(
              supabase,
              siteId,
              totalTasks,
              completed,
              `Generating ${batchLabel}...`
            );

            try {
              const serviceContents = await generateServicePages(
                anthropic,
                site.name,
                primaryLocation.city,
                primaryLocation.state,
                catNameForServices,
                batch.map((s) => ({ name: s.name, description: s.description || '' })),
                contentDirectives
              );

              for (let j = 0; j < batch.length; j++) {
                const service = batch[j];
                const content = serviceContents[j];

                if (content) {
                  await supabase
                    .from('services')
                    .update({
                      meta_title: content.meta_title,
                      meta_description: content.meta_description,
                      h1: content.h1,
                      body_copy: content.body_copy,
                      intro_copy: content.intro_copy || null,
                      problems: content.problems || null,
                      detailed_sections: content.detailed_sections || null,
                      faqs: content.faqs,
                    })
                    .eq('id', service.id);
                }

                completed++;
              }
              await log(`Generated services: ${batchLabel}`, `generate-services-${batch[0].id}`);
            } catch (batchError) {
              console.error(`Failed to generate service batch: ${batchLabel}`, batchError);
              await log(`Failed to generate services: ${batchLabel}`, `generate-services-${batch[0].id}`, 'error');
              completed += batch.length;
            }

            return completed;
          }
        );
      }
    }

    // Step 7: Generate service area pages (batched, 10 at a time)
    if (allServiceAreas.length > 0) {
      const areasBatchSize = 10;
      for (let i = 0; i < allServiceAreas.length; i += areasBatchSize) {
        const batch = allServiceAreas.slice(i, i + areasBatchSize);

        completedTasks = await step.run(
          `generate-areas-batch-${i}`,
          async () => {
            let completed = completedTasks;
            const anthropic = createAnthropicClient();

            await updateProgress(
              supabase,
              siteId,
              totalTasks,
              completed,
              `Generating ${batch[0].name} service area page...`
            );

            try {
              const areaContents = await generateServiceAreaPages(
                anthropic,
                site.name,
                primaryLocation.city,
                primaryLocation.state,
                categoryName,
                batch.map((a) => ({
                  name: a.name,
                  state: a.state || primaryLocation.state,
                })),
                contentDirectives
              );

              for (let j = 0; j < batch.length; j++) {
                const area = batch[j];
                const content = areaContents[j];

                if (content) {
                  await supabase
                    .from('service_areas')
                    .update({
                      meta_title: content.meta_title,
                      meta_description: content.meta_description,
                      h1: content.h1,
                      body_copy: content.body_copy,
                    })
                    .eq('id', area.id);
                }

                completed++;
              }
            } catch (batchError) {
              console.error(
                `Failed to generate service area batch starting at ${batch[0].name}:`,
                batchError
              );
              completed += batch.length;
            }

            return completed;
          }
        );
      }
    }

    // Step 8: Generate brand pages (batched, 5 at a time)
    if (allBrands.length > 0) {
      const brandBatchSize = 5;
      for (let i = 0; i < allBrands.length; i += brandBatchSize) {
        const batch = allBrands.slice(i, i + brandBatchSize);

        completedTasks = await step.run(
          `generate-brands-batch-${i}`,
          async () => {
            let completed = completedTasks;
            const anthropic = createAnthropicClient();

            await updateProgress(
              supabase,
              siteId,
              totalTasks,
              completed,
              `Generating ${batch[0].name} brand page...`
            );

            try {
              const brandContents = await generateBrandPages(
                anthropic,
                site.name,
                primaryLocation.city,
                primaryLocation.state,
                categoryName,
                batch.map((b) => ({ name: b.name, slug: b.slug })),
                contentDirectives
              );

              for (let j = 0; j < batch.length; j++) {
                const brand = batch[j];
                const content = brandContents[j];

                if (content) {
                  await supabase
                    .from('site_brands')
                    .update({
                      meta_title: content.meta_title,
                      meta_description: content.meta_description,
                      h1: content.h1,
                      hero_description: content.hero_description,
                      body_copy: content.body_copy,
                      value_props: content.value_props,
                      faqs: content.faqs,
                      cta_heading: content.cta_heading,
                      cta_description: content.cta_description,
                    })
                    .eq('id', brand.id);
                }

                completed++;
              }
            } catch (batchError) {
              console.error(
                `Failed to generate brand batch starting at ${batch[0].name}:`,
                batchError
              );
              completed += batch.length;
            }

            return completed;
          }
        );
      }
    }

    // Step 8.5: Generate neighborhood pages (batched, 10 at a time)
    if (allNeighborhoods.length > 0) {
      const neighborhoodBatchSize = 10;
      for (let i = 0; i < allNeighborhoods.length; i += neighborhoodBatchSize) {
        const batch = allNeighborhoods.slice(i, i + neighborhoodBatchSize);

        completedTasks = await step.run(
          `generate-neighborhoods-batch-${i}`,
          async () => {
            let completed = completedTasks;
            const anthropic = createAnthropicClient();

            await updateProgress(
              supabase,
              siteId,
              totalTasks,
              completed,
              `Generating ${batch[0].name} neighborhood page...`
            );

            try {
              const neighborhoodContents = await generateNeighborhoodPages(
                anthropic,
                site.name,
                primaryLocation.city,
                primaryLocation.state,
                categoryName,
                batch.map((n) => ({
                  name: n.name,
                  latitude: n.latitude,
                  longitude: n.longitude,
                })),
                contentDirectives
              );

              for (let j = 0; j < batch.length; j++) {
                const neighborhood = batch[j];
                const content = neighborhoodContents[j];

                if (content) {
                  await supabase
                    .from('neighborhoods')
                    .update({
                      meta_title: content.meta_title,
                      meta_description: content.meta_description,
                      h1: content.h1,
                      body_copy: content.body_copy,
                      local_features: content.local_features,
                      faqs: content.faqs,
                    })
                    .eq('id', neighborhood.id);
                }

                completed++;
              }
            } catch (batchError) {
              console.error(
                `Failed to generate neighborhood batch starting at ${batch[0].name}:`,
                batchError
              );
              completed += batch.length;
            }

            return completed;
          }
        );
      }
    }

    // Step 9: Generate FAQ hub page
    await step.run('generate-faq-page', async () => {
      const anthropic = createAnthropicClient();

      await updateProgress(supabase, siteId, totalTasks, completedTasks, 'Generating FAQ hub page...');

      const faqContent = await generateFAQPage(
        anthropic,
        site.name,
        primaryLocation.city,
        primaryLocation.state,
        categoryName,
        contentDirectives
      );

      if (faqContent) {
        await supabase.from('site_pages').upsert(
          {
            site_id: siteId,
            page_type: 'faq' as const,
            slug: 'faq',
            meta_title: faqContent.meta_title,
            meta_description: faqContent.meta_description,
            h1: faqContent.h1,
            hero_description: faqContent.hero_description,
            is_active: true,
          },
          { onConflict: 'site_id,slug' }
        );
      }

      await log('Generated FAQ hub page', 'generate-faq-page');
    });

    // Step 10: Mark complete
    await step.run('mark-complete', async () => {
      await supabase
        .from('sites')
        .update({
          status: 'active',
          build_progress: {
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            current_task: 'Complete',
            started_at: new Date().toISOString(),
          },
          status_message: null,
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', siteId);

      // Revalidate all cached pages so new content is immediately visible
      await revalidateSite(siteId);

      // Log to build_logs
      await supabase.from('build_logs').insert({
        site_id: siteId,
        level: 'info',
        message: `Content generation complete (${completedTasks}/${totalTasks} tasks)`,
        metadata: { completedTasks, totalTasks },
      });
    });

    return { completedTasks, totalTasks };
  }
);

// --- Helper functions ---

function getCategoryName(
  category: { gbp_categories: { display_name: string } | { display_name: string }[] }
): string {
  return Array.isArray(category.gbp_categories)
    ? category.gbp_categories[0]?.display_name || 'Services'
    : category.gbp_categories?.display_name || 'Services';
}

async function updateProgress(
  supabase: ReturnType<typeof createAdminClient>,
  siteId: string,
  totalTasks: number,
  completedTasks: number,
  currentTask: string
) {
  await supabase
    .from('sites')
    .update({
      build_progress: {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        current_task: currentTask,
        started_at: new Date().toISOString(),
      },
      status_updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);
}

// --- Content generation functions ---

async function generateCorePages(
  anthropic: Anthropic,
  businessName: string,
  city: string,
  state: string,
  primaryCategory: string,
  websiteType: string,
  directives: string = ''
) {
  const homePageFocus =
    websiteType === 'single_location'
      ? `The home page IS the primary category page. It should focus on "${primaryCategory}" in ${city}, ${state} since this is a single-location business. The H1 should be like "Your Trusted ${primaryCategory} in ${city}, ${state}".`
      : `The home page should be brand-focused for ${businessName} since this is a multi-location business.`;

  const prompt = `You are an SEO expert generating core page content for a local service business website.

Business: ${businessName}
Location: ${city}, ${state}
Primary Category: ${primaryCategory}
Website Type: ${websiteType}

${homePageFocus}
${directives}
Generate content for these core pages: home, about, contact

For EACH page, provide:
1. meta_title: SEO-optimized title (max 60 chars)
2. meta_description: Compelling description with CTA (max 155 chars)
3. h1: Main heading
4. h2: Supporting subheading (for home page: something like "Serving ${city} With Quality ${primaryCategory}" or "Your Local ${primaryCategory} Expert")
5. hero_description: 1-2 sentence hero subheading for the page (compelling value proposition, used below the H1)
6. body_copy: Main content block:
   - Home: 2-3 paragraphs about the business, services, and why customers trust them (300-500 words). Write naturally about the business and its commitment to the community.
   - About: Company story, values, team expertise, and why choose us (300-500 words)
   - Contact: Brief intro encouraging contact with mention of service area (100-200 words)
7. body_copy_2: Secondary content block (used in alternating layout sections):
   - Home: 1-2 paragraphs about community commitment, certifications, or experience (150-250 words)
   - About: Additional section about team or certifications (150-250 words)
   - Contact: empty string

Use double newlines (\\n\\n) to separate paragraphs within body_copy and body_copy_2.

Format as JSON:
{
  "pages": [
    {
      "page_type": "home",
      "meta_title": "...",
      "meta_description": "...",
      "h1": "...",
      "h2": "...",
      "hero_description": "...",
      "body_copy": "...",
      "body_copy_2": "..."
    }
  ]
}

Return ONLY valid JSON.`;

  const message = await withRetry((signal) =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal }
    )
  );

  const result = parseJsonResponse<{
    pages: {
      page_type: 'home' | 'about' | 'contact';
      meta_title: string;
      meta_description: string;
      h1: string;
      h2: string;
      hero_description: string;
      body_copy: string;
      body_copy_2: string;
    }[];
  }>(message);

  return result?.pages || [];
}

async function generateCategoryPage(
  anthropic: Anthropic,
  businessName: string,
  city: string,
  state: string,
  categoryName: string,
  isPrimary: boolean,
  directives: string = ''
) {
  const prompt = `You are an SEO expert generating a category page for a local service business.

Business: ${businessName}
Location: ${city}, ${state}
Category: ${categoryName}${isPrimary ? ' (Primary — this is also the home page for single-location sites)' : ''}
${directives}
Generate content for this category page:
1. meta_title: "[Category Name] in [City], [State] | [Business Name]" (max 60 chars)
2. meta_description: Overview of services in this category with CTA (max 155 chars)
3. h1: Main heading (e.g., "Your Trusted ${categoryName} in ${city}, ${state}")
4. h2: Supporting subheading for localized content section (e.g., "Serving ${city} With Expert ${categoryName}")
5. hero_description: 1-2 sentence value proposition shown below the H1 in the hero section
6. body_copy: 2-3 paragraphs introducing this category of services (200-400 words). Write naturally about the business capabilities, experience, and commitment to the local community.
7. body_copy_2: 1-2 paragraphs for a secondary content block (150-250 words) — focus on certifications, community involvement, or additional value propositions.

Use double newlines (\\n\\n) to separate paragraphs.

Format as JSON:
{
  "meta_title": "...",
  "meta_description": "...",
  "h1": "...",
  "h2": "...",
  "hero_description": "...",
  "body_copy": "...",
  "body_copy_2": "..."
}

Return ONLY valid JSON.`;

  const message = await withRetry((signal) =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal }
    )
  );

  const result = parseJsonResponse<{
    meta_title: string;
    meta_description: string;
    h1: string;
    h2: string;
    hero_description: string;
    body_copy: string;
    body_copy_2: string;
  }>(message);

  return (
    result || {
      meta_title: '',
      meta_description: '',
      h1: '',
      h2: '',
      hero_description: '',
      body_copy: '',
      body_copy_2: '',
    }
  );
}

async function generateServicePages(
  anthropic: Anthropic,
  businessName: string,
  city: string,
  state: string,
  categoryName: string,
  services: { name: string; description: string }[],
  directives: string = ''
) {
  const serviceList = services
    .map((s) => `- ${s.name}: ${s.description || 'No description'}`)
    .join('\n');

  const prompt = `You are an SEO expert generating rich, structured content for a local service business website.

Business: ${businessName}
Location: ${city}, ${state}
Category: ${categoryName}
${directives}
Generate SEO-optimized content for these services:
${serviceList}

For EACH service, provide ALL of these fields:
1. meta_title: Format as "[Service Name] in [City], [State] | [Business Name]" (max 60 chars total)
2. meta_description: Compelling description with call-to-action (max 155 chars)
3. h1: Main heading like "Professional [Service Name] Services"
4. intro_copy: 2-3 sentence service introduction highlighting key benefits (shown as a callout card)
5. body_copy: 2-3 paragraphs of helpful, SEO-friendly content (300-500 words total)
6. problems: Exactly 3 common problems/issues this service solves. Each with a short heading and a description of how the business solves it (2-3 sentences each)
7. detailed_sections: Exactly 3 informational subsections. Each with an h2 heading, a body paragraph (100-150 words), and 3-4 bullet points
8. faqs: 3-5 common questions and detailed answers about this specific service

Use double newlines (\\n\\n) to separate paragraphs within body_copy.

Format your response as JSON:
{
  "services": [
    {
      "name": "Service Name",
      "meta_title": "...",
      "meta_description": "...",
      "h1": "...",
      "intro_copy": "...",
      "body_copy": "...",
      "problems": [
        { "heading": "Problem 1", "description": "How we solve it..." },
        { "heading": "Problem 2", "description": "..." },
        { "heading": "Problem 3", "description": "..." }
      ],
      "detailed_sections": [
        { "h2": "Section heading", "body": "Paragraph...", "bullets": ["point 1", "point 2", "point 3"] }
      ],
      "faqs": [
        { "question": "...", "answer": "..." }
      ]
    }
  ]
}

Return ONLY valid JSON.`;

  const message = await withRetry((signal) =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal }
    )
  );

  const result = parseJsonResponse<{
    services: {
      name: string;
      meta_title: string;
      meta_description: string;
      h1: string;
      intro_copy: string;
      body_copy: string;
      problems: { heading: string; description: string }[];
      detailed_sections: { h2: string; body: string; bullets: string[] }[];
      faqs: { question: string; answer: string }[];
    }[];
  }>(message);

  return result?.services || [];
}

async function generateServiceAreaPages(
  anthropic: Anthropic,
  businessName: string,
  primaryCity: string,
  state: string,
  primaryCategory: string,
  serviceAreas: { name: string; state: string }[],
  directives: string = ''
) {
  const areaList = serviceAreas.map((a) => `- ${a.name}, ${a.state}`).join('\n');

  const prompt = `You are an SEO expert generating service area page content for a local service business.

Business: ${businessName}
Primary Location: ${primaryCity}, ${state}
Primary Category: ${primaryCategory}
${directives}
Generate content for these service area pages (nearby cities we serve):
${areaList}

For EACH service area, provide:
1. meta_title: "[Primary Category] in [City], [State] | [Business Name]" (max 60 chars)
2. meta_description: Compelling description mentioning we serve this area (max 155 chars)
3. h1: Main heading emphasizing service in that city
4. body_copy: 1-2 paragraphs (150-250 words) explaining:
   - That ${businessName} proudly serves [City]
   - The services available to residents of [City]
   - Call to action to contact us

Format as JSON:
{
  "service_areas": [
    {
      "name": "City Name",
      "meta_title": "...",
      "meta_description": "...",
      "h1": "...",
      "body_copy": "..."
    }
  ]
}

Return ONLY valid JSON.`;

  const message = await withRetry((signal) =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal }
    )
  );

  const result = parseJsonResponse<{
    service_areas: {
      name: string;
      meta_title: string;
      meta_description: string;
      h1: string;
      body_copy: string;
    }[];
  }>(message);

  return result?.service_areas || [];
}

async function generateBrandPages(
  anthropic: Anthropic,
  businessName: string,
  city: string,
  state: string,
  primaryCategory: string,
  brands: { name: string; slug: string }[],
  directives: string = ''
) {
  const brandList = brands.map((b) => `- ${b.name}`).join('\n');

  const prompt = `You are an SEO expert generating unique brand-specific landing page content for a local service business.

Business: ${businessName}
Location: ${city}, ${state}
Industry/Category: ${primaryCategory}
${directives}
Generate unique, compelling content for each of these brand pages:
${brandList}

CRITICAL: Each brand MUST have genuinely different wording, tone, and selling points. Do NOT just swap the brand name into identical templates. Consider:
- Premium/luxury brands (Sub-Zero, Wolf, Viking, Miele, Thermador) → emphasize specialized expertise, factory training, genuine parts, warranty protection
- Popular brands (Samsung, LG, Whirlpool, GE, Frigidaire) → emphasize fast service, affordability, wide availability of parts, reliability
- Mid-tier brands (KitchenAid, Bosch, Maytag) → emphasize quality workmanship, value, trusted service

For EACH brand, provide ALL of these fields:
1. meta_title: SEO title (max 60 chars) — include brand name, service type, and city
2. meta_description: Compelling description with CTA (max 155 chars)
3. h1: Main hero heading — be creative, vary structure between brands (don't just use "[Brand] [Category] in [City]" for every one)
4. hero_description: 2-3 sentences below the H1 — unique value proposition for this specific brand. What makes ${businessName} the right choice for THIS brand?
5. body_copy: 1-2 paragraphs (150-300 words) for the "Why Choose Us" section — specific to this brand. Mention what sets this brand apart and why expert service matters.
6. value_props: 3-4 unique value propositions, each with a "title" (3-5 words) and "description" (1-2 sentences). VARY these between brands — not every brand should get "Experienced Technicians".
7. faqs: 3-5 brand-specific Q&A pairs. Include questions customers actually ask about this brand (e.g., repair costs, common issues, parts availability, warranty). Naturally mention typical repair cost ranges where relevant.
8. cta_heading: Action-oriented CTA heading — vary between brands
9. cta_description: 1-2 sentences encouraging contact — mention the brand and city

Format as JSON:
{
  "brands": [
    {
      "name": "Brand Name",
      "meta_title": "...",
      "meta_description": "...",
      "h1": "...",
      "hero_description": "...",
      "body_copy": "...",
      "value_props": [
        { "title": "...", "description": "..." }
      ],
      "faqs": [
        { "question": "...", "answer": "..." }
      ],
      "cta_heading": "...",
      "cta_description": "..."
    }
  ]
}

Return ONLY valid JSON.`;

  const message = await withRetry((signal) =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal }
    )
  );

  const result = parseJsonResponse<{
    brands: {
      name: string;
      meta_title: string;
      meta_description: string;
      h1: string;
      hero_description: string;
      body_copy: string;
      value_props: { title: string; description: string }[];
      faqs: { question: string; answer: string }[];
      cta_heading: string;
      cta_description: string;
    }[];
  }>(message);

  return result?.brands || [];
}

async function generateFAQPage(
  anthropic: Anthropic,
  businessName: string,
  city: string,
  state: string,
  primaryCategory: string,
  directives: string = ''
) {
  const prompt = `You are an SEO expert generating the FAQ hub page intro content for a local service business website.

Business: ${businessName}
Location: ${city}, ${state}
Primary Category: ${primaryCategory}
${directives}
This is NOT a page that contains full FAQ answers. It is a master FAQ index page that links to the individual service and brand pages where the full answers live.

Generate:
1. meta_title: SEO-optimized title like "FAQ | ${businessName} — ${city}, ${state}" (max 60 chars)
2. meta_description: Compelling description encouraging visitors to browse FAQs (max 155 chars)
3. h1: Main heading for the FAQ hub, like "Frequently Asked Questions" or "${primaryCategory} FAQ — ${businessName}"
4. hero_description: 1-2 sentence intro shown below the H1, mentioning the business, location, and that answers are organized by topic

Format as JSON:
{
  "meta_title": "...",
  "meta_description": "...",
  "h1": "...",
  "hero_description": "..."
}

Return ONLY valid JSON.`;

  const message = await withRetry((signal) =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal }
    )
  );

  return parseJsonResponse<{
    meta_title: string;
    meta_description: string;
    h1: string;
    hero_description: string;
  }>(message);
}

async function generateNeighborhoodPages(
  anthropic: Anthropic,
  businessName: string,
  primaryCity: string,
  state: string,
  primaryCategory: string,
  neighborhoods: { name: string; latitude: number | null; longitude: number | null }[],
  directives: string = ''
) {
  const neighborhoodList = neighborhoods
    .map((n) => {
      let entry = `- ${n.name}`;
      if (n.latitude && n.longitude) {
        entry += ` (lat: ${n.latitude}, lng: ${n.longitude})`;
      }
      return entry;
    })
    .join('\n');

  const prompt = `You are an SEO expert and local area researcher generating rich, neighborhood-specific content for a local service business website.

Business: ${businessName}
Primary Location: ${primaryCity}, ${state}
Primary Category: ${primaryCategory}
${directives}
Generate unique, locally-specific content for each of these neighborhoods:
${neighborhoodList}

IMPORTANT: Use your knowledge to include REAL, SPECIFIC local details about each neighborhood. Do NOT write generic filler. Include actual school names, real landmarks, parks, and accurate descriptions of the area's character. If you are unsure about specific details for a neighborhood, focus on the general area character and housing types typical for that part of ${primaryCity}.

For EACH neighborhood, provide ALL of these fields:
1. meta_title: "${primaryCategory} in [Neighborhood], ${primaryCity} | ${businessName}" (max 60 chars)
2. meta_description: Compelling description mentioning ${primaryCategory.toLowerCase()} services in this neighborhood (max 155 chars)
3. h1: Creative main heading — vary between neighborhoods (not just "${primaryCategory} in [Neighborhood]" for every one)
4. body_copy: 2-3 paragraphs (200-350 words) about:
   - The neighborhood's character and what makes it distinct
   - Why ${businessName} is a great fit for residents here
   - Specific services relevant to the types of homes/buildings in this area
   - Call to action
5. local_features: Object with:
   - landmarks: 2-3 notable landmarks, parks, or points of interest with brief descriptions (1 sentence each)
   - schools: 2-3 nearby schools (any level) with brief descriptions (1 sentence each)
   - housing: 1 paragraph about typical housing types and architectural character
   - community: 1 paragraph about the neighborhood's community character, local businesses, and vibe
   - why_choose_us: 4-6 reasons specific to THIS neighborhood (not generic — reference local factors like housing age, climate, proximity)
6. faqs: 3-4 questions and answers specific to this neighborhood (e.g., "How quickly can you reach [Neighborhood]?", "What ${primaryCategory.toLowerCase()} issues are common in [Neighborhood] homes?")

Format as JSON:
{
  "neighborhoods": [
    {
      "name": "Neighborhood Name",
      "meta_title": "...",
      "meta_description": "...",
      "h1": "...",
      "body_copy": "...",
      "local_features": {
        "landmarks": [{"name": "...", "description": "..."}],
        "schools": [{"name": "...", "description": "..."}],
        "housing": "...",
        "community": "...",
        "why_choose_us": ["...", "..."]
      },
      "faqs": [{"question": "...", "answer": "..."}]
    }
  ]
}

Return ONLY valid JSON.`;

  const message = await withRetry((signal) =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal }
    )
  );

  const result = parseJsonResponse<{
    neighborhoods: {
      name: string;
      meta_title: string;
      meta_description: string;
      h1: string;
      body_copy: string;
      local_features: {
        landmarks: { name: string; description: string }[];
        schools: { name: string; description: string }[];
        housing: string;
        community: string;
        why_choose_us: string[];
      };
      faqs: { question: string; answer: string }[];
    }[];
  }>(message);

  return result?.neighborhoods || [];
}
