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

// Appended to EVERY generation prompt (via buildContentDirectives), whether or
// not the site has any settings filled in. Two jobs: keep the copy sounding like
// a person wrote it, and stop the model inventing facts about the business.
export const WRITING_STANDARDS = `
## Writing Standards — these override any length or structure guidance elsewhere in this prompt:

VOICE
- Write the way the owner would explain the job to a customer at the counter: plain words, direct, knows the trade. Not a brochure, not an essay.
- Short sentences. Average under 18 words; never over 30. One idea per sentence. If a sentence has two commas and a dash, split it.
- No em dashes (—). Use a period or a comma.
- Say a thing once. Never restate the heading, the hero text, or a previous paragraph in different words.
- Stop when the point is made. Word counts in this prompt are CEILINGS, never targets. Shorter is better when nothing is lost.
- Lead with the specific. Name the part, the symptom, the cause, the fix. Cut any sentence that would be equally true of every company in the industry.
- No adjective stacking ("comprehensive, professional, reliable"). No throat-clearing openers ("When it comes to...", "In today's...", "Whether you need X or Y...").
- NEVER use: "comprehensive", "peak performance", "state-of-the-art", "top-notch", "second to none", "look no further", "one-stop shop", "proudly serving", "we take pride", "trusted provider", "unique needs", "peace of mind", "rest assured", "relentless", "demanding conditions", "the expertise and equipment", "we understand that", "don't let X ruin your Y".
- Vary the shape. Do not give every section the same length or the same paragraph-then-bullets layout. Use bullets only where the content is actually a list.

FACTS — do not invent anything about this business
- The ONLY facts you know about this business are the ones written in this prompt (business name, location, services, and anything under Content Directives).
- Unless it is stated in this prompt, do NOT claim or imply: years in business, "family-owned", generations, licensing or insurance, certifications or factory training, awards, guarantees or warranties, response or turnaround times, 24/7 or emergency availability, free estimates, pricing, financing, team size, customer counts, specific tools, equipment or parts brands used, or OEM parts policies.
- Do NOT describe how this business operates unless stated in this prompt: shop vs. mobile or on-site service, written estimates or reports, inspection or approval steps, scheduling, pickup or delivery. You do not know their process.
- FAQs must be answerable from trade knowledge alone. Never write a question whose honest answer depends on this business's policies (hours, on-site service, payment, warranty). Skip it.
- Avoid self-praise disguised as process: "honest assessment", "straight answer", "fix the actual problem, not just the symptom", "done right the first time".
- Do NOT put words in customers' mouths or describe reviews unless review text is provided in this prompt.
- General trade knowledge IS allowed and encouraged: how the work is done, what causes the problem, what a customer should check or expect, how local climate or conditions affect it. Write about the work, not about how great the company is.
- When a fact about the business would help but is not provided, leave it out. Never fill the gap with a plausible guess.
`;

export function buildContentDirectives(settings?: SiteSettings): string {
  if (!settings) return WRITING_STANDARDS;

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

  if (lines.length === 0) return WRITING_STANDARDS;

  return `\n## Content Directives — follow these closely when writing:\n${lines.join('\n')}\n${WRITING_STANDARDS}`;
}

// --- Service page prompt (shared by the Inngest pipeline and the single-service route) ---

