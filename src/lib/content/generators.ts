import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SiteSettings } from '@/types/database';

// --- Shared types ---

export interface BusinessContext {
  businessName: string;
  primaryCity: string;
  state: string;
  primaryCategoryName: string;
  settings?: SiteSettings;
}

export interface ServiceContentResult {
  meta_title: string;
  meta_description: string;
  h1: string;
  intro_copy: string;
  body_copy: string;
  problems: { heading: string; description: string }[];
  detailed_sections: { h2: string; body: string; bullets: string[] }[];
  faqs: { question: string; answer: string }[];
}

export interface ServiceAreaContentResult {
  meta_title: string;
  meta_description: string;
  h1: string;
  body_copy: string;
}

// --- Shared helpers ---

export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  return new Anthropic({ apiKey });
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  retries = 1,
  timeoutMs = 120_000
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await fn(controller.signal);
      clearTimeout(timer);
      return result;
    } catch (error) {
      clearTimeout(timer);
      if (attempt === retries) throw error;
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      console.warn(
        `API call failed (attempt ${attempt + 1}/${retries + 1}, ${isTimeout ? 'TIMEOUT' : 'error'}):`,
        error
      );
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Unreachable');
}

export function parseJsonResponse<T>(message: Anthropic.Message): T | null {
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return null;
  }

  try {
    const responseText = textContent.text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
  } catch (parseError) {
    console.error('Failed to parse LLM response:', parseError);
  }

  return null;
}

// --- Content directives builder ---

const POV_LABELS: Record<string, string> = {
  first_person_plural: 'Write in first person plural (we/our/us)',
  first_person_singular: 'Write in first person singular (I/my/me)',
  third_person: 'Write in third person (they/the company)',
};

export function buildContentDirectives(settings?: SiteSettings): string {
  if (!settings) return '';

  const lines: string[] = [];

  if (settings.tone_values?.length) {
    lines.push(`**Voice & Tone:** ${settings.tone_values.join(', ')}`);
  }
  if (settings.point_of_view) {
    lines.push(`**Point of View:** ${POV_LABELS[settings.point_of_view] || settings.point_of_view}`);
  }
  if (settings.words_to_use?.trim()) {
    lines.push(`**Words & phrases to use:** ${settings.words_to_use.trim()}`);
  }
  if (settings.words_to_avoid?.trim()) {
    lines.push(`**Words & phrases to NEVER use:** ${settings.words_to_avoid.trim()}`);
  }
  if (settings.target_audience?.trim()) {
    lines.push(`**Target Audience:** ${settings.target_audience.trim()}`);
  }
  if (settings.business_description?.trim()) {
    lines.push(`**About the Business:** ${settings.business_description.trim()}`);
  }
  if (settings.credentials?.trim()) {
    lines.push(`**Credentials & Certifications:** ${settings.credentials.trim()}`);
  }
  if (settings.local_details?.trim()) {
    lines.push(`**Local Context:** ${settings.local_details.trim()}`);
  }
  if (settings.writing_samples?.trim()) {
    lines.push(`**Writing Samples (match this voice and style):**\n${settings.writing_samples.trim()}`);
  }
  if (settings.specific_requests?.trim()) {
    lines.push(`**Specific Requests (follow these closely):**\n${settings.specific_requests.trim()}`);
  }
  if (settings.onboarding_notes?.trim()) {
    lines.push(`**Additional Business Context:**\n${settings.onboarding_notes.trim()}`);
  }

  if (lines.length === 0) return '';

  return `\n## Content Directives — follow these closely when writing:\n${lines.join('\n')}\n`;
}

// --- Context loader ---

export async function loadBusinessContext(siteId: string): Promise<BusinessContext & { siteSlug: string }> {
  const supabase = createAdminClient();

  const [{ data: site }, { data: locations }, { data: categories }] = await Promise.all([
    supabase.from('sites').select('name, slug, settings').eq('id', siteId).single(),
    supabase.from('locations').select('city, state').eq('site_id', siteId).eq('is_primary', true).limit(1),
    supabase
      .from('site_categories')
      .select('is_primary, gbp_category:gbp_categories(display_name)')
      .eq('site_id', siteId)
      .eq('is_primary', true)
      .limit(1),
  ]);

  if (!site) throw new Error('Site not found');

  const primaryLocation = locations?.[0];
  const primaryCategory = categories?.[0];
  const gbp = primaryCategory
    ? (Array.isArray(primaryCategory.gbp_category)
        ? primaryCategory.gbp_category[0]
        : primaryCategory.gbp_category)
    : null;

  return {
    businessName: site.name,
    primaryCity: primaryLocation?.city || '',
    state: primaryLocation?.state || '',
    primaryCategoryName: gbp?.display_name || 'Professional Services',
    siteSlug: site.slug,
    settings: (site.settings || {}) as SiteSettings,
  };
}

