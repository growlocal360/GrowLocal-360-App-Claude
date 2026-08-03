import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { industry, categories } = body as {
      industry: string;
      categories: string[];
    };

    if (!industry || typeof industry !== 'string') {
      return NextResponse.json(
        { error: 'industry is required' },
        { status: 400 }
      );
    }

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

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    const categoryList = categories.join(', ');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `For a ${industry} business with these Google Business Profile categories: ${categoryList}

List the top product/equipment brands they commonly service, repair, install, or work with. These should be well-known manufacturer brands that customers would search for (e.g., "Carrier", "Lennox", "Samsung", "LG").

CRITICAL — balanced coverage: the categories above may span DIFFERENT niches (e.g. HVAC/heating/AC AND appliance repair). You MUST cover EVERY category, not just the primary one. For each distinct niche include roughly 8-12 of its top brands — e.g. an HVAC + appliance repair business needs BOTH HVAC brands (Carrier, Trane, Lennox, Goodman, Rheem…) AND appliance brands (Whirlpool, GE, Maytag, Frigidaire, KitchenAid, Bosch, Samsung, LG…). Do NOT return mostly one niche's brands. Return up to ~24 brands total.

For EACH brand, also assign the single best-fit category from this exact list: ${categoryList}. Use the category's exact wording. If a brand genuinely spans MULTIPLE of those categories (e.g. GE, LG, and Samsung make both HVAC systems and home appliances), set its category to "both" instead.

Return ONLY a JSON object in this exact format, no other text:
{
  "brands": [
    { "name": "Brand Name", "category": "Exact Category Name or both" }
  ]
}`,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ brands: [] });
    }

    const responseText = textContent.text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ brands: result.brands || [] });
    }

    return NextResponse.json({ brands: [] });
  } catch (error) {
    console.error('Error in brands suggest API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
