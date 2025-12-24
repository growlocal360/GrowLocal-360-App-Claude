import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface NeighborhoodSuggestion {
  id: string;
  name: string;
  placeId: string;
  latitude: number;
  longitude: number;
  locationId: string;
}

interface LocationInput {
  id: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locations } = body as { locations: LocationInput[] };

    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return NextResponse.json(
        { error: 'At least one location is required' },
        { status: 400 }
      );
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    const allNeighborhoods: NeighborhoodSuggestion[] = [];
    const seenNames = new Set<string>();

    for (const location of locations) {
      if (!location.city || !location.state) continue;

      const locationId = location.id || `loc-${location.city}`;
      const { city, state, latitude, longitude } = location;

      // Ask Claude for neighborhoods in this city
      const prompt = `List the major neighborhoods, districts, and local areas within ${city}, ${state}.

These should be actual neighborhoods WITHIN the city limits - NOT nearby towns or cities.

For each neighborhood, provide:
1. The official/common name
2. A brief description (1 sentence)

Format your response as a JSON array like this:
[
  {"name": "Downtown", "description": "The central business district"},
  {"name": "Westside", "description": "Residential area west of downtown"}
]

Only include actual neighborhoods, subdivisions, districts, or local areas that are PART OF ${city}.
Do NOT include:
- Nearby cities or towns
- Counties
- Regions
- Areas outside the city limits

If you're not confident about neighborhoods in this city, return a smaller list of only the ones you're certain about.
Return ONLY the JSON array, no other text.`;

      try {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        // Extract the text content from the response
        const textContent = message.content.find((block) => block.type === 'text');
        if (!textContent || textContent.type !== 'text') continue;

        const responseText = textContent.text.trim();

        // Parse the JSON response
        let neighborhoods: { name: string; description: string }[] = [];
        try {
          // Handle potential markdown code blocks
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            neighborhoods = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error('Failed to parse LLM response:', parseError);
          continue;
        }

        // Convert to our format
        for (const hood of neighborhoods) {
          const normalizedName = hood.name.toLowerCase().trim();

          // Skip if we've already seen this name
          if (seenNames.has(normalizedName)) continue;

          // Skip if it matches the city name
          if (normalizedName === city.toLowerCase().trim()) continue;

          seenNames.add(normalizedName);

          // Generate a unique ID based on the name
          const id = `llm-${city.toLowerCase().replace(/\s+/g, '-')}-${hood.name.toLowerCase().replace(/\s+/g, '-')}`;

          allNeighborhoods.push({
            id,
            name: hood.name,
            placeId: id, // Use the same ID since we don't have Google Place IDs
            latitude: latitude || 0,
            longitude: longitude || 0,
            locationId,
          });
        }
      } catch (llmError) {
        console.error('LLM error for', city, ':', llmError);
        continue;
      }
    }

    // Sort alphabetically
    const sortedNeighborhoods = allNeighborhoods.sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      neighborhoods: sortedNeighborhoods,
      source: 'llm'
    });
  } catch (error) {
    console.error('Error fetching neighborhoods from LLM:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch neighborhoods' },
      { status: 500 }
    );
  }
}
