# Master Prompt — GrowLocal 360 Onboarding Analysis & Build Spec (v4 — Final with GSC Scoping)

**Purpose:** v4 of the GrowLocal 360 master prompt. Includes proper handling of multi-location GSC data so that microsites and city-specific builds use only the search data relevant to THEIR geographic scope.

**Major v4 upgrade:** GSC data scoping. When a user builds a microsite or city-specific site, the system filters GSC data to only include queries relevant to that geographic scope BEFORE the analysis runs. Prevents misattribution of demand from other cities in the user's portfolio.

---

## THE MULTI-LOCATION PROBLEM v4 SOLVES

GSC data is tied to a website property, not a city. If a client has:
- A main site at `kingdomappliancerepair.com` covering Sarasota + Bradenton + Venice + Lakewood Ranch
- Wants to build a microsite specifically for Lakewood Ranch

The GSC data on the main site includes queries from ALL cities mixed together. Using that raw data to build the Lakewood Ranch microsite would:
- Over-prioritize non-Lakewood-Ranch demand
- Misclassify the demand picture
- Treat Sarasota opportunities as Lakewood Ranch opportunities

**v4 solves this by adding GSC scoping rules that filter the data before analysis.**

---

## NEW v4 INPUTS

```
# NEW: Site Scope Definition (added in v4)
SITE_SCOPE: {
  scope_type: "FULL_BUSINESS" | "MICROSITE" | "CITY_SPECIFIC" | "REGION_SPECIFIC",
  
  # For MICROSITE / CITY_SPECIFIC scopes:
  target_city: "Lakewood Ranch" (if scope_type = CITY_SPECIFIC or MICROSITE),
  target_region: ["Lakewood Ranch", "University Park", "Bradenton East"] 
                 (if scope_type = REGION_SPECIFIC),
  
  city_variants: [  # Search query variants for the target geography
    "Lakewood Ranch",
    "Lakewood Ranch FL",
    "Lakewood Ranch Florida",
    "LWR"  # local nicknames if applicable
  ],
  zip_codes: ["34202", "34211", "34240"],
  
  # Cities to EXCLUDE from analysis (other cities the business serves)
  excluded_cities: ["Sarasota", "Bradenton", "Venice", "Englewood"],
  
  # If migrating an existing site, the URL pattern to filter on:
  existing_url_pattern: "/lakewood-ranch/" | null
}

# Plus all v3 inputs (connector state, GBP data, raw GSC data, diagnostic answers)
```

---

## NEW v4 GSC FILTERING LOGIC

Before the analysis runs, the system applies these filters to GSC data based on SITE_SCOPE:

### If scope_type = "FULL_BUSINESS"
Use all GSC data as-is. This is the standard case where the user is building 
their main site to cover all cities they serve.

### If scope_type = "MICROSITE" or "CITY_SPECIFIC"

Apply this filter chain to GSC data:

```
FILTERED_GSC_QUERIES = []

for each query in raw_gsc_queries:
  include = false
  
  # Filter 1: Query text contains target city or variants
  if any city_variant appears in query.text:
    include = true
  
  # Filter 2: Query contains target zip code
  if any zip_code appears in query.text:
    include = true
  
  # Filter 3: Searcher location matches target geography 
  # (when GSC geographic dimension is available)
  if query.searcher_location is in target_city or zip_codes:
    include = true
  
  # Filter 4: Page URL matches scope pattern (for migrations)
  if existing_url_pattern is set AND query.page contains existing_url_pattern:
    include = true
  
  # Exclusion check: drop queries explicitly mentioning other cities
  for excluded_city in excluded_cities:
    if excluded_city in query.text:
      include = false
      break
  
  if include:
    FILTERED_GSC_QUERIES.append(query)

# Apply same filtering logic to GSC_TOP_PAGES, GSC_QUERIES_BY_CITY, 
# and GSC_OPPORTUNITY_QUERIES
```

