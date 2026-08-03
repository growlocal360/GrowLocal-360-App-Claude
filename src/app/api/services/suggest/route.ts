import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { dedupeGeneratedServices } from '@/lib/services/service-dedupe';

export const maxDuration = 60;

interface CategoryInput {
  gcid: string;
  name: string;
}

interface GeneratedService {
  name: string;
  description: string;
  categoryGcid: string;
  categoryName: string;
}

// Tier the number of sub-services based on total category count
function getServicesPerCategory(totalCategories: number): number {
  if (totalCategories <= 1) return 20;
  if (totalCategories === 2) return 10;
  if (totalCategories === 3) return 8;
  if (totalCategories <= 5) return 6;
  if (totalCategories <= 8) return 5;
  return 4;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { categories } = body as {
      categories: CategoryInput[];
    };

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json(
        { error: 'At least one category is required' },
        { status: 400 }
      );
    }

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

    const servicesPerCategory = getServicesPerCategory(categories.length);

    // Single pass with ALL categories in context so the model can assign each
    // distinct service to exactly one best-fit category (avoids duplicates that
    // per-category batching produced for overlapping GBP categories).
    const generated = await generateServicesForBatch(anthropic, categories, servicesPerCategory);

    // Deterministic safety net: strip any service that still repeats across
    // categories (exact + suffix near-dupes), keeping the best-fit copy.
    const categoryNameById = Object.fromEntries(categories.map((c) => [c.gcid, c.name]));
    const allServices = dedupeGeneratedServices(generated, {
      primaryGcid: categories[0]?.gcid,
      categoryNameById,
    });

    return NextResponse.json({ services: allServices });
  } catch (error) {
    console.error('Error in services suggest API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

async function generateServicesForBatch(
  anthropic: Anthropic,
  categories: CategoryInput[],
  servicesPerCategory: number
): Promise<GeneratedService[]> {
  const categoryList = categories
    .map((c) => `- ${c.name} (ID: ${c.gcid})`)
    .join('\n');

  const prompt = `You are an SEO expert generating service pages for a local business website that must rank in Google Maps and the Local 3-Pack. They operate in these Google Business Profile categories:

${categoryList}

For EACH category, generate up to ${servicesPerCategory} deliverable-based service pages.

CRITICAL RULES:
1. Service names MUST represent real services/deliverables the business offers — things they DO or DELIVER.
2. Each service name must use clear, industry-standard language that could realistically appear as a Google Business Profile service.
3. DO NOT name service pages after problems, symptoms, pain points, or emergency language.
4. NO DUPLICATES ACROSS CATEGORIES. These categories often overlap (e.g. "Air conditioning repair service" + "Air conditioning contractor" + "HVAC contractor", or "Plumber" + "Drain cleaning service"). Each distinct service must appear under EXACTLY ONE category — never repeat a service, and never emit near-synonyms of the same service under different names (e.g. do NOT produce both "Indoor Air Quality Services" and "Indoor Air Quality Solutions", or both "Smart Thermostat Installation" and "Thermostat Installation & Upgrade").
5. BEST-FIT PLACEMENT (generic across trades): put repair/maintenance-type services under the "…repair service" categories; installation/replacement-type services under the "…contractor" categories; and whole-system services (e.g. ductwork, thermostats, indoor air quality, zoning) under the BROADEST applicable category (e.g. "HVAC contractor") rather than an equipment-specific one.

VALID service name examples:
- "Logo Design & Branding" (a deliverable)
- "Custom Business Signage" (a deliverable)
- "Vehicle Wraps & Fleet Graphics" (a deliverable)
- "AC Installation & Replacement" (a service)
- "Drain Cleaning & Hydro Jetting" (a service)

INVALID service name examples (DO NOT USE):
- "Logo Not Converting Customers" (a problem)
- "LED Sign Not Working" (a symptom)
- "Emergency Sign Repair" (emergency language)
- "AC Not Cooling" (a symptom)
- "No Online Leads Generated" (a pain point)

For each service, provide a 1-2 sentence SEO-friendly description that:
- Explains what the service delivers and who it's for
- May reference common problems this service solves (problems belong in descriptions, NOT in service names)
- Uses action-oriented, professional language

Format your response as JSON:
{
  "services": [
    {
      "name": "Logo Design & Branding",
      "description": "Professional logo design and brand identity packages that help your business stand out. From concept to final files, we create memorable logos that build customer trust and recognition.",
      "categoryGcid": "gcid:graphic_designer",
      "categoryName": "Graphic designer"
    },
    ...
  ]
}

Important:
- Aim for about ${servicesPerCategory} services per category, but prioritise UNIQUENESS over hitting the count — a service belongs to one category only
- Service names should be 3-6 words using industry-standard terminology
- Each service must be a distinct deliverable worthy of its own page
- Problems and symptoms go in descriptions ONLY, never in service names
- Return ONLY the JSON, no other text`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract text content
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return [];
  }

  // Parse JSON response
  const responseText = textContent.text.trim();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const result = JSON.parse(jsonMatch[0]);
    return result.services || [];
  }

  return [];
}
