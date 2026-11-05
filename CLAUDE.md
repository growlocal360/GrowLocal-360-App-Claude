# GrowLocal 360 — Claude Instructions

## Project context

GrowLocal 360 is a website builder for local service businesses. The onboarding flow analyzes Google Business Profile (GBP) and Google Search Console (GSC) data, builds the site on the **Town Page model** (home = primary category + Primary Market; one town page per served city under `/service-areas/`; a town is promoted into a silo only when it gets its own GBP), and generates SEO-optimized sites with auto-routed job snap content.

## Architecture references

When working on the onboarding analysis module, GSC integration, site generation, Primary Market / travel-strategy logic, or URL routing — always read the relevant architecture doc first:

- **Site analysis & onboarding logic (CANONICAL):** `docs/architecture/growlocal360_master_prompt_v6.md`
  - (v5 is deprecated — see `docs/architecture/archive/growlocal360_master_prompt_v5.md`. Its brand-level home page, `/{primary-market}/` hub, `/{city}/` root hubs, Pattern 1 `/{service}/{city}/` pages and "service-areas is never a folder" rule are all retired. v4's 9-scenario framing is also archived.)
  - Live reference site for the model: latourshvac.com (single-GBP, ranks for city + service terms).
- **Job snap URL generation:** `docs/architecture/growlocal360_job_snap_slug_spec.md`

## Key rules to never violate

- The home page is `{primary GBP category} in {Primary Market}` and is the first GBP's landing page (GBP website link → `/`). No brand-level home, no separate `/{primary-market}/` hub
- The **Primary Market** is a strategy decision (where the business wants its next customers), not the GBP address
- All main service pages live FLAT at root (never under `/services/`); sub-services nest one level under their parent service
- The **main service list** = every primary-category service at `/{service}/` + every secondary GBP category as a hub at `/{category}/` (with `/{category}/{service}/` beneath). Home, every town page, footer and sitemap render this same list in the same order. Never filter it by category
- Washer and dryer always combined as `/washer-dryer-repair/`
- `/service-areas/` is the locations hub and IS a folder: every town page is `/service-areas/{city}/`. The index lists every served town (linked when a page exists, plain text when not)
- A **plain town page** lists the full main service list with cards linking to the ROOT service pages. It has no children
- A town page is **promoted** only when that town has its own GBP listing. Then its cards link to `/service-areas/{city}/{service}/`, that silo plus `/service-areas/{city}/{neighborhood}/` is generated, and that GBP's website link points at the town page. Removing the GBP demotes it (children 301 to the town page)
- NEVER build `/{service}/{city}/`, `/{city}/` at root, or anything under `/locations/`
- Travel strategy (Local / Regional / Metro) sets only HOW MANY towns get a page (0 / ~6–9 / ~9–12). It never changes a page's shape. "Multi-market" = promoted town pages, not a different site type (Microsite is still its own type)
- The Primary Market never gets a town page; `/service-areas/{primary-market}/` redirects to `/`. Towns within ~10 mi of the Primary Market are text on the index unless marked priority
- Sub-services never link to town pages; town pages never link to sub-services
- A thin town page is worse than no town page — quality over quantity