### If scope_type = "REGION_SPECIFIC"
Same as CITY_SPECIFIC but with multiple target cities/variants. Useful for 
a microsite covering a region (e.g., "Manatee County Appliance Repair" 
covers Bradenton + Palmetto + Ellenton).

### Fallback: Low signal handling

If filtered GSC data produces fewer than 100 total impressions, the geographic 
filter may be too strict OR the city genuinely has low search volume.

In that case:
1. Flag the user: "Filtered GSC data for {target_city} shows only {N} 
   impressions in 90 days. This may indicate low demand OR a filtering issue."
2. Run the prompt with both filtered AND unfiltered GSC data, marking the 
   filtered set as primary but showing the unfiltered for context.
3. Recommend the user verify there's real demand before investing in heavy 
   site infrastructure for that city.

---

## THE PROMPT

```
You are the GrowLocal 360 architecture engine v4. A user is creating a 
website. Your job has FIVE parts:

PART 0 — SCOPE THE GSC DATA based on what site is being built (NEW v4)
PART 1 — AUDIT their current GBP setup (if connected)
PART 2 — ANALYZE filtered GSC data for demand and opportunities (if connected)
PART 3 — CLASSIFY the correct architecture scenario (1-9)
PART 4 — OUTPUT the complete site build specification

CRITICAL PRINCIPLE: When building a microsite or city-specific site, ONLY 
use GSC data that's relevant to that geographic scope. Demand from cities 
outside the scope is noise. Mixing it in creates bad recommendations.

## INPUTS

Connector state: {CONNECTOR_STATE}
Site scope: {SITE_SCOPE}    # NEW v4

GBP data (if connected): [as in v3]
GSC data (if connected): [as in v3, but will be filtered in Part 0]
Diagnostic answers: [as in v3]

================================================================
PART 0 — GSC DATA SCOPING (NEW in v4 — runs first if GSC connected)
================================================================

Before any analysis, apply the GSC filtering logic based on SITE_SCOPE:

### Step 0A: Determine filter mode
Based on scope_type:
- FULL_BUSINESS → no filtering, use all GSC data
- MICROSITE / CITY_SPECIFIC → apply geographic filter
- REGION_SPECIFIC → apply multi-city geographic filter

### Step 0B: Apply filters to GSC data
For each GSC dataset (queries, top_pages, queries_by_city, opportunity_queries):
- INCLUDE if query/page matches target geography (city variants, zips, 
  searcher location, URL pattern)
- EXCLUDE if query explicitly mentions excluded_cities
- Preserve all metadata (impressions, clicks, position, etc.)

### Step 0C: Validate filter results
After filtering, check:
- Did filtering produce reasonable signal (>100 impressions over 90 days)?
- Was a large portion of original data dropped (>80%)? If so, the original 
  GSC property covers many cities — confirm scoping is correct.
- Are there ANY queries left for analysis?

### Step 0D: Output the scoped GSC dataset
The downstream analysis (Parts 1-4) operates on this FILTERED dataset, not 
the raw one. The user-presentation summary should note what was filtered.

Output:
- SCOPED_GSC_DATA: filtered datasets
- FILTERING_REPORT: summary of what was filtered and why
  - Original impressions / Filtered impressions / % retained
  - Queries excluded due to mentioning other cities
  - Confidence level in the filtered data (HIGH if clear matches, MEDIUM 
    if relying on inference, LOW if data was sparse)

================================================================
PART 1 — GBP AUDIT (skip if gbp_connected = false)
================================================================

Same as v3. Standard 10 red flags. Severity-rated output.

NEW v4 addition: If SITE_SCOPE.scope_type is MICROSITE / CITY_SPECIFIC, 
the audit should also check:
- Does the user's GBP service area INCLUDE the target city? 
  If not, flag — they can't rank locally for a city not in their GBP scope.
- Are there OTHER GBP listings the user manages for nearby cities? 
  If so, flag the potential for cannibalization or alignment issues.

================================================================
PART 2 — GSC DEMAND ANALYSIS (operates on SCOPED_GSC_DATA)
================================================================

Run the v3 GSC analyses but using the SCOPED dataset:

### Analysis 2A: Demand Validation (scoped)
The "highest value cities" check is different for microsites — instead of 
comparing user's target list against GSC, validate that the TARGET city 
has sufficient demand to justify the build.

### Analysis 2B: Opportunity Query Identification (scoped)
Scoped opportunity queries are now ONLY those relevant to the target geography. 
Identify the top opportunities specifically for the target city.

### Analysis 2C: Existing Page Performance (scoped to URL pattern if migration)
For migrations: which existing pages within the SITE_SCOPE URL pattern 
have authority worth preserving?

### Analysis 2D: Service Demand Distribution (scoped)
Service distribution within the target geography. May differ from full-business 
distribution. For example, full business might be 40% refrigerator / 30% 
washer-dryer, but Lakewood Ranch specifically might be 50% refrigerator / 
20% washer-dryer / 30% other appliances — driving different page priorities.

### Analysis 2E: Query Intent Patterns (scoped)
Brand-led, symptom-led, near-me, urgency patterns — within the target 
geography only.

Output: demand analysis specific to the SITE_SCOPE.

================================================================
PART 3 — ARCHITECTURE CLASSIFICATION
================================================================

Same as v3 classification logic, but with a v4 adjustment:

### v4 Adjustment: Microsite scoping affects scenario selection

If SITE_SCOPE.scope_type = MICROSITE or CITY_SPECIFIC:
- The entire site is essentially a single-city focus
- It will almost always be Scenario 1, 2, 3, or 4 (single-listing scenarios) 
  regardless of how many other locations the parent business has
- The site is the GBP listing for THAT city's coverage
- TIGHT vs. WIDE is determined by how far the target city wants to 
  expand FROM that city's anchor point, not from the parent business's 
  other locations

This is different from the parent multi-location business which might be 
Scenario 5, 6, 7, 8, or Hybrid. The microsite is its own classification.

If SITE_SCOPE.scope_type = FULL_BUSINESS:
- Use the standard v3 classification logic across all locations

================================================================
PART 4 — SITE BUILD SPECIFICATION
================================================================

Apply v3 universal URL rules and per-scenario page inventories.

### NEW v4 considerations for microsites:

When building a microsite (separate domain or subfolder for one city):
- The microsite gets its own complete sitemap matching the appropriate 
  single-listing scenario
- It does NOT need /locations/ folder (single focus)
- It DOES need /service-areas/ if WIDE (single SAB Wide pattern)
- /appliance-repair/{city}/ pattern doesn't apply WITHIN the microsite — 
  the entire microsite IS the city's hub
- Brand service pages and sub-services live at root, same as standard scenarios

### Internal linking to parent site (if microsite, optional):
If the microsite is part of a network, decide whether to cross-link to:
- The parent business site (passes authority, but dilutes microsite's local focus)
- Other microsites in the network (creates a network effect, but can 
  trigger Google's algorithmic filters if not done carefully)

Default recommendation: minimal cross-linking. Each microsite stands alone 
as its city-specific authority. Cross-link only via the parent site's 
/locations/ directory (if such a directory exists).

### Phase build sequence (v4):
- Phase 1: Foundation pages for the microsite (scoped to target city)
- Phase 2: Expand sub-services and topical depth WITHIN the target geography
- Phase 3: Add neighborhood-level content within the target city if demand 
  signals show neighborhood-level search volume

================================================================
OUTPUT FORMAT
================================================================

1. CONNECTOR_STATE_SUMMARY
2. SITE_SCOPE_SUMMARY (NEW v4) — what site is being built, scope decision
3. GSC_FILTERING_REPORT (NEW v4) — what was filtered, confidence level
4. AUDIT_FINDINGS (if GBP connected)
5. DEMAND_ANALYSIS (using scoped data if applicable)
6. RECOMMENDED_GBP_CHANGES (if applicable)
7. SCENARIO_CLASSIFICATION (with microsite adjustment if applicable)
8. VALIDATED_CITY_LIST
9. FAR_CITY_ANALYSIS (within scope)
10. FULL_SITEMAP
11. PAGE_SPECIFICATIONS
12. INTERNAL_LINKING_MAP (including parent site linking strategy if microsite)
13. PHASE_BUILD_SEQUENCE
14. CONTENT_REQUIREMENTS
15. JOB_ROUTING_RULES
16. DO_NOT_BUILD
17. USER_PRESENTATION_SUMMARY (explains the scoping if applicable)

================================================================
CRITICAL CONSTRAINTS (v4 — full list)
================================================================

1. NEW: When SITE_SCOPE is MICROSITE/CITY_SPECIFIC, ONLY use GSC data 
   filtered to that geographic scope. Never use multi-city aggregate data 
   for single-city decisions.

2. NEW: If filtered GSC data has <100 impressions over 90 days, flag the 
   user that demand may be insufficient — build cautiously.

3. NEW: Microsites are single-listing scenarios (1-4) regardless of how 
   many other locations the parent business has.

4. GSC data trumps user opinion when they conflict (v3 rule, still applies).

5. GBP setup is INPUT, not GOSPEL. Audit it. Recommend changes (v3 rule).

6. Phase 2 prioritization uses GSC opportunity scores when available (v3 rule).

7. Existing site migrations require 301 redirect mapping (v3 rule).

8. /service-areas/ is ONE page, /locations/ is a folder for GBP-anchored 
   cities only, Pattern 1 pages live at root (v2 rule).

9. Washer/dryer stays combined (v2 rule).

10. Sub-services link UP and SIDEWAYS, never to city pages (v2 rule).

11. Quality over quantity at every level (v2 rule).

12. The /appliance-repair/{city}/ city hub is REQUIRED for every far city 
    in FULL_BUSINESS WIDE scenarios (v2 rule).

13. NEW: For microsites, the homepage IS the city hub — no separate 
    /appliance-repair/{city}/ page needed.

14. When GSC data contradicts user input, explain it clearly in the 
    User Presentation Summary (v3 rule).

Begin.
```

