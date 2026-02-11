import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { waitUntil } from '@vercel/functions';
import Anthropic from '@anthropic-ai/sdk';
import { GBPClient, starRatingToNumber } from '@/lib/google/gbp-client';

// Vercel background function - up to 5 minutes
export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

interface SiteBuildProgress {
  total_tasks: number;
  completed_tasks: number;
  current_task: string;
  started_at: string;
}

/**
 * POST /api/sites/[siteId]/generate-content
 * Generates AI content for all services, service areas, and core pages.
 * Runs as a background function (up to 5 minutes).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  try {
    // Check for internal API key (used by webhook) or user session
    const internalKey = request.headers.get('x-internal-key');
    const isInternalCall = internalKey === process.env.INTERNAL_API_KEY;

    // Use admin client for internal calls (no user session), otherwise use server client
    const supabase = isInternalCall ? createAdminClient() : await createClient();

    let site;

    if (!isInternalCall) {
      // User call - verify ownership
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get user's profile to get their organization_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) {
        return NextResponse.json({ error: 'User has no organization' }, { status: 403 });
      }

      // Get site and verify it belongs to user's organization
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('id, name, website_type, settings, status, organization_id')
        .eq('id', siteId)
        .eq('organization_id', profile.organization_id)
        .single();

      if (siteError || !siteData) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      }
      site = siteData;
    } else {
      // Internal call from webhook - skip user auth
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('id, name, website_type, settings, status, organization_id')
        .eq('id', siteId)
        .single();

      if (siteError || !siteData) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      }
      site = siteData;
    }

    // Check if already building (skip for internal calls - they're triggering a fresh build)
    if (!isInternalCall && site.status === 'building') {
      return NextResponse.json(
        { error: 'Content generation already in progress' },
        { status: 409 }
      );
    }

    // Get all data needed for content generation
    const [
      { data: locations },
      { data: services },
      { data: serviceAreas },
      { data: siteCategories },
    ] = await Promise.all([
      supabase.from('locations').select('*').eq('site_id', siteId),
      supabase.from('services').select('*').eq('site_id', siteId),
      supabase.from('service_areas').select('*').eq('site_id', siteId),
      supabase
        .from('site_categories')
        .select('*, gbp_categories(*)')
        .eq('site_id', siteId),
    ]);

    const primaryLocation = locations?.find((l) => l.is_primary) || locations?.[0];
    const primaryCategory = siteCategories?.find((c) => c.is_primary);

    if (!primaryLocation || !primaryCategory) {
      return NextResponse.json(
        { error: 'Site missing required data (location or category)' },
        { status: 400 }
      );
    }

    // Calculate total tasks
    const serviceCount = services?.length || 0;
    const serviceAreaCount = serviceAreas?.length || 0;
    const categoryCount = siteCategories?.length || 0;
    const corePageCount = 3; // home, about, contact
    const totalTasks = serviceCount + serviceAreaCount + categoryCount + corePageCount;

    // Update build progress (keep site active if it already is — don't take it offline)
    const initialProgress: SiteBuildProgress = {
      total_tasks: totalTasks,
      completed_tasks: 0,
      current_task: 'Initializing content generation...',
      started_at: new Date().toISOString(),
    };

    const isAlreadyActive = site.status === 'active';
    const statusUpdate: Record<string, unknown> = {
      build_progress: initialProgress,
      status_message: null,
      status_updated_at: new Date().toISOString(),
    };
    if (!isAlreadyActive) {
      statusUpdate.status = 'building';
    }

    await supabase
      .from('sites')
      .update(statusUpdate)
      .eq('id', siteId);

    // Capture Google access token for review fetching (only available during user session)
    let googleAccessToken: string | null = null;
    if (!isInternalCall) {
      const { data: { session } } = await supabase.auth.getSession();
      googleAccessToken = session?.provider_token || null;
    }

    // Start content generation in background using waitUntil
    // This keeps the function alive after returning the response
    waitUntil(
      generateAllContent(
        siteId,
        site.name,
        site.website_type,
        site.settings,
        primaryLocation,
        primaryCategory,
        services || [],
        serviceAreas || [],
        siteCategories || [],
        initialProgress,
        googleAccessToken,
        isAlreadyActive
      ).catch((error) => {
        console.error('Background content generation failed:', error);
      })
    );

    // Return immediately with 202 Accepted
    return NextResponse.json(
      {
        status: 'started',
        message: 'Content generation started in background',
        total_tasks: totalTasks,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error starting content generation:', error);
    return NextResponse.json(
      { error: 'Failed to start content generation' },
      { status: 500 }
    );
  }
}

/**
 * Background function that generates all content for a site.
 * Updates progress in the database as it goes.
 */
