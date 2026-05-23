# GrowLocal 360 — Job Snap URL Slug Generation Spec

**Purpose:** Defines the URL slug generation logic for job snaps (field snaps) across all home service industries. Optimized for SEO diversity, hyperlocal signal, uniqueness, and clean readability.

---

## Core Principles

1. **Keyword-first** — front-load the URL with what users search for
2. **Diversity by default** — multiple variables ensure most URLs are unique without suffixes
3. **No leaked metadata** — never expose job counts, internal IDs, or sequential numbers unless necessary
4. **Clean default** — most URLs have NO numeric suffix
5. **Industry-aware** — adapts to industries with or without brand relevance
6. **Privacy-safe** — strip house numbers, never expose customer identity

---

## The Slug Formula

```
/work/{component-1}-{component-2}-{component-3}-{component-4}-{component-5}[-{collision-suffix}]/
```

Components are concatenated with hyphens. Each component is normalized (lowercase, hyphenated, special chars removed). Components are pulled in priority order based on the industry.

### Component Priority by Industry

The system selects up to 5 components based on what's available and relevant. Industries differ in which variables produce diversity.

#### Industries with strong brand relevance
*(Appliance Repair, HVAC, Electronics Repair, Pool Equipment Repair)*

```
{brand}-{equipment-type}-{primary-problem}-{street-name}-{city}
```

Example:
```
/work/sub-zero-refrigerator-defrost-repair-highfield-circle-lakewood-ranch/
/work/trane-ac-not-cooling-oak-avenue-bradenton/
/work/pentair-pool-pump-replacement-beach-road-sarasota/
```

#### Industries without strong brand relevance
*(Plumbing, Pressure Washing, Landscaping, Roofing, Painting, Cleaning, Pest Control, Garage Door, Electrical, Concrete, Fence Installation)*

```
{service-type}-{primary-problem-or-detail}-{street-name}-{city}
```

OR when service-type alone is enough:
```
{service-type}-{property-detail}-{street-name}-{city}
```

Examples:

**Plumbing:**
```
/work/drain-cleaning-kitchen-sink-clog-highfield-circle-lakewood-ranch/
/work/water-heater-replacement-50-gallon-tank-oak-avenue-bradenton/
/work/sewer-line-repair-tree-root-removal-main-street-sarasota/
/work/toilet-installation-master-bathroom-palm-drive-venice/
```

**Pressure Washing:**
```
/work/driveway-pressure-washing-oil-stain-removal-highfield-circle-lakewood-ranch/
/work/house-soft-wash-vinyl-siding-oak-avenue-bradenton/
/work/roof-cleaning-algae-removal-beach-road-englewood/
/work/pool-deck-pressure-washing-pavers-palm-drive-sarasota/
```

**Landscaping:**
```
/work/sod-installation-st-augustine-grass-highfield-circle-lakewood-ranch/
/work/mulch-installation-front-yard-oak-avenue-bradenton/
/work/palm-tree-trimming-three-trees-beach-road-sarasota/
```

**Roofing:**
```
/work/roof-replacement-architectural-shingles-highfield-circle-lakewood-ranch/
/work/roof-repair-leak-detection-oak-avenue-bradenton/
/work/skylight-installation-living-room-palm-drive-sarasota/
```

#### Industries that benefit from both service + brand axes
*(Garage Door — brand of opener, Auto Repair, Lawn Mower Repair)*

Use brand when available, fall back to service when not:
```
/work/liftmaster-garage-door-opener-replacement-highfield-circle-lakewood-ranch/
/work/garage-door-spring-replacement-broken-torsion-oak-avenue-bradenton/
```

---

## Component Definitions and Normalization

### `brand`
- Manufacturer/equipment brand (Sub-Zero, Whirlpool, Pentair, Trane, etc.)
- Normalize: lowercase, replace `&` with `-`, replace spaces with hyphens
- Strip special chars (apostrophes, periods)
- Examples: `Sub-Zero` → `sub-zero`, `GE Appliances` → `ge-appliances`
- **Omit this component if industry doesn't use brand as a variable**

