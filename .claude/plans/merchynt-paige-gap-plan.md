# GrowLocal 360 vs. Merchynt "Paige" — gap analysis and build plan

_Written 2026-10-31. Source: https://www.merchynt.com/white-label-ai-local-seo-software-for-agencies, cross-checked against the GrowLocal codebase on `main`._

## 1. What Paige is

Paige is a white-label "AI local SEO employee" sold to agencies at **$99/month per GBP location** (wholesale), with agencies told to resell at $299–$599. Citations are a $40/location add-on. 3-day trial, no contract. Their pitch is fulfillment-in-a-box: the agency connects a client's Google Business Profile once, answers a 20-minute questionnaire, picks "autopilot" or "approve first", and Paige does the recurring work and sends the monthly report under the agency's brand.

Their 81 features group into: GBP optimization and posting, reputation, rank/AI-visibility tracking, social and video distribution, image geotagging, an "AI account manager" that emails clients, website creation + widgets, white-label, citations, and integrations (MCP, Zapier, CompanyCam, webhooks).

The important strategic read: **Paige's website is a throwaway; the GBP is the product.** GrowLocal is the inverse. The site, the booking engine and the lead flow are the product, and GBP is a channel feeding it. That is the thing to lean into, not away from.

## 2. Where GrowLocal already matches or beats Paige