async function generateAllContent(
  siteId: string,
  businessName: string,
  websiteType: string,
  siteSettings: Record<string, unknown> | null,
  primaryLocation: { id: string; city: string; state: string; gbp_account_id?: string | null; gbp_location_id?: string | null },
  primaryCategory: { gbp_categories: { display_name: string } | { display_name: string }[] },
  services: { id: string; name: string; description: string | null; site_category_id: string }[],
  serviceAreas: { id: string; name: string; state: string | null }[],
  siteCategories: { id: string; is_primary: boolean; gbp_categories: { display_name: string } | { display_name: string }[] }[],
  progress: SiteBuildProgress,
  googleAccessToken: string | null,
  wasAlreadyActive: boolean = false
) {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    if (!wasAlreadyActive) {
      await markFailed(supabase, siteId, 'API key not configured');
    }
    return;
  }

  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const categoryName = Array.isArray(primaryCategory.gbp_categories)
    ? primaryCategory.gbp_categories[0]?.display_name || 'Services'
    : primaryCategory.gbp_categories?.display_name || 'Services';

  let completedTasks = 0;

  try {
    // 0. Fetch Google Reviews (non-fatal — continues if this fails)
    if (googleAccessToken && primaryLocation.gbp_account_id && primaryLocation.gbp_location_id) {
      try {
        await updateProgress(supabase, siteId, progress, completedTasks, 'Fetching Google Reviews...');
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
            author_name: r.reviewer.isAnonymous ? 'Anonymous' : (r.reviewer.displayName || 'Customer'),
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

          console.log(`Fetched ${reviewsResponse.reviews.length} Google Reviews for site ${siteId}`);
        }

        // Store average rating + total count in site settings
        if (reviewsResponse.averageRating) {
          await supabase
            .from('sites')
            .update({
              settings: {
                ...(siteSettings || {}),
                google_average_rating: reviewsResponse.averageRating,
                google_total_reviews: reviewsResponse.totalReviewCount || 0,
              },
            })
            .eq('id', siteId);
        }
      } catch (reviewError) {
        console.error('Failed to fetch Google Reviews (non-fatal):', reviewError);
        // Continue with content generation — reviews are optional
      }
    }

    // 1. Generate core pages (home, about, contact)
    await updateProgress(supabase, siteId, progress, completedTasks, 'Generating home page...');

    const coreContent = await generateCorePages(
      anthropic,
      businessName,
      primaryLocation.city,
      primaryLocation.state,
      categoryName,
      websiteType
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
      completedTasks++;
      await updateProgress(
        supabase,
        siteId,
        progress,
        completedTasks,
        `Generated ${page.page_type} page`
      );
    }

    // 2. Generate category pages
    for (const category of siteCategories) {
      const catName = Array.isArray(category.gbp_categories)
        ? category.gbp_categories[0]?.display_name || 'Services'
        : category.gbp_categories?.display_name || 'Services';

      await updateProgress(
        supabase,
        siteId,
        progress,
        completedTasks,
        `Generating ${catName} category page...`
      );

      const categoryContent = await generateCategoryPage(
        anthropic,
        businessName,
        primaryLocation.city,
        primaryLocation.state,
        catName,
        category.is_primary
      );

      const catSlug = catName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

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

      completedTasks++;
    }

    // 3. Generate service pages (batch by category for efficiency)
    const servicesBySiteCategory = new Map<string, typeof services>();
    for (const service of services) {
      const key = service.site_category_id || 'uncategorized';
      if (!servicesBySiteCategory.has(key)) {
        servicesBySiteCategory.set(key, []);
      }
      servicesBySiteCategory.get(key)!.push(service);
    }

    for (const [siteCategoryId, categoryServices] of servicesBySiteCategory) {
      const siteCat = siteCategories.find((c) => c.id === siteCategoryId);
      const catNameForServices = siteCat
        ? Array.isArray(siteCat.gbp_categories)
          ? siteCat.gbp_categories[0]?.display_name || 'Services'
          : siteCat.gbp_categories?.display_name || 'Services'
        : 'Services';

      // Process services in batches of 5 to avoid timeouts
      const batchSize = 5;
      for (let i = 0; i < categoryServices.length; i += batchSize) {
        const batch = categoryServices.slice(i, i + batchSize);

        await updateProgress(
          supabase,
          siteId,
          progress,
          completedTasks,
          `Generating ${batch[0].name} and ${batch.length - 1} more services...`
        );

        try {
          const serviceContents = await generateServicePages(
            anthropic,
            businessName,
            primaryLocation.city,
            primaryLocation.state,
            catNameForServices,
            batch.map((s) => ({ name: s.name, description: s.description || '' }))
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

            completedTasks++;
          }
        } catch (batchError) {
          console.error(`Failed to generate service batch starting at ${batch[0].name}:`, batchError);
          completedTasks += batch.length;
        }
      }
    }

    // 4. Generate service area pages (batch for efficiency)
    const areasBatchSize = 10;
    for (let i = 0; i < serviceAreas.length; i += areasBatchSize) {
      const batch = serviceAreas.slice(i, i + areasBatchSize);

      await updateProgress(
        supabase,
        siteId,
        progress,
        completedTasks,
        `Generating ${batch[0].name} service area page...`
      );

      try {
        const areaContents = await generateServiceAreaPages(
          anthropic,
          businessName,
          primaryLocation.city,
          primaryLocation.state,
          categoryName,
          batch.map((a) => ({ name: a.name, state: a.state || primaryLocation.state }))
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

          completedTasks++;
        }
      } catch (batchError) {
        console.error(`Failed to generate service area batch starting at ${batch[0].name}:`, batchError);
        completedTasks += batch.length;
      }
    }

    // Mark as complete
    await supabase
      .from('sites')
      .update({
        status: 'active',
        build_progress: {
          ...progress,
          completed_tasks: completedTasks,
          current_task: 'Complete',
        },
        status_message: null,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', siteId);

    console.log(`Content generation complete for site ${siteId}`);
  } catch (error) {
    console.error(`Content generation failed for site ${siteId}:`, error);
    if (wasAlreadyActive) {
      // Don't take an active site offline — just log the error and clear build progress
      await supabase
        .from('sites')
        .update({
          build_progress: null,
          status_message: `Content regeneration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', siteId);
    } else {
      await markFailed(
        supabase,
        siteId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}

async function updateProgress(
  supabase: ReturnType<typeof import('@/lib/supabase/static').createStaticClient>,
  siteId: string,
  progress: SiteBuildProgress,
  completedTasks: number,
  currentTask: string
) {
  await supabase
    .from('sites')
    .update({
      build_progress: {
        ...progress,
        completed_tasks: completedTasks,
        current_task: currentTask,
      },
      status_updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);
}

async function markFailed(
  supabase: ReturnType<typeof import('@/lib/supabase/static').createStaticClient>,
  siteId: string,
  message: string
) {
  await supabase
    .from('sites')
    .update({
      status: 'failed',
      status_message: message,
      status_updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);
}

// Content generation functions

async function generateCorePages(
  anthropic: Anthropic,
  businessName: string,
  city: string,
  state: string,
  primaryCategory: string,
  websiteType: string
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

  const message = await withRetry(() =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: 120_000 }
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
  isPrimary: boolean
) {
  const prompt = `You are an SEO expert generating a category page for a local service business.

Business: ${businessName}
Location: ${city}, ${state}
Category: ${categoryName}${isPrimary ? ' (Primary — this is also the home page for single-location sites)' : ''}

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

  const message = await withRetry(() =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: 120_000 }
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

  return result || { meta_title: '', meta_description: '', h1: '', h2: '', hero_description: '', body_copy: '', body_copy_2: '' };
}

async function generateServicePages(
  anthropic: Anthropic,
  businessName: string,
  city: string,
  state: string,
  categoryName: string,
  services: { name: string; description: string }[]
) {
  const serviceList = services.map((s) => `- ${s.name}: ${s.description || 'No description'}`).join('\n');

  const prompt = `You are an SEO expert generating rich, structured content for a local service business website.

Business: ${businessName}
Location: ${city}, ${state}
Category: ${categoryName}

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

  const message = await withRetry(() =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: 120_000 }
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
  serviceAreas: { name: string; state: string }[]
) {
  const areaList = serviceAreas.map((a) => `- ${a.name}, ${a.state}`).join('\n');

  const prompt = `You are an SEO expert generating service area page content for a local service business.

Business: ${businessName}
Primary Location: ${primaryCity}, ${state}
Primary Category: ${primaryCategory}

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

  const message = await withRetry(() =>
    anthropic.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: 120_000 }
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

async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`API call failed, retrying (attempt ${attempt + 1}):`, error);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Unreachable');
}

function parseJsonResponse<T>(message: Anthropic.Message): T | null {
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return null;
  }

  try {
    const responseText = textContent.text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
  } catch (parseError) {
    console.error('Failed to parse LLM response:', parseError);
  }

  return null;
}
