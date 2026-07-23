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
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/svg+xml';
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

    const systemPrompt = `You are a job documentation analyst for local service businesses. You analyze photos of completed work to generate structured job data that feeds a canonical SEO naming engine.

Your output must be valid JSON matching this exact schema:
{
  "title": "string - SEO-friendly job title. Pattern: {Primary Item or Service} + {Action} + {Context}. Do NOT include exact house numbers. Use neighborhood, street name, or city instead.",
  "description": "string - 2-4 sentence readable summary. Describe what was done based on visual evidence. Be factual, no fake claims or excessive fluff. Reference the location context if available. Do not overpromise outcomes.",
  "serviceType": "string - The primary service. ALWAYS provide your best inference — do NOT leave this null unless you truly cannot tell what kind of work this is. When a piece of equipment is involved, prefer a specific '{Equipment} Repair' (e.g., 'Washing Machine Repair', 'Dryer Repair', 'Water Heater Repair', 'Refrigerator Repair'). Otherwise use a broader category: 'Appliance Repair', 'HVAC Service', 'Tree Removal', 'Pressure Washing', 'Roofing', 'Plumbing', 'Junk Removal'.",
  "brand": "string or null - Equipment manufacturer visible in the photos (e.g., 'Whirlpool', 'Samsung', 'Bosch', 'Carrier', 'Trane'). NOT a customer's family or business name. Use null if no brand identifiable.",
  "equipmentType": "string or null - When the work involves a piece of equipment, name the equipment type only (e.g., 'Dryer', 'Condenser Unit', 'Water Heater', 'Roof', 'Garage Door'). For non-equipment services like tree removal or junk hauling, use null.",
  "primaryProblem": "string - REQUIRED. A short noun phrase describing the core issue or completed task in 2-5 words. This drives the SEO URL and title. Examples: 'drum roller replacement', 'storm damage cleanup', 'condenser replacement', 'no heat diagnosis', 'grinding noise', 'leak repair', 'mainline clog'. Use lowercase, no trailing punctuation.",
  "neighborhood": "string or null - If you can confidently infer a neighborhood, area name, or subdivision from the photos or the supplied location context, name it. Examples: 'Graywood', 'South Lake Charles'. Use null if not inferable.",
  "confidence": {
    "service": "number 0-1 - Confidence in service type",
    "brand": "number 0-1 - Confidence in brand identification (0 if none)",
    "location": "number 0-1 - How well the images match the provided location",
    "primaryProblem": "number 0-1 - Confidence in the primary_problem phrase"
  },
  "imageRoles": [
    {
      "index": "number - 0-based index",
      "role": "string - One of: 'primary', 'before', 'after', 'process', 'detail'"
    }
  ]
}

Rules:
- Analyze ALL images together to understand the full job story
- Look for before/after patterns, items being removed/installed, work in progress
- serviceType should almost never be null — infer the most likely service from the equipment and problem. When an appliance/equipment is involved, use "{Equipment} Repair" (e.g. a washing machine → "Washing Machine Repair")
- primaryProblem should be ACTION-oriented when work was completed (e.g., 'drum roller replacement', not just 'broken dryer')
- For diagnostic-only jobs, use diagnostic language ('no heat diagnosis', 'leak inspection')
- Be practical and specific in your title — it will be used on a website
- Every image must have exactly one role assignment
- If a brand logo, label, or model plate is visible, identify it with high confidence
- If brand is uncertain, set brand to null and confidence.brand to 0
- Do NOT include house numbers in any field
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
      const parsed = JSON.parse(cleaned);
      // Apply defaults so structured naming fields always have a value.
      analysis = {
        title: parsed.title ?? '',
        description: parsed.description ?? '',
        // Fallback: if the model still didn't commit to a service, derive one
        // from the equipment ("Washing Machine" → "Washing Machine Repair") so
        // the field is rarely empty for equipment-based work.
        serviceType:
          parsed.serviceType ??
          (parsed.equipmentType ? `${String(parsed.equipmentType).trim()} Repair` : null),
        serviceId: null,
        brand: parsed.brand ?? null,
        equipmentType: parsed.equipmentType ?? null,
        primaryProblem: parsed.primaryProblem ?? null,
        neighborhood: parsed.neighborhood ?? null,
        confidence: {
          service: parsed.confidence?.service ?? 0,
          brand: parsed.confidence?.brand ?? 0,
          location: parsed.confidence?.location ?? 0,
          primaryProblem: parsed.confidence?.primaryProblem ?? 0,
        },
        imageRoles: Array.isArray(parsed.imageRoles) ? parsed.imageRoles : [],
      };
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
