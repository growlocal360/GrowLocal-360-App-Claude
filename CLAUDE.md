# GrowLocal 360 — Claude Instructions

## Project context

GrowLocal 360 is a website builder for local service businesses. The onboarding flow analyzes Google Business Profile (GBP) and Google Search Console (GSC) data, builds the site on the **Town Page model** (home = primary category + Primary Market; one page per served town under `/service-areas/`; a town with its own GBP becomes `/locations/{city}/` with a service silo beneath it), and generates SEO-optimized sites with auto-routed job snap content.

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
- `/service-areas/` IS a folder: every town WITHOUT its own GBP that earns a page is `/service-areas/{city}/`. The index lists every served town (linked when a page exists, plain text when not)
- `/locations/` IS a folder for pages WITH their own GBP: `/locations/{city}/`. A town never appears under `/locations/` without a GBP. "Own GBP" is the only test for which folder
- A **plain town page** lists the full main service list with cards linking to the ROOT service pages. It has no children
- A town is **promoted** only when it has its own GBP listing. Then it moves to `/locations/{city}/` (301 from the town URL), its cards link to `/locations/{city}/{service}/`, that silo is generated, and that GBP's website link points at the location page. Removing the GBP demotes it back
- NEVER build `/{service}/{city}/` or `/{city}/` at root
- An existing home page is NEVER demoted when branches are added. A brand-centric home (no Primary Market) is only for a business that is multi-location on day one
- Click depth is about LINKS, not folders: home links directly to every location page; a location page links directly to its silo and suburb pages
- Travel strategy (Local / Regional / Metro) sets only HOW MANY towns get a page (0 / ~6–9 / ~9–12). It never changes a page's shape. "Multi-market" = promoted town pages, not a different site type (Microsite is still its own type)
- The Primary Market never gets a town page; `/service-areas/{primary-market}/` redirects to `/`. Towns within ~10 mi of the Primary Market are text on the index unless marked priority
- Sub-services never link to town pages; town pages never link to sub-services
- A thin town page is worse than no town page — quality over quantity
