import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Fetch site data (no org join needed — access already verified)
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, name, settings')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const adminSupabase = createAdminClient();

  // Fetch locations, service areas, and categories in parallel
  const [{ data: locations }, { data: serviceAreas }, { data: categories }] = await Promise.all([
    adminSupabase
      .from('locations')
      .select('city, state, address_line1')
      .eq('site_id', siteId)
      .order('is_primary', { ascending: false }),
    adminSupabase
      .from('service_areas')
      .select('name, state')
      .eq('site_id', siteId)
      .order('sort_order'),
    adminSupabase
      .from('site_categories')
      .select('gbp_category:gbp_categories(display_name)')
      .eq('site_id', siteId),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (site.settings || {}) as any;
  const coreIndustry = settings.core_industry || '';

  const primaryLocation = locations?.[0];
  if (!primaryLocation) {
    return NextResponse.json({ error: 'No locations found for this site' }, { status: 400 });
  }

  // Build category list
  const categoryNames = (categories || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any) => {
      const gbp = Array.isArray(c.gbp_category) ? c.gbp_category[0] : c.gbp_category;
      return gbp?.display_name;
    })
    .filter(Boolean);

  // Build location list
  const locationList = (locations || [])
    .map((l: { city: string; state: string; address_line1: string }) =>
      `${l.address_line1 ? l.address_line1 + ', ' : ''}${l.city}, ${l.state}`
    )
    .join('\n  - ');

  // Build service area list
  const areaList = (serviceAreas || [])
    .map((a: { name: string; state: string | null }) =>
      a.state ? `${a.name}, ${a.state}` : a.name
    )
    .join('\n  - ');

  const prompt = `You are a local SEO expert helping a service business create locally relevant content. Generate detailed local context information for this business.

Business: ${site.name}
${coreIndustry ? `Industry: ${coreIndustry}` : ''}
${categoryNames.length > 0 ? `Categories: ${categoryNames.join(', ')}` : ''}

Primary Location: ${primaryLocation.address_line1 ? primaryLocation.address_line1 + ', ' : ''}${primaryLocation.city}, ${primaryLocation.state}
${locations && locations.length > 1 ? `All Locations:\n  - ${locationList}` : ''}
${serviceAreas && serviceAreas.length > 0 ? `Service Areas:\n  - ${areaList}` : ''}

Write 3-5 paragraphs of local context covering:
- Geographic and regional context (area, climate, terrain features)
- Notable landmarks, neighborhoods, and points of interest in the service areas
- Regional factors that commonly affect ${coreIndustry || 'this type of'} services (weather patterns, housing styles, building codes, seasonal considerations)
- Community and cultural context relevant to the business

Important:
- Write in a factual, informative tone
- This text will be used as background context for AI content generation — it will NOT be displayed directly on the website
- Focus on details that would help a content writer create locally authentic, relevant content
- Reference specific cities and areas from the service area list
- Be specific and accurate — do not invent landmarks or details

Return ONLY the paragraphs of text, no JSON, no headings, no bullet points.`;

  try {
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
    }

    return NextResponse.json({ localDetails: textContent.text.trim() });
  } catch (error) {
    console.error('Error generating local details:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate local details' },
      { status: 500 }
    );
  }
}