### `equipment-type` or `service-type`
- The category of work being done
- For brand industries: the equipment (refrigerator, dryer, ac-unit, pool-pump)
- For non-brand industries: the service (drain-cleaning, pressure-washing, sod-installation)
- Normalize: lowercase, hyphenated, no special chars
- Examples: `Refrigerator` → `refrigerator`, `Drain Cleaning` → `drain-cleaning`

### `primary-problem` or `service-detail`
- The specific issue, symptom, or work performed
- Keep concise — 2-5 words max
- Examples:
  - Appliance: `defrost-repair`, `not-cooling`, `ice-maker-repair`
  - Plumbing: `kitchen-sink-clog`, `tree-root-removal`, `50-gallon-tank`
  - Pressure Washing: `oil-stain-removal`, `algae-removal`, `vinyl-siding`
  - Roofing: `architectural-shingles`, `leak-detection`, `three-trees`
- Normalize: lowercase, hyphenated, strip filler words ("the", "a", "of")

### `street-name`
- Public street name with house number REMOVED
- Strip directional prefixes ONLY if redundant (keep "North Main" but strip "123")
- Examples: `12520 Highfield Circle` → `highfield-circle`, `4521 SW 27th Ave` → `sw-27th-ave`
- If street name unavailable, omit this component (degrades gracefully)
- Normalize: lowercase, hyphenated

### `city`
- City of the job
- Normalize: lowercase, hyphenated
- Examples: `Lakewood Ranch` → `lakewood-ranch`, `St. Petersburg` → `st-petersburg`

### `collision-suffix`
- Only added if the generated slug already exists
- Format: `-2`, `-3`, `-4`, etc. (NOT `-0001`, NOT random hash)
- Increments sequentially per collision
- Never used proactively — only on actual collision detection

---

## Industry Configuration Table

Each industry in GrowLocal 360 should have a configuration that specifies which components to use:

| Industry | Slug Formula |
|---|---|
| Appliance Repair | `{brand}-{equipment-type}-{problem}-{street}-{city}` |
| HVAC | `{brand}-{equipment-type}-{problem}-{street}-{city}` |
| Pool Service | `{brand}-{equipment-type}-{problem}-{street}-{city}` |
| Electronics Repair | `{brand}-{device-type}-{problem}-{street}-{city}` |
| Plumbing | `{service-type}-{problem-detail}-{street}-{city}` |
| Pressure Washing | `{service-type}-{surface-or-detail}-{street}-{city}` |
| Landscaping | `{service-type}-{detail}-{street}-{city}` |
| Roofing | `{service-type}-{detail}-{street}-{city}` |
| Painting | `{service-type}-{detail}-{street}-{city}` |
| Cleaning Services | `{service-type}-{detail}-{street}-{city}` |
| Pest Control | `{service-type}-{pest-type-or-detail}-{street}-{city}` |
| Garage Door | `{brand-if-present}-{service-type}-{detail}-{street}-{city}` |
| Electrical | `{service-type}-{detail}-{street}-{city}` |
| Auto Repair | `{brand}-{vehicle-type}-{problem}-{street}-{city}` |
| Carpet Cleaning | `{service-type}-{room-or-detail}-{street}-{city}` |
| Tree Service | `{service-type}-{tree-type-or-detail}-{street}-{city}` |
| Concrete | `{service-type}-{detail}-{street}-{city}` |
| Fence Installation | `{service-type}-{material-or-detail}-{street}-{city}` |
| Window Cleaning | `{service-type}-{detail}-{street}-{city}` |
| Gutter Service | `{service-type}-{detail}-{street}-{city}` |

---

## Generation Logic (Pseudocode)

