import Anthropic from '@anthropic-ai/sdk';
import { withRetry, parseJsonResponse } from './generators';
import type { ImagePrompt, SiteSettings } from '@/types/database';

// ---------------------------------------------------------------------------
// Context passed into the prompt generator
// ---------------------------------------------------------------------------

export interface ImagePromptContext {
  businessName: string;
  primaryCategory: string;
  city: string;
  state: string;
  pageType: ImagePrompt['page_type'];
  categoryName?: string;
  serviceName?: string;
  brandColors?: string;
  defaultImageStyle?: string;
  brandStyleGuide?: string;
  hasRealImages?: boolean;
}

// ---------------------------------------------------------------------------
// Style & negative-prompt constants (appended to every prompt)
// ---------------------------------------------------------------------------

const STYLE_BLOCK =
  'photorealistic, commercial photography style, natural lighting, slightly imperfect environment, real-world textures, authentic small business setting, no staged poses, no stock photo look';

const NEGATIVE_PROMPT =
  'cartoon, illustration, CGI, overly polished, stock photo, fake people, symmetrical posing, identical faces, distorted hands, text overlays, watermark, fake logos';

// ---------------------------------------------------------------------------
// System prompt — distilled from the user's Image Strategy Engine spec
// ---------------------------------------------------------------------------

const IMAGE_STRATEGY_SYSTEM_PROMPT = `You are the GrowLocal 360 Image Strategy Engine.

You generate structured JSON image prompts for local business websites.
You do NOT generate images — you generate prompts that will later be sent to image generation APIs.

RULES:
1. NO FAKE PEOPLE — no staged teams, no smiling groups. If people appear they must be working, natural, non-posed, ideally partial (hands, action shots).
2. ENVIRONMENT OVER STAGING — prioritize tools, workspace, materials, real job environments. Slight mess and imperfection is good.
3. SERVICE INTENT MATCHING — every image must visually represent the service or category. Derive visuals from the category/service name. Never use generic business imagery.
4. LOCAL CONTEXT — subtly reflect the local business environment when appropriate. Do not force location visually.
5. COST CONTROL — use category-level images as base. Only generate new images when a service is highly distinct or high-importance.
6. CONSISTENCY — all images for a site must feel cohesive in lighting, realism level, and tone.

BRANDING RULES:
- HOME PAGE HERO ONLY: may include subtle branding (logo placement, branded apparel, branded vehicle) — must feel like real-world environment first, brand second.
- ALL OTHER IMAGES: no logos, no text overlays, no fake branded uniforms, no repeated brand marks. Use brand colors only as subtle accents in materials, lighting, or accents.

IMAGE HIERARCHY:
- Hero images: 1 per page (home hero uses engine "nano_banana", all others use "openai")
- Category images: 2–4 per category, representing core processes. Reused across service pages.
- Service images: default to reuse_category. Only "new" if the service is highly distinct.

PAGE TYPE RULES:
- home: hero (nano_banana, light branding allowed) + 1 supporting environment image (openai, no branding)
- category: 1 hero (openai, no branding) + 2–3 grid images (openai, no branding)
- service: return reuse_category references only (no new prompts unless highly distinct)
- about: 1–2 environment images (openai, no people focus unless hasRealImages)
- contact: 1 simple environment or exterior image (openai, low priority)
- location: 1 service + local environment blend (openai, no branding)

RESPOND WITH ONLY valid JSON in this exact format:
{
  "image_prompts": [
    {
      "image_type": "hero" | "category_support" | "service" | "environment",
      "engine": "openai" | "nano_banana",
      "page_type": "<the page type provided>",
      "section_type": "hero" | "grid" | "background" | "supporting",
      "prompt": "<detailed image generation prompt>",
      "reuse_strategy": "new"
    }
  ]
}

Do not include style or negative_prompt in your response — those are appended automatically.`;

// ---------------------------------------------------------------------------
// Build user message for a given page context
// ---------------------------------------------------------------------------

function buildUserMessage(ctx: ImagePromptContext): string {
  const lines = [
    `Business: ${ctx.businessName}`,
    `Primary category: ${ctx.primaryCategory}`,
    `Location: ${ctx.city}, ${ctx.state}`,
    `Page type: ${ctx.pageType}`,
  ];

  if (ctx.categoryName) lines.push(`Category name: ${ctx.categoryName}`);
  if (ctx.serviceName) lines.push(`Service name: ${ctx.serviceName}`);
  if (ctx.brandColors) lines.push(`Brand color: ${ctx.brandColors}`);
  if (ctx.defaultImageStyle) lines.push(`Image style preference: ${ctx.defaultImageStyle}`);
  if (ctx.brandStyleGuide) lines.push(`Brand style guide: ${ctx.brandStyleGuide}`);
  if (ctx.hasRealImages) lines.push(`Has real team images: yes`);

  lines.push('', 'Generate the image prompts for this page.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main generator — calls Claude to produce image prompts for a page
// ---------------------------------------------------------------------------

export async function generateImagePromptsForPage(
  anthropic: Anthropic,
  ctx: ImagePromptContext
): Promise<ImagePrompt[]> {
  const result = await withRetry(async () => {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: IMAGE_STRATEGY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(ctx) }],
    });
    return parseJsonResponse<{ image_prompts: Omit<ImagePrompt, 'style' | 'negative_prompt'>[] }>(
      message
    );
  });

  if (!result?.image_prompts?.length) {
    console.warn(`[image-prompts] No prompts generated for ${ctx.pageType} page`);
    return [];
  }

  // Append style & negative prompt to every entry
  return result.image_prompts.map((p) => ({
    ...p,
    style: STYLE_BLOCK,
    negative_prompt: NEGATIVE_PROMPT,
    reuse_strategy: p.reuse_strategy || 'new',
  }));
}

// ---------------------------------------------------------------------------
// Service-level reuse (no Claude call — pure function)
// ---------------------------------------------------------------------------

export function getServiceImageReuse(siteCategoryId: string | null): ImagePrompt[] {
  return [
    {
      image_type: 'service',
      engine: 'openai',
      page_type: 'service',
      section_type: 'hero',
      prompt: '',
      style: STYLE_BLOCK,
      negative_prompt: NEGATIVE_PROMPT,
      reuse_strategy: 'reuse_category',
      reuse_source_category_id: siteCategoryId ?? undefined,
    },
  ];
}
