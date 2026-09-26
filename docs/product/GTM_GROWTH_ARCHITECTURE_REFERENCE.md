# GTM & Growth Architecture — Future Activation Reference

> **Status: ARCHIVED — NOT ACTIVATED.** This is the consolidated go-to-market and
> marketing architecture reference. It documents *what to deploy when public
> acquisition and outreach are activated*, and — critically — the segmentation
> rules in §4 that govern which mechanics are used (and avoided) per target
> segment. Nothing in this document authorizes live outreach, tracking, or
> automated acquisition motion until explicitly activated.
>
> **Activation gate:** ABM mechanics (§3) deploy **strictly if/when** approaching
> high-value entities: boutique record labels, publishing administrators, sync
> libraries, or management agencies. PLG segments (independent producers/artists)
> must never be exposed to reverse-DNS tracking, outbound cadences, or
> enterprise remarketing.
>
> **Companion doctrine:** brand voice and positioning rules live in
> `docs/product/PRODUCT_COPYWRITING_BRIEF.md` and
> `docs/product/JEV_NATIVE_POSITIONING_AND_COPY_PLAYBOOK.md`. All public-facing
> copy generated under this GTM plan must comply with those rules
> (lowercase `indii` / `indii.music`, no name-dropping, no "AI"/model-tech jargon,
> "your team" language).

---

## 1. Answer Engine Optimization (AEO) & Semantic Search

**Core concept:** Instead of optimizing purely for traditional 10-blue-links
Google SEO, structure site content so LLM search agents (Perplexity, ChatGPT
Search, Google AI Overviews) parse, trust, and cite your documentation and
comparison points.

**Implementation mechanics:**

- **Structured JSON-LD Schema:** Embed machine-readable entity schemas for all
  public-facing explainer pages (e.g., clear definitions of DDEX ERN feeds,
  split-sheet mechanics, ISRC vs. ISWC workflows).
- **Narrow-Concession Comparison Pages:** Build clean, non-hyperbolic comparison
  landing pages targeting queries like "best post-mastering admin tools,"
  "split sheet software vs spreadsheets," and "DDEX metadata management
  alternatives." State exact functional boundaries candidly; answer engines
  prioritize well-structured, objective feature comparisons over generic
  marketing copy.
- **FAQ & Schema Microdata:** Mark up common operational questions with
  structured microdata to increase direct-citation rate in conversational search
  queries.

## 2. Autonomous Technical Web Operations

**Core concept:** Letting background code scripts and agents handle routine
technical maintenance so marketing pages never decay while product development
takes priority.

**Implementation mechanics:**

- **Automated Web Vitals & Metadata Auditing:** Run automated background checks
  on the public site to patch broken Open Graph (OG) tags, verify XML sitemaps,
  flag 404 routes, and monitor load performance (Core Web Vitals).
- **Content Gap & Query Mining:** Periodically inspect Google Search Console API
  feeds to locate technical music business terms that are driving impressions
  but lack dedicated documentation, then auto-generate content briefs.

## 3. High-Value B2B Account-Based Marketing (ABM) Framework

> **Gate:** To be activated strictly if/when approaching high-value entities:
> boutique record labels, publishing administrators, sync libraries, or
> management agencies.

**Core concept:** Targeted inbound account tracking and tailored outbound
cadences rather than broad-stroke consumer ad spend.

**Implementation mechanics:**

- **Corporate IP Deanonymization:** Use reverse-DNS lookup exclusively to
  identify traffic coming from corporate VPNs/networks belonging to known music
  groups, PRO offices, or major distribution houses.
- **Intent-Triggered Outreach:** Trigger internal review alerts when traffic
  spikes on specific enterprise or catalog workflow pages, staging pre-drafted
  direct outreach for **human sign-off** rather than sending automated spam.
- **Custom Account Landing Endpoints:** Programmatically generate private or
  semi-private onboarding briefs addressing specific institutional friction
  points (e.g., high-volume back-catalog cleanup or DDEX compliance
  bottlenecks).

## 4. GTM Target Segmentation Rules (When to Deploy What)

| Target Segment | Acquisition Motion | Tools & Mechanics to Prioritize | Mechanics to Avoid |
|---|---|---|---|
| Independent Producers / Artists | Product-Led Growth (PLG), Technical Authority, Community | AEO/SEO guides on music rights logistics, clear tooling utility, transparent trial access, Word-of-Mouth. | Reverse-DNS IP tracking, outbound sales cadences, aggressive enterprise remarketing. |
| Boutique Labels & Managers | Relationship / Hybrid Inbound | Technical comparison pages, demo workflows solving audit/split liabilities, targeted LinkedIn/email follow-ups. | Broad consumer social ad campaigns. |
| Enterprise / Institutional Catalogs | High-Touch ABM | Dedicated compliance specs (DDEX, audit trails, multi-party cryptographic signing), custom migration demos. | Self-serve low-tier pricing funnels. |
