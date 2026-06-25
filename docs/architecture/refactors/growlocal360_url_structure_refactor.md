# GrowLocal 360 — URL Structure & Primary Market Refactor

**Purpose:** Refactor GrowLocal 360's site generation logic to use the Primary Market model and the updated URL structure rules. This replaces the previous "anchor city" terminology and aligns the platform with the current framework.

**Execution model:** Execute this entire refactor as one continuous task. Confirm understanding before starting, then complete all sections sequentially without waiting for further instruction.

---

## REFERENCE DOCUMENTS

Read these files first to understand existing context:
1. `CLAUDE.md` (repo root)
2. `docs/architecture/growlocal360_master_prompt_v4.md` (current master prompt — will be superseded)
3. `docs/architecture/growlocal360_job_snap_slug_spec.md` (job snap URL rules — stays valid)
4. Any existing onboarding wizard code in the codebase

---

## WHAT'S CHANGING

The framework has evolved past v4. This refactor incorporates the following changes:

1. **"Anchor City" → "Primary Market"** throughout
2. **Travel strategy** added as a first-class onboarding input
3. **Top 2-3 services rule** limits Pattern 1 city page bloat
4. **GBP-anchored cities use city-first hubs** (`/{city}/`) regardless of physical or SAB
5. **Flat URL structure** — `/locations/` parent removed entirely
6. **`/service-areas/` page** lists ALL cities (linked when pages exist, text when not)

---

## CORE FRAMEWORK RULES (THE NEW CANONICAL VERSION)

### Primary Market

The Primary Market is the city or market the business wants to prioritize first for SEO, internal linking, GBP landing page strategy, and content distribution. It may or may not be the same as the dispatch city, physical address city, or largest nearby city.

**Rules:**
- Primary Market is determined by business strategy, not GBP address
- For most clients, the Primary Market and the GBP-anchored city will be the same — but the framing should always be strategy-first
- The GBP website field should usually point to `/{primary-market}/`, not the homepage
- The Primary Market gets prioritized internal linking, top homepage placement, priority job snap routing, and the strongest content depth

### Travel Strategy

Asked during onboarding. Four options:

- **Local (0-15 miles):** One Primary Market + nearby adjacent towns only. Avoid creating broad metro pages.
- **Regional (15-30 miles):** Primary Market hub + supporting service area/city pages within regional radius.
- **Metro (30+ miles):** Primary Market hub + broader metro-level supporting pages. Larger competitive cities can exist but should not automatically become the Primary Market.
- **Multi-market:** Multiple market hubs, each with its own city/service structure.

### URL Structure Rules

Apply ALL of these consistently:

1. All service pages live FLAT at root (never under `/services/`)
2. Sub-services nest under parent service (e.g., `/refrigerator-repair/not-cooling/`)
3. `/service-areas/` is ALWAYS ONE PAGE — never a folder, never has children
4. GBP-anchored cities (physical OR SAB) get `/{city}/` city-first hub at root
5. GBP-anchored cities also get `/{city}/{service}/` pages for each GBP category service
6. Non-anchored cities (served but no GBP) use Pattern 1: `/{service}/{city}/`
7. `/locations/` parent is NEVER used — it falsely implies physical when SAB anchors exist
8. Washer/dryer always combined as `/washer-dryer-repair/` (matches GBP category)
9. Sub-services NEVER link directly to city pages
10. Brand-level service hubs are the connector between sub-services and city pages
11. The homepage stays brand-level (no city in H1) unless the business is single-location AND the user explicitly designates the homepage as the Primary Market page
12. Quality over quantity — thin city page is worse than no city page

### Top 2-3 Services Rule

When building Pattern 1 city pages:

- Identify the top 2-3 revenue-generating services (from GBP categories + client input)
- Build Pattern 1 city pages ONLY for those services
- Lower-volume services are covered by their brand hub and mentions in city content
- This prevents combinatorial bloat (3 services × 6 cities = 18 thin pages)
- Better to have 6 strong pages than 18 weak ones

### City Page Decision Logic