export function buildServicePagePrompt(
  ctx: { businessName: string; city: string; state: string; categoryName: string },
  services: { name: string; description: string }[],
  directives: string
): string {
  const serviceList = services
    .map((s) => `- ${s.name}: ${s.description || 'No description'}`)
    .join('\n');

  return `You are writing service pages for a local service business. The reader is a customer with a problem who wants to know three things fast: do you fix my problem, what is involved, and what should I do next.

Business: ${ctx.businessName}
Location: ${ctx.city}, ${ctx.state}
Category: ${ctx.categoryName}
${directives}
Write a page for each of these services:
${serviceList}

${services.length > 1 ? `These pages sit side by side on the same site. They must NOT share a skeleton: give them different numbers of problems and sections, and no more than ONE section angle in common. If one page has a "how it is done" section or a checklist, the other should not. Do not reuse heading patterns ("X vs. Y", "How Florida...") across pages.

` : ''}The short description after each service name is ALREADY shown at the top of the page as the hero text. Do not repeat or paraphrase it anywhere.

For EACH service, provide:
1. meta_title: "[Service Name] in [City], [State] | [Business Name]" (max 60 chars total)
2. meta_description: What the service covers plus a call to action (max 155 chars)
3. h1: Name the service in plain words, the way a customer would say it (max 9 words). It MUST contain the service's core keyword. Do NOT put a city or state in the h1: this page is the brand-level page for the service, the title tag carries the location, and separate city pages own "[service] in [city]". No "Professional ... Services" wrapper, no adjectives, no taglines. Let the form follow the service: sometimes just the service name, sometimes the name plus what it covers (e.g. "Marine Engine Repair and Rebuilds", "Fiberglass Hull and Gelcoat Repair").
4. intro_copy: 2 sentences, max 45 words. Open with the customer's situation or the most common reason people call, not with the business name.
5. body_copy: One short paragraph, max 80 words, plain summary of what this service covers. Used as a fallback only.
6. problems: The 2 to 4 problems customers actually call about for THIS service. Use as many as are real, not a fixed number. Each has a heading (the symptom in the customer's words, max 8 words) and a description of 1-2 sentences (max 40 words) giving the usual cause and what the fix involves.
7. detailed_sections: 2 to 4 sections. Pick the angles that matter for THIS service, and choose different angles for different services. Options include: how the work is done step by step, repair vs. replace, what affects the cost, how long it takes and why, what to check yourself before calling, warning signs, how local climate or conditions affect it, maintenance that prevents the problem. Each section has:
   - h2: a plain heading a customer would search for or ask. No "Comprehensive", no "&" chains, max 9 words.
   - body: 40 to 90 words. Lengths should differ between sections.
   - bullets: 0 to 5 items. Use bullets ONLY when the content is a real list (steps, symptoms, parts, a checklist). At least one section per page should have NO bullets (empty array). Bullets are fragments of max 12 words and must not repeat the body.
8. faqs: 3 to 5 questions a customer would really ask. Answers are 1-3 sentences (max 60 words) and start with the direct answer. Do not re-ask anything the sections already covered.

Use double newlines (\\n\\n) to separate paragraphs.

Format your response as JSON:
{
  "services": [
    {
      "name": "Service Name exactly as given",
      "meta_title": "...",
      "meta_description": "...",
      "h1": "...",
      "intro_copy": "...",
      "body_copy": "...",
      "problems": [
        { "heading": "...", "description": "..." }
      ],
      "detailed_sections": [
        { "h2": "...", "body": "...", "bullets": [] }
      ],
      "faqs": [
        { "question": "...", "answer": "..." }
      ]
    }
  ]
}

Return ONLY valid JSON.`;
}

// --- GSC context builder ---

export async function buildGSCContext(siteId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data: queries } = await supabase
    .from('gsc_queries')
    .select('query, impressions, clicks, position')
    .eq('site_id', siteId)
    .order('impressions', { ascending: false })
    .limit(50);

  if (!queries?.length) return '';

  const topQueries = queries
    .map(
      (q) =>
        `- "${q.query}" (${q.impressions} impressions, ${q.clicks} clicks, avg position ${q.position.toFixed(1)})`
    )
    .join('\n');

  return `\n## Real Search Data — use these insights to optimize content:\nThese are actual Google search queries that lead people to this business:\n${topQueries}\n\nNaturally incorporate high-impression queries into headings, body copy, and FAQs where relevant. Focus especially on queries with high impressions but few clicks (position > 10) as content optimization opportunities.\n`;
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

  const prompt = buildServicePagePrompt(
    { businessName: ctx.businessName, city: ctx.primaryCity, state: ctx.state, categoryName },
    [service],
    directives
  );

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

  const result = parseJsonResponse<{ services: ServiceContentResult[] }>(message)?.services?.[0];
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
