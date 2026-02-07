import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

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

const BATCH_SIZE = 3;

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

    // Batch categories into groups of 3 for parallel calls
    const batches: CategoryInput[][] = [];
    for (let i = 0; i < categories.length; i += BATCH_SIZE) {
      batches.push(categories.slice(i, i + BATCH_SIZE));
    }

    // Run all batches in parallel
    const batchResults = await Promise.all(
      batches.map(async (batch) => {
        try {
          return await generateServicesForBatch(anthropic, batch, servicesPerCategory);
        } catch (error) {
          console.error('Batch failed for categories:', batch.map(c => c.name).join(', '), error);
          return [];
        }
      })
    );

    const allServices = batchResults.flat();

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

  const prompt = `You are an SEO expert helping a local service business create service pages for their website. They operate in these Google Business Profile categories:

${categoryList}

For EACH category, generate exactly ${servicesPerCategory} granular, problem-based sub-services that:
1. Represent specific problems/symptoms customers actually search for (e.g., "AC Not Cooling" instead of generic "AC Repair")
2. Would make excellent individual service pages for local SEO
3. Include a mix of:
   - Emergency services (e.g., "Emergency AC Repair")
   - Common symptoms/problems (e.g., "AC Not Turning On", "Refrigerant Leak")
   - Specific repairs (e.g., "Compressor Repair", "Capacitor Replacement")
   - Preventive services (e.g., "AC Tune-Up", "Annual Maintenance")

For each service, provide a 1-2 sentence SEO-friendly description that:
- Explains what the problem is and how you solve it
- Uses action-oriented language
- Mentions urgency or expertise where appropriate

Format your response as JSON:
{
  "services": [
    {
      "name": "AC Not Cooling",
      "description": "Is your AC running but not cooling your home? Our certified technicians diagnose and fix cooling issues fast, from refrigerant leaks to compressor problems.",
      "categoryGcid": "gcid:air_conditioning_repair_service",
      "categoryName": "Air Conditioning Repair Service"
    },
    ...
  ]
}

Important:
- Generate exactly ${servicesPerCategory} services PER category
- Make service names concise but descriptive (3-5 words max)
- Avoid generic names like "AC Repair" - be specific about the problem or service
- Each service should be distinct enough to warrant its own page
- Return ONLY the JSON, no other text`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
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