// --- Single-item generators ---

export async function generateSingleServiceContent(
  ctx: BusinessContext,
  service: { name: string; description: string },
  categoryName: string
): Promise<ServiceContentResult> {
  const anthropic = createAnthropicClient();

  const directives = buildContentDirectives(ctx.settings);

  const prompt = `You are an SEO expert generating rich, structured content for a local service business website.

Business: ${ctx.businessName}
Location: ${ctx.primaryCity}, ${ctx.state}
Category: ${categoryName}
${directives}
Generate SEO-optimized content for this service:
- ${service.name}: ${service.description || 'No description'}

Provide ALL of these fields:
1. meta_title: Format as "[Service Name] in [City], [State] | [Business Name]" (max 60 chars total)
2. meta_description: Compelling description with call-to-action (max 155 chars)
3. h1: Main heading like "Professional [Service Name] Services"
4. intro_copy: 2-3 sentence service introduction highlighting key benefits (shown as a callout card)
5. body_copy: 2-3 paragraphs of helpful, SEO-friendly content (300-500 words total)
6. problems: Exactly 3 common problems/issues this service solves. Each with a short heading and a description of how the business solves it (2-3 sentences each)
7. detailed_sections: Exactly 3 informational subsections. Each with an h2 heading, a body paragraph (100-150 words), and 3-4 bullet points
8. faqs: 3-5 common questions and detailed answers about this specific service

Use double newlines (\\n\\n) to separate paragraphs within body_copy.

Format your response as JSON:
{
  "meta_title": "...",
  "meta_description": "...",
  "h1": "...",
  "intro_copy": "...",
  "body_copy": "...",
  "problems": [
    { "heading": "Problem 1", "description": "How we solve it..." }
  ],
  "detailed_sections": [
    { "h2": "Section heading", "body": "Paragraph...", "bullets": ["point 1", "point 2", "point 3"] }
  ],
  "faqs": [
    { "question": "...", "answer": "..." }
  ]
}

Return ONLY valid JSON.`;

  const message = await withRetry(
    (signal) =>
      anthropic.messages.create(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        },
        { signal }
      ),
    1,
    60_000
  );

  const result = parseJsonResponse<ServiceContentResult>(message);
  if (!result) throw new Error('Failed to generate service content');
  return result;
}

export async function generateSingleServiceAreaContent(
  ctx: BusinessContext,
  area: { name: string; state: string }
): Promise<ServiceAreaContentResult> {
  const anthropic = createAnthropicClient();

  const directives = buildContentDirectives(ctx.settings);

  const prompt = `You are an SEO expert generating service area page content for a local service business.

Business: ${ctx.businessName}
Primary Location: ${ctx.primaryCity}, ${ctx.state}
Primary Category: ${ctx.primaryCategoryName}
${directives}
Generate content for this service area page (a nearby city we serve):
- ${area.name}, ${area.state}

Provide:
1. meta_title: "[Primary Category] in [City], [State] | [Business Name]" (max 60 chars)
2. meta_description: Compelling description mentioning we serve this area (max 155 chars)
3. h1: Main heading emphasizing service in that city
4. body_copy: 1-2 paragraphs (150-250 words) explaining:
   - That ${ctx.businessName} proudly serves ${area.name}
   - The services available to residents of ${area.name}
   - Call to action to contact us

Format as JSON:
{
  "meta_title": "...",
  "meta_description": "...",
  "h1": "...",
  "body_copy": "..."
}

Return ONLY valid JSON.`;

  const message = await withRetry(
    (signal) =>
      anthropic.messages.create(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        },
        { signal }
      ),
    1,
    60_000
  );

  const result = parseJsonResponse<ServiceAreaContentResult>(message);
  if (!result) throw new Error('Failed to generate service area content');
  return result;
}
