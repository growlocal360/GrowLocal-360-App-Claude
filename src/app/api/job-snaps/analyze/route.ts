import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAnthropicClient, withRetry } from '@/lib/content/generators';
import type Anthropic from '@anthropic-ai/sdk';
import type { JobSnapAnalysisResult } from '@/lib/job-snaps/types';

/**
 * POST /api/job-snaps/analyze
 *
 * Accepts base64-encoded job photos + optional location context.
 * Returns AI-generated title, description, service type, brand, and image roles.
 */

// --- Request / Response types ---

interface AnalyzeImageInput {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileName: string;
}

interface AnalyzeLocationInput {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number | null;
  lng?: number | null;
}

interface AnalyzeRequest {
  images: AnalyzeImageInput[];
  location?: AnalyzeLocationInput;
  businessName?: string;
  businessCategory?: string;
}

export async function POST(request: Request) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as AnalyzeRequest;

    // Validate
    if (!body.images || body.images.length === 0) {
      return NextResponse.json(
        { error: 'At least one image is required' },
        { status: 400 }
      );
    }

    if (body.images.length > 4) {
      return NextResponse.json(
        { error: 'Maximum 4 images allowed' },
        { status: 400 }
      );
    }

    const anthropic = createAnthropicClient();

    // Build the location context string
    let locationContext = '';
    if (body.location) {
      const parts = [
        body.location.address,
        body.location.city,
        body.location.state,
        body.location.zip,
      ].filter(Boolean);
      if (parts.length > 0) {
        locationContext = `\nJob location: ${parts.join(', ')}`;
      }
    }

    // Build business context
    let businessContext = '';
    if (body.businessName) {
      businessContext += `\nBusiness: ${body.businessName}`;
    }
    if (body.businessCategory) {
      businessContext += `\nBusiness category: ${body.businessCategory}`;
    }

    // Build image content blocks for the API
    type ContentBlock = Anthropic.Messages.ContentBlockParam;
    const imageBlocks: ContentBlock[] = body.images.map((img) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        data: img.base64,
      },
    }));

    const systemPrompt = `You are a job documentation analyst for local service businesses. You analyze photos of completed work to generate structured job data.

Your output must be valid JSON matching this exact schema:
{
  "title": "string - SEO-friendly job title. Pattern: {Primary Item or Service} + {Action} + {Context}. Do NOT include exact house numbers. Use neighborhood, street name, or city instead. Examples: 'Washroom Dryer Removal for Home Remodel', 'Complete Kitchen Appliance Suite Removal for Condo Renovation', 'Garage Cleanout and Organization - Lake Charles Family Home'",
  "description": "string - 2-4 sentence readable summary. Describe what was done based on visual evidence. Be factual, no fake claims or excessive fluff. Reference the location context if available.",
  "serviceType": "string or null - The primary service category this job falls under. Examples: 'Appliance Removal', 'Garage Clean Out', 'Junk Removal', 'Demolition', 'Hauling'. Use null if unclear.",
  "brand": "string or null - Any product/equipment brand visibly identifiable in the images. Examples: 'Whirlpool', 'Samsung', 'GE'. Use null if no brand is confidently identifiable.",
  "confidence": {
    "service": "number 0-1 - How confident you are in the service type classification",
    "brand": "number 0-1 - How confident you are in the brand identification. 0 if no brand detected",
    "location": "number 0-1 - How well the images match the provided location context. 0 if no location context provided"
  },
  "imageRoles": [
    {
      "index": "number - 0-based index matching the image order provided",
      "role": "string - One of: 'primary' (best overall shot), 'before' (showing pre-work state), 'after' (showing completed work), 'process' (showing work in progress), 'detail' (close-up of specific item)"
    }
  ]
}

Rules:
- Analyze ALL images together to understand the full job story
- Look for before/after patterns, items being removed/installed, work in progress
- Be practical and specific in your title — this will be used on a website
- Description should read naturally and be based only on visual evidence
- Every image must have exactly one role assignment
- If you can see brand logos, labels, or model plates, identify them with high confidence
- If brand is uncertain, set brand to null and confidence.brand to 0
- Return ONLY the JSON object, no markdown or explanation`;

    const userPrompt = `Analyze these ${body.images.length} job photo${body.images.length > 1 ? 's' : ''} and generate structured job data.${businessContext}${locationContext}

Images are provided in order. Assign a role to each image based on what it shows.`;

    const result = await withRetry(async (signal) => {
      const response = await anthropic.messages.create(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                ...imageBlocks,
                { type: 'text' as const, text: userPrompt } as ContentBlock,
              ],
            },
          ],
        },
        { signal }
      );

      // Extract text content
      const textBlock = response.content.find(
        (block) => block.type === 'text'
      );
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from AI');
      }

      return textBlock.text;
    });

    // Parse the JSON response
    let analysis: JobSnapAnalysisResult;
    try {
      // Strip markdown code fences if present
      const cleaned = result
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', result);
      return NextResponse.json(
        { error: 'Failed to parse AI analysis result' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error('Job snap analysis failed:', error);
    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
