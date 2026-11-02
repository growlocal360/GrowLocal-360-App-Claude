import type { SupabaseClient } from '@supabase/supabase-js';
import { createAnthropicClient } from '@/lib/content/generators';

/**
 * AI visibility: ask the assistants people actually use the question a
 * customer would ask ("who's the best appliance repair in Sarasota?") and
 * record whether this business is named, where in the list, and who else is.
 * Claude via the Anthropic key already in use; OpenAI via plain fetch when
 * OPENAI_API_KEY is set. Other models can be added the same way.
 */

export type AiModel = 'claude' | 'openai';

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
    `Who are the best ${cat} companies in ${city}, ${state}? List the top 5 by business name with one line each. Name real local businesses you know of; if you are unsure, say so in one line.`,
    `I need ${cat} in ${city}, ${state}. Which local businesses should I call first? Name specific companies you know of.`,
    `Recommend a reliable, well-reviewed ${cat} business near ${city}, ${state}. Give me actual business names.`,
  ];
}

/** Directories and generic advice an assistant falls back to instead of naming businesses. Never counted as competitors. */
const NOT_A_BUSINESS = /^(google( maps| business profile)?|yelp|angi(e'?s list)?|bbb|better business bureau|nextdoor|thumbtack|homeadvisor|facebook( groups?)?|reddit|craigslist|houzz|porch|task ?rabbit|local (facebook )?groups?|word of mouth|ask (friends|neighbors)|check reviews?|search (online|google)|here'?s? .*|what i'?d suggest.*|how to .*|tips?.*|options?.*)$/i;

function looksLikeBusinessName(entry: string): boolean {
  const e = entry.trim().replace(/[.:]+$/, '');
  if (!e || e.length > 60) return false;
  if (e.split(/\s+/).length > 7) return false;
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
  const short = target.split(' ').slice(0, 3).join(' ');
  const text = norm(answer);
  const mentioned = !!target && (text.includes(target) || (short.length >= 8 && text.includes(short)));

  // List entries: "1. Name", "- Name", "**Name**"
  const lines = answer.split('\n').map((l) => l.trim()).filter(Boolean);
  const entries: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(?:\d+[.)]|[-*•])\s*\**([^*:\-–—(]{3,80}?)\**\s*(?:[:\-–—(]|$)/);
    if (m && looksLikeBusinessName(m[1])) entries.push(m[1].trim().replace(/[.:]+$/, ''));
  }
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

async function askClaude(prompt: string): Promise<{ modelId: string; answer: string }> {
  const anthropic = createAnthropicClient();
  const modelId = 'claude-sonnet-4-6';
  const res = await anthropic.messages.create({ model: modelId, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
  const block = res.content.find((c) => c.type === 'text');
  return { modelId, answer: block && block.type === 'text' ? block.text : '' };
}

async function askOpenAI(prompt: string): Promise<{ modelId: string; answer: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const modelId = process.env.OPENAI_VISIBILITY_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: prompt }], max_tokens: 600, temperature: 0.3 }),
  });
  const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `OpenAI HTTP ${res.status}`);
  return { modelId, answer: json.choices?.[0]?.message?.content || '' };
}

export function aiModelsAvailable(): AiModel[] {
  const out: AiModel[] = [];
  if (process.env.ANTHROPIC_API_KEY) out.push('claude');
  if (process.env.OPENAI_API_KEY) out.push('openai');
  return out;
}

export async function runAiVisibility(supabase: SupabaseClient, siteId: string): Promise<{ siteId: string; checks: AiCheck[]; skipped?: string }> {
  const [{ data: site }, { data: loc }, { data: cat }] = await Promise.all([
    supabase.from('sites').select('name, status').eq('id', siteId).single(),
    supabase.from('locations').select('city, state').eq('site_id', siteId).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('site_categories').select('gbp_category:gbp_categories(display_name)').eq('site_id', siteId).eq('is_primary', true).limit(1).maybeSingle(),
  ]);
  if (!site || site.status !== 'active') return { siteId, checks: [], skipped: 'site inactive' };
  const category = ((cat?.gbp_category as unknown as { display_name?: string } | null)?.display_name) || null;
  if (!category || !loc?.city || !loc.state) return { siteId, checks: [], skipped: 'need a primary category and a city' };
  const models = aiModelsAvailable();
  if (models.length === 0) return { siteId, checks: [], skipped: 'no AI provider keys' };

  const prompts = visibilityPrompts(category, loc.city, loc.state);
  const checks: AiCheck[] = [];
  const batchAt = new Date().toISOString();
  for (const model of models) {
    for (const prompt of prompts) {
      try {
        const { modelId, answer } = model === 'claude' ? await askClaude(prompt) : await askOpenAI(prompt);
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
