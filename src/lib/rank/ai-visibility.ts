import type { SupabaseClient } from '@supabase/supabase-js';
import type Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '@/lib/content/generators';
import { aiModeSearch, dataForSeoConfigured } from './dataforseo';
import { resolveCenter } from './scan';

/**
 * AI visibility: ask the assistants people actually use the question a
 * customer would ask ("who's the best appliance repair in Sarasota?") and
 * record whether this business is named, where in the list, and who else is.
 *
 * Both assistants are asked WITH web search turned on and the searcher placed
 * in the business's city, which is how the consumer apps answer. Without
 * search the models either decline (Claude) or invent plausible-sounding
 * businesses that do not exist (small OpenAI models), and neither reflects
 * what a customer sees. Claude via the Anthropic key already in use; OpenAI
 * via the Responses API when OPENAI_API_KEY is set.
 */

export type AiModel = 'claude' | 'openai' | 'google_ai';

export interface AiCheck {
  model: AiModel;
  modelId: string;
  prompt: string;
  mentioned: boolean;
  position: number | null;
  competitors: string[];
  answered: boolean;
  answer: string;
  error?: string;
}

export function visibilityPrompts(category: string, city: string, state: string): string[] {
  const cat = category.toLowerCase().replace(/\s+service$/, '');
  return [
    `Who are the best ${cat} companies in ${city}, ${state}? List the top 5 by business name with one line each.`,
    `I need ${cat} in ${city}, ${state}. Which local businesses should I call first? Name specific companies.`,
    `Recommend a reliable, well-reviewed ${cat} business near ${city}, ${state}. Give me actual business names.`,
  ];
}

