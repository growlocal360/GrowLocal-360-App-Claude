import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

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
    const supabase = await createClient();

    // Verify site exists and user has access
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get site with organization check
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select(
        `
        id,
        name,
        website_type,
        settings,
        status,
        organization:organizations!inner(
          id,
          organization_members!inner(user_id)
        )
      `
      )
      .eq('id', siteId)
      .eq('organization.organization_members.user_id', user.id)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Check if already building
    if (site.status === 'building') {
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

    // Update site status to building
    const initialProgress: SiteBuildProgress = {
      total_tasks: totalTasks,
      completed_tasks: 0,
      current_task: 'Initializing content generation...',
      started_at: new Date().toISOString(),
    };

    await supabase
      .from('sites')
      .update({
        status: 'building',
        build_progress: initialProgress,
        status_message: null,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', siteId);

    // Start content generation (runs in background)
    generateAllContent(
      siteId,
      site.name,
      site.website_type,
      primaryLocation,
      primaryCategory,
      services || [],
      serviceAreas || [],
      siteCategories || [],
      initialProgress
    ).catch((error) => {
      console.error('Background content generation failed:', error);
    });

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
  primaryLocation: { city: string; state: string },
  primaryCategory: { gbp_categories: { display_name: string } | { display_name: string }[] },
  services: { id: string; name: string; description: string | null; site_category_id: string }[],
  serviceAreas: { id: string; name: string; state: string | null }[],
  siteCategories: { id: string; is_primary: boolean; gbp_categories: { display_name: string } | { display_name: string }[] }[],
  progress: SiteBuildProgress
) {
  const { createStaticClient } = await import('@/lib/supabase/static');
  const supabase = createStaticClient();

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    await markFailed(supabase, siteId, 'API key not configured');
    return;
  }

  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const categoryName = Array.isArray(primaryCategory.gbp_categories)
    ? primaryCategory.gbp_categories[0]?.display_name || 'Services'
    : primaryCategory.gbp_categories?.display_name || 'Services';

  let completedTasks = 0;

  try {
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
          body_copy: page.body_copy,
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
          body_copy: categoryContent.body_copy,
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
                faqs: content.faqs,
              })
              .eq('id', service.id);
          }

          completedTasks++;
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
    await markFailed(
      supabase,
      siteId,
      error instanceof Error ? error.message : 'Unknown error'
    );
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
      ? `The home page should focus on "${primaryCategory}" in ${city}, ${state} since this is a single-location business.`
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
4. h2: Supporting subheading
5. body_copy: Appropriate content for each page type:
   - Home: 2-3 paragraphs introducing the business and primary services (300-500 words)
   - About: Company story, values, and why choose us (300-500 words)
   - Contact: Brief intro encouraging contact with mention of service area (100-200 words)

Format as JSON:
{
  "pages": [
    {
      "page_type": "home",
      "meta_title": "...",
      "meta_description": "...",
      "h1": "...",
      "h2": "...",
      "body_copy": "..."
    }
  ]
}

Return ONLY valid JSON.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const result = parseJsonResponse<{
    pages: {
      page_type: 'home' | 'about' | 'contact';
      meta_title: string;
      meta_description: string;
      h1: string;
      h2: string;
      body_copy: string;
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
Category: ${categoryName}${isPrimary ? ' (Primary)' : ''}

Generate content for this category page:
1. meta_title: "[Category Name] in [City], [State] | [Business Name]" (max 60 chars)
2. meta_description: Overview of services in this category with CTA (max 155 chars)
3. h1: Main heading for the category page
4. h2: Supporting subheading
5. body_copy: 2-3 paragraphs introducing this category of services (200-400 words)

Format as JSON:
{
  "meta_title": "...",
  "meta_description": "...",
  "h1": "...",
  "h2": "...",
  "body_copy": "..."
}

Return ONLY valid JSON.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const result = parseJsonResponse<{
    meta_title: string;
    meta_description: string;
    h1: string;
    h2: string;
    body_copy: string;
  }>(message);

  return result || { meta_title: '', meta_description: '', h1: '', h2: '', body_copy: '' };
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

  const prompt = `You are an SEO expert generating content for a local service business website.

Business: ${businessName}
Location: ${city}, ${state}
Category: ${categoryName}

Generate SEO-optimized content for these services:
${serviceList}

For EACH service, provide:
1. meta_title: Format as "[Service Name] in [City], [State] | [Business Name]" (max 60 chars total)
2. meta_description: Compelling description with call-to-action (max 155 chars)
3. h1: Main heading that includes the service and location naturally
4. body_copy: 2-3 paragraphs of helpful, SEO-friendly content (300-500 words total)
5. faqs: 3-5 common questions and detailed answers about this specific service

Format your response as JSON:
{
  "services": [
    {
      "name": "Service Name",
      "meta_title": "...",
      "meta_description": "...",
      "h1": "...",
      "body_copy": "...",
      "faqs": [
        { "question": "...", "answer": "..." }
      ]
    }
  ]
}

Return ONLY valid JSON.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const result = parseJsonResponse<{
    services: {
      name: string;
      meta_title: string;
      meta_description: string;
      h1: string;
      body_copy: string;
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

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

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
