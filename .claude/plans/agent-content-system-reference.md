# GrowLocal 360 — Agent-Based Content Generation System Reference

> Compiled from competitive analysis of a 9-phase AI website builder workflow.
> This document serves as the feature spec and reference for building our upgraded content generation system.

---

## Architecture Overview

**Current system:** Single-shot Claude API calls inside Vercel serverless functions (2-5 min, self-chaining for timeouts)

**Target system:** Claude Agent running on persistent compute (Inngest or similar), with tools for research, planning, generation, image creation, and database writes. Real-time progress reporting to dashboard.

---

## Dashboard Layout

### Top Bar
- Client name displayed (e.g., "Water Heater Malden")
- "Hide Log" toggle (top-right)

### Stats Bar (5 metrics across the top):
- [ ] Pages Generated count
- [ ] Published count
- [ ] Pages Crawled count
- [ ] GBP Services count
- [ ] Link Opportunities count

### Left Sidebar Navigation:
- Dashboard (active/highlighted in green)
- Client Settings (no phase number — config area, not workflow phase)
- GBP Audit & Entity Research (P1)
- GBP Management (P2)
- Site Crawl & Analysis (P3)
- Content Production (P4)
- Images & Video — Optional (P5)
- WordPress Publish (P6)
- Video Publishing — Optional (P9)
- Content Library (no phase number — browsable content archive)

### Phase Cards (3x3 grid):
- [ ] Visual cards for each phase with phase number badges and icons
- [ ] Status indicators (green checkmark for completed, in-progress, etc.)
- [ ] Click into each phase for details
- [ ] Cards: Client Settings (gear), P1 GBP Audit (blue), P2 GBP Management (green checkmark when complete), P3 Site Crawl (globe), P4 Content Production (fire), P5 Images & Video (optional), P6 WordPress Publish (rocket), P9 Video Publishing (optional), Content Library (folder)

### Activity Log (right sidebar):
- [ ] Real-time activity feed showing every action the agent takes
- [ ] Timestamped entries (e.g., "8:42:13 PM — Entity overlap analysis completed for 'plumber' in malden")
- [ ] Shows: entity overlap analysis, site crawl completions, category audits
- [ ] "Hide Log" toggle
- [ ] Persisted to database for review

---

## Phase 0: Client Settings (Pre-Generation Configuration)

All of these settings feed into every content generation prompt as context.
Two separate save actions: "Save GBP Profile" and "Save Client Context".
Profile Completion progress bar at the top tracking how filled-in settings are.

### GBP Profile Data
- [ ] Profile Completion progress bar (~60% example, green)
- [ ] Primary Category (editable)
- [ ] Additional Categories (editable list with edit/delete icons, "+ Add Category")
- [ ] Services organized by category with add/edit/delete per category, "+ Add Service"
- [ ] "Save GBP Profile" button (green) + "Re-import" button (gray)

### Business Location & GBP
- [ ] Business address (auto-filled from GBP import)
- [ ] GBP Primary Category (auto-filled, noted "Auto-filled from your GBP Profile Data")
- [ ] GBP Secondary Categories (comma-separated, auto-filled)
- [ ] GBP Services (comma-separated, auto-populated from GBP import)