| Paige feature | GrowLocal today | Verdict |
|---|---|---|
| Multi-page SEO website, hosted, custom domain | Full generator: Primary Market model, city hubs, service pages, sub-services, brands, neighborhoods, legal pages, sitemap, robots, llms.txt, JSON-LD incl. sameAs, per-site favicon, two templates | **Ahead by a mile** |
| "Text-based editing" | Per-page and per-service editors, hero images, settings-driven copy | Ahead |
| Website widgets (reviews, photos, posts, schema, FAQ) | Reviews page, /work pages, FAQ, schema on our own sites; external sites get webhook push + REST API `v1/job-snaps` | Parity for our sites; **gap for third-party sites** (see §3h) |
| Geotagged photo uploads to GBP | Job Snaps: EXIF GPS extraction, AI analysis, title/description, publish to GBP post + website | Ahead on photos-with-story; **gap on scheduled photo drip** |
| Google posts | Job Snap posts and availability posts (cron every 30 min, Book/Call/Learn more CTA) | Partial; **gap on general AI-written weekly posts** |
| Rank tracking | GSC integration (queries, clicks, impressions, position) per site, synced on demand | Different data: ours is real traffic, theirs is grid snapshots. **Gap on Maps heatmap + AI visibility** |
| Request reviews | Nothing | **Gap** |
| Reply to reviews | We import and display replies; we never write them | **Gap** |
| Social posting (FB/IG/LinkedIn) | Nothing built. Job Snaps "Max" plan copy already promises "Push to Facebook, Instagram, TikTok" | **Gap, and a promise we're not keeping** |
| Video (YouTube/TikTok) | Planned only (`project_video_generation` memory) | Gap, low priority |
| AI account manager emails | Lead/booking notifications only | **Gap** |
| Monthly white-label report | Nothing | **Gap** |
| White-label (domain, branding, emails) | Nothing. Dashboard is GrowLocal-branded | **Gap** |
| Competitor analysis | `places/nearby` exists for cities; no competitor tracking | Gap |
| Citations | Nothing | Gap (buy, don't build) |
| Integrations | HighLevel delivery, outbound webhooks, API keys + REST API, Twilio SMS, Resend email, Stripe | Ahead on CRM; **gap on Zapier/MCP/CompanyCam** |
| Online booking with live availability | Full scheduling engine: staff, areas, blocks, overrides, approvals, SMS, /book page, hero availability badge, GBP availability posts | **Paige has nothing here. Our biggest differentiator.** |
| Lead capture | Niche-aware multi-step form, address autocomplete, coverage check, lead inbox, CRM delivery | Paige has nothing. Differentiator. |

Net: we are strong on everything that turns a visitor into a customer. We are weak on everything that happens on Google and social *between* site builds, and on the agency-facing wrapper (white-label, reports, client comms) that makes it resellable.

## 3. The gaps, with how to build each on what exists

Effort: S = days, M = 1–2 weeks, L = 3+ weeks.

### a. Review requests (M)
- After an appointment is marked complete, or a Job Snap is published with a customer phone/email, queue a review request. Send via Twilio SMS (already wired) and Resend email. Follow-up once after 3 days if no review appears in the imported set.
- Per-site review link: `https://search.google.com/local/writereview?placeid=…` built from `locations.gbp_place_id` (we already resolve this for the Maps sameAs URL). Add a QR code generator for print.
- Settings: on/off, delay, templates, autopilot vs. manual "send" button on the appointment and lead rows.
- New tables: `review_requests` (site, contact, channel, sent_at, followed_up_at, status). Inngest function for delays.

### b. AI review replies (M)
- GBP API v4 has `PUT accounts/*/locations/*/reviews/*/reply`. Add `replyToReview()` to `GBPClient`.
- Nightly Inngest cron: import new reviews (we already fetch during content gen; make it a standing cron), draft a reply with Claude using site voice + WRITING_STANDARDS, then either post (autopilot) or park in an approval queue.
- Negative reviews (1–2 stars) always go to the queue and trigger an owner alert, never autopilot.
- Approval queue UI is shared with (c) and (e) below. Build once.

### c. GBP post autopilot (M)
- Weekly cadence per site. Sources rotate: a service page excerpt, a service-area angle, a recent Job Snap, a 5-star review turned into a post, a seasonal tip. Claude writes, approval queue or autopilot publishes through the existing `createLocalPost()`.
- Photo drip: from a site's uploaded photo pool (Job Snaps media + a new "photo library" upload), schedule one GBP media upload per N days. Add `media.create` to `GBPClient`. Geotag from EXIF when present, else from the location.
- Settings: cadence, autopilot flag, topics to avoid.

### d. Approval queue + per-site autopilot switch (S, prerequisite for a–c)
- `pending_actions` table: type (review_reply | gbp_post | social_post | photo), payload, site, status, created_by (system), decided_by, decided_at.
- Dashboard page `/dashboard/sites/[siteId]/queue` plus a badge count on the site card. One click approve/edit/reject.
- A site-level `automation_mode: 'autopilot' | 'approve'`. This single switch is the "20-minute onboarding, then hands off" story Paige sells.

### e. Social distribution (L, start the Meta app review now)
- Facebook Page + Instagram Business via Meta Graph API, LinkedIn Company Page via Marketing API. Store connections per site in `social_connections` with refresh handling.
- Every Job Snap publish and every GBP post gets optional fan-out to connected channels, through the same queue.
- Meta app review takes weeks and needs a working demo video and privacy policy; file it in week one of this track regardless of build order.
- TikTok/YouTube wait for the video track (§3j).

### f. AI account manager (M)
- Weekly digest email per site, under the agency's name once white-label lands: what was published, reviews gained and replied to, leads and bookings, GSC movement, items waiting for approval, "we need 5 fresh photos" nudges.
- Profile-change alerts: diff the GBP location nightly (hours, phone, categories, address) and alert on changes.
- All Inngest crons + Resend templates. Ties into the queue (d) and reports (g).

### g. Monthly white-label report (M)
- Data we already have or can get free: GSC clicks/impressions/queries, GBP Performance API (calls, website clicks, direction requests, searches), leads and bookings from our tables, posts/snaps/reviews published.
- Render as a branded HTML page on a signed URL plus PDF (use `next/og` style rendering or Puppeteer in an Inngest step), emailed on the 1st.
- Enable the GBP Performance API on the Google Cloud project; same OAuth scope we already hold.
- This is the retention lever. Paige's whole sales motion is "agency forwards the report, client stays."

### h. Embeddable widgets for external sites (S–M)
- `<script src="https://{slug}.growlocal360.com/embed.js" data-widget="reviews|work|posts|book">`. Renders from our public JSON endpoints, which mostly exist (`public/work`, reviews via site data, `public/availability`).
- The **booking widget** is the one Paige cannot offer. Lead with it.
- Also emit the LocalBusiness + Review schema into the host page.

### i. Rank and AI-visibility tracking (L, has a recurring cost)
- Maps grid heatmap: 5×5 or 7×7 points around the primary market, up to 10 keywords, monthly (weekly on higher plans). Needs a SERP provider. DataForSEO Maps SERP is roughly $0.002–0.003 per point, so a 7×7 grid × 10 keywords is about $1.50/site/month. Cheap enough to include.
- AI visibility: once a month, ask each of ChatGPT, Claude, Gemini, Perplexity "best {category} in {city}" variants and record whether the business is named and in what position. Store raw answers for the report.
- Before/after heatmaps become the hero image of the monthly report and the trial-conversion moment, exactly as Paige uses them.
- Competitor momentum (Paige's "competitor analysis") falls out of this: the grid results name the competitors; track their review count and rating monthly via Places Details.

### j. Video automation (L, later)
- Job Snap photos → 15–30 second slideshow with captions and music → YouTube Shorts, TikTok, GBP. Existing memory `project_video_generation` covers approach. Depends on (e) for distribution.

### k. Citations (S to integrate, buy don't build)
- Resell BrightLocal Citation Builder or Whitespark via API as a $40/location add-on, matching Paige's price. Our job is the order form and status display, not directory submission.

### l. Integrations parity (S each)
- Zapier app: triggers for new lead, new booking, new review, snap published. Our webhook dispatcher already emits these; Zapier is a thin wrapper.
- MCP server exposing: list sites, create job snap, get leads, get availability, draft GBP post. Agencies and owners can then drive GrowLocal from Claude or ChatGPT. Small, and it is a marketing story in itself.
- CompanyCam import → Job Snaps. Their API is straightforward; photos arrive with GPS and project names, which is exactly a snap.

### m. White-label agency layer (L)
- Org hierarchy: `agency` org owns child client orgs. We already have organizations, invitations and roles; add `parent_organization_id` and an agency role.
- Agency branding record: name, logo, colors, support email, sending domain (Resend domain verification per agency), dashboard custom domain (`app.{agency}.com` CNAME to us, same pattern as client site custom domains).
- Client-user role that sees only their own sites, no GrowLocal branding, no billing.
- All outbound email and the monthly report read from agency branding.
- Billing: agency pays per location, sets its own client prices outside our system (Paige's model). A Stripe "agency" plan with metered locations.

## 4. Where to go past Paige (the positioning)

Paige's value stops at the Google listing. Everything after the click is the client's problem. GrowLocal owns that half:

1. **Live booking everywhere.** Availability on the site, in the GBP post, in the embed widget, soon in the social post. "Book a 2–4 PM slot Tuesday" beats "Learn more" every time. No competitor on their comparison list does this.
2. **Lead-to-CRM in one step.** Niche-aware forms, address and coverage checks, HighLevel/webhook delivery, SMS alerts.
3. **The content flywheel.** A technician's photo becomes a Job Snap, which becomes a /work page, which enriches the service and city pages it is attached to, which becomes a GBP post and a social post, which shows up in the monthly report. Paige's content is generic; ours is the client's actual jobs.
4. **GSC feedback loop** (already planned, `project_gsc_feedback_loop`): real ranking data regenerates the pages that are moving. Paige tracks rankings; we act on them.
5. **Primary Market strategy.** A deliberate "where do you want your next customers" model instead of radiating generic city pages.

Suggested line for the marketing site: _"Paige optimizes your Google profile. GrowLocal optimizes your Google profile and then books the job."_

## 5. Sequencing

**Phase 1 (next 4–6 weeks): "between builds" automation**
d. approval queue + autopilot switch → b. AI review replies → a. review requests → c. GBP post autopilot + photo drip.
Also: file the Meta app review (e) and enable the GBP Performance API (g) now, since both have lead time.

**Phase 2 (following 4–6 weeks): the agency wrapper**
g. monthly report → f. account-manager digest and alerts → m. white-label layer (org hierarchy, branding, sending domain, dashboard domain) → agency Stripe plan.

**Phase 3: proof and reach**
i. Maps heatmap + AI visibility (the trial-conversion moment) → e. Facebook/Instagram/LinkedIn fan-out → h. embed widgets with booking.

**Phase 4: breadth**
l. Zapier, MCP, CompanyCam → k. citations resale → j. video.

Phase 1 and 2 use plumbing that already exists (GBP client, Inngest, Twilio, Resend, Claude, orgs). Nothing in them needs a new vendor.

## 6. Prerequisites and costs to line up

- Google Cloud: enable Business Profile Performance API; confirm `business.manage` scope covers review replies and media create (it does).
- Meta developer app with `pages_manage_posts`, `instagram_content_publish`; app review with demo video. Start immediately.
- LinkedIn Marketing Developer Platform access (also has an approval step).
- SERP data: DataForSEO or SerpApi account; budget roughly $1–3 per site per month at the cadence above.
- Resend: per-agency domain verification for white-label sending.
- Puppeteer or a PDF service for reports if HTML-only is not enough.

## 7. Packaging thoughts

Paige is $99/location wholesale with a suggested $299–599 resale. Our current plans are $147/$297/$497 direct. An agency tier priced per location, with white-label and the report included, lands naturally at or just above Paige's $99 because we include booking and lead capture that they cannot. Citations as a $40 add-on keeps the comparison table clean.

## 8. Decisions needed

1. ~~Agency wholesale first, or direct-to-owner first?~~ **Decided 2026-10-31: direct first.** White-label (§3m) drops to the end of Phase 2; the monthly report ships owner-facing first and gets re-skinned for agencies later.
2. Autopilot default: on or approve-first for new sites?
3. SERP provider and tracking cadence per plan.
4. Build social fan-out for Job Snaps first (keeps the Max plan promise) or for GBP posts first?
5. Citations: resell BrightLocal, Whitespark, or skip.
