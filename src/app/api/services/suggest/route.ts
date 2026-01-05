import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCategoryByGcid } from '@/data/gbp-categories';

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
      // Fall back to hardcoded commonServices if no API key
      const fallbackServices: GeneratedService[] = [];
      for (const category of categories) {
        const fullCategory = getCategoryByGcid(category.gcid);
        if (fullCategory?.commonServices) {
          for (const serviceName of fullCategory.commonServices) {
            fallbackServices.push({
              name: serviceName,
              description: '',
              categoryGcid: category.gcid,
              categoryName: category.name,
            });
          }
        }
      }
      return NextResponse.json({ services: fallbackServices });
    }

    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    // Build the prompt for granular, problem-based sub-services
    const categoryList = categories
      .map((c) => `- ${c.name} (ID: ${c.gcid})`)
      .join('\n');

    const prompt = `You are an SEO expert helping a local service business create service pages for their website. They operate in these Google Business Profile categories:

${categoryList}

For EACH category, generate 6-8 granular, problem-based sub-services that:
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
- Generate 6-8 services PER category
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
      // Fall back to hardcoded services
      return NextResponse.json({ services: getFallbackServices(categories) });
    }

    // Parse JSON response
    try {
      const responseText = textContent.text.trim();
      // Handle potential markdown code blocks
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          services: result.services || [],
        });
      }
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
    }

    // Fall back to hardcoded services on parse failure
    return NextResponse.json({ services: getFallbackServices(categories) });
  } catch (error) {
    console.error('Error in services suggest API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

// Fallback to hardcoded commonServices from gbp-categories.ts
function getFallbackServices(categories: CategoryInput[]): GeneratedService[] {
  const services: GeneratedService[] = [];
  for (const category of categories) {
    const fullCategory = getCategoryByGcid(category.gcid);
    if (fullCategory?.commonServices) {
      for (const serviceName of fullCategory.commonServices) {
        services.push({
          name: serviceName,
          description: '',
          categoryGcid: category.gcid,
          categoryName: category.name,
        });
      }
    }
  }
  return services;
}
