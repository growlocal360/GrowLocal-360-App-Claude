# GrowLocal 360 — Claude Instructions

## Project context

GrowLocal 360 is a website builder for local service businesses. The onboarding flow analyzes Google Business Profile (GBP) and Google Search Console (GSC) data, classifies businesses into one of 9 architecture scenarios, and generates SEO-optimized sites with auto-routed job snap content.

## Architecture references

When working on the onboarding analysis module, GSC integration, site generation, scenario classification, or URL routing — always read the relevant architecture doc first:

- **Site analysis & onboarding logic:** `docs/architecture/growlocal360_master_prompt_v4.md`
- **Job snap URL generation:** `docs/architecture/growlocal360_job_snap_slug_spec.md`

## Key rules to never violate

- `/service-areas/` is ALWAYS a single page, never a folder
- `/locations/` IS a folder, but only contains GBP-anchored cities as children
- All service pages live FLAT at root (never under `/services/`)
- Washer and dryer always combined as `/washer-dryer-repair/`
- Sub-services NEVER link directly to city pages
- The `/appliance-repair/{city}/` city hub is REQUIRED for every far city in WIDE scenarios
- A thin city page is worse than no city page — quality over quantity