```
function generateSlug(jobData, industryConfig):
    components = []
    
    # Pull components in priority order from industry config
    for component_name in industryConfig.componentOrder:
        value = jobData[component_name]
        if value is present and not empty:
            normalized = normalize(value)
            components.append(normalized)
    
    # Always include city as final component if available
    if jobData.city is present:
        if "city" not in industryConfig.componentOrder:
            components.append(normalize(jobData.city))
    
    # Build base slug
    base_slug = components.join("-")
    
    # Check for collision
    candidate_slug = base_slug
    collision_count = 2
    while slugExistsInDatabase(candidate_slug):
        candidate_slug = base_slug + "-" + collision_count
        collision_count += 1
    
    return candidate_slug


function normalize(text):
    text = text.toLowerCase()
    text = text.replace("&", "and")
    text = text.replace(".", "")
    text = text.replace("'", "")
    text = stripFillerWords(text)  # removes "the", "a", "of", "for"
    text = text.replace(/[^a-z0-9-\s]/g, "")  # strip special chars
    text = text.replace(/\s+/g, "-")  # spaces to hyphens
    text = text.replace(/-+/g, "-")  # collapse multiple hyphens
    text = text.trim("-")  # remove leading/trailing hyphens
    return text


function stripHouseNumber(address):
    # "12520 Highfield Circle" → "Highfield Circle"
    # Strip leading digits and whitespace
    return address.replace(/^\d+\s+/, "")
```

---

## Graceful Degradation

If a component is missing, the slug should still generate cleanly using whatever IS available. Order of preference for what to drop:

1. **Most droppable:** detail/problem (use just service + location)
2. **Less droppable:** brand (only some industries use it anyway)
3. **Less droppable:** street-name (hyperlocal signal, but city alone still works)
4. **Always keep:** service-type and city (the minimum viable slug)

Examples with missing data:

```
Full data:
/work/sub-zero-refrigerator-defrost-repair-highfield-circle-lakewood-ranch/

Missing street:
/work/sub-zero-refrigerator-defrost-repair-lakewood-ranch/

Missing brand AND street:
/work/refrigerator-defrost-repair-lakewood-ranch/

Bare minimum (just service + city):
/work/refrigerator-repair-lakewood-ranch/
```

The slug never breaks — it just gets shorter when data is sparse.

---

## URL Length Targets

Keep slugs under 100 characters when possible. Google handles longer URLs but rewards brevity. Most slugs with the formula above land in the 50-85 character range, which is the sweet spot.