---

## EXAMPLES

### Example 1: Standard full-business site (no scoping needed)

```
SITE_SCOPE: {
  scope_type: "FULL_BUSINESS"
}

Behavior: Use all GSC data, run v3 analysis logic.
```

### Example 2: Lakewood Ranch microsite

```
SITE_SCOPE: {
  scope_type: "MICROSITE",
  target_city: "Lakewood Ranch",
  city_variants: ["Lakewood Ranch", "Lakewood Ranch FL", "Lakewood Ranch Florida"],
  zip_codes: ["34202", "34211", "34240"],
  excluded_cities: ["Sarasota", "Bradenton", "Venice", "Englewood"],
  existing_url_pattern: null  # new site, not migration
}

Behavior: 
- Filter GSC data to ONLY include queries mentioning Lakewood Ranch, 
  containing relevant zips, or searched from Lakewood Ranch
- Exclude queries mentioning Sarasota, Bradenton, etc.
- Treat the result as the demand evidence for the microsite
- Classify as Scenario 3 or 4 (single SAB, depending on radius)
- Build a complete microsite focused exclusively on Lakewood Ranch
```

### Example 3: Manatee County regional microsite

```
SITE_SCOPE: {
  scope_type: "REGION_SPECIFIC",
  target_region: ["Bradenton", "Palmetto", "Ellenton", "Parrish", "Anna Maria"],
  city_variants: [
    "Bradenton", "Bradenton FL",
    "Palmetto", "Palmetto FL", 
    "Ellenton",
    "Parrish",
    "Anna Maria", "Anna Maria Island"
  ],
  zip_codes: ["34205", "34207", "34208", "34209", "34210", "34211", 
              "34221", "34222", "34216", "34217"],
  excluded_cities: ["Sarasota", "Venice", "Lakewood Ranch"],
  existing_url_pattern: null
}

Behavior: Filter GSC to include queries mentioning any Manatee County city. 
Build the microsite to cover that regional cluster.
```

