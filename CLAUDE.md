# GrowLocal 360 — Claude Instructions

## Project context

GrowLocal 360 is a website builder for local service businesses. The onboarding flow analyzes Google Business Profile (GBP) and Google Search Console (GSC) data, determines the site shape from the **Primary Market model** (businessType × travel strategy × primary market), and generates SEO-optimized sites with auto-routed job snap content.

## Architecture references

When working on the onboarding analysis module, GSC integration, site generation, Primary Market / travel-strategy logic, or URL routing — always read the relevant architecture doc first:

- **Site analysis & onboarding logic (CANONICAL):** `docs/architecture/growlocal360_master_prompt_v5.md`
  - (v4 is deprecated — see `docs/architecture/archive/growlocal360_master_prompt_v4.md`. The 9-scenario / "anchor city" framing is retired.)
- **Job snap URL generation:** `docs/architecture/growlocal360_job_snap_slug_spec.md`

## Key rules to never violate

- `/service-areas/` is ALWAYS a single page, never a folder — it lists every city (linked when a page exists, plain text when not)
- `/locations/` parent is NEVER used (it falsely implies physical when SAB anchors exist)
- GBP-anchored cities (physical OR SAB) get a city-first hub at root: `/{city}/`, plus `/{city}/{service}/` per GBP category
- Non-anchored served cities use Pattern 1: `/{service}/{city}/`
- All service pages live FLAT at root (never under `/services/`); sub-services nest under their parent service
- Washer and dryer always combined as `/washer-dryer-repair/`
- Sub-services NEVER link directly to city pages — brand service hubs connect sub-services to city pages
- Top 2-3 services only get Pattern 1 city-page depth (prevents thin-page bloat)
- The **Primary Market** is a strategy decision (where the business wants its next customers), not the GBP address; the GBP website link should point to `/{primary-market}/`
- A thin city page is worse than no city page — quality over quantity