/** Directories, platforms and generic advice an assistant falls back to instead of naming businesses. Never counted as competitors. */
const NOT_A_BUSINESS = /^(google( maps| business profile| search)?|yelp|angi(e'?s list)?|bbb|better business bureau|nextdoor|thumbtack|homeadvisor|facebook( groups?| marketplace)?|instagram|linkedin|reddit|craigslist|houzz|porch|task ?rabbit|clutch(\.co)?|upwork|fiverr|behance|dribbble|99designs|etsy|chamber of commerce|.*chamber of commerce|local (facebook )?groups?|word of mouth|ask (friends|neighbors)|check reviews?|search (online|google)|here'?s? .*|what i'?d suggest.*|how to .*|tips?.*|options?.*|businesses that .*|companies that .*|better ways .*|portfolio .*|local references?|for (branding|logos?|print(ing)?|web(sites?)?|signs?|design|marketing|large|small|quick|budget).*)$/i;

function looksLikeBusinessName(entry: string): boolean {
  const e = entry.trim().replace(/[.:]+$/, '');
  if (!e || e.length > 60) return false;
  if (e.split(/\s+/).length > 7) return false;
  if (/^\d+\s+\w+(\s+\w+)?\s+(st|ave|rd|blvd|dr|ln|hwy|street|avenue|road|drive|lane|highway|suite|ste)\b/i.test(e)) return false; // street address
  if (/^(https?:\/\/|www\.)/i.test(e)) return false;
  if (!/\s/.test(e) && !/[A-Z0-9]/.test(e)) return false; // a lone lowercase word ("web", "phone") is a detail, not a name
  if (/\b(suggest|recommend|consider|look for|verify|contact|call|visit|search|review|rating|ask|check|make sure|instead|however|unfortunately)\b/i.test(e)) return false;
  if (NOT_A_BUSINESS.test(e)) return false;
  return /[A-Za-z]/.test(e);
}

/**
 * Case/punctuation-insensitive mention check; position = order among lines
 * that look like list entries naming a business. `answered` is false when the
 * assistant declined to name any business at all (common for models without
 * browsing), which the page shows as "declined" rather than as competitors.
 */
export function analyzeAnswer(answer: string, businessName: string): { mentioned: boolean; position: number | null; competitors: string[]; answered: boolean } {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const target = norm(businessName);
  const words = target.split(' ');
  // Assistants shorten names ("Graphic Works" for "Graphic Works Advertising & Design Shop"), so
  // accept the full name, its first three words, or its first two words when those are distinctive.
  const short = words.slice(0, 3).join(' ');
  const GENERIC = /^(the|a|an|and|of|appliance|repair|service|services|company|co|inc|llc|design|designs|graphic|graphics|plumbing|hvac|electric|electrical|roofing|cleaning|lawn|care|home|pro|pros|local|best|quality|affordable|expert|experts)$/;
  const two = words.slice(0, 2).join(' ');
  const twoIsDistinctive = words.length >= 3 && two.length >= 10 && !words.slice(0, 2).every((w) => GENERIC.test(w));
  const text = norm(answer);
  const mentioned = !!target && (text.includes(target) || (short.length >= 8 && text.includes(short)) || (twoIsDistinctive && text.includes(two)));

  // List entries: "1. Name", "- Name", "**Name**", "**[Name](url)**", "### 2. Name"
  const lines = answer
    .split('\n')
    .map((l) =>
      l
        .trim()
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // markdown links -> text
        .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '') // emoji
        .replace(/^#{1,6}\s*/, '') // headings
        .replace(/^\*\*(\d+[.)])\s*/, '$1 **') // "**2. Name**" -> "2. **Name**"
        .trim()
    )
    .filter(Boolean);
  // Numbered entries and bullet entries are collected separately: when an answer is a numbered
  // list, its dash bullets are details under each entry (address, phone), not more businesses.
  const numbered: string[] = [];
  const bulleted: string[] = [];
  const bold: string[] = [];
  for (const line of lines) {
    const n = line.match(/^\d+[.)]\s*\**([^*:\-–—(]{3,80}?)\**\s*(?:[:\-–—(]|$)/);
    const b = !n && line.match(/^[-*•]\s*\**([^*:\-–—(]{3,80}?)\**\s*(?:[:\-–—(]|$)/);
    const s = !n && !b && line.match(/^\*\*([^*:\-–—(]{3,80}?)\*\*\s*(?:[:\-–—(]|$)/);
    const m = n || b || s;
    if (!m || !looksLikeBusinessName(m[1])) continue;
    const name = m[1].trim().replace(/[.:]+$/, '');
    (n ? numbered : b ? bulleted : bold).push(name);
  }
  const entries = numbered.length ? [...numbered, ...bold] : [...bulleted, ...bold];
  const answered = entries.length > 0 || mentioned;
  let position: number | null = null;
  if (mentioned) {
    const idx = entries.findIndex((e) => { const n = norm(e); return n.includes(short) || target.includes(n) && n.length >= 8; });
    position = idx >= 0 ? idx + 1 : null;
  }
  const competitors = entries
    .filter((e) => { const n = norm(e); return !(n.includes(short) || (target.includes(n) && n.length >= 8)); })
    .slice(0, 8);
  return { mentioned, position, competitors, answered };
}

export interface Asked { modelId: string; answer: string; searches: number }
export interface Searcher { city: string; state: string }

const US_STATE_NAMES: Record<string, string> = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia' };
const regionName = (state: string) => US_STATE_NAMES[state.toUpperCase()] || state;

/** Claude with Anthropic's web search tool, searcher placed in the business's city. Capped at 3 searches per question. */
export async function askClaude(prompt: string, where: Searcher): Promise<Asked> {
  const anthropic = createAnthropicClient();
  const modelId = 'claude-sonnet-4-6';
  const webSearch = {
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: 3,
    user_location: { type: 'approximate', city: where.city, region: regionName(where.state), country: 'US' },
  } as unknown as Anthropic.Messages.ToolUnion;
  const res = await anthropic.messages.create({ model: modelId, max_tokens: 1200, tools: [webSearch], messages: [{ role: 'user', content: prompt }] });
  const answer = res.content.filter((c): c is Anthropic.Messages.TextBlock => c.type === 'text').map((c) => c.text).join('\n');
  const searches = res.content.filter((c) => c.type === 'server_tool_use').length;
  return { modelId, answer, searches };
}

/** ChatGPT via the Responses API with OpenAI's web search tool. */
export async function askOpenAI(prompt: string, where: Searcher): Promise<Asked> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const modelId = process.env.OPENAI_VISIBILITY_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      tools: [{ type: 'web_search_preview', user_location: { type: 'approximate', city: where.city, region: regionName(where.state), country: 'US' } }],
      input: prompt,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    output?: { type: string; content?: { type: string; text?: string }[] }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message || `OpenAI HTTP ${res.status}`);
  const answer = (json.output || [])
    .filter((o) => o.type === 'message')
    .flatMap((o) => o.content || [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text || '')
    .join('\n');
  const searches = (json.output || []).filter((o) => o.type === 'web_search_call').length;
  return { modelId, answer, searches };
}

/** Google AI Mode through DataForSEO: the answer a searcher standing at the business sees. Business cards in it read "Name 5.0 (87)". */
export async function askGoogleAi(prompt: string, center: { lat: number; lng: number }): Promise<Asked> {
  const r = await aiModeSearch(prompt, center.lat, center.lng);
  // Turn the Maps cards embedded in the markdown into a plain numbered list the shared parser reads,
  // and keep the prose so a mention in a sentence still counts.
  const cards: string[] = [];
  for (const line of r.markdown.split('\n')) {
    const m = line.trim().match(/^(?:\*\*)?([A-Za-z0-9][^|*]{1,70}?)(?:\*\*)?\s+([1-5]\.\d)\s*\((\d[\d,]*)\)/);
    if (m && !cards.includes(m[1].trim())) cards.push(m[1].trim());
  }
  const list = cards.map((c, i) => `${i + 1}. ${c}`).join('\n');
  const answer = [list, r.markdown.replace(/!\[\]\([^)]*\)/g, '').replace(/\[\[\d+\]\]\([^)]*\)/g, '')].filter(Boolean).join('\n\n');
  return { modelId: 'google-ai-mode', answer, searches: 1 };
}

export function aiModelsAvailable(): AiModel[] {
  const out: AiModel[] = [];
  if (dataForSeoConfigured()) out.push('google_ai');
  if (process.env.ANTHROPIC_API_KEY) out.push('claude');
  if (process.env.OPENAI_API_KEY) out.push('openai');
  return out;
}

export interface AiRunOptions {
  /** Skip when the latest batch is younger than this (days). Scheduled runs use 13 for an every-other-week cadence; manual scans use 1. */
  minIntervalDays?: number;
}

export async function runAiVisibility(supabase: SupabaseClient, siteId: string, opts: AiRunOptions = {}): Promise<{ siteId: string; checks: AiCheck[]; skipped?: string }> {
  const [{ data: site }, { data: loc }, { data: cat }, { data: last }] = await Promise.all([
    supabase.from('sites').select('name, status').eq('id', siteId).single(),
    supabase.from('locations').select('city, state').eq('site_id', siteId).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('site_categories').select('gbp_category:gbp_categories(display_name)').eq('site_id', siteId).eq('is_primary', true).limit(1).maybeSingle(),
    supabase.from('ai_visibility_checks').select('batch_at').eq('site_id', siteId).order('batch_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!site || site.status !== 'active') return { siteId, checks: [], skipped: 'site inactive' };
  if (opts.minIntervalDays && last?.batch_at) {
    const ageDays = (Date.now() - new Date(last.batch_at as string).getTime()) / 86_400_000;
    if (ageDays < opts.minIntervalDays) return { siteId, checks: [], skipped: `checked ${Math.max(1, Math.round(ageDays))} day${Math.round(ageDays) === 1 ? '' : 's'} ago` };
  }
  const category = ((cat?.gbp_category as unknown as { display_name?: string } | null)?.display_name) || null;
  if (!category || !loc?.city || !loc.state) return { siteId, checks: [], skipped: 'need a primary category and a city' };
  const models = aiModelsAvailable();
  if (models.length === 0) return { siteId, checks: [], skipped: 'no AI provider keys' };
  const center = models.includes('google_ai') ? await resolveCenter(supabase, siteId) : null;

  const prompts = visibilityPrompts(category, loc.city, loc.state);
  const checks: AiCheck[] = [];
  const batchAt = new Date().toISOString();
  for (const model of models) {
    if (model === 'google_ai' && !center) continue; // needs coordinates for the searcher's position
    for (const prompt of prompts) {
      try {
        const where = { city: loc.city, state: loc.state };
        const { modelId, answer } =
          model === 'claude' ? await askClaude(prompt, where) : model === 'openai' ? await askOpenAI(prompt, where) : await askGoogleAi(prompt, center!);
        const a = analyzeAnswer(answer, site.name);
        checks.push({ model, modelId, prompt, answer, ...a });
      } catch (e) {
        checks.push({ model, modelId: model, prompt, answer: '', mentioned: false, position: null, competitors: [], answered: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  if (checks.length) {
    await supabase.from('ai_visibility_checks').insert(
      checks.map((c) => ({
        site_id: siteId,
        batch_at: batchAt,
        model: c.model,
        model_id: c.modelId,
        prompt: c.prompt,
        mentioned: c.mentioned,
        position: c.position,
        competitors: c.competitors,
        answered: c.answered,
        answer: c.answer.slice(0, 4000),
        error: c.error || null,
      }))
    );
  }
  return { siteId, checks };
}

/** Roll-up of the latest batch: share of prompts that named the business, per model. */
export async function latestAiVisibility(supabase: SupabaseClient, siteId: string) {
  const { data } = await supabase.from('ai_visibility_checks').select('batch_at, model, model_id, prompt, mentioned, position, competitors, answered, error').eq('site_id', siteId).order('batch_at', { ascending: false }).limit(60);
  const rows = data || [];
  if (rows.length === 0) return null;
  const latestBatch = rows[0].batch_at as string;
  const batch = rows.filter((r) => r.batch_at === latestBatch);
  const previousBatchAt = rows.find((r) => r.batch_at !== latestBatch)?.batch_at as string | undefined;
  const previous = previousBatchAt ? rows.filter((r) => r.batch_at === previousBatchAt) : [];
  const share = (list: typeof rows) => (list.length ? Math.round((list.filter((r) => r.mentioned).length / list.length) * 100) : 0);
  const byModel = Array.from(new Set(batch.map((r) => r.model as string))).map((m) => ({ model: m, mentionedShare: share(batch.filter((r) => r.model === m)), checks: batch.filter((r) => r.model === m) }));
  const competitorCounts = new Map<string, number>();
  for (const r of batch) for (const c of (r.competitors as string[]) || []) competitorCounts.set(c, (competitorCounts.get(c) || 0) + 1);
  return {
    batchAt: latestBatch,
    mentionedShare: share(batch),
    previousShare: previous.length ? share(previous) : null,
    byModel,
    topCompetitors: [...competitorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
  };
}
