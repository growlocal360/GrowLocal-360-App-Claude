import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Request types
interface ServiceInput {
  name: string;
  description: string;
}

interface CategoryInput {
  name: string;
  isPrimary: boolean;
}

interface GenerateServicesRequest {
  type: 'services';
  businessName: string;
  city: string;
  state: string;
  categoryName: string;
  services: ServiceInput[];
}

interface GenerateCategoriesRequest {
  type: 'categories';
  businessName: string;
  city: string;
  state: string;
  categories: CategoryInput[];
}

interface GenerateCoreRequest {
  type: 'core';
  businessName: string;
  city: string;
  state: string;
  primaryCategory: string;
  websiteType: 'single_location' | 'multi_location' | 'microsite';
}

interface GenerateServiceAreasRequest {
  type: 'service_areas';
  businessName: string;
  primaryCity: string;
  state: string;
  primaryCategory: string;
  serviceAreas: { name: string; state?: string }[];
}

type GenerateContentRequest =
  | GenerateServicesRequest
  | GenerateCategoriesRequest
  | GenerateCoreRequest
  | GenerateServiceAreasRequest;

// Response types
interface ServiceContent {
  name: string;
  meta_title: string;
  meta_description: string;
  h1: string;
  h2: string;
  body_copy: string;
  faqs: { question: string; answer: string }[];
}

interface CategoryContent {
  name: string;
  meta_title: string;
  meta_description: string;
  h1: string;
  h2: string;
  body_copy: string;
}

interface CorePageContent {
  page_type: 'home' | 'about' | 'contact';
  meta_title: string;
  meta_description: string;
  h1: string;
  h2: string;
  body_copy: string;
}

interface ServiceAreaContent {
  name: string;
  meta_title: string;
  meta_description: string;
  h1: string;
  body_copy: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateContentRequest;

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    switch (body.type) {
      case 'services':
        return await generateServiceContent(anthropic, body);
      case 'categories':
        return await generateCategoryContent(anthropic, body);
      case 'core':
        return await generateCoreContent(anthropic, body);
      case 'service_areas':
        return await generateServiceAreaContent(anthropic, body);
      default:
        return NextResponse.json(
          { error: 'Invalid content type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in content generation API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate content' },
      { status: 500 }
    );
  }
}

async function generateServiceContent(
  anthropic: Anthropic,
  req: GenerateServicesRequest
): Promise<NextResponse> {
  const serviceList = req.services
    .map((s) => `- ${s.name}: ${s.description || 'No description'}`)
    .join('\n');

  const prompt = `You are an SEO expert generating content for a local service business website.

Business: ${req.businessName}
Location: ${req.city}, ${req.state}
Category: ${req.categoryName}

Generate SEO-optimized content for these services:
${serviceList}

For EACH service, provide:
1. meta_title: Format as "[Service Name] in [City], [State] | [Business Name]" (max 60 chars total)
2. meta_description: Compelling description with call-to-action (max 155 chars)
3. h1: Main heading that includes the service and location naturally
4. h2: Supporting subheading that adds value
5. body_copy: 2-3 paragraphs of helpful, SEO-friendly content (300-500 words total). Include:
   - What the problem/service is
   - How ${req.businessName} solves it
   - Why choose this business
   - Brief mention of the service area
6. faqs: 3-5 common questions and detailed answers about this specific service. Each answer should be 2-4 sentences.

Format your response as JSON:
{
  "services": [
    {
      "name": "Service Name",
      "meta_title": "...",
      "meta_description": "...",
      "h1": "...",
      "h2": "...",
      "body_copy": "...",
      "faqs": [
        { "question": "...", "answer": "..." }
      ]
    }
  ]
}

Important:
- Make each service's content unique and specific to that service
- Write in a professional but approachable tone
- Include relevant local keywords naturally
- FAQs should answer real questions customers would ask
- Return ONLY valid JSON, no markdown or other text`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const result = parseJsonResponse<{ services: ServiceContent[] }>(message);
  if (!result) {
    return NextResponse.json(
      { error: 'Failed to parse response' },
      { status: 500 }
    );
  }

  return NextResponse.json({ services: result.services || [] });
}