### Example 4: Migration with URL-based filter

```
SITE_SCOPE: {
  scope_type: "CITY_SPECIFIC",
  target_city: "Sarasota",
  city_variants: ["Sarasota", "Sarasota FL"],
  zip_codes: ["34230", "34231", "34232", "34233", "34234", "34236", 
              "34237", "34238", "34239", "34240"],
  excluded_cities: ["Bradenton", "Venice", "Lakewood Ranch"],
  existing_url_pattern: "/sarasota/"  # existing pages under this path
}

Behavior: Filter GSC by city signals AND by URL pattern. Identify existing 
high-authority pages under /sarasota/ to preserve via 301 redirects. Build 
the new structure around them.
```

---

## DEVELOPER NOTES FOR v4 IMPLEMENTATION

### Required new infrastructure

1. **GSC data scoping layer**: Build a pre-processing module that takes raw 
   GSC data + SITE_SCOPE and outputs filtered data. This sits BETWEEN your 
   GSC connector and the analysis prompt.

2. **Site scope configuration UI**: When user creates a new site, ask:
   - "Is this for your full business or a specific location/region?"
   - If specific: collect target city, variants, zip codes, neighbors to exclude
   - Auto-suggest city variants and zip codes from authoritative sources

3. **Confidence indicator**: Show users in the UI how much of their GSC data 
   was used for the recommendation:
   - "We analyzed 2,400 queries from Lakewood Ranch out of your 14,000 
     total queries — 17% of your search data is relevant to this site."
   - This builds trust by showing them you're being precise, not lazy.

