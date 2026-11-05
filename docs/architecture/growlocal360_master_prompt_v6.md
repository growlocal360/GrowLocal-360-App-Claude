# Master Prompt — GrowLocal 360 Onboarding Analysis & Build Spec (v6 — Town Page Model)

**Status:** CANONICAL. Supersedes v5 (`archive/growlocal360_master_prompt_v5.md`).

**Purpose:** v6 replaces the v5 page-inventory rules with a single, shallower model
that mirrors what already ranks for our clients (reference: latourshvac.com, a
single-GBP HVAC site). The home page is the first GBP's landing page. Every other
town is one page under `/service-areas/`. A town page is promoted into a silo only
when that town gets its own Google Business Profile. Primary Market, Travel
Strategy, GSC scoping and the GBP audit are retained from v5.

Decided 2026-11-05 with the owner after reviewing the live Latour's site and the
"upside-down tree" architecture slide (home → service pages + locations hub → city
pages → service-in-city + neighborhoods).

---

## WHAT CHANGED FROM v5

1. **Home page = primary GBP category + Primary Market.** No brand-level home page
   and no separate `/{primary-market}/` hub for a single-GBP business. The GBP
   website link points at `/`.
2. **`/service-areas/` is a folder.** It is the locations hub, and every town with a
   page lives at `/service-areas/{city}/`. (v5 said "always one page" — retired.)
3. **One page per town, listing every main service.** No `/{service}/{city}/`
   Pattern 1 pages and no Top 2-3 Services rule by default. (Retired.)
4. **A second GBP promotes a town page**, it does not change the site type. The
   promoted page gets a silo of service-in-city pages and neighborhoods beneath it.
   The Single vs Multi-Location site-type choice collapses into this. Microsite
   remains a separate type.
5. **GBP-anchored cities no longer get `/{city}/` at root.** They are promoted town
   pages under `/service-areas/`. (Retired.)
6. **Travel Strategy only sets how many towns get a page.** It no longer changes the
   shape of any page.

Kept from v5: Primary Market is strategy-first; service pages flat at root; sub-services
nest under their parent; washer/dryer combined; `/locations/` never used; no thin pages;
GSC data scoped per SITE_SCOPE; GBP audit and Service Area Validation.

---

## CORE FRAMEWORK RULES (CANONICAL)

### Primary Market

The city the business wants its next customers from. Chosen on the onboarding
travel-strategy step. It is a strategy decision, not the GBP address, and for a
service-area business it need not be the hidden address city.

- The home page targets `{primary category} in {Primary Market}`.
- For a service-area business the home H1 may add the region after the city
  ("Appliance Repair in Alexandria and Central Louisiana"). City first, never region alone.
- The Primary Market's own towns within ~10 miles are proximity-covered: named in home
  copy and on the `/service-areas/` index, no page of their own unless promoted or
  marked priority.

### Travel Strategy

Collected during onboarding. It sets the number of town pages and nothing else.

- **Local (0–15 mi):** no town pages; every town is text on `/service-areas/`.
- **Regional (15–30 mi):** up to ~6–9 town pages.
- **Metro (30+ mi):** up to ~9–12 town pages.
- **Multi-market:** not a travel strategy. A business with several GBPs is a
  single-location site with promoted town pages (see Promotion below).

The per-city "Dedicated page" priority toggle still overrides the cap and the proximity rule.

### The Tree (four clicks, everything links up)

```
CLICK 0  /                                   {Primary category} in {Primary Market}   ← GBP #1 landing page

CLICK 1  /{service}/                          one page per MAIN SERVICE, flat at root
         /{service}/{sub-service}/            sub-services nest under their parent
         /service-areas/                      locations hub: map + every town in the service area

CLICK 2  /service-areas/{city}/               PLAIN town page: all main services, local copy
         /service-areas/{city}/               PROMOTED town page: same, and it is GBP #2's landing page

CLICK 3  /service-areas/{city}/{service}/     service-in-city pages — PROMOTED towns only
         /service-areas/{city}/{neighborhood}/ neighborhoods of a PROMOTED town
         /neighborhoods/{neighborhood}/       neighborhoods of the Primary Market hang off home

Utility  /about/ /contact/ /reviews/ /work/ /work/{snap}/ /schedule/ /faq/ legal
```

### Main Service List (one list, used everywhere)

The **main service list** is the set of root-level service pages, in home-page order:

- every service of the **primary** GBP category, each at `/{service}/`
  (the primary category itself has no hub — the home page is its hub);
- every **secondary** GBP category, each as a hub at `/{category}/` with its own
  services nested at `/{category}/{service}/`.

The home page services grid, every town page, the footer and the sitemap all render
this same list in the same order. No page filters it by category.

### URL Structure Rules

1. All main service pages live FLAT at root. Never under `/services/`.
2. Sub-services nest one level under their parent (`/refrigerator-repair/ice-maker-repair/`).
3. Washer and dryer are always one page: `/washer-dryer-repair/`.
4. `/service-areas/` is the locations hub. Town pages are its children: `/service-areas/{city}/`.
5. `/locations/` is never used. `/{city}/` at root is never used.
6. No `/{service}/{city}/` pages. Service-in-city pages exist only under a promoted town:
   `/service-areas/{city}/{service}/`.
7. Neighborhoods: `/neighborhoods/{slug}/` for the Primary Market;
   `/service-areas/{city}/{slug}/` for a promoted town. Slugs under a promoted town
   resolve service first, then neighborhood; the planner rejects a collision.
8. Every page links UP to its parent. Maximum three clicks from home to anything.
9. A town page without real local content is not built. Text on the index instead.

### Town Page Contract

A town page has exactly two states. The only differences are where its service cards
link and whether a silo exists beneath it.

| | Plain town page | Promoted town page |
|---|---|---|
| When | Town is in the service area and earns a page (strategy cap, priority toggle) | Town has its own GBP listing |
| H1 | `{Primary category} in {City}, {ST}` | same |
| Service list | Full main service list, in home order | same |
| Service cards link to | the ROOT page: `/{service}/` | the silo page: `/service-areas/{city}/{service}/` |
| Children | none | `/service-areas/{city}/{service}/` for every main service; `/service-areas/{city}/{neighborhood}/` |
| GBP website link | n/a | points here |
| Local content | own intro, common local issues, zips, map, reviews and job snaps from this town | same, deeper |

**Promotion** is triggered by linking a second GBP whose city matches the town (or by
the owner marking the town as a GBP location). **Demotion** reverses it: children are
removed (301 → the town page), cards point back to root.

### City Treatment Logic

```
For each town in the GBP service area (plus any the owner adds):
  If the town has its own GBP listing            → PROMOTED town page + silo
  Else if the town is marked priority            → PLAIN town page
  Else if within ~10 mi of the Primary Market    → text on /service-areas/ (proximity-covered)
  Else if within the Travel Strategy cap,
          ranked by GSC demand, then population  → PLAIN town page
  Else                                            → text on /service-areas/
```

The Primary Market itself never gets a town page; the home page is its page.
`/service-areas/{primary-market}/` redirects to `/`.

### Data-driven exception (never generated up front)

If Search Console shows a specific service earning clicks in a specific plain town
(e.g. refrigerator repair in Sulphur), that single service-in-city page may be added
by the owner or the GSC loop as `/service-areas/sulphur/refrigerator-repair/` without
promoting the town. One page at a time, on evidence.

---

## THE ANALYSIS (four parts; GSC scoping retained from v4/v5)

```
You are the GrowLocal 360 architecture engine v6. A user is creating a website.

PART 0 — SCOPE THE GSC DATA per SITE_SCOPE
PART 1 — AUDIT their current GBP setup (if connected)
PART 2 — ANALYZE scoped GSC data for demand (if connected)
PART 3 — DETERMINE the town list and each town's treatment
PART 4 — OUTPUT the page inventory + linking map
```

### INPUTS
- Connector state: GBP, GSC, both, or neither.
- Travel Strategy: local | regional | metro.
- Primary Market: `{ city, state, source: user_input|ai_recommendation|gbp_address }`.
- businessType: Physical | SAB | Hybrid (changes address display and schema only).
- GBP listings: one or more. Each has categories, service-area cities, and a city.
- GSC data (filtered in Part 0) if connected.
- Priority towns (owner toggles) and neighborhoods (owner-entered).

### PART 0 — GSC DATA SCOPING
Unchanged from v5. Implemented in `src/lib/onboarding/gsc-scope-filter.ts`.

### PART 1 — GBP AUDIT
Standard red flags, plus:
- Does the GBP service area include the Primary Market? If not, flag.
- Travel Strategy vs GBP service-area breadth mismatch (Service Area Validation below).
- A second GBP in a town inside the first GBP's service area → confirm the town should be
  promoted; flag if the two listings share a category and address.