async function generateCategoryContent(
  anthropic: Anthropic,
  req: GenerateCategoriesRequest
): Promise<NextResponse> {
  const categoryList = req.categories
    .map((c) => `- ${c.name}${c.isPrimary ? ' (Primary)' : ''}`)
    .join('\n');

  const prompt = `You are an SEO expert generating category page content for a local service business.

Business: ${req.businessName}
Location: ${req.city}, ${req.state}

Generate content for these service category pages:
${categoryList}

For EACH category, provide:
1. meta_title: "[Category Name] in [City], [State] | [Business Name]" (max 60 chars)
2. meta_description: Overview of services in this category with CTA (max 155 chars)
3. h1: Main heading for the category page
4. h2: Supporting subheading
5. body_copy: 2-3 paragraphs introducing this category of services (200-400 words). Explain:
   - What services fall under this category
   - Why ${req.businessName} excels in this area
   - The value provided to customers

Format as JSON:
{
  "categories": [
    {
      "name": "Category Name",
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

  const result = parseJsonResponse<{ categories: CategoryContent[] }>(message);
  if (!result) {
    return NextResponse.json(
      { error: 'Failed to parse response' },
      { status: 500 }
    );
  }

  return NextResponse.json({ categories: result.categories || [] });
}

async function generateCoreContent(
  anthropic: Anthropic,
  req: GenerateCoreRequest
): Promise<NextResponse> {
  const homePageFocus =
    req.websiteType === 'single_location'
      ? `The home page should focus on "${req.primaryCategory}" in ${req.city}, ${req.state} since this is a single-location business.`
      : `The home page should be brand-focused for ${req.businessName} since this is a multi-location business.`;

  const prompt = `You are an SEO expert generating core page content for a local service business website.

Business: ${req.businessName}
Location: ${req.city}, ${req.state}
Primary Category: ${req.primaryCategory}
Website Type: ${req.websiteType}

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
    },
    {
      "page_type": "about",
      ...
    },
    {
      "page_type": "contact",
      ...
    }
  ]
}

Return ONLY valid JSON.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const result = parseJsonResponse<{ pages: CorePageContent[] }>(message);
  if (!result) {
    return NextResponse.json(
      { error: 'Failed to parse response' },
      { status: 500 }
    );
  }

  return NextResponse.json({ pages: result.pages || [] });
}

async function generateServiceAreaContent(
  anthropic: Anthropic,
  req: GenerateServiceAreasRequest
): Promise<NextResponse> {
  const areaList = req.serviceAreas
    .map((a) => `- ${a.name}${a.state ? `, ${a.state}` : ''}`)
    .join('\n');

  const prompt = `You are an SEO expert generating service area page content for a local service business.

Business: ${req.businessName}
Primary Location: ${req.primaryCity}, ${req.state}
Primary Category: ${req.primaryCategory}

Generate content for these service area pages (nearby cities we serve):
${areaList}

For EACH service area, provide:
1. meta_title: "[Primary Category] in [City], [State] | [Business Name]" (max 60 chars)
2. meta_description: Compelling description mentioning we serve this area (max 155 chars)
3. h1: Main heading emphasizing service in that city
4. body_copy: 1-2 paragraphs (150-250 words) explaining:
   - That ${req.businessName} proudly serves [City]
   - The services available to residents of [City]
   - How close/convenient it is from our primary location
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

  const result = parseJsonResponse<{ service_areas: ServiceAreaContent[] }>(message);
  if (!result) {
    return NextResponse.json(
      { error: 'Failed to parse response' },
      { status: 500 }
    );
  }

  return NextResponse.json({ service_areas: result.service_areas || [] });
}

function parseJsonResponse<T>(message: Anthropic.Message): T | null {
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return null;
  }

  try {
    const responseText = textContent.text.trim();
    // Handle potential markdown code blocks
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
  } catch (parseError) {
    console.error('Failed to parse LLM response:', parseError);
  }

  return null;
}