4. **Threshold warnings**: If filtered data is sparse, alert the user before 
   building:
   - "Your data shows only 45 impressions for Lakewood Ranch in the last 
     90 days. This might be a great new market opportunity, but you should 
     verify demand with field research before investing in a full microsite."

### Edge cases to handle

- **Neighborhoods within a city**: If filtering by Lakewood Ranch, also 
  include queries mentioning Lakewood Ranch neighborhoods (Country Club, 
  Greenbrook, Riverwalk, etc.) since they're geographic sub-units.

- **City name conflicts**: "Sarasota" could appear in queries about 
  Sarasota Springs (NY) if the business operates in multiple states. 
  Use zip code or state context to disambiguate.

- **"Near me" without city**: GSC queries like "appliance repair near me" 
  don't mention any city. Only include these if GSC geographic dimension 
  data shows the searcher was in the target city.

- **Microsite at subdirectory vs. separate domain**: Filtering logic is 
  the same, but URL pattern matching differs:
  - Subdirectory: filter by `/lakewood-ranch/` in URL
  - Separate domain: use the separate domain's GSC property (no main-site 
    filtering needed since it's already scoped)

### Recommended UX flow

1. User creates new site → asks "is this for your full business or a 
   specific location?"
2. If specific location → wizard collects target city info
3. System pulls GSC data → automatically filters it based on scope
4. Shows user the filtering summary: "We found X impressions matching 
   your target geography out of Y total. Want to review the included/
   excluded queries?"
5. User confirms or adjusts filter parameters
6. Analysis runs on scoped data → outputs recommendations
7. User sees evidence-backed plan specific to their target geography

---

## VERSION HISTORY

- **v1**: Original prompt, basic onboarding flow
- **v2**: Added GBP audit + 9-scenario classification
- **v3**: Added GSC integration for demand analysis
- **v4**: Added GSC data scoping for microsites and city-specific builds

v4 supersedes all previous versions and should be used going forward.