### About the Business
- [ ] Business description (rich text — owner name, years experience, license #, specialties, fleet size, job volume, service area)

### Credentials & Awards
- [ ] Free text — license numbers, insurance amounts, certifications, dealer partnerships, financing partners, BBB rating, review count/average

### Voice & Tone
- [ ] Tone (select up to 2, pill-style multi-select): Professional, Friendly & Warm, Authoritative & Expert, Casual & Conversational, Luxurious & Premium, Compassionate & Caring, Technical & Precise, Energetic & Bold
- [ ] Point of View: dropdown (We/Our, I/My, They/The Team, etc.)
- [ ] Words to Always Use: free text — industry-specific terms, local references, technical terminology
- [ ] Words to Never Use: free text — AI cliches, redundant terms, banned phrases

### Audience
- [ ] Target Audience: free text — demographics, housing types, knowledge level, pain points, landlords vs homeowners, etc.

### Reference Material
- [ ] Writing Samples: "Paste 2-3 examples of content this client likes or has written" — monospace text area with style guide content
- [ ] Onboarding Notes: "Call transcripts, intake form responses, discovery notes" — free text area

### Specific Requests (NEW)
- [ ] Free text area for client-specific instructions for content generation
- [ ] Example: "Any client-specific instructions for content generation..."

### Brand & CTA Settings
- [ ] Brand Primary Color: hex input with color swatch preview (e.g., #2563eb)
- [ ] Brand Accent Background: hex input with color swatch preview (e.g., #f0f7ff)
- [ ] Phone Number: used in CTA boxes for click-to-call links
- [ ] CTA Text: displayed in CTA boxes on published pages (e.g., "Call now for a free estimate")
- [ ] CTA Preview: live preview box showing "Need help? [phone] [CTA text]"

### Review Data
- [ ] Average Rating: number input (e.g., 4.8)
- [ ] Total Review Count: number input (e.g., 187)
- [ ] Review Source URL: URL input (e.g., Google Maps link)
- [ ] Note: "Enter your actual Google review stats. Leave blank to exclude review data from schema markup."

### Local Details
- [ ] Free text area for local information about the service area
- [ ] "Auto-Generate" button — searches for local housing stock, building codes, climate, and common issues specific to the area
- [ ] Auto-generated content includes: Housing Stock Age, Freezing Climate Challenges, local building specifics
- [ ] Note: "Local information about your service area. This gets injected into every article for authentic local flavor."
- [ ] **Multi-location**: each location gets its own Local Details (Lake Charles is different from Houston)
- [ ] Covers: business nuances, local landscape, community context, regional regulations, housing types, climate challenges

### Image Preferences
- [ ] Default Image Style: dropdown — Realistic Photography, Clean Illustration, Minimalist, Corporate
- [ ] Brand Style Guide: free text area — "Used as a prefix for all image generation prompts" (e.g., "show real work environments...")

### Save Actions
- [ ] "Save GBP Profile" (green) — saves GBP categories and services
- [ ] "Save Client Context" (green) — saves everything else (final save button at bottom)

---

## Phase 1: GBP Audit & Entity Research

Research phase that runs BEFORE any content is generated. Uses DataForSEO as the data source for competitor analysis.
This is a **standalone dashboard feature** — no agent or pipeline needed. Just an API route + UI component.

### Category Audit
- [ ] Inputs: Primary GBP Category + City (auto-filled from GBP Profile Data)
- [ ] "Run Category Audit" button (green)
- [ ] Your Categories vs Competitor Trends — two-column layout:
  - Left: Your GBP Categories (each tagged "Competitors use this too" or "Unique to you")
  - Right: Competitor Categories You're Missing (with competitor count, e.g., "Electrician (17 competitors)")
- [ ] Recommended Secondary Categories table: Category | Competitor Usage (bar chart) | Count
- [ ] **Add to Site** action — adds recommended categories to GrowLocal site structure (not to actual GBP listing)
- [ ] Note: "Want these on your GBP too? Add them manually at business.google.com"

### Multi-Location + No-GBP Support for Audit:
- [ ] **Single GBP**: Audit competitors for that location's primary category + city
- [ ] **Multi-GBP**: Audit competitors per location (each city may have different competitor landscape)
- [ ] **No GBP** ("Start Fresh"): User manually enters business type + city → still run competitor audit, but show only "Competitor Categories" (no "Your Categories" to compare against since no GBP data)
- [ ] All three paths feed into site categories that determine content silo structure

### Service Entity Overlap Research
- [ ] Purpose: "Determine which services Google treats as distinct entities worthy of their own page"
- [ ] Inputs: Seed Keyword + City + Candidate Entities (auto-filled from GBP services, with "Import from GBP" button)
- [ ] "Run Overlap Analysis" button (green)
- [ ] Shows "X seed businesses found" count
- [ ] Collapsible "Top seed businesses" list
- [ ] Results table: Service Entity | Results | Overlap % | Verdict | Action
- [ ] Verdict system with color-coded bars:
  - OVERLAPPING (red, >70%) — same businesses rank, don't need separate page
  - MODERATE (yellow, 50-70%) — borderline
  - DISTINCT (blue, <50%) — deserves its own page
- [ ] Actionable recommendation: "X Distinct Entities Need Their Own Page" — lists which services should get dedicated pages
- [ ] This directly informs content planning and the Content Production queue

---

## Phase 2: GBP Management

- [ ] GBP optimization and management dashboard
- [ ] Separate from Phase 1 (Audit) — P2 is about ongoing optimization
- [ ] Shows green checkmark when completed (likely auto-completes from GBP import)
- [ ] (Lower priority — focus on content generation first)

---

## Phase 3: Site Crawl & Analysis

### Site Crawler
- [ ] **Website URL** input field
- [ ] "Crawl the client website to extract page data, headings, schema, and technical info."
- [ ] **Crawling in progress** state: spinner, pages crawled count, current URL being crawled
- [ ] **Last crawl timestamp** displayed (e.g., "Last crawl: 2/20/2026, 2:39:23 PM — 24 pages")

### Crawl Stats Bar (6 metrics):
- [ ] Total Pages (e.g., 24)
- [ ] Avg Words (e.g., 4197)
- [ ] With Schema (e.g., 12) — pages that have structured data
- [ ] No H1 (e.g., 1, yellow warning) — pages missing H1 tags
- [ ] Internal Links (e.g., 497)
- [ ] External Links (e.g., 28)

### Crawl Results Table:
- [ ] Columns: URL | Title | Words | Service/Category (dropdown) | auto badge
- [ ] **Auto-assignment**: automatically maps crawled pages to GBP services/categories (e.g., "Auto-assigned: 16 | Not assigned: 8")
- [ ] Service/Category dropdown per row — manually assignable for pages that weren't auto-matched
- [ ] "auto" badge on rows that were automatically matched
- [ ] Expandable rows (chevron on each row)
- [ ] **"Save Assignments"** button to persist service/category mappings

### Gap Analysis
- [ ] "Compare crawl data vs GBP data vs entity research to find content gaps."
- [ ] Three data source toggles (checkboxes): Crawl Data | GBP Data | Entity Research
- [ ] "Run Gap Analysis" button (green)
- [ ] Cross-references all three sources to identify missing content

### What we need to build:
- [ ] Web crawler tool (fetch and parse existing site pages — URL, title, word count, schema, H1, links)
- [ ] Auto-assignment logic (match crawled pages to GBP services/categories)
- [ ] Gap analysis engine (compare crawl data vs GBP data vs entity research)
- [ ] Content plan generator (recommended pages, topics, keywords based on gaps)
- [ ] Rank tracking integration (optional/future)

---

## Phase 4: Content Production

### Two modes:
- [ ] **Single Page** — one-off generation for individual pages
- [ ] **Bulk Queue** — batch generation for multiple pages (toggle at top)

### Bulk Queue 4-Step Pipeline:
1. **Build Queue** — import and configure items
2. **Outlines** — generate outlines for review
3. **Generate** — write full content from approved outlines
4. **Review & Publish** — review and publish to site

### Step 1: Build Queue
- [ ] Import from two sources: "Import from Entity Overlap" (DISTINCT entities) | "Import from GBP" | "+ Add Item"
- [ ] Global Defaults:
  - Content Type: Service Page (dropdown)
  - Target City: e.g. "malden ma"
  - Images per Page: 4
  - Video: Every 5th item (dropdown)
  - Checkboxes: Humanize content, AI Detection, Auto-approve outlines
  - Publish Controls: Auto-publish to WP (draft), Auto-upload to YouTube
- [ ] Queue table columns: Service Name | Type | Images | Video | Source | Parent Page | delete
- [ ] Source column shows origin: "Entity (DISTINCT)" or "GBP"
- [ ] Parent Page dropdown per row (allows nesting service pages under category pages)
- [ ] Per-item configurability for type, images, video, parent page
- [ ] Summary stats bar: "X selected, Y with video, Est. time: ~Z min" (roughly 3-4 min per page)
- [ ] "Generate Outlines (X)" button — proceeds to step 2
- [ ] "Full Auto (X)" button (green) — skips manual outline review, runs all 4 steps automatically

### Step 2: Outlines
- [ ] "Generating outlines..." progress bar (green) with per-item spinner
- [ ] Outlines generate in parallel (one completing while another is in progress)
- [ ] Each completed outline shows: service name + "X sections | Y FAQs" (e.g., "12 sections | 5 FAQs")
- [ ] **"Approve" button** per outline — manual review before generation (unless "Auto-approve outlines" was checked in Build Queue)
- [ ] Outline structure (expandable per service):
  - **SEO Title**: "[Service] in [City], [State] -- [Modifiers]" (e.g., "Septic System Service in Malden, MA -- Pumping, Inspection & Repair")
  - **H2 sections** with detailed bullet-point content plans per section (not full content, just outlines)
  - Each bullet describes what to cover: specific facts, credentials, local references, processes, pricing mentions
  - Sections incorporate Client Settings context: license numbers, insurance, BBB rating, service areas, brand name, local details
  - Example sections: service overview, how it works, process description, repairs handled, why choose us, service areas
  - **FAQs** (typically 5): question + brief answer outline per FAQ
  - **Snippet target** at bottom — identifies a Google featured snippet opportunity (e.g., "How often should a septic tank be pumped?")

### Step 3: Generate
- [ ] Writes full long-form content from approved outlines
- [ ] ~3,500-4,200 words per service page
- [ ] Generates DALL-E images (4 per page by default)
- [ ] Generates Pictory video for flagged items

### Step 4: Review & Publish
- [ ] Summary stats bar (3 metrics): Completed (green) | Failed (red) | Total Words
- [ ] "Upload All Videos (X)" button — batch video upload to YouTube
- [ ] Results table columns: Service | Words | AI Score | Images | Video | Status | Actions
  - Words: actual word count (e.g., 4,211 / 3,734)
  - AI Score: AI detection score (can be "--" if not run)
  - Images: fraction showing generated vs requested (e.g., "4/4" in green)
  - Video: "Published" with video icon, or "--"
  - Status: "Published" with green checkmark
  - Actions: 5 icons — view (eye), edit (pencil), settings (gear), copy (clipboard), external link
- [ ] **Publish to WordPress** section:
  - Publish Strategy dropdown: "Save as Drafts" (likely also "Publish Immediately")
  - "Save All as Drafts (X pages)" button (green)

### Published Page Structure (what gets output):
- [ ] **Title format**: "[Service] [City], [State] | [Business Name]" — SEO-optimized
- [ ] **Hero section**: dark background, H1 title, subtitle, "Call Now [phone]" button (gold/brand color), "Schedule Service" button (outlined)
- [ ] **Trust badges**: Licensed & Insured, 24/7 Emergency Service, Locally Owned & Operated, Satisfaction Guaranteed
- [ ] **DALL-E images**: with captions "[service] -- [Business Name] [number]"
- [ ] **Quick Summary box** (blue left border): concise paragraph with phone number, key selling points, CTA
- [ ] **Table of Contents** ("What's Covered on This Page"): two-column anchor link navigation with section headings + FAQ questions
- [ ] **Long-form content sections**: ~8-10 H2 sections with detailed content (~3,500-4,200 words total)
- [ ] **CTA sections**: "Need [service]?" with phone number and call-to-action (appears between content sections)
- [ ] **FAQ section**: 5+ questions with full answers
- [ ] **Video embed section** (if video generated): dark background, "WATCH OUR VIDEO" label, "See How We Handle [service] in [city]", embedded YouTube player
- [ ] **Footer**: "[Business] -- Licensed professionals serving [city] and surrounding areas"

### Schema Markup (per published page):
- [ ] Organization (1 item)
- [ ] VideoObject (1 item, if video present)
- [ ] Article (1 item)
- [ ] Service (1 item)
- [ ] FAQPage (1 item)
- [ ] WebSite (1 item)
- [ ] CreativeWork (1 item)
- All validated with 0 errors, 0 warnings on Schema.org validator

### Content types to generate:
- [ ] Core pages (home, about, contact)
- [ ] Category pages
- [ ] Service pages (rich: intro, body, problems solved, detailed sections, FAQs)
- [ ] Service area pages (city-specific landing pages)
- [ ] Brand pages (brand-specific landing pages)

### Quality controls:
- [ ] Two-pass generation: outline -> then full content
- [ ] Tone/voice enforcement from Client Settings
- [ ] Words to always use / never use enforcement
- [ ] Writing style matching from reference samples
- [ ] Target audience awareness in content framing
- [ ] Humanize content toggle (variation in sentence structure and vocabulary to avoid AI detection)
- [ ] AI Detection checking toggle (AI Score column in Review & Publish)
- [ ] Specific dollar ranges, brand names, local references (not generic)
- [ ] Local Details injection for authentic local flavor
- [ ] Snippet targeting per page for Google featured snippets

---

## Phase 5: Images & Video (Optional)

### Image Generation:
- [ ] **Per-page image count**: configurable in Bulk Queue Global Defaults (default: 4 per page)
- [ ] **Per-item override**: each queue item can have its own image count
- [ ] **Image style**: configurable in Client Settings (Default Image Style dropdown):
  - Realistic Photography, Clean Illustration, Minimalist, Corporate
- [ ] **Brand Style Guide**: free text in Client Settings, used as prefix for all image prompts (e.g., "show real work environments...")
- [ ] **Image captions**: auto-generated as "[service] -- [Business Name] [number]"
- [ ] **Storage**: images saved to Supabase storage, referenced in service/page records

### Image Generation APIs (available accounts):
- [ ] **DALL-E** (via OpenAI/ChatGPT account) — ~$0.04-0.08 per image
- [ ] **Google Imagen** (via Gemini Pro account) — alternative option
- [ ] Recommendation: Start with DALL-E (proven quality for service business imagery), evaluate Imagen as alternative

### Video Generation Pipeline:
- [ ] **Source**: takes generated page content (intro, sections, FAQs) and converts to narrated video
- [ ] **Google Veo** (via existing Gemini Pro account) — AI video generation from text/images
  - Can generate video clips from text descriptions of services
  - Combine with generated images for service-specific video content
  - Narration/voiceover from page content
- [ ] **Alternative**: Pictory, Synthesia, InVideo, Lumen5 (~$0.50-2.00 per video)
- [ ] **Configurable**: video for every Nth service (dropdown in Bulk Queue), or per-item toggle
- [ ] **Per-location**: videos customized per location for multi-location sites (e.g., "Water Heater Installation in Malden" vs "Water Heater Installation in Medford")

### YouTube Upload Pipeline:
- [ ] **YouTube Data API v3** — requires OAuth consent from user for their YouTube channel
- [ ] Auto-generated metadata: title, description, tags from page content
- [ ] Title format: "[Service] - [Business Name]" (e.g., "Septic system service - Water Heater Malden")
- [ ] Embed back on service page after upload (VideoObject schema markup)
- [ ] **Video sitemap generation** for SEO
- [ ] "Upload All Videos (X)" batch upload button in Review & Publish step

### What we need to build:
- [ ] Image generation API integration (DALL-E via OpenAI, or Google Imagen via Gemini)
- [ ] Image style configuration UI (Client Settings)
- [ ] Per-page image count configuration (Bulk Queue)
- [ ] Brand Style Guide prompt prefix (Client Settings)
- [ ] Video generation integration (Google Veo or Pictory)
- [ ] YouTube OAuth flow for channel access
- [ ] YouTube upload API integration (Data API v3)
- [ ] Video sitemap generation
- [ ] Video embed component for service pages

---

## Phase 6: WordPress Publish

- [ ] Not applicable to us — we publish to our own Next.js sites
- [ ] Our equivalent: trigger ISR revalidation after content is saved
- [ ] Competitor publishes "with schema markup" — we should ensure structured data on our pages too

---

## Phase 7-8: (Unknown / Not shown)

- Phases 7 and 8 appear to be missing from his dashboard — jumps from P6 to P9

---

## Phase 9: Video Publishing (Optional)

- [ ] Upload videos to YouTube
- [ ] Create video sitemaps
- [ ] (Future phase for us)

---

## Content Library (NEW — 10th section, no phase number)

- [ ] Browsable and searchable archive of all generated content
- [ ] Folder icon in sidebar and phase card
- [ ] Description: "Browse and search all generated content"
- [ ] (No screenshots captured yet — details TBD)

---

## Decision: AI Agent vs Current System

### Option A: Keep Current System (Single-Shot API Calls in Vercel)

**Pros:**
- Predictable and deterministic — same input produces consistent output every time
- Simple architecture — no new infrastructure to manage
- Already working — content generation is functional today
- Low cost per site (~$0.30-0.50)
- Easy to debug — single API call, clear error path
- No new dependencies (no Inngest, no worker infrastructure)

**Cons:**
- Vercel timeout ceiling (60s on Hobby, 300s on Pro) — forces self-chaining hacks with `waitUntil`
- Can't run 60+ minute multi-phase workflows (research, outline, generate, images)
- No real-time progress reporting — user stares at a spinner
- Single-shot means no outline review step — goes straight to final content
- Can't incorporate research phase (entity overlap, competitor analysis, gap analysis)
- Content quality limited by single prompt context — no iterative refinement
- No way to do bulk queue with 18+ pages in one run
- Self-chaining is fragile and hard to maintain

### Option B: AI Agent on Persistent Compute (Inngest/Similar)

**Pros:**
- No timeout limits — can run 60+ minutes building out all phases
- Enables the full multi-phase workflow: research -> outline -> generate -> review -> publish
- Real-time activity log and progress reporting (Supabase Realtime)
- Two-pass generation (outline then content) produces significantly better content
- Can incorporate research data (entity overlap, competitor analysis) into content
- Bulk queue with parallel generation
- Snippet targeting, AI detection scoring, and quality controls become possible
- Matches competitor's proven workflow that produces ~4,000+ word service pages
- Can pause for human approval (outline review) then resume

**Cons:**
- Somewhat unpredictable — agent may take unexpected paths or make wrong tool choices
- Higher cost per site (~$3-10 vs $0.30-0.50)
- More complex architecture — new infrastructure (Inngest), new DB tables (build_logs), Realtime subscriptions
- Harder to debug — multi-step workflows with branching logic
- Agent errors can cascade — one bad decision early affects downstream steps
- New dependency on Inngest (or similar) — another service to manage
- Requires guardrails and fallback logic to handle agent failures gracefully
- Development time to build the agent, tools, and dashboard UI

### Option C: Hybrid — Deterministic Orchestration on Persistent Compute (Inngest + Structured Pipelines)

Not a true "agent" that reasons about what to do next — instead, a **fixed multi-step pipeline** running on Inngest with Claude API calls at each step. The orchestration logic is code you write (deterministic), but the content generation at each step uses Claude (AI). Think of it as "agent-quality output with pipeline-level predictability."

**Pros:**
- No timeout limits (Inngest) — same as Option B
- Predictable execution — steps run in a fixed order, no agent deciding what to do next
- Real-time progress reporting — same as Option B (Supabase Realtime)
- Two-pass generation (outline then content) — same quality improvement as Option B
- Each step is independently testable and debuggable — if step 3 fails, you know exactly where
- No agent unpredictability — Claude is used for content generation, not for deciding workflow
- Errors don't cascade — pipeline catches failures at each step with clear retry/fallback logic
- Can still do bulk queue, parallel generation, research phases — all orchestrated by code
- Lower cost than full agent — fewer Claude calls (no reasoning about tool selection)
- Incremental to build — each pipeline step can be added independently

**Cons:**
- Less flexible than a true agent — can't adapt to unexpected situations or make creative decisions about workflow
- Still requires Inngest infrastructure (same as Option B)
- Pipeline logic is hardcoded — adding new phases requires code changes (an agent could potentially learn new workflows)
- Still higher cost than Option A (~$2-6 per site vs $0.30-0.50), though less than full agent
- Development time to build pipeline steps, though simpler than building agent tools + reasoning

**How it works:**
1. Inngest function triggered with site ID + configuration
2. Step 1: Fetch Client Settings from DB (deterministic)
3. Step 2: Run entity overlap analysis — Claude API call with structured output (deterministic orchestration, AI content)
4. Step 3: Generate outlines — Claude API call per service, save to DB, optionally pause for human approval
5. Step 4: Generate full content — Claude API call per service using outline + Client Settings context
6. Step 5: Generate images — DALL-E API calls (deterministic)
7. Step 6: Save to DB + trigger ISR revalidation (deterministic)
8. Each step logs progress to `build_logs` table for real-time UI updates

### Recommendation:
**Go with the Hybrid approach (Option C)** — deterministic pipelines on Inngest with Claude for content generation:
1. Start by moving current generation to Inngest (solves timeout, adds real-time logs) — low risk
2. Add Client Settings expansion (feeds better context into existing prompts) — no agent needed
3. Add outline step (two-pass generation) — second Inngest step in the pipeline
4. Layer in research phases (entity overlap, gap analysis) as additional pipeline steps
5. Build bulk queue and full auto mode last
6. Optionally evolve toward a true agent (Option B) later if the pipeline approach hits limitations

This gives us the competitor's workflow quality and the agent's timeout-free execution, while keeping the predictability and debuggability of structured code. Best of both worlds.

### Key Clarification: Content Generation vs Frontend Rendering

**The agent/pipeline only generates content data — it does NOT build the website.**

Our advantage over the competitor:
- **Competitor**: Agent generates content -> dumps into WordPress -> generic theme renders it (random, poorly designed)
- **Us**: Agent/pipeline generates content -> saves to Supabase (`services`, `site_pages` tables) -> our custom Next.js template renders it (polished, consistent design)

What stays the same regardless of Option A, B, or C:
- URL structure: `/sites/[slug]/locations/[location]/[serviceOrCategory]/[service]`
- Template components: `src/components/templates/local-service-pro/` (SiteHeader, HeroSection, TrustBar, etc.)
- Design system: Tailwind + shadcn/ui, brand colors, responsive layout
- DB schema: `services` table (intro_copy, problems, detailed_sections, faqs), `site_pages` table (hero_description, body_copy_2)
- ISR/SSG rendering with on-demand revalidation

What changes with Option B/C:
- *How* the content is generated (single-shot vs pipeline vs agent)
- *How much context* feeds into generation (Client Settings, research data, outlines)
- *How long* generation can run (no timeout limits)
- *Quality* of the generated content (two-pass, research-informed, snippet-targeted)

The agent is the kitchen. The template is the restaurant. Upgrading the kitchen produces better food — the dining experience (design, layout, UX) only gets better because the content is better.

---

## Infrastructure Decisions

### Compute for Agent:
- **Recommendation:** Inngest (serverless long-running jobs, Next.js integration)
- **Alternative:** Railway/Fly.io worker, Trigger.dev, BullMQ + Redis

### Inngest Pricing (as of March 2026):
| | Hobby (Free) | Pro ($75/mo) |
|--|--|--|
| Executions/mo | 50,000 | 1M (up to 20M add-on) |
| Concurrent steps | 5 | 100+ |
| Realtime connections | 50 | 1,000+ |
| Users | 3 | 15+ |
| Features | Unlimited branch/staging envs, logs/traces, basic alerting, community support | Granular metrics, higher throughput, 7-day trace retention |

**Plan Decision:**
- Start on **Hobby (Free)** for development and early customers
- Upgrade to **Pro ($75/mo)** before significant customer volume (5 concurrent steps becomes a bottleneck with 10+ simultaneous site builds)
- At 1,000 customers: Pro is required (100+ concurrent steps, 1M executions handles ~65K site builds/mo)

### Progress Reporting:
- **Recommendation:** `build_logs` table in Supabase + Supabase Realtime subscription
- Replaces current polling-based progress tracking

### AI Model:
- Agent orchestration: Claude Opus 4.6 (for reasoning and tool selection)
- Content generation: Claude Sonnet 4.6 (for actual page content — cost-effective)
- Could use Opus for research/planning phases, Sonnet for bulk content generation

### External APIs:
- DataForSEO — competitor category/service analysis for GBP Audit & Entity Research
- **DALL-E** (OpenAI) — image generation (have account)
- **Google Imagen/Gemini Pro** — alternative image generation (have account)
- **Google Veo** — AI video generation from text/images (have account via Gemini Pro)
- **YouTube Data API v3** — video upload + channel management
- **Anthropic Claude** — content generation (have account)
- **OpenAI ChatGPT** — have account (DALL-E, potential fallback for content)

### Available Accounts:
- Claude (Anthropic) — primary content generation
- ChatGPT (OpenAI) — DALL-E image generation
- Google Gemini Pro / Veo — video generation, alternative image generation

### Cost Considerations:
- Current: ~$0.30-0.50 per site (Sonnet only, single-shot calls)
- Pipeline approach (Option C): ~$2-6 per site (multi-step, research, outlines + content)
- Agent approach (Option B): ~$3-10 per site (more API calls, agent reasoning overhead)
- Image generation: ~$0.04-0.08 per DALL-E image, 4 per page = ~$0.16-0.32 per page
- Video generation: TBD (Google Veo pricing, or ~$0.50-2.00 per video with Pictory)
- Justification: higher quality content = better SEO results = justified at our price point

---

## Implementation Priority

### Phase 1 (MVP — Highest Impact):
1. Client Settings expansion (Voice & Tone, Audience, Reference Material, About the Business, Specific Requests, Brand & CTA, Review Data, Local Details, Image Preferences)
2. Move content generation to Inngest (eliminate timeout issues)
3. Feed all Client Settings context into generation prompts
4. Real-time build log (Supabase Realtime)

### Phase 2 (Research & Planning):
5. GBP audit tool (Category Audit with competitor comparison)
6. Entity Overlap Analysis (with OVERLAPPING/MODERATE/DISTINCT verdicts)
7. Competitor crawl & analysis
8. Content plan generation (outlines before full content)

### Phase 3 (Content Production Upgrade):
9. Bulk Queue with 4-step pipeline (Build Queue -> Outlines -> Generate -> Review & Publish)
10. Import from Entity Overlap + GBP into queue
11. Full Auto mode
12. Parent Page hierarchy support

### Phase 4 (Media — Images):
13. DALL-E image generation integration (via OpenAI account)
14. Image style/quantity configuration (Client Settings + Bulk Queue)
15. Brand Style Guide as image prompt prefix

### Phase 5 (Media — Video):
16. Google Veo video generation from page content
17. YouTube OAuth flow + upload integration (Data API v3)
18. Video embed component + VideoObject schema
19. Video sitemap generation

### Phase 6 (Advanced):
20. GBP management/optimization (P2)
21. Rank tracking
19. Content Library (browsable archive)

---

## Screenshots Reference

Screenshots captured from YouTube video: "Build An SEO-Perfect Website With AI"

### Dashboard:
- Dashboard overview with phase cards (3x3 grid), stats bar, left sidebar nav, activity log
- Dark theme UI, client name in top bar

### Client Settings (10 screenshots):
- GBP Profile Data: Profile Completion bar, categories list, services by category
- Business Location & GBP: address, auto-filled category/services fields
- About the Business: rich text business description
- Credentials & Awards: license, insurance, certifications, BBB, reviews
- Voice & Tone: pill-style tone selection (max 2), POV dropdown, words to use/avoid
- Audience: target audience free text
- Reference Material: writing samples (monospace), onboarding notes
- Specific Requests: free text for client-specific generation instructions
- Brand & CTA Settings: primary color, accent color, phone, CTA text, live CTA preview
- Review Data: average rating, total count, source URL
- Local Details: free text + Auto-Generate button (housing, building codes, climate)
- Image Preferences: Default Image Style dropdown (4 options), Brand Style Guide text

### Site Crawl & Analysis (3 screenshots):
- Site Crawler results: stats bar (Total Pages, Avg Words, With Schema, No H1, Internal Links, External Links), crawl results table with auto-assignment
- Crawling in progress state + Gap Analysis section (Crawl Data vs GBP Data vs Entity Research toggles, Run Gap Analysis button)
- Crawl results with Service/Category dropdowns populated (auto-assigned mappings)

### GBP Audit & Entity Research (3 screenshots):
- Category Audit: your categories vs competitor trends, recommended secondary categories table
- Entity Overlap Research: seed keyword + city input, candidate entities from GBP
- Entity Overlap Results: table with Overlap %, Verdict (OVERLAPPING/MODERATE/DISTINCT), actionable recommendations

### Content Production (10 screenshots):
- Bulk Queue toggle (Single Page vs Bulk Queue)
- Build Queue: import buttons, global defaults, queue table
- Populated queue with Entity (DISTINCT) and GBP sources, parent page dropdowns
- Queue footer: summary stats, "Generate Outlines" and "Full Auto" buttons, time estimate
- Step 2 Outlines: progress bar, per-item spinner, "Approve" button, section/FAQ counts
- Outline detail: SEO title, H2 sections with bullet-point content plans, FAQs with answer outlines, snippet target
- Step 4 Review & Publish: Completed/Failed/Total Words stats, results table (Words, AI Score, Images, Video, Status, Actions)
- Publish to WordPress: strategy dropdown (Save as Drafts), batch publish button
- WordPress Pages list: 21 pages generated, Published/Draft statuses
- Published page: hero with CTAs + trust badges, Quick Summary box, Table of Contents, DALL-E images with captions, YouTube video embed
- Schema.org validation: Organization, VideoObject, Article, Service, FAQPage, WebSite, CreativeWork — all 0 errors