If a slug exceeds 100 characters, the system should:
1. Drop the problem/detail component first (it's usually the longest variable element)
2. If still too long, abbreviate the detail (e.g., `architectural-shingle-replacement` → `shingle-replacement`)
3. Hard cap at 110 characters

---

## Edge Cases to Handle

### Case 1: Service type contains the equipment name
Don't double-up. If service is "Refrigerator Repair" and equipment is "Refrigerator," only use one.

```
❌ /work/sub-zero-refrigerator-refrigerator-repair-defrost-issue-...
✅ /work/sub-zero-refrigerator-defrost-repair-...
```

### Case 2: Multiple services in one job
Pick the PRIMARY service for the URL. List others in body content. URL stays focused on one searchable intent.

### Case 3: Street name has number in it
"4521 SW 27th Ave" — strip the leading house number (4521) but keep "27th" in the street name.

Result: `sw-27th-ave`

### Case 4: Apartment/unit numbers
Always strip. Never appears in URL.

### Case 5: Brand contains the equipment name
"Sub-Zero Refrigerators" as a brand → just use "sub-zero" (brand) + "refrigerator" (equipment type).

### Case 6: Compound cities or special characters
- "St. Petersburg" → `st-petersburg`
- "Coeur d'Alene" → `coeur-dalene`
- "Winston-Salem" → `winston-salem`
- "O'Fallon" → `ofallon`

### Case 7: Same-day duplicate jobs (rare)
If a tech somehow logs two jobs with identical brand+equipment+problem+street+city on the same day, the second gets `-2`. This is the only realistic collision case.

---

## Meta Fields Generated From the Same Data

The slug generation should also drive related SEO fields automatically:

### Meta Title
```
{Brand} {Equipment} {Problem} in {City}, {State}
```
Example: `Sub-Zero Refrigerator Defrost Repair in Lakewood Ranch, FL`

For non-brand industries:
```
{Service Type} on {Street Name} in {City}, {State}
```
Example: `Drain Cleaning on Oak Avenue in Bradenton, FL`

### H1
```
{Brand} {Equipment} {Problem} in {City}
```
Example: `Sub-Zero Refrigerator Defrost Repair in Lakewood Ranch`

Slightly less formal than the meta title (omits state).

### Image Filename Base
Same components as slug, but with a 4-char hash since image filenames CAN'T have collisions:
```
sub-zero-refrigerator-defrost-repair-highfield-circle-lakewood-ranch-26c2
```

(Image filenames keep the hash because they're per-file, not per-page, and they aren't visible in URLs.)

### Default Alt Text
```
{Brand} {equipment} {problem} for appliance repair in {City}, {State}
```

---

## Examples Across Industries

### Appliance Repair (with brand)
```
/work/sub-zero-refrigerator-defrost-repair-highfield-circle-lakewood-ranch/
/work/whirlpool-dryer-not-heating-oak-avenue-bradenton/
/work/lg-washer-leaking-palm-drive-sarasota/
/work/samsung-refrigerator-ice-maker-repair-beach-road-venice/
```

### Plumbing (no brand)
```
/work/drain-cleaning-kitchen-sink-clog-highfield-circle-lakewood-ranch/
/work/water-heater-replacement-50-gallon-tank-oak-avenue-bradenton/
/work/sewer-line-repair-tree-root-removal-main-street-sarasota/
/work/toilet-installation-master-bathroom-palm-drive-venice/
/work/leak-detection-slab-leak-repair-beach-road-englewood/
```

### Pressure Washing (no brand)
```
/work/driveway-pressure-washing-oil-stain-removal-highfield-circle-lakewood-ranch/
/work/house-soft-wash-vinyl-siding-oak-avenue-bradenton/
/work/roof-cleaning-algae-removal-beach-road-englewood/
/work/pool-deck-pressure-washing-pavers-palm-drive-sarasota/
/work/concrete-sealing-driveway-restoration-main-street-venice/
```

### HVAC (with brand)
```
/work/trane-ac-not-cooling-highfield-circle-lakewood-ranch/
/work/carrier-heat-pump-replacement-oak-avenue-bradenton/
/work/goodman-furnace-installation-palm-drive-sarasota/
/work/lennox-ac-capacitor-replacement-beach-road-venice/
```

### Roofing (no brand, or brand secondary)
```
/work/roof-replacement-architectural-shingles-highfield-circle-lakewood-ranch/
/work/roof-repair-leak-detection-oak-avenue-bradenton/
/work/skylight-installation-living-room-palm-drive-sarasota/
/work/gutter-replacement-seamless-aluminum-beach-road-venice/
```

### Landscaping (no brand)
```
/work/sod-installation-st-augustine-grass-highfield-circle-lakewood-ranch/
/work/palm-tree-trimming-three-trees-oak-avenue-bradenton/
/work/mulch-installation-front-yard-palm-drive-sarasota/
/work/landscape-design-paver-walkway-beach-road-venice/
```

### Pest Control (no brand)
```
/work/termite-treatment-subterranean-inspection-highfield-circle-lakewood-ranch/
/work/rodent-removal-attic-exclusion-oak-avenue-bradenton/
/work/mosquito-treatment-yard-spray-palm-drive-sarasota/
```

### Garage Door (brand optional)
```
/work/liftmaster-garage-door-opener-replacement-highfield-circle-lakewood-ranch/
/work/garage-door-spring-replacement-broken-torsion-oak-avenue-bradenton/
/work/chamberlain-garage-door-remote-programming-palm-drive-sarasota/
```

---

## Summary

The system uses an **industry-aware, component-based slug formula** that:

1. Pulls 4-5 SEO-rich components in priority order
2. Adapts to whether the industry uses brand as a variable
3. Generates clean URLs without suffixes by default
4. Adds `-2`, `-3`, etc. ONLY on collision detection
5. Gracefully degrades when components are missing
6. Stays under 100 characters when possible
7. Drives the meta title, H1, alt text, and image filename generation from the same source data

This produces maximum URL diversity for SEO juice transfer to parent pages while keeping URLs human-readable, privacy-safe, and free of leaked business intelligence.
