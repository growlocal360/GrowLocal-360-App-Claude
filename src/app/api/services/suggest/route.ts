import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface CategoryInput {
  gcid: string;
  name: string;
}

interface ExistingService {
  name: string;
  categoryGcid: string;
}

interface ServiceSuggestion {
  name: string;
  description: string;
  categoryGcid: string;
  categoryName: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { categories, existingServices } = body as {
      categories: CategoryInput[];
      existingServices: ExistingService[];
    };

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json(
        { error: 'At least one category is required' },
        { status: 400 }
      );
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      // Return empty response if no API key - services will work without descriptions
      return NextResponse.json({
        descriptions: {},
        suggestions: [],
      });
    }

    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    // Build the prompt
    const categoryList = categories
      .map((c) => `- ${c.name} (ID: ${c.gcid})`)
      .join('\n');

    const existingServicesList = existingServices
      .map((s) => `- ${s.name}`)
      .join('\n');

    const prompt = `You are helping a local service business set up their website. They offer services in these categories:

${categoryList}

Their current services are:
${existingServicesList || '(none yet)'}

Please provide:

1. SEO-friendly descriptions (1-2 sentences) for each existing service. Focus on what the service includes and why customers need it.

2. Suggest 2-3 additional services for each category that are commonly offered but not in their list. Only suggest services that make sense for the specific business type.

Format your response as JSON:
{
  "descriptions": {
    "Service Name": "Description text here",
    ...
  },
  "suggestions": [
    {
      "name": "New Service Name",
      "description": "Description of this service",
      "categoryGcid": "gcid:category_name",
      "categoryName": "Category Display Name"
    },
    ...
  ]
}

Important:
- Keep descriptions concise and action-oriented
- Use local SEO language (e.g., "professional", "licensed", "same-day")
- Suggestions should be realistic services that complement existing ones
- Don't suggest services that overlap with existing ones
- Return ONLY the JSON, no other text`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
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
      return NextResponse.json({
        descriptions: {},
        suggestions: [],
      });
    }

    // Parse JSON response
    try {
      const responseText = textContent.text.trim();
      // Handle potential markdown code blocks
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          descriptions: result.descriptions || {},
          suggestions: result.suggestions || [],
        });
      }
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
    }

    return NextResponse.json({
      descriptions: {},
      suggestions: [],
    });
  } catch (error) {
    console.error('Error in services suggest API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