For each city in the service area, determine treatment:

```
If city has its own GBP anchor (physical or SAB):
  → /{city}/ hub (city-first)
  → /{city}/{service}/ for each GBP category

Else if city is within ~10 miles of Primary Market:
  → Proximity-covered, NO dedicated page
  → Listed as text on /service-areas/ page

Else if city is a priority for one of the top 2-3 services:
  → Pattern 1: /{service}/{city}/

Else:
  → Listed as text only on /service-areas/ page
  → No dedicated page
```

### Service Areas Page Treatment

The `/service-areas/` page:
- Single page, never a folder
- Lists EVERY city in the service area
- Cities with dedicated pages get linked
- Cities without dedicated pages are listed as plain text
- Structure: grouped by region/parish/county when applicable
- Always includes the Primary Market prominently at top
- Includes service area map, response time info, and FAQs

When new pages are built (Pattern 1 or city hubs), the `/service-areas/` page updates to convert that city's text mention to a link.

---

## SECTION 1: DOCUMENTATION UPDATE (do first)

### 1A: Create v5 master prompt

Create `docs/architecture/growlocal360_master_prompt_v5.md` that incorporates all the framework rules above. This supersedes v4.

The v5 document should include:
- Connector state handling (GBP, GSC, both, neither) — same as v4
- All inputs collected during onboarding (now including travel strategy and Primary Market)
- The new four-part analysis (GSC scoping, GBP audit, demand analysis, classification)
- URL structure rules (the 12 above)
- Top 2-3 services rule
- Travel strategy logic
- Primary Market logic
- City page decision logic
- Service areas page treatment
- Page inventory templates per travel strategy + business type
- Output format specifications

Mark v4 as deprecated. v5 is canonical going forward.

### 1B: Update CLAUDE.md

Update the repo root `CLAUDE.md` to reference v5 as the canonical architecture doc. Update any "anchor city" terminology to "Primary Market." Keep references to the job snap slug spec.

### 1C: Archive v4

Move `docs/architecture/growlocal360_master_prompt_v4.md` to `docs/architecture/archive/growlocal360_master_prompt_v4.md` with a header note: "Superseded by v5. Kept for reference."

---

## SECTION 2: ONBOARDING WIZARD REFACTOR

### 2A: Add Travel Strategy question

After the GBP connection step (or service area collection step if no GBP), add a new question:

**Question:** "What is your travel strategy?"

**Options:**
- Local: 0-15 miles
- Regional: 15-30 miles
- Metro: 30+ miles
- Multi-market: multiple distinct cities/metros

Store the answer in `siteConfig.travelStrategy`.

### 2B: Add Primary Market question

After the travel strategy question, add:

**Question:** "Where do you want most of your next customers to come from?"

**UX:**
- If GBP service areas are available, show them as suggested options
- Allow custom city entry
- If GBP has an address (hidden or public), pre-suggest that city as the Primary Market
- Show this as a recommendation, but let the user override

Store the answer in `siteConfig.primaryMarket` with sub-fields:
- `city`: the city name
- `state`: the state
- `source`: "user_input" | "ai_recommendation" | "gbp_address"

### 2C: Update existing onboarding language

Replace user-facing "anchor city" terminology with:
- "Primary Market" in user-facing copy
- "where you operate from" when referring to GBP address
- Internal data model can keep variable names like `primaryMarketCity` for clarity

### 2D: Service area validation

If the user's travel strategy doesn't align with the GBP service area, surface a recommendation:

- **Local strategy + GBP service area > 30 miles:** "Your GBP service area is broader than your travel strategy suggests. Consider trimming GBP service areas to focus on local rankings."
- **Metro strategy + GBP service area has only 1 city:** "Your travel strategy suggests broader coverage. Consider adding service areas to your GBP."
- **Primary Market not in GBP service area:** "Your Primary Market isn't currently in your GBP service area. Add it for stronger geographic relevance."

These surface as audit findings during onboarding, not blockers.

---

## SECTION 3: SITE GENERATION LOGIC REFACTOR