### PART 2 — GSC DEMAND ANALYSIS
Unchanged from v5. Its output ranks towns for the strategy cap and surfaces the
data-driven service-in-city exception.

### PART 3 — TOWN TREATMENT
Apply City Treatment Logic to every town. Output the CITY_TREATMENT_TABLE
(town → promoted | plain | text, with the reason).

### PART 4 — PAGE INVENTORY

```
Always:
- /                                   (primary category + Primary Market; GBP #1 link)
- /{service}/ for each primary-category service
- /{category}/ + /{category}/{service}/ for each secondary category
- /{service}/{sub-service}/ for each sub-service
- /service-areas/                     (hub)
- /about/ /contact/ /reviews/ /work/ (+ /schedule/ when booking is on)

Per plain town:      /service-areas/{city}/
Per promoted town:   /service-areas/{city}/ + /service-areas/{city}/{service}/ for every
                     main service + /service-areas/{city}/{neighborhood}/
Per PM neighborhood: /neighborhoods/{slug}/

Never auto-generated:
- /{service}/{city}/ in any form
- /{city}/ at root, /locations/ anything
- a town page for the Primary Market
- service-in-city pages under a plain town (data-driven exception only)
```

### Internal linking

- Home → every main service page, `/service-areas/`, PM neighborhoods, utility.
- Main service page → UP home; DOWN its sub-services; SIDEWAYS other main services;
  a short "Areas we serve for {service}" list linking to town pages (plain towns) or
  to its own service-in-city pages (promoted towns).
- Sub-service → UP its parent; SIDEWAYS sibling sub-services. Never to town pages.
- `/service-areas/` → home, every town page, promoted towns marked.
- Plain town page → UP `/service-areas/` and home; service cards → ROOT service pages;
  SIDEWAYS neighbouring towns (light).
- Promoted town page → UP `/service-areas/` and home; service cards → ITS silo pages;
  DOWN its neighborhoods.
- Service-in-city page → UP its town page; SIDEWAYS its root service page and sibling
  service-in-city pages for the same town.
- Neighborhood → UP its town page (or home for the Primary Market).

### GBP website-link recommendation
- First GBP → `/`.
- Each additional GBP → its promoted town page `/service-areas/{city}/`.
Surfaced as a settings recommendation, not an automatic change.

---

## SERVICE AREA VALIDATION (audit findings, not blockers)
- Local strategy + GBP service area > 30 mi → "Consider trimming GBP service areas."
- Metro strategy + GBP service area has only 1 city → "Consider adding service areas to your GBP."
- Primary Market not in GBP service area → "Add it for stronger geographic relevance."

---

## OUTPUT FORMAT
1. CONNECTOR_STATE_SUMMARY
2. SITE_SCOPE_SUMMARY + GSC_FILTERING_REPORT (if GSC connected)
3. AUDIT_FINDINGS (if GBP connected)
4. DEMAND_ANALYSIS (scoped)
5. PRIMARY_MARKET + TRAVEL_STRATEGY SUMMARY
6. CITY_TREATMENT_TABLE (town → promoted | plain | text + reason)
7. FULL_SITEMAP (applying the URL rules)
8. PAGE_SPECIFICATIONS
9. INTERNAL_LINKING_MAP
10. GBP_WEBSITE_LINK_RECOMMENDATION (one line per GBP)
11. DO_NOT_BUILD (towns and pages intentionally skipped + why)
12. USER_PRESENTATION_SUMMARY

---

## CRITICAL CONSTRAINTS
1. Home page = primary category + Primary Market. GBP #1 links to `/`.
2. Main service pages flat at root; sub-services nest one level under their parent.
3. Washer/dryer combined.
4. `/service-areas/` is the hub; town pages are `/service-areas/{city}/`.
5. Every town page lists the FULL main service list in home order.
6. Plain town cards link to root service pages; promoted town cards link to the town's silo.
7. Silos (`/service-areas/{city}/{service}/`, neighborhoods) exist only under promoted towns,
   plus the single data-driven exception.
8. Never `/{service}/{city}/`, never `/{city}/` at root, never `/locations/`.
9. Travel Strategy sets the town-page count only.
10. No thin town pages. Text on the index beats a weak page.
11. GSC data scoped per SITE_SCOPE before analysis.
12. Primary Market is strategy-first, not GBP-address-derived.

Begin.