### 3A: Page inventory generation

When generating a site, the system builds the page inventory based on:

```
Inputs:
- businessType (Physical / SAB / Hybrid)
- travelStrategy (Local / Regional / Metro / Multi-market)
- primaryMarket (city + state)
- gbpCategories (primary + secondaries)
- serviceAreaCities (full list from GBP or user input)
- additionalServices (non-GBP services the business offers)
```

```
Always generated:
- / (brand homepage)
- /{primary-market}/ (Primary Market hub)
- /{primary-market}/{service}/ for each GBP category
- /{service}/ for each GBP category (brand service hub at root)
- /{service}/{sub-service}/ for each sub-service identified
- /service-areas/ (single page, no children)
- /about/, /contact/, /reviews/, /work/ (utility)

Generated based on travel strategy:
- Local: NO Pattern 1 city pages — only Primary Market + proximity coverage
- Regional: Pattern 1 city pages for top 2-3 services × priority cities (max 6-9 pages)
- Metro: Pattern 1 city pages for top 2-3 services × priority cities (max 9-12 pages)
- Multi-market: Multiple Primary Market hubs, each with own city/service structure

Never generated automatically (must be triggered by evidence or user action):
- Pattern 1 pages for services beyond the top 2-3
- Pattern 1 pages for cities below the priority threshold
- Pattern 1 pages duplicating intent (if /{primary-market}/{service}/ exists, do NOT also build /{service}/{primary-market}/)
```

### 3B: Service area page generation

Generate `/service-areas/` with:

```
Structure:
- H1 themed to travel strategy area (e.g., "West Valley Appliance Repair Coverage" for Regional)
- Service area map embed
- Cities grouped by region/parish/county
- Primary Market prominently at top, linked
- Other cities listed:
  - LINKED if they have a dedicated page (Pattern 1 or city hub)
  - TEXT ONLY if they don't yet have a page (planned, proximity-covered, or below threshold)
- Service-by-service expansion section
- Recent jobs map (auto-populates from job snaps)
- FAQs
- Operational paragraph
```

When a new Pattern 1 page or city hub is built later, the system updates this page to convert that city's text mention to a link.

### 3C: Internal linking generation

When generating the site, apply these linking patterns:

```
Homepage links DOWN to:
- All brand service hubs
- Primary Market hub (/{primary-market}/)
- Service-areas hub
- Utility pages

Primary Market hub (/{primary-market}/) links to:
- UP: Homepage
- DOWN: /{primary-market}/{service}/ for each GBP category at this hub
- SIDEWAYS: brand service hubs, /service-areas/

Brand service hubs (/{service}/) link to:
- DOWN: all sub-services
- DOWN: /{primary-market}/{service}/
- DOWN: Pattern 1 city pages (/{service}/{city}/) if/when they exist
- SIDEWAYS: other brand service hubs, /service-areas/

Sub-services link to:
- UP: parent brand hub
- SIDEWAYS: sibling sub-services
- NEVER to city pages

Pattern 1 city pages link to:
- UP: parent brand service hub
- UP: /service-areas/
- SIDEWAYS: other Pattern 1 city pages for same service (light cross-linking)

/service-areas/ links to:
- Primary Market hub
- All city pages that exist (Pattern 1 + city hubs)
- Brand service hubs
- Homepage
```

### 3D: GBP website link recommendation

After site generation, surface a recommendation:

> "Update your Google Business Profile website link to point to /{primary-market}/ instead of the homepage. This aligns your GBP geographic anchor with the Primary Market hub on your site."

This is a settings recommendation, not an automatic action.

---

## SECTION 4: DATA MODEL UPDATES

### 4A: Site config schema additions

Add these fields to the site configuration data model:

```
siteConfig: {
  // ... existing fields ...
  travelStrategy: "local" | "regional" | "metro" | "multi-market",
  primaryMarket: {
    city: string,
    state: string,
    source: "user_input" | "ai_recommendation" | "gbp_address"
  },
  // For multi-market sites:
  additionalMarkets: [
    { city: string, state: string, ... }
  ]
}
```

### 4B: Page inventory schema

Each generated page should be tracked with metadata:

```
page: {
  url: string,
  pageType: "homepage" | "primary_market_hub" | "primary_market_service" | "brand_service_hub" | "sub_service" | "pattern_1_city" | "service_areas" | "utility",
  associatedCity: string | null,
  associatedService: string | null,
  createdAt: timestamp,
  generatedFrom: "phase_1_build" | "manual_add" | "evidence_based_add",
  status: "active" | "archived"
}
```

This metadata enables future features (Growth Opportunities, additive page generation, internal linking updates).

### 4C: Service area schema

Track service area cities with treatment status:

```
serviceArea: {
  city: string,
  state: string,
  treatment: "primary_market" | "proximity_covered" | "has_pattern_1_page" | "has_city_hub" | "text_mention_only" | "excluded",
  hasPage: boolean,
  pageUrl: string | null,
  distanceFromPrimaryMarket: number | null
}
```

---

## SECTION 5: BACKWARDS COMPATIBILITY

Existing sites built under the old framework should continue to work. Do not break them.

Strategy:
- Existing sites keep their current structure
- New sites use the v5 framework
- Existing sites can be migrated manually on a per-site basis (not part of this refactor)
- The site dashboard should NOT show errors for old sites just because they don't have `primaryMarket` set

If existing sites lack the new fields:
- `travelStrategy` defaults to inferred value based on existing service area breadth
- `primaryMarket` defaults to the existing "anchor city" or first service area city
- These defaults are flagged for review on the dashboard but don't block usage

---

## SECTION 6: TESTING

After the refactor:

1. **Generate a test site** for a fictional client to verify the new logic:
   - Business: SAB appliance repair
   - Travel strategy: Regional (15-30 mi)
   - Primary Market: Surprise, AZ
   - GBP categories: Appliance repair (primary), Refrigerator repair, Washer-dryer repair (secondaries)
   - Service area: Surprise, Peoria, Glendale, Phoenix, Sun City, El Mirage

2. **Verify the generated sitemap includes:**
   - `/` (brand homepage)
   - `/surprise/` (Primary Market hub)
   - `/surprise/refrigerator-repair/`, `/surprise/washer-dryer-repair/`
   - `/appliance-repair/`, `/refrigerator-repair/`, `/washer-dryer-repair/` (brand hubs)
   - Sub-services nested under each brand hub
   - `/appliance-repair/peoria/`, `/appliance-repair/glendale/`, `/appliance-repair/phoenix/` (Pattern 1)
   - `/refrigerator-repair/peoria/`, `/refrigerator-repair/glendale/`, `/refrigerator-repair/phoenix/` (Pattern 1)
   - NO Pattern 1 pages for washer-dryer-repair (only top 2 services get Pattern 1 depth)
   - NO `/locations/` parent anywhere
   - NO dedicated pages for Sun City or El Mirage (proximity-covered)
   - `/service-areas/` as single page, linking to Surprise + Pattern 1 cities, text mentions for proximity-covered

3. **Verify internal linking** matches the patterns documented in Section 3C.

4. **Verify the GBP website link recommendation** appears after generation.

---

## SECTION 7: DELIVERABLES SUMMARY

When complete, output:

1. List of files created or modified
2. Confirmation that v4 was archived and v5 is canonical
3. Confirmation that onboarding wizard now collects travel strategy + Primary Market
4. Confirmation that site generation applies all 12 URL structure rules
5. Confirmation that top 2-3 services rule is enforced
6. Confirmation that `/service-areas/` page handles linked vs. text-mention cities
7. Test site generation output (the fictional client from Section 6)
8. Any issues, edge cases, or decisions that should be flagged for review

---

## EXECUTION CHECKPOINT

Before starting, confirm:

1. You've read the three reference docs
2. You understand the framework changes from v4 to v5
3. You'll execute all six sections sequentially without waiting for further instruction
4. You'll preserve backwards compatibility for existing sites
5. You'll output the deliverables summary at the end

Then proceed.
